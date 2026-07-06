import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useContext } from "react";
import { ThemeContext } from "../context";
import { authClient } from "../lib/auth-client";
import {
  signInWithSocial,
  type SocialProvider,
  getEnabledSocialProviders,
  formatSocialAuthError,
} from "../lib/socialAuth";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "../components/LanguageToggle";
import { CountryPickerModal } from "../components/CountryPickerModal";
import { AuthFormField } from "../components/AuthFormField";
import { AuthPasswordField } from "../components/AuthPasswordField";
import { AUTH_INPUT_FOCUS_BORDER, AUTH_INPUT_FOCUS_BORDER_WIDTH, AUTH_INPUT_ERROR_BORDER_WIDTH, createAuthFormStyles } from "../components/authFormStyles";
import { findCountry, type Country } from "../lib/countries";

const APP_LOGO = require("../../assets/logo.png");

export type SignUpDraft = {
  name: string;
  email: string;
  password: string;
  country: string;
  verificationToken?: string;
};

type SignUpProps = {
  onContinue?: (draft: SignUpDraft) => void;
  onBack?: () => void;
  initialDraft?: SignUpDraft | null;
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
      <Svg pointerEvents="none" style={styles.heroGlow}>
        <Defs>
          <SvgRadialGradient
            id="signUpRadialBg"
            cx="50%"
            cy="-30%"
            rx="120%"
            ry="95%"
          >
            <Stop offset="0%" stopColor="#071D47" stopOpacity={1} />
            <Stop offset="100%" stopColor="#071D47" stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#signUpRadialBg)" />
      </Svg>
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" />
        </View>
        <View style={styles.header}>
          <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.heroTitleTechniqueWeb}>
            {t("auth.signUpHeroTitle")}
          </Text>
          <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.subtitle}>
            {t("auth.signUpHeroSubtitle")}
          </Text>
        </View>

        <AuthFormField
          theme={theme}
          hasError={!!errors.name}
          placeholder={t("auth.name")}
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          autoComplete="name"
          editable={!loading && !socialLoading}
        />
        {errors.name ? <Text style={fieldStyles.errorText}>{errors.name}</Text> : null}
        <AuthFormField
          theme={theme}
          hasError={!!errors.email}
          placeholder={t("auth.email")}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={!loading && !socialLoading}
        />
        {errors.email ? <Text style={fieldStyles.errorText}>{errors.email}</Text> : null}
        <AuthPasswordField
          theme={theme}
          hasError={!!errors.password}
          placeholder={t("auth.passwordMinPlaceholder")}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          autoComplete="password-new"
          editable={!loading && !socialLoading}
        />
        {errors.password ? <Text style={fieldStyles.errorText}>{errors.password}</Text> : null}
        <AuthPasswordField
          theme={theme}
          hasError={!!errors.confirmPassword}
          placeholder={t("auth.repeatPassword")}
          value={confirmPassword}
          onChangeText={(v) => {
            setConfirmPassword(v);
            if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }}
          autoComplete="password-new"
          editable={!loading && !socialLoading}
        />
        {errors.confirmPassword ? <Text style={fieldStyles.errorText}>{errors.confirmPassword}</Text> : null}

        <TouchableOpacity
          style={[
            styles.countryTrigger,
            countryPickerOpen && styles.countryTriggerFocused,
            errors.country && styles.countryTriggerError,
          ]}
          onPress={() => setCountryPickerOpen(true)}
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
            <Text allowFontScaling={false} style={styles.countryTriggerPlaceholder} numberOfLines={1}>
              {t("auth.selectYourCountry")}
            </Text>
          )}
          <Ionicons name="chevron-down" size={18} color="rgba(200, 220, 255, 0.85)" />
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
            <View style={styles.socialDividerRow}>
              <View style={styles.socialDividerLine} />
              <Text allowFontScaling={false} style={styles.socialDividerText}>{t("auth.orCreateWith")}</Text>
              <View style={styles.socialDividerLine} />
            </View>

            <View style={styles.socialRow}>
              {enabledSocialProviders.map((provider) => (
                <TouchableOpacity
                  key={provider}
                  style={[styles.socialButton, socialLoading && styles.socialButtonDisabled]}
                  activeOpacity={0.85}
                  onPress={() => handleSocialSignUp(provider)}
                  disabled={!!socialLoading || loading}
                >
                  {socialLoading === provider ? (
                    <ActivityIndicator
                      color={provider === "facebook" ? "#2D7DFF" : "#FFFFFF"}
                      size="small"
                    />
                  ) : (
                    <Ionicons
                      name={
                        provider === "google"
                          ? "logo-google"
                          : provider === "facebook"
                            ? "logo-facebook"
                            : "logo-apple"
                      }
                      size={22}
                      color={provider === "facebook" ? "#2D7DFF" : "#FFFFFF"}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={props?.onBack}
            activeOpacity={0.85}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color="#00BBFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.buttonOuter, { flex: 1 }, (loading || socialLoading) && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={loading || !!socialLoading}
          >
            <LinearGradient
              colors={["#0022FF", "#00BBFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              {loading ? (
                <ActivityIndicator color={theme.tintTextColor} />
              ) : (
                <Text allowFontScaling={false} style={styles.buttonText}>{t("auth.signUp")}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <LanguageToggle />
      </View>
    </KeyboardAwareScrollView>
  );
}

function getStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
    },
    kasvContent: {
      flexGrow: 1,
      justifyContent: "center",
    },
    content: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingTop: 0,
    },
    logoWrap: {
      alignItems: "center",
      marginBottom: 32,
    },
    logoImage: {
      width: 172,
      height: 92,
    },
    header: {
      alignItems: "center",
      marginBottom: 22,
    },
    heroTitleTechniqueWeb: {
      fontSize: 34,
      fontFamily: theme.semiBoldFont,
      textAlign: "center",
      marginBottom: 8,
      color: "#FFFFFF",
    },
    subtitle: {
      fontSize: 12,
      fontFamily: theme.regularFont,
      color: "rgba(255,255,255,0.62)",
      textAlign: "center",
      marginTop: 0,
    },
    countryTrigger: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 0,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      minHeight: 48,
      backgroundColor: "#0B1F57",
      marginBottom: 10,
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
    buttonOuter: {
      borderRadius: 16,
      overflow: "hidden",
    },
    button: {
      minHeight: 54,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      fontSize: 17,
      fontFamily: theme.semiBoldFont,
      color: theme.tintTextColor,
    },
    actionRow: {
      marginTop: 14,
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
    },
    socialDividerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
      marginBottom: 14,
      gap: 8,
    },
    socialDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    socialDividerText: {
      fontSize: 12,
      color: "rgba(255,255,255,0.55)",
      fontFamily: theme.regularFont,
    },
    socialRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    socialButton: {
      flex: 1,
      height: 50,
      borderRadius: 16,
      backgroundColor: "#0B1F57",
      alignItems: "center",
      justifyContent: "center",
    },
    socialButtonDisabled: {
      opacity: 0.55,
    },
    heroGlow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 430,
      opacity: 1,
    },
  });
}
