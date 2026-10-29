import React, { useState } from "react";
import {
  View,
  Text,
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
import { AuthFormField } from "../components/AuthFormField";
import { AuthPasswordField } from "../components/AuthPasswordField";
import { TEST_IDS } from '../lib/testIds'
import { AuthBackdrop, GlassCard, GlowButton, OrDivider, SocialAuthRow, SurfaceIconButton, TextLink, UI } from "../components/ui";

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

  const busy = loading || !!socialLoading;

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.kasvContent}
      bottomOffset={insets.bottom + 8}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <AuthBackdrop id="signInRadialBg" />
      <View style={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.logoWrap}>
          <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" />
        </View>

        <Text allowFontScaling={false} style={styles.title}>{t("auth.signIn")}</Text>

        <AuthFormField
          theme={theme}
          label={t("auth.email")}
          testID={TEST_IDS.signinEmail}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={!loading}
        />
        <AuthPasswordField
          theme={theme}
          label={t("auth.password")}
          testID={TEST_IDS.signinPassword}
          value={password}
          onChangeText={setPassword}
          autoComplete="password"
          editable={!busy}
        />

        {enabledSocialProviders.length > 0 ? (
          <>
            <OrDivider label={t("auth.orLogInWith")} style={styles.divider} />
            <SocialAuthRow
              providers={enabledSocialProviders}
              loading={socialLoading}
              disabled={loading}
              onPress={handleSocialSignIn}
            />
          </>
        ) : null}

        <View style={styles.actionRow}>
          {onRestart ? (
            <SurfaceIconButton
              icon="chevron-back"
              onPress={onRestart}
              accessibilityLabel={t("auth.restart")}
              testID={TEST_IDS.signinRestart}
            />
          ) : null}
          <GlowButton
            label={t("auth.signIn")}
            onPress={handleSignIn}
            loading={loading}
            disabled={!!socialLoading}
            testID={TEST_IDS.signinSubmit}
            style={styles.submit}
          />
        </View>

        <TextLink
          label={t("auth.forgotPassword")}
          onPress={onForgotPassword}
          testID={TEST_IDS.signinForgot}
          disabled={busy}
          style={styles.forgot}
        />

        <LanguageToggle />

        {onSignUp ? (
          <GlassCard style={styles.signUpCard}>
            <Ionicons name="person-add-outline" size={36} color={UI.accent} />
            <Text allowFontScaling={false} style={styles.signUpCardText} numberOfLines={2}>
              {t("auth.noAccount")}
            </Text>
            <GlowButton
              label={t("auth.signUp")}
              arrow
              onPress={onSignUp}
              disabled={busy}
              testID={TEST_IDS.signinToSignup}
            />
          </GlassCard>
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
      marginBottom: 56,
    },
    logoImage: {
      width: 190,
      height: 100,
    },
    title: {
      color: UI.text,
      fontSize: 24,
      fontFamily: theme.regularFont,
      marginBottom: 20,
    },
    divider: {
      marginTop: 18,
      marginBottom: 22,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 28,
    },
    submit: {
      flex: 1,
    },
    forgot: {
      alignSelf: "flex-end",
      marginTop: 18,
    },
    signUpCard: {
      alignItems: "center",
      marginTop: 24,
    },
    signUpCardText: {
      color: UI.textMuted,
      fontSize: 15,
      fontFamily: theme.regularFont,
      marginBottom: 4,
    },
  });
}
