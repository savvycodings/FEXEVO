import React, { useContext, useEffect, useState } from "react";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { ThemeContext } from "../context";
import { registerVerifiedSignup } from "../lib/signupVerification";
import { clearDismissedSession } from "../lib/signOut";
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
import { LocalSvgAsset } from "../components/LocalSvgAsset";
import { PAGE_TOP_EXTRA_PADDING } from "../../constants";
import { TEST_IDS } from '../lib/testIds'
import { CARD_GLOW, GlowButton, OptionButton, SegmentedToggle, SurfaceIconButton, UI } from "../components/ui";

const APP_LOGO = require("../../assets/logo.png");
const COURT_IMAGE = require("../../assets/court.png");
const BALL_IMAGE = require("../../assets/ball.png");
const SELECTION_BOX_BG = "#041641";
const COURT_NATIVE_W = 262;
const COURT_NATIVE_H = 151;
const BALL_NATIVE_W = 61;
const BALL_NATIVE_H = 21;
const COURT_ASPECT = COURT_NATIVE_W / COURT_NATIVE_H;
const BALL_ASPECT = BALL_NATIVE_W / BALL_NATIVE_H;
/** Ball anchor tuned to the near court surface in court.png (percent of court box). */
const BALL_BOTTOM_PCT = `${(43 / COURT_NATIVE_H) * 100}%`;
const BALL_SIDE_PCT = `${(62 / COURT_NATIVE_W) * 100}%`;
const BALL_WIDTH_PCT = `${(BALL_NATIVE_W / COURT_NATIVE_W) * 100}%`;
const COURT_MAX_W = 296;
const RANK_LOGO_BOX_H = 80;
const RANK_LOGO_BOX_W = 200;

const RANKING_ORG_GRID_OPTIONS = [
  "WPR",
  "Playtomic",
  "RankedIn",
  "MATCHi",
  "Padel Manager",
  "Playbypoint",
  "PadelScore",
  "Tie Player",
] as const;

const RANKING_ORG_OPTIONS = [
  ...RANKING_ORG_GRID_OPTIONS,
  "Red Padel",
  "Spain Federation",
];

