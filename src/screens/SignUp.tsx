import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useContext } from "react";
import { ThemeContext } from "../context";
import { authClient } from "../lib/auth-client";
import { clearDismissedSession } from "../lib/signOut";
import {
  signInWithSocial,
  type SocialProvider,
  getEnabledSocialProviders,
  formatSocialAuthError,
} from "../lib/socialAuth";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "../components/LanguageToggle";
import { CountryPickerModal } from "../components/CountryPickerModal";
import { AuthFormField } from "../components/AuthFormField";
import { AuthPasswordField } from "../components/AuthPasswordField";
import { AUTH_INPUT_FOCUS_BORDER, AUTH_INPUT_FOCUS_BORDER_WIDTH, AUTH_INPUT_ERROR_BORDER_WIDTH, AUTH_ICON_COLOR, createAuthFormStyles } from "../components/authFormStyles";
import { findCountry, type Country } from "../lib/countries";
import { TEST_IDS } from '../lib/testIds'
import { AuthBackdrop, GlowButton, OrDivider, SocialAuthRow, UI } from "../components/ui";

const APP_LOGO = require("../../assets/logo.png");

export type SignUpDraft = {
  name: string;
  email: string;
  password: string;
  country: string;
  verificationToken?: string;
  /** Started from the welcome "Coach Signup" button. Recorded only; the coach role is still granted by an admin. */
  coachSignup?: boolean;
};

type SignUpProps = {
  onContinue?: (draft: SignUpDraft) => void;
  onBack?: () => void;
  /** "Already have an account? Sign in" */
  onSignIn?: () => void;
  initialDraft?: SignUpDraft | null;
  coachSignup?: boolean;
};

export function SignUp(props?: SignUpProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme } = useContext(ThemeContext);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    country?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const styles = getStyles(theme);
  const fieldStyles = createAuthFormStyles(theme);
  const enabledSocialProviders = getEnabledSocialProviders();

  useEffect(() => {
    if (!props?.initialDraft) return;
    setName(props.initialDraft.name || "");
    setEmail(props.initialDraft.email || "");
    setPassword(props.initialDraft.password || "");
    setConfirmPassword(props.initialDraft.password || "");
    setSelectedCountry(findCountry(props.initialDraft.country || ""));
  }, [props?.initialDraft]);

  const handleContinue = async () => {
    const nextErrors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
      country?: string;
    } = {};
    if (!name.trim()) nextErrors.name = t("auth.nameRequired");
    if (!email.trim()) nextErrors.email = t("auth.emailRequired");
    if (!password) {
      nextErrors.password = t("auth.passwordRequired");
    } else if (password.length < 8) {
      nextErrors.password = t("auth.passwordMin8");
    }
    if (!confirmPassword) {
      nextErrors.confirmPassword = t("auth.confirmRequired");
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = t("auth.passwordsMismatch");
    }
    if (!selectedCountry) {
      nextErrors.country = t("auth.countryRequired");
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      Alert.alert(t("auth.missingInfo"), t("auth.fixHighlighted"));
      return;
    }
    setErrors({});

    console.log("[Auth] SignUp onboarding step complete", {
      name: name.trim(),
      email: email.trim(),
    });
    setLoading(true);
    props?.onContinue?.({
      name: name.trim(),
      email: email.trim(),
      password,
      country: selectedCountry?.name ?? "",
      ...(props?.coachSignup ? { coachSignup: true } : {}),
    });
    setLoading(false);
  };

  const handleSocialSignUp = async (provider: SocialProvider) => {
    setSocialLoading(provider);
    try {
      const { error } = await signInWithSocial(provider);
      if (error) {
        Alert.alert(t("auth.signUpFailed"), formatSocialAuthError(error));
        return;
      }
      const sessionResult = await authClient.getSession().catch(() => null);
      const sessionData: any = (sessionResult as any)?.data ?? sessionResult;
      if (!sessionData?.user?.id || !sessionData?.session?.id) {
        Alert.alert(t("auth.signUpFailed"), t("auth.sessionErrorMsg"));
        return;
      }
      console.log("[Auth] Social sign-up success", {
        provider,
        userId: sessionData.user.id,
      });
      clearDismissedSession();
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.kasvContent}
      bottomOffset={insets.bottom + 8}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <AuthBackdrop id="signUpRadialBg" />
      <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.logoWrap}>
          <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" />
        </View>
        <View style={styles.header}>
          <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.heroTitleTechniqueWeb}>
            {t("auth.signUpHeroTitleLead")}
            <Text style={styles.heroTitleAccent}>{t("auth.signUpHeroTitleAccent")}</Text>
          </Text>
          <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.subtitle}>
            {t("auth.signUpHeroSubtitle")}
          </Text>
        </View>

        <AuthFormField
          theme={theme}
          hasError={!!errors.name}
          placeholder={t("auth.name")}
          testID={TEST_IDS.signupName}
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          autoComplete="name"
          editable={!loading && !socialLoading}
          leftIcon="person-outline"
        />
        {errors.name ? <Text style={fieldStyles.errorText}>{errors.name}</Text> : null}
        <AuthFormField
          theme={theme}
          hasError={!!errors.email}
          placeholder={t("auth.email")}
          testID={TEST_IDS.signupEmail}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={!loading && !socialLoading}
          leftIcon="mail-outline"
        />
        {errors.email ? <Text style={fieldStyles.errorText}>{errors.email}</Text> : null}
        <AuthPasswordField
          theme={theme}
          hasError={!!errors.password}
          placeholder={t("auth.passwordMinPlaceholder")}
          testID={TEST_IDS.signupPassword}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          autoComplete="password-new"
          editable={!loading && !socialLoading}
          leftIcon="lock-closed-outline"
        />
        {errors.password ? <Text style={fieldStyles.errorText}>{errors.password}</Text> : null}
        <AuthPasswordField
          theme={theme}
          hasError={!!errors.confirmPassword}
          placeholder={t("auth.repeatPassword")}
          testID={TEST_IDS.signupRepeat}
          value={confirmPassword}
          onChangeText={(v) => {
            setConfirmPassword(v);
            if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }}
          autoComplete="password-new"
          editable={!loading && !socialLoading}
          leftIcon="lock-closed-outline"
          toggleIcon="eye"
        />
        {errors.confirmPassword ? <Text style={fieldStyles.errorText}>{errors.confirmPassword}</Text> : null}

        <TouchableOpacity
          style={[
            styles.countryTrigger,
            countryPickerOpen && styles.countryTriggerFocused,
            errors.country && styles.countryTriggerError,
          ]}
          onPress={() => setCountryPickerOpen(true)}
          testID={TEST_IDS.signupCountry}
          activeOpacity={0.85}
          disabled={loading || !!socialLoading}
          accessibilityRole="button"
          accessibilityLabel={t("auth.selectYourCountry")}
        >
          {selectedCountry ? (
            <>
              <Image source={selectedCountry.flag} style={styles.countryTriggerFlag} />
              <Text allowFontScaling={false} style={styles.countryTriggerText} numberOfLines={1}>
                {selectedCountry.name}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="globe-outline" size={24} color={AUTH_ICON_COLOR} />
              <Text allowFontScaling={false} style={styles.countryTriggerPlaceholder} numberOfLines={1}>
                {t("auth.selectYourCountry")}
              </Text>
            </>
          )}
          <Ionicons name="chevron-down" size={20} color={UI.accent} />
        </TouchableOpacity>
        {errors.country ? <Text style={fieldStyles.errorText}>{errors.country}</Text> : null}

        <CountryPickerModal
          visible={countryPickerOpen}
          selected={selectedCountry}
          onSelect={(country) => {
            setSelectedCountry(country);
            if (errors.country) setErrors((prev) => ({ ...prev, country: undefined }));
          }}
          onClose={() => setCountryPickerOpen(false)}
        />

        {enabledSocialProviders.length > 0 ? (
          <>
            <OrDivider label={t("auth.orCreateWith")} style={styles.divider} />
            <SocialAuthRow
              providers={enabledSocialProviders}
              loading={socialLoading}
              disabled={loading}
              onPress={handleSocialSignUp}
            />
          </>
        ) : null}

        <GlowButton
          label={t("auth.signUp")}
          arrow
          onPress={handleContinue}
          loading={loading}
          disabled={!!socialLoading}
          testID={TEST_IDS.signupSubmit}
          style={styles.submit}
        />
        <LanguageToggle />
        {props?.onSignIn ? (
          <TouchableOpacity
            style={styles.switchLink}
            onPress={props.onSignIn}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text allowFontScaling={false} style={styles.switchText}>
              {t("auth.hasAccount")} <Text style={styles.switchTextBold}>{t("auth.signIn")}</Text>
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </KeyboardAwareScrollView>
  );
}

function getStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: UI.pageBg,
    },
    kasvContent: {
      flexGrow: 1,
      justifyContent: "center",
    },
    content: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    logoWrap: {
      alignItems: "center",
      marginBottom: 20,
    },
    logoImage: {
      width: 190,
      height: 100,
    },
    header: {
      alignItems: "center",
      marginBottom: 22,
    },
    heroTitleTechniqueWeb: {
      fontSize: 34,
      fontFamily: theme.mediumFont,
      textAlign: "center",
      marginBottom: 8,
      color: UI.text,
    },
    heroTitleAccent: {
      color: UI.accentStrong,
    },
    subtitle: {
      fontSize: 15,
      fontFamily: theme.regularFont,
      color: UI.textMuted,
      textAlign: "center",
    },
    countryTrigger: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: UI.surfaceBorder,
      borderRadius: UI.radius,
      paddingHorizontal: 18,
      paddingVertical: 12,
      minHeight: UI.fieldHeight,
      backgroundColor: UI.surface,
      marginBottom: 12,
    },
    countryTriggerFocused: {
      borderWidth: AUTH_INPUT_FOCUS_BORDER_WIDTH,
      borderColor: AUTH_INPUT_FOCUS_BORDER,
    },
    countryTriggerError: {
      borderWidth: AUTH_INPUT_ERROR_BORDER_WIDTH,
      borderColor: "#FF5A6A",
      backgroundColor: "rgba(70, 12, 20, 0.35)",
      marginBottom: 6,
    },
    countryTriggerFlag: {
      width: 26,
      height: 18,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.06)",
    },
    countryTriggerText: {
      flex: 1,
      fontSize: 15,
      fontFamily: theme.regularFont,
      color: theme.textColor,
    },
    countryTriggerPlaceholder: {
      flex: 1,
      fontSize: 15,
      fontFamily: theme.regularFont,
      color: theme.placeholderTextColor,
    },
    divider: {
      marginTop: 10,
      marginBottom: 18,
    },
    submit: {
      marginTop: 22,
    },
    switchLink: {
      alignItems: "center",
      paddingTop: 4,
    },
    switchText: {
      fontSize: 15,
      fontFamily: theme.regularFont,
      color: UI.textMuted,
    },
    switchTextBold: {
      fontFamily: theme.semiBoldFont,
      color: UI.accent,
    },
  });
}
