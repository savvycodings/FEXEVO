import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { ThemeContext } from "../context";
import { authClient } from "../lib/auth-client";
import { Header } from "../components";
import { SignUpDraft } from "./SignUp";
import Ionicons from "@expo/vector-icons/Ionicons";
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from "react-native-svg";

const COURT_IMAGE = require("../../assets/court.png");
const BALL_IMAGE = require("../../assets/ball.png");

const LEVEL_OPTIONS = [
  "Beginner",
  "High Beginner",
  "Low Intermediate",
  "Intermediate",
  "High Intermediate",
  "Low Advanced",
  "Advanced",
  "High Advanced",
  "Competition/Open",
  "Other",
];

const RANKING_ORG_OPTIONS = [
  "Playtomic",
  "Redpadel",
  "USPA",
  "Spain Federation",
  "Play by Point",
];

type ProfileSetupProps = {
  onComplete?: () => void;
  signUpDraft?: SignUpDraft | null;
  mode?: "onboarding" | "edit";
  onBack?: () => void;
};

export function ProfileSetup({ onComplete, signUpDraft, mode = "onboarding", onBack }: ProfileSetupProps) {
  const { theme } = useContext(ThemeContext);
  const styles = getStyles(theme);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState(signUpDraft?.name ?? "");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [courtSide, setCourtSide] = useState<"left" | "right" | null>(null);
  const [hasRanking, setHasRanking] = useState<boolean | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [rankingOrg, setRankingOrg] = useState<string | null>(null);
  const [rankingValue, setRankingValue] = useState("");

  const canContinueStep1 = !!courtSide;
  const canContinueStep2 =
    hasRanking === false
      ? !!level
      : hasRanking === true
      ? !!rankingOrg && rankingValue.trim().length > 0
      : false;

  useEffect(() => {
    if (signUpDraft) {
      setDisplayName(signUpDraft.name);
      setLoading(false);
      return;
    }
    let mounted = true;
    async function loadMe() {
      setLoading(true);
      const res = await authClient.$fetch("/profile/me", { method: "GET" }).catch(() => null);
      const body: any = (res as any)?.data ?? res;
      if (!mounted || !body) {
        setLoading(false);
        return;
      }
      setDisplayName(body?.user?.name || "");
      setAvatarUri(
        typeof body?.user?.image === "string" && body.user.image.length > 0
          ? body.user.image
          : null
      );
      if (body?.profile?.courtSide === "left" || body?.profile?.courtSide === "right") {
        setCourtSide(body.profile.courtSide);
      }
      if (typeof body?.profile?.hasRanking === "boolean") {
        setHasRanking(body.profile.hasRanking);
      }
      if (body?.profile?.level) setLevel(body.profile.level);
      if (body?.profile?.rankingOrg) setRankingOrg(body.profile.rankingOrg);
      if (body?.profile?.rankingValue) setRankingValue(body.profile.rankingValue);
      setLoading(false);
    }
    void loadMe();
    return () => {
      mounted = false;
    };
  }, [signUpDraft]);

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setAvatarUri(result.assets[0].uri);
  }

  async function saveProfile() {
    if (!canContinueStep2 || !courtSide) return;
    setSaving(true);

    async function ensureSessionReady(): Promise<boolean> {
      for (let i = 0; i < 5; i++) {
        const sessionResult = await authClient.getSession().catch(() => null);
        const sessionData: any = (sessionResult as any)?.data ?? sessionResult;
        if (sessionData?.user?.id) return true;
        await new Promise((r) => setTimeout(r, 200));
      }
      return false;
    }

    const hasSessionBefore = await ensureSessionReady();

    if (!hasSessionBefore && signUpDraft) {
      const { error } = await authClient.signUp.email({
        name: displayName.trim() || signUpDraft.name,
        email: signUpDraft.email.trim(),
        password: signUpDraft.password,
      });
      if (error) {
        // Common in retries: account may already exist from a prior attempt.
        // Fall back to sign-in so final-step onboarding can continue.
        const code = String((error as any)?.code || "").toUpperCase();
        const msg = String(error.message || "");
        const looksLikeExistingUser =
          code.includes("USER_ALREADY_EXISTS") ||
          code.includes("ALREADY_EXISTS") ||
          msg.toLowerCase().includes("already exists");

        if (!looksLikeExistingUser) {
          setSaving(false);
          Alert.alert("Sign up failed", error.message || "Could not create account.");
          return;
        }

        const signInRes = await authClient.signIn.email({
          email: signUpDraft.email.trim(),
          password: signUpDraft.password,
        });
        if (signInRes?.error) {
          setSaving(false);
          Alert.alert(
            "Account exists",
            "This email already exists and password did not match. Try signing in."
          );
          return;
        }
      }

      const hasSessionAfterAuth = await ensureSessionReady();
      if (!hasSessionAfterAuth) {
        setSaving(false);
        Alert.alert("Session error", "Could not establish a session. Please try again.");
        return;
      }
    }

    const form = new FormData();
    form.append("courtSide", courtSide);
    form.append("hasRanking", String(!!hasRanking));
    if (level) form.append("level", level);
    if (rankingOrg) form.append("rankingOrg", rankingOrg);
    if (rankingValue.trim()) form.append("rankingValue", rankingValue.trim());
    if (displayName.trim()) form.append("name", displayName.trim());
    if (avatarUri) {
      if (Platform.OS === "web") {
        try {
          const r = await fetch(avatarUri);
          const blob = await r.blob();
          const file = new File([blob], "avatar.jpg", { type: blob.type || "image/jpeg" });
          // @ts-ignore web file append
          form.append("avatar", file);
        } catch {
          // ignore avatar upload if web blob conversion fails
        }
      } else {
        // @ts-ignore React Native FormData file type
        form.append("avatar", { uri: avatarUri, name: "avatar.jpg", type: "image/jpeg" });
      }
    }

    const res = await authClient
      .$fetch<{ ok?: boolean; error?: string }>("/profile/setup", {
        method: "POST",
        body: form,
      })
      .catch((err) => ({ error: err?.message || "Failed to save profile" } as any));

    const body = ((res as any)?.data ?? res) as { ok?: boolean; error?: string };
    setSaving(false);

    if (!body?.ok) {
      Alert.alert("Setup failed", body?.error || "Could not save your profile setup.");
      return;
    }

    onComplete?.();
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <Svg pointerEvents="none" style={styles.heroGlow}>
          <Defs>
            <SvgRadialGradient
              id="profileSetupRadialBgLoading"
              cx="50%"
              cy="-30%"
              rx="120%"
              ry="95%"
            >
              <Stop offset="0%" stopColor="#071D47" stopOpacity={1} />
              <Stop offset="100%" stopColor="#071D47" stopOpacity={0} />
            </SvgRadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#profileSetupRadialBgLoading)" />
        </Svg>
        <Header />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#00BBFF" />
        </View>
      </View>
    );
  }

  const onboardingStep = step === 1 ? 2 : 3;
  const isEditMode = mode === "edit";

  return (
    <View style={styles.screen}>
      <Svg pointerEvents="none" style={styles.heroGlow}>
        <Defs>
          <SvgRadialGradient
            id="profileSetupRadialBg"
            cx="50%"
            cy="-30%"
            rx="120%"
            ry="95%"
          >
            <Stop offset="0%" stopColor="#071D47" stopOpacity={1} />
            <Stop offset="100%" stopColor="#071D47" stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#profileSetupRadialBg)" />
      </Svg>
      <Header />
      {!isEditMode ? (
        <View style={styles.progressSection}>
          <View style={styles.progressWrap}>
            {[1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.progressSegment, i <= onboardingStep && styles.progressSegmentActive]}
              />
            ))}
          </View>
          <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.stepTitle}>
          {step === 1 ? "Set your court side." : "Set ranking and level."}
          </Text>
        </View>
      ) : (
        <View style={styles.progressSection}>
          <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.stepTitle}>
            Set your profile.
          </Text>
        </View>
      )}
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {!isEditMode ? (
          <>
            <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.title}>
              Complete your profile
            </Text>
            <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.subtitle}>
              This is part of your sign-up onboarding flow.
            </Text>
          </>
        ) : null}

        <View style={styles.avatarRow}>
          <TouchableOpacity style={styles.avatarCircle} onPress={pickAvatar} activeOpacity={0.85}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarInitial}>{(displayName || "U").slice(0, 1).toUpperCase()}</Text>
            )}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text allowFontScaling={false} style={styles.inputLabel}>Name</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={theme.mutedForegroundColor}
            />
          </View>
        </View>

        {step === 1 && (
          <View style={styles.card}>
          <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.cardTitle}>
            What side of court do you play?
          </Text>
          <View style={styles.row}>
            <ChoicePill
              label="Left"
              active={courtSide === "left"}
              onPress={() => setCourtSide("left")}
              styles={styles}
            />
            <ChoicePill
              label="Right"
              active={courtSide === "right"}
              onPress={() => setCourtSide("right")}
              styles={styles}
            />
          </View>
          <View style={styles.courtWrap}>
            <View style={styles.courtImageArea}>
              <Image source={COURT_IMAGE} style={styles.courtImage} resizeMode="contain" />
              {courtSide && (
                <Image
                  source={BALL_IMAGE}
                  style={[
                    styles.courtBall,
                    courtSide === "left" ? styles.courtBallLeft : styles.courtBallRight,
                  ]}
                  resizeMode="contain"
                />
              )}
            </View>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              activeOpacity={0.85}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#00BBFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryOuter, { flex: 1 }, !canContinueStep1 && { opacity: 0.45 }]}
              onPress={() => setStep(2)}
              disabled={!canContinueStep1}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#0022FF", "#00BBFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryInner}
              >
                <Text allowFontScaling={false} style={styles.primaryText}>Set your Ranking</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.card}>
          <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.cardTitle}>Set your Ranking</Text>
          <Text allowFontScaling={false} style={styles.cardSub}>Do you have a ranking rating?</Text>
          <View style={styles.row}>
            <ChoicePill
              label="No"
              active={hasRanking === false}
              onPress={() => {
                setHasRanking(false);
                setRankingOrg(null);
                setRankingValue("");
              }}
              styles={styles}
            />
            <ChoicePill
              label="Yes"
              active={hasRanking === true}
              onPress={() => setHasRanking(true)}
              styles={styles}
            />
          </View>

          {hasRanking === false && (
            <View style={{ gap: 8, marginTop: 12 }}>
              <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.cardTitle}>Set your Level</Text>
              {LEVEL_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.levelOption, level === opt && styles.levelOptionActive]}
                  onPress={() => setLevel(opt)}
                  activeOpacity={0.85}
                >
                  <Text allowFontScaling={false} style={[styles.levelText, level === opt && styles.levelTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {hasRanking === true && (
            <View style={{ gap: 10, marginTop: 12 }}>
              <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.cardTitle}>Choose ranking source</Text>
              <View style={styles.chipWrap}>
                {RANKING_ORG_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.chip, rankingOrg === opt && styles.chipActive]}
                    onPress={() => setRankingOrg(opt)}
                    activeOpacity={0.85}
                  >
                    <Text allowFontScaling={false} style={[styles.chipText, rankingOrg === opt && styles.chipTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                value={rankingValue}
                onChangeText={setRankingValue}
                style={styles.input}
                placeholder="Please put your rating"
                placeholderTextColor={theme.mutedForegroundColor}
              />
            </View>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setStep(1);
              }}
              activeOpacity={0.85}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#00BBFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryOuter, { flex: 1 }, (!canContinueStep2 || saving) && { opacity: 0.45 }]}
              onPress={saveProfile}
              disabled={!canContinueStep2 || saving}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={isEditMode ? ["#00BBFF", "#0022FF"] : ["#0022FF", "#00BBFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryInner}
              >
                <Text allowFontScaling={false} style={styles.primaryText}>
                  {saving ? "Saving..." : isEditMode ? "Done" : "Finish Setup"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ChoicePill({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: any;
}) {
  return (
    <TouchableOpacity
      style={[styles.choicePill, active && styles.choicePillActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text allowFontScaling={false} style={[styles.choiceText, active && styles.choiceTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  styles,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  styles: any;
}) {
  return (
    <TouchableOpacity
      style={[styles.primaryOuter, disabled && { opacity: 0.45 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={["#0022FF", "#00BBFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryInner}
      >
        <Text allowFontScaling={false} style={styles.primaryText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function getStyles(theme: any) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
    },
    container: { flex: 1, backgroundColor: theme.backgroundColor },
    content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40, gap: 10 },
    loadingWrap: { flex: 1, backgroundColor: theme.backgroundColor, alignItems: "center", justifyContent: "center" },
    progressSection: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 8,
    },
    progressWrap: { flexDirection: "row", gap: 8, marginBottom: 12 },
    progressSegment: {
      flex: 1,
      height: 6,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    progressSegmentActive: { backgroundColor: "#00BBFF" },
    stepTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: theme.textColor,
      marginBottom: 4,
    },
    heroGlow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 430,
      opacity: 1,
    },
    title: { fontFamily: theme.semiBoldFont, fontSize: 24, color: "#fff" },
    subtitle: { fontFamily: theme.regularFont, fontSize: 13, color: "rgba(255,255,255,0.72)" },
    avatarRow: { flexDirection: "row", gap: 12, alignItems: "center", marginTop: 4 },
    avatarCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: "rgba(0, 94, 255, 0.35)",
      borderWidth: 1,
      borderColor: "rgba(0, 134, 255, 0.45)",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImage: { width: 64, height: 64 },
    avatarInitial: { color: "#fff", fontFamily: theme.semiBoldFont, fontSize: 20 },
    inputLabel: { color: "rgba(255,255,255,0.8)", fontFamily: theme.mediumFont, marginBottom: 4, fontSize: 12 },
    input: {
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(0, 120, 255, 0.4)",
      backgroundColor: "rgba(2, 26, 92, 0.45)",
      color: "#fff",
      paddingHorizontal: 12,
      fontFamily: theme.regularFont,
      fontSize: 13,
    },
    card: {
      marginTop: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(0, 102, 255, 0.4)",
      backgroundColor: "rgba(7, 16, 46, 0.9)",
      padding: 14,
      gap: 10,
    },
    cardTitle: { fontFamily: theme.semiBoldFont, fontSize: 21, color: "#fff" },
    cardSub: { fontFamily: theme.regularFont, fontSize: 13, color: "rgba(255,255,255,0.72)" },
    row: { flexDirection: "row", gap: 10 },
    choicePill: {
      flex: 1,
      minHeight: 40,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "rgba(0, 134, 255, 0.35)",
      backgroundColor: "rgba(0, 34, 120, 0.45)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
    },
    choicePillActive: { backgroundColor: "#fff", borderColor: "#fff" },
    choiceText: { fontFamily: theme.mediumFont, fontSize: 13, color: "#73A8FF" },
    choiceTextActive: { color: "#062063" },
    courtWrap: {
      marginTop: 4,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(0, 134, 255, 0.3)",
      backgroundColor: "rgba(0, 20, 64, 0.55)",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      minHeight: 220,
    },
    // New court asset is wider and less tall; scale up to make it prominent.
    courtImageArea: { width: 280, height: 176, position: "relative", overflow: "hidden" },
    courtImage: { width: 280, height: 176 },
    // New ball asset is an ellipse; keep natural ratio.
    courtBall: { position: "absolute", width: 32, height: 14, bottom: 18 },
    // Position ball on left/right half of the near baseline area.
    courtBallLeft: { left: 66 },
    courtBallRight: { right: 66 },
    levelOption: {
      minHeight: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(0, 120, 255, 0.4)",
      backgroundColor: "rgba(3, 23, 90, 0.55)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    levelOptionActive: { borderColor: "#00BBFF", backgroundColor: "rgba(0, 108, 255, 0.35)" },
    levelText: { fontFamily: theme.mediumFont, color: "#79AFFF", fontSize: 13 },
    levelTextActive: { color: "#fff" },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(0, 120, 255, 0.45)",
      backgroundColor: "rgba(2, 26, 92, 0.45)",
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipActive: { borderColor: "#00BBFF", backgroundColor: "rgba(0, 94, 255, 0.38)" },
    chipText: { fontFamily: theme.mediumFont, color: "#79AFFF", fontSize: 12 },
    chipTextActive: { color: "#fff" },
    primaryOuter: { marginTop: 8, borderRadius: 999, overflow: "hidden" },
    primaryInner: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 999 },
    primaryText: { fontFamily: theme.semiBoldFont, fontSize: 14, color: "#fff" },
    actionRow: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    backButton: {
      width: 54,
      height: 54,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(6, 26, 86, 0.9)",
      borderWidth: 1,
      borderColor: "rgba(0, 120, 255, 0.45)",
    },
  });
}