const RANKING_ORG_LOGOS: Record<string, any> = {
  WPR: require("../../assets/worldpadlerating.svg"),
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

function rankingOrgLabel(org: string): string {
  if (org === "RankedIn") return "Rankedin";
  return org;
}

type ProfileSetupProps = {
  onComplete?: () => void;
  signUpDraft?: SignUpDraft | null;
  mode?: "onboarding" | "edit";
  onBack?: () => void;
  onRestart?: () => void;
};

export function ProfileSetup({ onComplete, signUpDraft, mode = "onboarding", onBack, onRestart }: ProfileSetupProps) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const screenBg = theme.backgroundColor ?? "#030A17";
  const styles = getStyles(theme);
  const [step, setStep] = useState(1);
  const [rankingSetupPhase, setRankingSetupPhase] = useState<"choose" | "configure">("choose");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submittingOverlay, setSubmittingOverlay] = useState(false);
  const [displayName, setDisplayName] = useState(signUpDraft?.name ?? "");
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [dominantHand, setDominantHand] = useState<"left" | "right" | null>(null);
  const [courtSide, setCourtSide] = useState<"left" | "right" | null>(null);
  const [heightCmInput, setHeightCmInput] = useState("");
  const [weightKgInput, setWeightKgInput] = useState("");
  const [hasRanking, setHasRanking] = useState<boolean | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [customLevelText, setCustomLevelText] = useState("");
  const [rankingOrg, setRankingOrg] = useState<string | null>("WPR");
  const [rankingValue, setRankingValue] = useState("");

  const standardLevelOptions = LEVEL_OPTION_VALUES.filter((opt) => opt !== "Other");

  const canContinueStep1 =
    !!dominantHand &&
    !!courtSide &&
    Number(heightCmInput) >= 100 &&
    Number(heightCmInput) <= 250 &&
    Number(weightKgInput) >= 30 &&
    Number(weightKgInput) <= 250;

  function chooseHasRanking(next: "yes" | "no") {
    if (next === "no") {
      setHasRanking(false);
      setRankingOrg(null);
      setRankingValue("");
    } else {
      setHasRanking(true);
      setRankingOrg((prev) => prev || "WPR");
    }
    setLevel(null);
    setCustomLevelText("");
  }

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
      if (body?.profile?.level) {
        const savedLevel = String(body.profile.level);
        setLevel(savedLevel);
        if (!(LEVEL_OPTION_VALUES.filter((o) => o !== "Other") as readonly string[]).includes(savedLevel)) {
          setCustomLevelText(savedLevel);
        }
      }
      if (body?.profile?.username) setUsername(body.profile.username);
      if (body?.profile?.gender) setGender(body.profile.gender);
      if (body?.profile?.rankingOrg) setRankingOrg(body.profile.rankingOrg);
      if (body?.profile?.rankingValue) setRankingValue(body.profile.rankingValue);
      if (typeof body?.profile?.heightCm === "number" && Number.isFinite(body.profile.heightCm)) {
        setHeightCmInput(String(body.profile.heightCm));
      }
      if (typeof body?.profile?.weightKg === "number" && Number.isFinite(body.profile.weightKg)) {
        setWeightKgInput(String(body.profile.weightKg));
      }
      setLoading(false);
    }
    void loadMe();
    return () => {
      mounted = false;
    };
  }, [signUpDraft]);

  useEffect(() => {
    if (step === 2 && mode !== "edit") {
      setRankingSetupPhase("choose");
    }
  }, [step, mode]);

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
      clearDismissedSession();
    }

    const form = new FormData();
    form.append("dominantHand", dominantHand);
    form.append("courtSide", courtSide);
    form.append("hasRanking", String(!!hasRanking));
    const heightNum = Number(String(heightCmInput).trim());
    const weightNum = Number(String(weightKgInput).trim());
    if (
      !Number.isFinite(heightNum) ||
      heightNum < 100 ||
      heightNum > 250 ||
      !Number.isFinite(weightNum) ||
      weightNum < 30 ||
      weightNum > 250
    ) {
      setSaving(false);
      setSubmittingOverlay(false);
      Alert.alert(t("profileSetup.setupFailed"), t("profileSetup.anthroRequiredMsg"));
      return;
    }
    form.append("heightCm", String(heightNum));
    form.append("weightKg", String(weightNum));
    if (level) form.append("level", level);
    if (rankingOrg) form.append("rankingOrg", rankingOrg);
    if (rankingValue.trim()) form.append("rankingValue", rankingValue.trim());
    if (displayName.trim()) form.append("name", displayName.trim());
    if (signUpDraft?.country?.trim()) form.append("areaLocation", signUpDraft.country.trim());
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
        <LinearGradient
          pointerEvents="none"
          colors={["#071D47", screenBg]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.4 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.loadingWrap}>
          <Text allowFontScaling={false} style={styles.loadingTitle}>{loadingTitle}</Text>
          <Text allowFontScaling={false} style={styles.loadingSubtitle}>{loadingSubtitle}</Text>
        </View>
      </View>
    );
  }

  const isEditMode = mode === "edit";
  const onboardingHeaderPadH = Math.max(24, insets.left, insets.right);
  const onboardingHeaderPadTop = PAGE_TOP_EXTRA_PADDING + 16;

  return (
    <View style={styles.screen}>
      <LinearGradient
        pointerEvents="none"
        colors={["#071D47", screenBg]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.4 }}
        style={StyleSheet.absoluteFillObject}
      />
      {isEditMode ? <Header /> : null}
      {!isEditMode ? (
        <SafeAreaView edges={["top"]} style={styles.onboardingHeaderSafe}>
          <View
            style={[
              styles.onboardingHeader,
              {
                paddingTop: onboardingHeaderPadTop,
                paddingLeft: onboardingHeaderPadH,
                paddingRight: onboardingHeaderPadH,
              },
            ]}
          >
            <View style={styles.onboardingHeaderInner}>
              {onRestart ? (
                <TouchableOpacity
                  style={styles.restartTouch}
                  onPress={onRestart}
                  activeOpacity={0.85}
                  accessibilityLabel={t("profileSetup.restart")}
                >
                  <Text allowFontScaling={false} style={styles.restartText}>
                    {t("profileSetup.restart")}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {step === 1 ? (
                <View style={styles.detailsHead}>
                  <Text allowFontScaling={false} style={styles.detailsTitle}>
                    {t("profileSetup.playerDetailsLead")}
                    <Text style={styles.detailsTitleAccent}>{t("profileSetup.playerDetailsAccent")}</Text>
                  </Text>
                  <Text allowFontScaling={false} style={styles.detailsSubtitle}>
                    {t("profileSetup.playerDetailsSubtitle")}
                  </Text>
                </View>
              ) : (
                <View style={styles.logoWrap}>
                  <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" />
                </View>
              )}
            </View>
          </View>
        </SafeAreaView>
      ) : null}
      {isEditMode ? (
        <View style={styles.progressSection}>
          <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.stepTitle}>
            {t("profileSetup.editTitle")}
          </Text>
        </View>
      ) : null}
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          !isEditMode && step === 1 ? styles.contentStep1 : null,
          !isEditMode && step === 2 ? styles.contentStep2 : null,
          {
            paddingBottom:
              40 +
              insets.bottom +
              (step === 2 && (isEditMode || rankingSetupPhase === "configure") ? 72 : 0),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        bottomOffset={insets.bottom + 72}
        extraKeyboardSpace={20}
      >
        {isEditMode ? (
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
              testID={TEST_IDS.setupName}
              placeholderTextColor={theme.mutedForegroundColor}
            />
          </View>
        </View>
        ) : null}
        {isEditMode ? (
          <>
            <View>
              <Text allowFontScaling={false} style={styles.inputLabel}>{t("profileSetup.username")}</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                style={styles.input}
                placeholder={t("profileSetup.username")}
                testID={TEST_IDS.setupUsername}
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
                    testID={TEST_IDS.setupGender(opt)}
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
          <>
          <View style={styles.selectionBox}>
          <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.boxTitle}>
            {t("profileSetup.dominantHand")}
          </Text>
          <SegmentedToggle
            accessibilityLabel={t("profileSetup.dominantHand")}
            value={dominantHand}
            onChange={selectDominantHand}
            options={[
              { value: "left", label: t("profileSetup.leftHand"), testID: TEST_IDS.setupHand("left") },
              { value: "right", label: t("profileSetup.rightHand"), testID: TEST_IDS.setupHand("right") },
            ]}
          />
          </View>

          <View style={styles.selectionBox}>
          <Text
            allowFontScaling={false}
            maxFontSizeMultiplier={1.05}
            style={styles.boxTitle}
          >
            {t("profileSetup.courtSide")}
          </Text>
          <SegmentedToggle
            accessibilityLabel={t("profileSetup.courtSide")}
            value={courtSide}
            onChange={setCourtSide}
            options={[
              { value: "left", label: t("common.left"), testID: TEST_IDS.setupCourt("left") },
              { value: "right", label: t("common.right"), testID: TEST_IDS.setupCourt("right") },
            ]}
          />
          <CourtSideGraphic courtSide={courtSide} />
          </View>

          <View style={styles.selectionBox}>
            {isEditMode ? (
              <>
              <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.boxTitle}>
                {t("profileSetup.heightTitle")}
              </Text>
              <View style={styles.anthroRow}>
                <TextInput
                  allowFontScaling={false}
                  value={heightCmInput}
                  onChangeText={(v) => setHeightCmInput(v.replace(/[^0-9.]/g, ""))}
                  keyboardType="decimal-pad"
                  placeholder={t("profileSetup.heightPlaceholder")}
                  testID={TEST_IDS.setupHeight}
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  style={styles.anthroInput}
                />
                <Text allowFontScaling={false} style={styles.anthroUnit}>
                  {t("profileSetup.cm")}
                </Text>
              </View>
              <Text
                allowFontScaling={false}
                maxFontSizeMultiplier={1.05}
                style={[styles.boxTitle, { marginTop: 16 }]}
              >
                {t("profileSetup.weightTitle")}
              </Text>
              <View style={styles.anthroRow}>
                <TextInput
                  allowFontScaling={false}
                  value={weightKgInput}
                  onChangeText={(v) => setWeightKgInput(v.replace(/[^0-9.]/g, ""))}
                  keyboardType="decimal-pad"
                  placeholder={t("profileSetup.weightPlaceholder")}
                  testID={TEST_IDS.setupWeight}
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  style={styles.anthroInput}
                />
                <Text allowFontScaling={false} style={styles.anthroUnit}>
                  {t("profileSetup.kg")}
                </Text>
              </View>
              </>
            ) : (
              <View style={styles.anthroPair}>
                <View style={styles.anthroCol}>
                  <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.anthroColTitle}>
                    {t("profileSetup.heightTitle")}
                  </Text>
                  <View style={styles.anthroField}>
                    <TextInput
                      allowFontScaling={false}
                      value={heightCmInput}
                      onChangeText={(v) => setHeightCmInput(v.replace(/[^0-9.]/g, ""))}
                      keyboardType="decimal-pad"
                      placeholder={t("profileSetup.heightPlaceholder")}
                      testID={TEST_IDS.setupHeight}
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      style={styles.anthroFieldInput}
                    />
                    <Text allowFontScaling={false} style={styles.anthroFieldUnit}>
                      {t("profileSetup.cm")}
                    </Text>
                  </View>
                </View>
                <View style={styles.anthroCol}>
                  <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.anthroColTitle}>
                    {t("profileSetup.weightTitle")}
                  </Text>
                  <View style={styles.anthroField}>
                    <TextInput
                      allowFontScaling={false}
                      value={weightKgInput}
                      onChangeText={(v) => setWeightKgInput(v.replace(/[^0-9.]/g, ""))}
                      keyboardType="decimal-pad"
                      placeholder={t("profileSetup.weightPlaceholder")}
                      testID={TEST_IDS.setupWeight}
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      style={styles.anthroFieldInput}
                    />
                    <Text allowFontScaling={false} style={styles.anthroFieldUnit}>
                      {t("profileSetup.kg")}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          <View style={styles.actionRow}>
            <SurfaceIconButton
              icon="chevron-back"
              onPress={onBack}
              accessibilityLabel={t("profileSetup.goBack")}
            />
            <GlowButton
              style={styles.actionPrimary}
              label={t("profileSetup.setYourRankingBtn")}
              arrow
              onPress={() => setStep(2)}
              testID={TEST_IDS.setupStep1Next}
              disabled={!canContinueStep1}
            />
          </View>
          </>
        )}

        {step === 2 && !isEditMode && rankingSetupPhase === "choose" && (
          <>
            <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.rankingTitle}>
              {t("profileSetup.setRanking")}
            </Text>
            <View style={styles.rankingSubtitleBlock}>
              <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.rankingSubtitle}>
                {t("profileSetup.hasRankingHint")}
              </Text>
              <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.rankingSubtitle}>
                {t("profileSetup.hasRankingHintSources")}
              </Text>
            </View>
            <View style={styles.selectionBox}>
              <SegmentedToggle
                value={hasRanking === null ? null : hasRanking ? "yes" : "no"}
                onChange={chooseHasRanking}
                options={[
                  { value: "no", label: t("common.no"), testID: TEST_IDS.setupRankingNo },
                  { value: "yes", label: t("common.yes") },
                ]}
              />
            </View>
            <View style={styles.actionRow}>
              <SurfaceIconButton
                icon="chevron-back"
                onPress={() => setStep(1)}
                accessibilityLabel={t("profileSetup.goBack")}
              />
              <GlowButton
                style={styles.actionPrimary}
                label={t("profileSetup.setYourLevelBtn")}
                onPress={() => setRankingSetupPhase("configure")}
                testID={TEST_IDS.setupRankingNext}
                disabled={hasRanking === null}
              />
            </View>
          </>
        )}

        {step === 2 && (isEditMode || rankingSetupPhase === "configure") && (
          <>
            {!isEditMode ? (
              <>
                <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.rankingTitle}>
                  {hasRanking === false ? t("profileSetup.setLevel") : t("profileSetup.setRanking")}
                </Text>
                {hasRanking === true ? (
                  <View style={styles.rankingSubtitleBlock}>
                    <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.rankingSubtitle}>
                      {t("profileSetup.hasRankingHint")}
                    </Text>
                    <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.rankingSubtitle}>
                      {t("profileSetup.hasRankingHintSources")}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}
            <View style={styles.selectionBox}>
              {(isEditMode || hasRanking === true) ? (
                <SegmentedToggle
                  value={hasRanking === null ? null : hasRanking ? "yes" : "no"}
                  onChange={chooseHasRanking}
                  options={[
                    { value: "no", label: t("common.no") },
                    { value: "yes", label: t("common.yes") },
                  ]}
                />
              ) : null}

              {hasRanking === false && (
                <View style={styles.levelList}>
                  {standardLevelOptions.map((opt) => {
                    const active = level === opt;
                    return (
                      <OptionButton
                        key={opt}
                        label={t(levelTranslationKey(opt))}
                        selected={active}
                        testID={TEST_IDS.setupLevel(opt)}
                        onPress={() => {
                          setCustomLevelText("");
                          setLevel(opt);
                        }}
                      />
                    );
                  })}
                  <TextInput
                    value={customLevelText}
                    onChangeText={(text) => {
                      setCustomLevelText(text);
                      const trimmed = text.trim();
                      setLevel(trimmed.length > 0 ? trimmed : null);
                    }}
                    onFocus={() => {
                      if (
                        level &&
                        (standardLevelOptions as readonly string[]).includes(level)
                      ) {
                        setLevel(customLevelText.trim() || null);
                      }
                    }}
                    style={styles.levelOtherInput}
                    placeholder={t(levelTranslationKey("Other"))}
                    placeholderTextColor={UI.textMuted}
                    allowFontScaling={false}
                    underlineColorAndroid="transparent"
                  />
                </View>
              )}

              {hasRanking === true && (
                <View style={styles.rankingForm}>
                  <View style={styles.rankLogoWrap}>
                    {rankingLogoModule(rankingOrg) != null ? (
                      <LocalSvgAsset
                        assetModule={rankingLogoModule(rankingOrg)!}
                        width={RANK_LOGO_BOX_W}
                        height={RANK_LOGO_BOX_H}
                      />
                    ) : (
                      <Text allowFontScaling={false} style={styles.rankLogoFallback}>
                        {rankingOrg || "WPR"}
                      </Text>
                    )}
                  </View>
                  <View style={styles.rankOrgGrid}>
                    {(isEditMode ? RANKING_ORG_OPTIONS : RANKING_ORG_GRID_OPTIONS).map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.rankOrgChip, rankingOrg === opt && styles.rankOrgChipActive]}
                        onPress={() => setRankingOrg(opt)}
                        activeOpacity={0.85}
                      >
                        <Text
                          allowFontScaling={false}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={[styles.rankOrgChipText, rankingOrg === opt && styles.rankOrgChipTextActive]}
                        >
                          {rankingOrgLabel(opt)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.rankingInputRow}>
                    <TextInput
                      value={rankingValue}
                      onChangeText={setRankingValue}
                      style={styles.rankingInput}
                      placeholder={t("profileSetup.ratingPlaceholder")}
                      placeholderTextColor="rgba(134, 167, 210, 0.55)"
                      keyboardType="decimal-pad"
                      underlineColorAndroid="transparent"
                    />
                    {rankingValue.trim().length > 0 ? (
                      <View style={styles.rankingInputCheck}>
                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </View>
                </View>
              )}
            </View>

            <View style={styles.actionRow}>
              <SurfaceIconButton
                icon="chevron-back"
                onPress={() => {
                  if (!isEditMode && rankingSetupPhase === "configure") {
                    setRankingSetupPhase("choose");
                    return;
                  }
                  setStep(1);
                }}
                accessibilityLabel={t("profileSetup.goBack")}
              />
              <GlowButton
                style={styles.actionPrimary}
                label={isEditMode ? t("common.done") : t("profileSetup.finishSetup")}
                onPress={saveProfile}
                testID={TEST_IDS.setupFinish}
                disabled={!canContinueStep2}
                loading={saving}
              />
            </View>
          </>
        )}

        <LanguageToggle />
      </KeyboardAwareScrollView>
    </View>
  );
}

