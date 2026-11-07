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
import { CourtSideGraphic } from "../components/CourtSideGraphic";
import { CaretDownIcon } from "../components/AuthFieldIcons";
import { TEST_IDS } from '../lib/testIds'
import { CARD, FIELD_BOX, FIELD_BOX_ACTIVE, FIELD_PLACEHOLDER_COLOR, GlowButton, OptionButton, SegmentedToggle, SurfaceIconButton, UI } from "../components/ui";

const SELECTION_BOX_BG = "#041641";
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

export function ProfileSetup({ onComplete, signUpDraft, mode = "onboarding", onBack }: ProfileSetupProps) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const screenBg = theme.backgroundColor ?? "#030A17";
  const styles = getStyles(theme);
  const [step, setStep] = useState(1);
  /** Which stacked anthropometric field is focused (drives the active field border). */
  const [anthroFocus, setAnthroFocus] = useState<"height" | "weight" | null>(null);
  const [levelOtherFocused, setLevelOtherFocused] = useState(false);
  /** Height unit shown in the field; the profile always stores centimetres. */
  const [heightUnit, setHeightUnit] = useState<"cm" | "ft">("cm");
  const [heightUnitMenuOpen, setHeightUnitMenuOpen] = useState(false);
  const [heightFt, setHeightFt] = useState("");
  /** Weight unit shown in the field; the profile always stores kilograms. */
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [weightUnitMenuOpen, setWeightUnitMenuOpen] = useState(false);
  const [weightLbInput, setWeightLbInput] = useState("");
  const [heightIn, setHeightIn] = useState("");
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

  /** Feet + inches → centimetres (rounded), kept in `heightCmInput` so validation and saving stay in cm. */
  const setImperialHeight = (part: "ft" | "in", v: string) => {
    const ft = part === "ft" ? v : heightFt;
    const inch = part === "in" ? v : heightIn;
    if (part === "ft") setHeightFt(v);
    else setHeightIn(v);
    const totalIn = Number(ft || 0) * 12 + Number(inch || 0);
    setHeightCmInput(ft || inch ? String(Math.round(totalIn * 2.54)) : "");
  };

  /** Pounds → kilograms (1 decimal), kept in `weightKgInput` so validation and saving stay in kg. */
  const setWeightLb = (v: string) => {
    setWeightLbInput(v);
    const lb = Number(v);
    setWeightKgInput(v && lb > 0 ? String(Math.round(lb * 0.45359237 * 10) / 10) : "");
  };

  const chooseWeightUnit = (u: "kg" | "lb") => {
    setWeightUnitMenuOpen(false);
    if (u === weightUnit) return;
    if (u === "lb") {
      const kg = Number(weightKgInput);
      setWeightLbInput(kg > 0 ? String(Math.round(kg / 0.45359237)) : "");
    }
    setWeightUnit(u);
  };

  const chooseHeightUnit = (u: "cm" | "ft") => {
    setHeightUnitMenuOpen(false);
    if (u === heightUnit) return;
    if (u === "ft") {
      const cm = Number(heightCmInput);
      if (cm > 0) {
        const totalIn = Math.round(cm / 2.54);
        setHeightFt(String(Math.floor(totalIn / 12)));
        setHeightIn(String(totalIn % 12));
      } else {
        setHeightFt("");
        setHeightIn("");
      }
    }
    setHeightUnit(u);
  };
  const [weightKgInput, setWeightKgInput] = useState("");
  const [hasRanking, setHasRanking] = useState<boolean | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [customLevelText, setCustomLevelText] = useState("");
  const [rankingOrg, setRankingOrg] = useState<string | null>("WPR");
  const [rankingValue, setRankingValue] = useState("");

  const standardLevelOptions = LEVEL_OPTION_VALUES.filter((opt) => opt !== "Other");

  /** Out-of-range hints, shown only once something has been typed (empty fields just keep the button disabled). */
  const heightOutOfRange = heightCmInput !== "" && !(Number(heightCmInput) >= 100 && Number(heightCmInput) <= 250);
  const weightOutOfRange = weightKgInput !== "" && !(Number(weightKgInput) >= 30 && Number(weightKgInput) <= 250);

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

  return (
    <View style={styles.screen}>
      <LinearGradient
        pointerEvents="none"
        colors={["#071D47", screenBg]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.4 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Design: every setup step (Player details, Set your Level) uses the app header. */}
      <Header />
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
              (step === 2 ? 72 : 0),
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

          {isEditMode ? (
            <View style={styles.selectionBox}>
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
            </View>
          ) : (
            <>
              {/* Height: value + cm/ft unit dropdown. Centimetres stay the source of truth (heightCmInput). */}
              <View
                style={[
                  styles.measureField,
                  anthroFocus === "height" && FIELD_BOX_ACTIVE,
                  heightUnitMenuOpen && styles.measureFieldRaised,
                ]}
              >
                <View style={styles.measureCol}>
                  <Text allowFontScaling={false} style={styles.measureLabel}>
                    {t("profileSetup.heightLabel")}
                  </Text>
                  {heightUnit === "cm" ? (
                    <View style={styles.valueRow}>
                      <TextInput
                        allowFontScaling={false}
                        value={heightCmInput}
                        onChangeText={(v) => setHeightCmInput(v.replace(/[^0-9.]/g, ""))}
                        onFocus={() => setAnthroFocus("height")}
                        onBlur={() => setAnthroFocus((cur) => (cur === "height" ? null : cur))}
                        keyboardType="decimal-pad"
                        placeholder={t("profileSetup.heightPlaceholder")}
                        testID={TEST_IDS.setupHeight}
                        placeholderTextColor={FIELD_PLACEHOLDER_COLOR}
                        style={styles.measureInput}
                      />
                      {/* Design shows the unit after the number ("170 cm"). */}
                      {heightCmInput ? (
                        <Text allowFontScaling={false} style={styles.valueSuffix}>
                          {t("profileSetup.cm")}
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.imperialRow}>
                      {(
                        [
                          { key: "ft" as const, value: heightFt, placeholder: "5", suffix: t("profileSetup.ft") },
                          { key: "in" as const, value: heightIn, placeholder: "11", suffix: t("profileSetup.in") },
                        ]
                      ).map((part) => (
                        <View key={part.key} style={styles.imperialPart}>
                          <TextInput
                            allowFontScaling={false}
                            value={part.value}
                            onChangeText={(v) => setImperialHeight(part.key, v.replace(/[^0-9]/g, "").slice(0, 2))}
                            onFocus={() => setAnthroFocus("height")}
                            onBlur={() => setAnthroFocus((cur) => (cur === "height" ? null : cur))}
                            keyboardType="number-pad"
                            placeholder={part.placeholder}
                            testID={`${TEST_IDS.setupHeight}-${part.key}`}
                            placeholderTextColor={FIELD_PLACEHOLDER_COLOR}
                            style={[styles.measureInput, styles.imperialInput]}
                          />
                          <Text allowFontScaling={false} style={styles.imperialSuffix}>
                            {part.suffix}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.unitTrigger}
                  onPress={() => {
                    setWeightUnitMenuOpen(false);
                    setHeightUnitMenuOpen((o) => !o);
                  }}
                  activeOpacity={0.75}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={t("profileSetup.heightUnit")}
                  accessibilityState={{ expanded: heightUnitMenuOpen }}
                  testID={`${TEST_IDS.setupHeight}-unit`}
                >
                  <Text allowFontScaling={false} style={styles.measureUnit}>
                    {heightUnit === "cm" ? t("profileSetup.cm") : t("profileSetup.ft")}
                  </Text>
                  <CaretDownIcon size={20} color="#86A7D2" />
                </TouchableOpacity>
                {heightUnitMenuOpen ? (
                  <View style={styles.unitMenu} accessibilityRole="menu">
                    {(["cm", "ft"] as const).map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[styles.unitOption, heightUnit === u && styles.unitOptionActive]}
                        onPress={() => chooseHeightUnit(u)}
                        activeOpacity={0.8}
                        accessibilityRole="menuitem"
                        accessibilityState={{ selected: heightUnit === u }}
                        testID={`${TEST_IDS.setupHeight}-unit-${u}`}
                      >
                        <Text
                          allowFontScaling={false}
                          style={[styles.unitOptionText, heightUnit === u && styles.unitOptionTextActive]}
                        >
                          {u === "cm" ? t("profileSetup.cm") : t("profileSetup.ftIn")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>

              {heightOutOfRange ? (
                <Text allowFontScaling={false} style={styles.measureError} testID={`${TEST_IDS.setupHeight}-error`}>
                  {heightUnit === "cm" ? t("profileSetup.heightRangeCm") : t("profileSetup.heightRangeFt")}
                </Text>
              ) : null}

              <View
                style={[
                  styles.measureField,
                  anthroFocus === "weight" && FIELD_BOX_ACTIVE,
                  weightUnitMenuOpen && styles.measureFieldRaised,
                ]}
              >
                <View style={styles.measureCol}>
                  <Text allowFontScaling={false} style={styles.measureLabel}>
                    {t("profileSetup.weightLabel")}
                  </Text>
                  <View style={styles.valueRow}>
                    <TextInput
                      allowFontScaling={false}
                      value={weightUnit === "kg" ? weightKgInput : weightLbInput}
                      onChangeText={(v) => {
                        const clean = v.replace(/[^0-9.]/g, "");
                        if (weightUnit === "kg") setWeightKgInput(clean);
                        else setWeightLb(clean);
                      }}
                      onFocus={() => setAnthroFocus("weight")}
                      onBlur={() => setAnthroFocus((cur) => (cur === "weight" ? null : cur))}
                      keyboardType="decimal-pad"
                      placeholder={weightUnit === "kg" ? t("profileSetup.weightPlaceholder") : t("profileSetup.weightPlaceholderLb")}
                      testID={weightUnit === "kg" ? TEST_IDS.setupWeight : `${TEST_IDS.setupWeight}-lb`}
                      placeholderTextColor={FIELD_PLACEHOLDER_COLOR}
                      style={styles.measureInput}
                    />
                    {(weightUnit === "kg" ? weightKgInput : weightLbInput) ? (
                      <Text allowFontScaling={false} style={styles.valueSuffix}>
                        {weightUnit === "kg" ? t("profileSetup.kg") : t("profileSetup.lb")}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.unitTrigger}
                  onPress={() => {
                    setHeightUnitMenuOpen(false);
                    setWeightUnitMenuOpen((o) => !o);
                  }}
                  activeOpacity={0.75}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={t("profileSetup.weightUnit")}
                  accessibilityState={{ expanded: weightUnitMenuOpen }}
                  testID={`${TEST_IDS.setupWeight}-unit`}
                >
                  <Text allowFontScaling={false} style={styles.measureUnit}>
                    {weightUnit === "kg" ? t("profileSetup.kg") : t("profileSetup.lb")}
                  </Text>
                  <CaretDownIcon size={20} color="#86A7D2" />
                </TouchableOpacity>
                {weightUnitMenuOpen ? (
                  <View style={styles.unitMenu} accessibilityRole="menu">
                    {(["kg", "lb"] as const).map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[styles.unitOption, weightUnit === u && styles.unitOptionActive]}
                        onPress={() => chooseWeightUnit(u)}
                        activeOpacity={0.8}
                        accessibilityRole="menuitem"
                        accessibilityState={{ selected: weightUnit === u }}
                        testID={`${TEST_IDS.setupWeight}-unit-${u}`}
                      >
                        <Text
                          allowFontScaling={false}
                          style={[styles.unitOptionText, weightUnit === u && styles.unitOptionTextActive]}
                        >
                          {u === "kg" ? t("profileSetup.kg") : t("profileSetup.lb")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
              {weightOutOfRange ? (
                <Text allowFontScaling={false} style={styles.measureError} testID={`${TEST_IDS.setupWeight}-error`}>
                  {weightUnit === "kg" ? t("profileSetup.weightRangeKg") : t("profileSetup.weightRangeLb")}
                </Text>
              ) : null}
            </>
          )}

          <View style={styles.actionRow}>
            <SurfaceIconButton
              icon="chevron-back"
              onPress={onBack}
              accessibilityLabel={t("profileSetup.goBack")}
            />
            <GlowButton
              style={styles.actionPrimary}
              label={t("profileSetup.setYourRankingBtn")}
              onPress={() => {
                // Onboarding skips the "Do you have a ranking?" screen and goes straight to the level picker.
                chooseHasRanking("no");
                setStep(2);
              }}
              testID={TEST_IDS.setupStep1Next}
              disabled={!canContinueStep1}
            />
          </View>
          </>
        )}

        {step === 2 && (
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
                  <View style={[styles.levelOtherBox, levelOtherFocused && FIELD_BOX_ACTIVE]}>
                    <TextInput
                      value={customLevelText}
                      onChangeText={(text) => {
                        setCustomLevelText(text);
                        const trimmed = text.trim();
                        setLevel(trimmed.length > 0 ? trimmed : null);
                      }}
                      onFocus={() => {
                        setLevelOtherFocused(true);
                        if (
                          level &&
                          (standardLevelOptions as readonly string[]).includes(level)
                        ) {
                          setLevel(customLevelText.trim() || null);
                        }
                      }}
                      onBlur={() => setLevelOtherFocused(false)}
                      style={styles.levelOtherInput}
                      testID="setup-level-other"
                      placeholder={t(levelTranslationKey("Other"))}
                      placeholderTextColor={UI.textMuted}
                      allowFontScaling={false}
                      underlineColorAndroid="transparent"
                    />
                  </View>
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
                  setStep(1);
                }}
                accessibilityLabel={t("profileSetup.goBack")}
              />
              <GlowButton
                style={styles.actionPrimary}
                label={t("common.done")}
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

function getStyles(theme: any) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
    },
    container: { flex: 1, backgroundColor: "transparent" },
    content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40, gap: 14 },
    contentStep1: {
      paddingTop: 20,
      paddingBottom: 28,
    },
    contentStep2: {
      paddingTop: 20,
      paddingBottom: 28,
      gap: 18,
    },
    /** Design: "Set your Level" — #FFF, Inter 500 20px (matches the Player details questions). */
    rankingTitle: {
      fontFamily: theme.mediumFont,
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
      ...CARD,
      paddingHorizontal: 19,
      paddingVertical: 24,
      gap: 16,
    },
    /** Design: "Are you:" / court question — #FFF, Inter 500 20px. */
    boxTitle: {
      fontFamily: theme.mediumFont,
      fontSize: 20,
      color: "#FFFFFF",
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
    /** Stacked Height / Weight fields: shared field box, label above the value, unit on the right. */
    measureField: {
      ...FIELD_BOX,
      height: 64,
      marginBottom: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    measureCol: {
      flex: 1,
      minWidth: 0,
      justifyContent: "center",
    },
    measureLabel: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: "#86A7D2",
    },
    measureInput: {
      color: "#FFFFFF",
      fontFamily: theme.mediumFont,
      fontSize: 18,
      padding: 0,
      margin: 0,
      ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
    },
    measureUnit: {
      fontFamily: theme.regularFont,
      fontSize: 18,
      color: "#86A7D2",
    },
    /** Number + unit on one line ("170 cm"); the input sizes to its text so the unit follows it. */
    valueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    valueSuffix: {
      fontFamily: theme.mediumFont,
      fontSize: 18,
      color: "#FFFFFF",
    },
    measureError: {
      fontFamily: theme.mediumFont,
      fontSize: 12,
      color: UI.error,
      marginTop: -8,
      paddingHorizontal: 4,
    },
    /** Lifts the height field (and its open unit menu) above the weight field. */
    measureFieldRaised: {
      zIndex: 10,
      elevation: 10,
    },
    unitTrigger: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    unitMenu: {
      position: "absolute",
      right: 10,
      top: 58,
      minWidth: 120,
      borderRadius: 16,
      backgroundColor: "#041641",
      borderWidth: 1,
      borderColor: "rgba(0, 184, 255, 0.35)",
      boxShadow: "0px 8px 24px 0px rgba(0, 0, 0, 0.45), 0px 0px 30px 0px rgba(0, 72, 255, 0.5) inset",
      paddingVertical: 6,
      zIndex: 20,
      elevation: 20,
    },
    unitOption: {
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    unitOptionActive: {
      backgroundColor: "rgba(0, 184, 255, 0.12)",
    },
    unitOptionText: {
      fontFamily: theme.regularFont,
      fontSize: 16,
      color: "#86A7D2",
    },
    unitOptionTextActive: {
      fontFamily: theme.mediumFont,
      color: "#00B8FF",
    },
    imperialRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 14,
    },
    imperialPart: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 4,
    },
    imperialInput: {
      minWidth: 24,
    },
    imperialSuffix: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: "#86A7D2",
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
      gap: 6,
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
    /** Box carries border/background/glow so focus (FIELD_BOX_ACTIVE) never shifts the text. */
    levelOtherBox: {
      marginTop: 14,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: UI.trackBorder,
      backgroundColor: UI.surface,
      justifyContent: "center",
    },
    levelOtherInput: {
      flex: 1,
      color: UI.text,
      fontFamily: theme.mediumFont,
      fontSize: 14,
      paddingHorizontal: 18,
      paddingVertical: 0,
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
