import React, { useState } from "react";
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
import { clearDismissedSession } from "../lib/signOut";
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
import { AuthFormField } from "../components/AuthFormField";
import { AuthPasswordField } from "../components/AuthPasswordField";
import { TEST_IDS } from '../lib/testIds'

const APP_LOGO = require("../../assets/logo.png");

type SignInProps = {
  onForgotPassword?: () => void;
  /** Opens sign up from the bottom card. */
  onSignUp?: () => void;
  /** Returns to the welcome slides. */
  onRestart?: () => void;
};

export function SignIn({ onForgotPassword, onSignUp, onRestart }: SignInProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme } = useContext(ThemeContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const styles = getStyles(theme);
  const enabledSocialProviders = getEnabledSocialProviders();

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert(t("common.error"), t("auth.enterEmailPassword"));
      return;
    }
    console.log("[Auth] SignIn pressed", {
      email: email.trim(),
    });
    setLoading(true);
    const { error } = await authClient.signIn.email({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      console.log("[Auth] SignIn error", {
        email: email.trim(),
        message: error.message,
        code: (error as any)?.code,
        hasSession: false,
        hasUser: false,
        hasSessionId: false,
      });
      Alert.alert(t("auth.signInFailed"), error.message || t("auth.sessionErrorMsg"));
      return;
    }

    const sessionResult = await authClient.getSession().catch(() => null);
    const sessionData: any = (sessionResult as any)?.data ?? sessionResult;
    setLoading(false);
    if (!sessionData?.user?.id || !sessionData?.session?.id) {
      console.log("[Auth] SignIn error", {
        email: email.trim(),
        message: "No session after sign-in",
        code: undefined,
        hasSession: !!sessionData,
        hasUser: !!sessionData?.user,
        hasSessionId: !!sessionData?.session?.id,
      });
      Alert.alert(t("auth.signInFailed"), t("auth.sessionErrorMsg"));
      return;
    }
    console.log("[Auth] SignIn success", {
      email: email.trim(),
      userId: sessionData.user.id,
      sessionId: sessionData.session.id,
    });
    clearDismissedSession();
  };

  const handleSocialSignIn = async (provider: SocialProvider) => {
    setSocialLoading(provider);
    try {
      const { error } = await signInWithSocial(provider);
      if (error) {
        console.log("[Auth] Sociall sign-in error", { provider, message: error.message });
        Alert.alert(t("auth.signInFailed"), formatSocialAuthError(error));
        return;
      }
      const sessionResult = await authClient.getSession().catch(() => null);
      const sessionData: any = (sessionResult as any)?.data ?? sessionResult;
      if (!sessionData?.user?.id || !sessionData?.session?.id) {
        Alert.alert(t("auth.signInFailed"), t("auth.sessionErrorMsg"));
        return;
      }
      console.log("[Auth] Social sign-in success", {
        provider,
        userId: sessionData.user.id,
        sessionId: sessionData.session.id,
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
      <Svg pointerEvents="none" style={styles.heroGlow}>
        <Defs>
          <SvgRadialGradient
            id="signInRadialBg"
            cx="50%"
            cy="-30%"
            rx="120%"
            ry="95%"
          >
            <Stop offset="0%" stopColor="#071D47" stopOpacity={1} />
            <Stop offset="100%" stopColor="#071D47" stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#signInRadialBg)" />
      </Svg>
      <View style={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
        {onRestart ? (
          <TouchableOpacity
            style={styles.restartTouch}
            onPress={onRestart}
            testID={TEST_IDS.signinRestart}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text allowFontScaling={false} style={styles.restartText}>{t("auth.restart")}</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.logoWrap}>
          <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" />
        </View>

        <AuthFormField
          theme={theme}
          placeholder={t("auth.email")}
          testID={TEST_IDS.signinEmail}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={!loading}
          fieldStyle={styles.inputSpacing}
          leftIcon="mail-outline"
        />
        <AuthPasswordField
          theme={theme}
          placeholder={t("auth.password")}
          testID={TEST_IDS.signinPassword}
          value={password}
          onChangeText={setPassword}
          autoComplete="password"
          editable={!loading && !socialLoading}
          wrapStyle={styles.inputSpacing}
          leftIcon="lock-closed-outline"
        />

        <TouchableOpacity
          style={[styles.buttonOuter, (loading || socialLoading) && styles.buttonDisabled]}
          onPress={handleSignIn}
          testID={TEST_IDS.signinSubmit}
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
              <View style={styles.buttonRow}>
                <Text allowFontScaling={false} style={styles.buttonText}>{t("auth.signIn")}</Text>
                <Ionicons name="arrow-forward" size={20} color={theme.tintTextColor} />
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.forgotWrap}
          onPress={onForgotPassword}
          testID={TEST_IDS.signinForgot}
          disabled={!onForgotPassword || loading || !!socialLoading}
          accessibilityRole="button"
        >
          <Text allowFontScaling={false} style={styles.forgotText}>{t("auth.forgotPassword")}</Text>
        </TouchableOpacity>

        {enabledSocialProviders.length > 0 ? (
          <>
            <View style={styles.socialDividerRow}>
              <View style={styles.socialDividerLine} />
              <Text allowFontScaling={false} style={styles.socialDividerText}>{t("auth.orLogInWith")}</Text>
              <View style={styles.socialDividerLine} />
            </View>

            <View style={styles.socialRow}>
              {enabledSocialProviders.map((provider) => (
                <TouchableOpacity
                  key={provider}
                  style={[styles.socialButton, socialLoading && styles.socialButtonDisabled]}
                  activeOpacity={0.85}
                  onPress={() => handleSocialSignIn(provider)}
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
        <LanguageToggle />

        {onSignUp ? (
          <View style={styles.signUpCard}>
            <View style={styles.signUpCardIcon}>
              <Ionicons name="person-add-outline" size={22} color="#3D8BFF" />
            </View>
            <Text allowFontScaling={false} style={styles.signUpCardText} numberOfLines={2}>
              {t("auth.noAccount")}
            </Text>
            <TouchableOpacity
              style={styles.signUpCardBtnOuter}
              onPress={onSignUp}
              testID={TEST_IDS.signinToSignup}
              activeOpacity={0.9}
              accessibilityRole="button"
              disabled={loading || !!socialLoading}
            >
              <LinearGradient
                colors={["#0022FF", "#00BBFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.signUpCardBtn}
              >
                <Text allowFontScaling={false} style={styles.signUpCardBtnText}>{t("auth.signUp")}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : null}
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
    restartTouch: {
      alignSelf: "flex-end",
      marginBottom: 8,
    },
    restartText: {
      color: "rgba(165,196,235,0.92)",
      fontSize: 15,
      fontFamily: theme.mediumFont,
    },
    logoWrap: {
      alignItems: "center",
      marginBottom: 42,
    },
    logoImage: {
      width: 172,
      height: 92,
    },
    inputSpacing: {
      marginBottom: 12,
    },
    buttonOuter: {
      borderRadius: 14,
      overflow: "hidden",
      marginTop: 14,
    },
    button: {
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      fontSize: 17,
      fontFamily: theme.semiBoldFont,
      color: theme.tintTextColor,
    },
    forgotWrap: {
      alignItems: "center",
      marginTop: 14,
      marginBottom: 18,
    },
    forgotText: {
      color: "#18C0FF",
      fontSize: 12,
      fontFamily: theme.regularFont,
    },
    socialDividerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
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
      marginBottom: 8,
    },
    socialButton: {
      flex: 1,
      height: 50,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(21, 102, 196, 0.45)",
      backgroundColor: "#0B1F57",
      alignItems: "center",
      justifyContent: "center",
    },
    signUpCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 28,
      padding: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(21, 102, 196, 0.45)",
      backgroundColor: "#06143D",
    },
    signUpCardIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: "#0B1F57",
      alignItems: "center",
      justifyContent: "center",
    },
    signUpCardText: {
      flex: 1,
      minWidth: 0,
      color: "#FFFFFF",
      fontSize: 15,
      fontFamily: theme.mediumFont,
    },
    signUpCardBtnOuter: {
      borderRadius: 14,
      overflow: "hidden",
    },
    signUpCardBtn: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    signUpCardBtnText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontFamily: theme.semiBoldFont,
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