function CourtSideGraphic({ courtSide }: { courtSide: "left" | "right" | null }) {
  return (
    <View style={courtGraphicStyles.wrap}>
      <View style={courtGraphicStyles.stage}>
        <View style={courtGraphicStyles.courtFrame}>
          <Image source={COURT_IMAGE} style={courtGraphicStyles.courtImage} resizeMode="stretch" />
          {courtSide ? (
            <Image
              source={BALL_IMAGE}
              style={[
                courtGraphicStyles.courtBall,
                courtSide === "left" ? courtGraphicStyles.courtBallLeft : courtGraphicStyles.courtBallRight,
              ]}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const courtGraphicStyles = StyleSheet.create({
  wrap: {
    marginTop: 32,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 4,
  },
  stage: {
    width: "100%",
    maxWidth: COURT_MAX_W,
    alignSelf: "center",
  },
  courtFrame: {
    width: "100%",
    aspectRatio: COURT_ASPECT,
    position: "relative",
    overflow: "hidden",
  },
  courtImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  courtBall: {
    position: "absolute",
    width: BALL_WIDTH_PCT,
    aspectRatio: BALL_ASPECT,
    bottom: BALL_BOTTOM_PCT,
  },
  courtBallLeft: {
    left: BALL_SIDE_PCT,
  },
  courtBallRight: {
    right: BALL_SIDE_PCT,
  },
});

function getStyles(theme: any) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
    },
    container: { flex: 1, backgroundColor: "transparent" },
    content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40, gap: 14 },
    contentStep1: {
      paddingTop: 0,
      paddingBottom: 28,
    },
    contentStep2: {
      paddingTop: 0,
      paddingBottom: 28,
      gap: 18,
    },
    rankingTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 20,
      color: "#FFFFFF",
      textAlign: "center",
      marginTop: 4,
    },
    rankingSubtitle: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      lineHeight: 18,
      color: "#86A7D2",
      textAlign: "center",
      paddingHorizontal: 8,
    },
    rankingSubtitleBlock: {
      alignItems: "center",
      marginTop: -6,
      marginBottom: 4,
      gap: 2,
    },
    onboardingHeaderSafe: {
      backgroundColor: "transparent",
    },
    onboardingHeader: {
      marginBottom: 28,
    },
    onboardingHeaderInner: {
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 108,
      paddingTop: 10,
    },
    restartTouch: {
      position: "absolute",
      right: 0,
      top: 10,
      zIndex: 2,
      paddingVertical: 6,
      paddingHorizontal: 2,
    },
    restartText: {
      color: "#86A7D2",
      fontFamily: theme.mediumFont,
      fontSize: 14,
    },
    logoWrap: {
      alignItems: "center",
      paddingTop: 10,
    },
    detailsHead: {
      alignItems: "center",
      paddingTop: 40,
      gap: 8,
    },
    detailsTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 32,
      color: "#FFFFFF",
      textAlign: "center",
    },
    detailsTitleAccent: {
      color: "#18C0FF",
    },
    detailsSubtitle: {
      fontFamily: theme.regularFont,
      fontSize: 15,
      color: "rgba(165,196,235,0.92)",
      textAlign: "center",
    },
    logoImage: {
      width: 172,
      height: 92,
    },
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
      backgroundColor: SELECTION_BOX_BG,
      color: "#fff",
      paddingHorizontal: 12,
      fontFamily: theme.regularFont,
      fontSize: 13,
    },
    selectionBox: {
      borderRadius: UI.radiusCard,
      backgroundColor: UI.cardBg,
      ...CARD_GLOW,
      paddingHorizontal: 19,
      paddingVertical: 24,
      gap: 16,
    },
    boxTitle: {
      fontFamily: theme.mediumFont,
      fontSize: 22,
      color: UI.text,
      textAlign: "center",
    },
    actionPrimary: {
      flex: 1,
    },
    anthroHint: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: "rgba(255,255,255,0.55)",
      textAlign: "center",
      lineHeight: 16,
      marginTop: -4,
    },
    anthroRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    anthroInput: {
      flex: 1,
      minHeight: 44,
      borderRadius: 14,
      backgroundColor: "#07256D",
      borderWidth: 1,
      borderColor: "rgba(0, 184, 255, 0.35)",
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont,
      fontSize: 18,
      paddingHorizontal: 14,
      textAlign: "center",
    },
    anthroPair: {
      flexDirection: "row",
      gap: 12,
    },
    anthroCol: {
      flex: 1,
      minWidth: 0,
      gap: 10,
    },
    anthroColTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      color: "#fff",
      textAlign: "center",
    },
    anthroField: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: "#07256D",
      borderWidth: 1,
      borderColor: "rgba(0, 184, 255, 0.35)",
      paddingHorizontal: 12,
    },
    anthroFieldInput: {
      flex: 1,
      minWidth: 0,
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont,
      fontSize: 18,
      paddingVertical: 10,
      textAlign: "center",
    },
    anthroFieldUnit: {
      fontFamily: theme.mediumFont,
      fontSize: 15,
      color: "#00B8FF",
      marginLeft: 4,
    },
    anthroUnit: {
      fontFamily: theme.mediumFont,
      fontSize: 16,
      color: "#00B8FF",
      minWidth: 28,
    },
    card: {
      marginTop: 8,
      borderRadius: 22,
      backgroundColor: SELECTION_BOX_BG,
      padding: 16,
      gap: 10,
    },
    cardTitle: { fontFamily: theme.semiBoldFont, fontSize: 21, color: "#fff", textAlign: "center" },
    levelList: {
      gap: 8,
    },
    rankingForm: {
      gap: 14,
      marginTop: 2,
    },
    rankLogoWrap: {
      height: RANK_LOGO_BOX_H,
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    rankOrgGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      justifyContent: "space-between",
    },
    rankOrgChip: {
      width: "48%",
      minHeight: 32,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: "#1848BA",
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    rankOrgChipActive: {
      borderColor: "#00BBFF",
    },
    rankOrgChipText: {
      fontFamily: theme.mediumFont,
      fontSize: 15,
      lineHeight: 18,
      color: "#1848BA",
      textAlign: "center",
    },
    rankOrgChipTextActive: {
      color: "#00BBFF",
    },
    rankingInputRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 54,
      borderRadius: 14,
      backgroundColor: "#07256D",
      paddingLeft: 16,
      paddingRight: 10,
      gap: 10,
      overflow: "hidden",
    },
    rankingInput: {
      flex: 1,
      color: "#00BBFF",
      backgroundColor: "#07256D",
      fontFamily: theme.semiBoldFont,
      fontSize: 28,
      paddingVertical: 10,
    },
    rankingInputCheck: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "#00BBFF",
      alignItems: "center",
      justifyContent: "center",
    },
    levelOtherInput: {
      marginTop: 10,
      minHeight: UI.fieldHeight,
      borderRadius: UI.radius,
      borderWidth: 1,
      borderColor: UI.trackBorder,
      backgroundColor: UI.surface,
      color: UI.text,
      fontFamily: theme.mediumFont,
      fontSize: 17,
      paddingHorizontal: 18,
      paddingVertical: 12,
      textAlignVertical: "center",
    },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" },
    chip: {
      width: "48.5%",
      borderRadius: 12,
      backgroundColor: "#0E2969",
      paddingHorizontal: 12,
      paddingVertical: 5,
      alignItems: "center",
    },
    chipActive: { backgroundColor: "rgba(0, 94, 255, 0.38)" },
    chipText: { fontFamily: theme.mediumFont, color: "#1F6CD0", fontSize: 14, lineHeight: 18 },
    chipTextActive: { color: "#fff" },
    rankLogoFallback: {
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont,
      letterSpacing: 1.6,
      fontSize: 18,
    },
    actionRow: {
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
  });
}
