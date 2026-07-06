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

const APP_LOGO = require("../../assets/logo.png");

export function SignIn() {
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
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" />
        </View>

        <AuthFormField
          theme={theme}
          placeholder={t("auth.email")}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={!loading}
          fieldStyle={styles.inputSpacing}
        />
        <AuthPasswordField
          theme={theme}
          placeholder={t("auth.password")}
          value={password}
          onChangeText={setPassword}
          autoComplete="password"
          editable={!loading && !socialLoading}
          wrapStyle={styles.inputSpacing}
        />

        <TouchableOpacity
          style={[styles.buttonOuter, (loading || socialLoading) && styles.buttonDisabled]}
          onPress={handleSignIn}
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
              <Text allowFontScaling={false} style={styles.buttonText}>{t("auth.signIn")}</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.8} style={styles.forgotWrap}>
          <Text allowFontScaling={false} style={styles.forgotText}>{t("auth.forgotPassword")}</Text>
        </TouchableOpacity>

        {enabledSocialProviders.length > 0 ? (
          <>
            <View style={styles.socialDividerRow}>
              <View style={styles.socialDividerLine} />
              <Text allowFontScaling={false} style={styles.socialDividerText}>{t("auth.orSignInWith")}</Text>
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
