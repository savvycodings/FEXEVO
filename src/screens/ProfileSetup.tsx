import React, { useContext, useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { ThemeContext } from "../context";
import { registerVerifiedSignup } from "../lib/signupVerification";
import { authClient } from "../lib/auth-client";
import { Header, LanguageToggle } from "../components";
import { SignUpDraft } from "./SignUp";
import { useTranslation } from "react-i18next";
import {
  GENDER_OPTION_VALUES,
  genderTranslationKey,
  LEVEL_OPTION_VALUES,
  levelTranslationKey,
} from "../i18n/profileOptionValues";
import Ionicons from "@expo/vector-icons/Ionicons";
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from "react-native-svg";
import { LocalSvgAsset } from "../components/LocalSvgAsset";

const COURT_IMAGE = require("../../assets/court.png");
const BALL_IMAGE = require("../../assets/ball.png");

const RANKING_ORG_OPTIONS = [
  "Playtomic",
  "Playbypoint",
  "RankedIn",
  "MATCHi",
  "Padel Manager",
  "Red Padel",
  "PadelScore",
  "Tie Player",
  "Spain Federation",
];

const RANKING_ORG_LOGOS: Record<string, any> = {
  Playtomic: require("../../assets/logos/playtomic.svg"),
  Playbypoint: require("../../assets/logos/playbypoint.svg"),
  RankedIn: require("../../assets/logos/RankedIn.svg"),
  MATCHi: require("../../assets/logos/MATCHi.svg"),
  "Padel Manager": require("../../assets/logos/Padel Manager.svg"),
  "Red Padel": require("../../assets/logos/Red Padel.svg"),
  PadelScore: require("../../assets/logos/PadelScore.svg"),
  "Tie Player": require("../../assets/logos/Tie Player.svg"),
  "Spain Federation": require("../../assets/logos/Spain Federation.svg"),
};

function rankingLogoModule(org: string | null): number | null {
  if (!org) return null;
  const mod = RANKING_ORG_LOGOS[org];
  return mod != null ? mod : null;
}

type ProfileSetupProps = {
  onComplete?: () => void;
  signUpDraft?: SignUpDraft | null;
  mode?: "onboarding" | "edit";
  onBack?: () => void;
};

export function ProfileSetup({ onComplete, signUpDraft, mode = "onboarding", onBack }: ProfileSetupProps) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submittingOverlay, setSubmittingOverlay] = useState(false);
  const [displayName, setDisplayName] = useState(signUpDraft?.name ?? "");
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [dominantHand, setDominantHand] = useState<"left" | "right" | null>(null);
  const [courtSide, setCourtSide] = useState<"left" | "right" | null>(null);
  const [hasRanking, setHasRanking] = useState<boolean | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [rankingOrg, setRankingOrg] = useState<string | null>("Playtomic");
  const [rankingValue, setRankingValue] = useState("");

  const canContinueStep1 = !!dominantHand && !!courtSide;

  function selectDominantHand(hand: "left" | "right") {
    setDominantHand(hand);
    // Suggest same side as dominant hand (left hand → left side); user can change court below.
    setCourtSide(hand === "left" ? "left" : "right");
  }
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
      if (body?.profile?.dominantHand === "left" || body?.profile?.dominantHand === "right") {
        setDominantHand(body.profile.dominantHand);
      }
      if (typeof body?.profile?.hasRanking === "boolean") {
        setHasRanking(body.profile.hasRanking);
      }
      if (body?.profile?.level) setLevel(body.profile.level);
      if (body?.profile?.username) setUsername(body.profile.username);
      if (body?.profile?.gender) setGender(body.profile.gender);
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
    if (!canContinueStep2 || !courtSide || !dominantHand) return;
    setSubmittingOverlay(true);
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
      if (!signUpDraft.verificationToken) {
        setSaving(false);
        setSubmittingOverlay(false);
        Alert.alert(t("verifyEmail.verifyFailedTitle"), t("verifyEmail.notVerifiedMsg"));
        return;
      }

      const registerResult = await registerVerifiedSignup({
        name: displayName.trim() || signUpDraft.name,
        email: signUpDraft.email.trim(),
        password: signUpDraft.password,
        verificationToken: signUpDraft.verificationToken,
      });

      if (!registerResult.ok) {
        const msg = registerResult.message.toLowerCase();
        const looksLikeExistingUser = msg.includes("already exists") || msg.includes("already registered");

        if (!looksLikeExistingUser) {
          setSaving(false);
          setSubmittingOverlay(false);
          Alert.alert(t("auth.signUpFailed"), registerResult.message || t("profileSetup.setupFailedMsg"));
          return;
        }

        const signInRes = await authClient.signIn.email({
          email: signUpDraft.email.trim(),
          password: signUpDraft.password,
        });
        if (signInRes?.error) {
          setSaving(false);
          setSubmittingOverlay(false);
          Alert.alert(t("profileSetup.accountExists"), t("profileSetup.accountExistsMsg"));
          return;
        }
      }

      const hasSessionAfterAuth = await ensureSessionReady();
      if (!hasSessionAfterAuth) {
        setSaving(false);
        setSubmittingOverlay(false);
        Alert.alert(t("profileSetup.sessionError"), t("profileSetup.sessionErrorMsg"));
        return;
      }
    }

    const form = new FormData();
    form.append("dominantHand", dominantHand);
    form.append("courtSide", courtSide);
    form.append("hasRanking", String(!!hasRanking));
    if (level) form.append("level", level);
    if (rankingOrg) form.append("rankingOrg", rankingOrg);
    if (rankingValue.trim()) form.append("rankingValue", rankingValue.trim());
    if (displayName.trim()) form.append("name", displayName.trim());
    if (isEditMode && username.trim()) form.append("username", username.trim());
    if (isEditMode && gender) form.append("gender", gender);
    if (avatarUri) {
      if (Platform.OS === "web") {
        try {
          const r = await fetch(avatarUri);
          const blob = await r.blob();
          const file = new File([blob], "avatar.jpg", { type: blob.type || "image/jpeg" });
          form.append("avatar", file);
        } catch {
        }
      } else {
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
      setSubmittingOverlay(false);
      Alert.alert(t("profileSetup.setupFailed"), body?.error || t("profileSetup.setupFailedMsg"));
      return;
    }

    onComplete?.();
  }

  if (loading || submittingOverlay) {
    const loadingTitle = loading ? t("profileSetup.loadingProfile") : t("profileSetup.settingUp");
    const loadingSubtitle = loading
      ? t("profileSetup.loadingProfileSub")
      : t("profileSetup.settingUpSub");
    return (
      <View style={styles.screen}>
        <Svg pointerEvents="none" style={[styles.heroGlow, { height: 430 + insets.top }]}>
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
        <View style={styles.loadingWrap}>
          <Text allowFontScaling={false} style={styles.loadingTitle}>{loadingTitle}</Text>
          <Text allowFontScaling={false} style={styles.loadingSubtitle}>{loadingSubtitle}</Text>
        </View>
      </View>
    );
  }

  const onboardingStep = step === 1 ? 2 : 3;
  const isEditMode = mode === "edit";

  return (
    <View style={styles.screen}>
      <Svg pointerEvents="none" style={[styles.heroGlow, { height: 430 + insets.top }]}>
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
          {step === 1 ? t("profileSetup.step1Title") : t("profileSetup.step2Title")}
          </Text>
        </View>
      ) : (
        <View style={styles.progressSection}>
          <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.stepTitle}>
            {t("profileSetup.editTitle")}
          </Text>
        </View>
      )}
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {!isEditMode ? (
          <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.title}>
            {t("profileSetup.completeTitle")}
          </Text>
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
            <Text allowFontScaling={false} style={styles.inputLabel}>{t("auth.name")}</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              style={styles.input}
              placeholder={t("profileSetup.yourName")}
              placeholderTextColor={theme.mutedForegroundColor}
            />
          </View>
        </View>
        {isEditMode ? (
          <>
            <View>
              <Text allowFontScaling={false} style={styles.inputLabel}>{t("profileSetup.username")}</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                style={styles.input}
                placeholder={t("profileSetup.username")}
                placeholderTextColor={theme.mutedForegroundColor}
                autoCapitalize="none"
              />
            </View>
            <View>
              <Text allowFontScaling={false} style={styles.inputLabel}>{t("profileSetup.gender")}</Text>
              <View style={styles.chipWrap}>
                {GENDER_OPTION_VALUES.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.chip, gender === opt && styles.chipActive]}
                    onPress={() => setGender(opt)}
                    activeOpacity={0.85}
                  >
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={[styles.chipText, gender === opt && styles.chipTextActive]}
                    >
                      {t(genderTranslationKey(opt))}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        ) : null}

        {step === 1 && (
          <View style={styles.card}>
          <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.cardTitle}>
            {t("profileSetup.dominantHand")}
          </Text>
          <View style={styles.row}>
            <ChoicePill
              label={t("profileSetup.leftHand")}
              active={dominantHand === "left"}
              onPress={() => selectDominantHand("left")}
              styles={styles}
            />
            <ChoicePill
              label={t("profileSetup.rightHand")}
              active={dominantHand === "right"}
              onPress={() => selectDominantHand("right")}
              styles={styles}
            />
          </View>
          <Text
            allowFontScaling={false}
            maxFontSizeMultiplier={1.05}
            style={[styles.cardTitle, { marginTop: 18 }]}
          >
            {t("profileSetup.courtSide")}
          </Text>
          <View style={styles.row}>
            <ChoicePill
              label={t("common.left")}
              active={courtSide === "left"}
              onPress={() => setCourtSide("left")}
              styles={styles}
            />
            <ChoicePill
              label={t("common.right")}
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
              accessibilityLabel={t("profileSetup.goBack")}
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
                <Text allowFontScaling={false} style={styles.primaryText}>{t("profileSetup.setYourRankingBtn")}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.card}>
          <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.cardTitle}>{t("profileSetup.setRanking")}</Text>
          <View style={styles.row}>
            <ChoicePill
              label={t("common.no")}
              active={hasRanking === false}
              onPress={() => {
                setHasRanking(false);
                setRankingOrg(null);
                setRankingValue("");
              }}
              styles={styles}
            />
            <ChoicePill
              label={t("common.yes")}
              active={hasRanking === true}
              onPress={() => {
                setHasRanking(true);
                setRankingOrg((prev) => prev || "Playtomic");
              }}
              styles={styles}
            />
          </View>

          {hasRanking === false && (
            <View style={{ gap: 8, marginTop: 12 }}>
              <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.cardTitle}>{t("profileSetup.setLevel")}</Text>
              {LEVEL_OPTION_VALUES.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.levelOption, level === opt && styles.levelOptionActive]}
                  onPress={() => setLevel(opt)}
                  activeOpacity={0.85}
                >
                  <Text allowFontScaling={false} style={[styles.levelText, level === opt && styles.levelTextActive]}>
                    {t(levelTranslationKey(opt))}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {hasRanking === true && (
            <View style={{ gap: 10, marginTop: 12 }}>
              <View style={styles.rankLogoWrap}>
                {rankingLogoModule(rankingOrg) != null ? (
                  <LocalSvgAsset assetModule={rankingLogoModule(rankingOrg)!} width={300} height={64} />
                ) : (
                  <Text allowFontScaling={false} style={styles.rankLogoFallback}>
                    {rankingOrg || "Playtomic"}
                  </Text>
                )}
              </View>
              <View style={styles.chipWrap}>
                {RANKING_ORG_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.chip, rankingOrg === opt && styles.chipActive]}
                    onPress={() => setRankingOrg(opt)}
                    activeOpacity={0.85}
                  >
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={[styles.chipText, rankingOrg === opt && styles.chipTextActive]}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                value={rankingValue}
                onChangeText={setRankingValue}
                style={styles.input}
                placeholder={t("profileSetup.ratingPlaceholder")}
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
              accessibilityLabel={t("profileSetup.goBack")}
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
                  {isEditMode ? t("common.done") : t("profileSetup.finishSetup")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          </View>
        )}

        <LanguageToggle />
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
    loadingWrap: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
      gap: 8,
    },
    loadingTitle: {
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont,
      fontSize: 17,
      textAlign: "center",
    },
    loadingSubtitle: {
      color: "rgba(255,255,255,0.72)",
      fontFamily: theme.regularFont,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
      maxWidth: 320,
    },
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
      opacity: 1,
    },
    title: { fontFamily: theme.semiBoldFont, fontSize: 24, color: "#fff" },
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
    courtImageArea: { width: 280, height: 176, position: "relative", overflow: "hidden" },
    courtImage: { width: 280, height: 176 },
    courtBall: { position: "absolute", width: 40, height: 18, bottom: 26 },
    courtBallLeft: { left: 62 },
    courtBallRight: { right: 62 },
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
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" },
    chip: {
      width: "48.5%",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(0, 120, 255, 0.45)",
      backgroundColor: "rgba(2, 26, 92, 0.45)",
      paddingHorizontal: 12,
      paddingVertical: 8,
      alignItems: "center",
    },
    chipActive: { borderColor: "#00BBFF", backgroundColor: "rgba(0, 94, 255, 0.38)" },
    chipText: { fontFamily: theme.mediumFont, color: "#79AFFF", fontSize: 12 },
    chipTextActive: { color: "#fff" },
    rankLogoWrap: {
      marginTop: 2,
      marginBottom: 2,
      minHeight: 78,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      backgroundColor: "rgba(255,255,255,0.02)",
    },
    rankLogoFallback: {
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont,
      letterSpacing: 1.6,
      fontSize: 18,
    },
    primaryOuter: { borderRadius: 16, overflow: "hidden" },
    primaryInner: { minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: 16 },
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
