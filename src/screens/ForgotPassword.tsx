import React, { useContext, useEffect, useState } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../context";
import { LanguageToggle } from "../components/LanguageToggle";
import { AuthFormField } from "../components/AuthFormField";
import { AuthPasswordField } from "../components/AuthPasswordField";
import { createAuthFormStyles } from "../components/authFormStyles";
import { requestPasswordResetCode, resetPasswordWithCode } from "../lib/passwordReset";

const APP_LOGO = require("../../assets/logo.png");
const RESEND_COOLDOWN_SEC = 60;

type ForgotPasswordProps = {
  onBack: () => void;
  initialEmail?: string;
};

export function ForgotPassword({ onBack, initialEmail = "" }: ForgotPasswordProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme } = useContext(ThemeContext);
  const styles = getStyles(theme);
  const fieldStyles = createAuthFormStyles(theme);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendSec, setResendSec] = useState(0);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();

  useEffect(() => {
    if (resendSec <= 0) return;
    const id = setInterval(() => {
      setResendSec((sec) => (sec > 0 ? sec - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [resendSec]);

  const failureMessage = (
    result: { messageKey: string | null; message?: string },
    fallbackKey: "auth.sendCodeFailed" | "auth.resetFailed"
  ) => (result.messageKey ? t(result.messageKey) : result.message || t(fallbackKey));

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setEmailError(t("auth.emailRequired"));
      return;
    }
    setLoading(true);
    const result = await requestPasswordResetCode(trimmed);
    setLoading(false);
    if (!result.ok) {
      Alert.alert(t("auth.sendCodeFailed"), failureMessage(result, "auth.sendCodeFailed"));
      return;
    }
    setEmail(trimmed);
    setResendSec(RESEND_COOLDOWN_SEC);
    setStep("code");
  };

  const handleResend = async () => {
    if (resendSec > 0 || loading) return;
    setLoading(true);
    const result = await requestPasswordResetCode(email);
    setLoading(false);
    if (!result.ok) {
      Alert.alert(t("auth.sendCodeFailed"), failureMessage(result, "auth.sendCodeFailed"));
      return;
    }
    setResendSec(RESEND_COOLDOWN_SEC);
  };

  const handleReset = async () => {
    const trimmedCode = code.trim();
    let blocked = false;
    if (!/^\d{6}$/.test(trimmedCode)) {
      setCodeError(t("auth.invalidResetCode"));
      blocked = true;
    }
    if (!password) {
      setPasswordError(t("auth.passwordRequired"));
      blocked = true;
    } else if (password.length < 8) {
      setPasswordError(t("auth.passwordMin8"));
      blocked = true;
    }
    if (confirmPassword !== password) {
      setConfirmError(t("auth.passwordsMismatch"));
      blocked = true;
    }
    if (blocked) return;

    setLoading(true);
    const result = await resetPasswordWithCode({
      email,
      otp: trimmedCode,
      password,
    });
    setLoading(false);
    if (!result.ok) {
      Alert.alert(t("auth.resetFailed"), failureMessage(result, "auth.resetFailed"));
      return;
    }
    Alert.alert(t("auth.passwordUpdatedTitle"), t("auth.passwordUpdatedMsg"));
    onBack();
  };

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={[styles.kasvContent, { paddingBottom: insets.bottom + 16 }]}
      bottomOffset={insets.bottom + 8}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Svg pointerEvents="none" style={styles.heroGlow}>
        <Defs>
          <SvgRadialGradient id="forgotRadialBg" cx="50%" cy="-30%" rx="120%" ry="95%">
            <Stop offset="0%" stopColor="#071D47" stopOpacity={1} />
            <Stop offset="100%" stopColor="#071D47" stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#forgotRadialBg)" />
      </Svg>
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" />
        </View>
        <View style={styles.header}>
          <Text allowFontScaling={false} style={styles.title}>
            {step === "email" ? t("auth.forgotTitle") : t("auth.resetTitle")}
          </Text>
          <Text allowFontScaling={false} style={styles.subtitle}>
            {step === "email" ? t("auth.forgotSubtitle") : t("auth.resetSubtitle", { email })}
          </Text>
        </View>

        {step === "email" ? (
          <>
            <AuthFormField
              theme={theme}
              hasError={!!emailError}
              placeholder={t("auth.email")}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (emailError) setEmailError(undefined);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!loading}
              fieldStyle={styles.inputSpacing}
            />
            {emailError ? <Text style={fieldStyles.errorText}>{emailError}</Text> : null}
          </>
        ) : (
          <>
            <AuthFormField
              theme={theme}
              hasError={!!codeError}
              placeholder={t("auth.resetCodePlaceholder")}
              value={code}
              onChangeText={(value) => {
                setCode(value.replace(/\D/g, "").slice(0, 6));
                if (codeError) setCodeError(undefined);
              }}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              editable={!loading}
              fieldStyle={styles.inputSpacing}
            />
            {codeError ? <Text style={fieldStyles.errorText}>{codeError}</Text> : null}
            <AuthPasswordField
              theme={theme}
              hasError={!!passwordError}
              placeholder={t("auth.passwordMinPlaceholder")}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (passwordError) setPasswordError(undefined);
              }}
              autoComplete="password-new"
              editable={!loading}
              wrapStyle={styles.inputSpacing}
            />
            {passwordError ? <Text style={fieldStyles.errorText}>{passwordError}</Text> : null}
            <AuthPasswordField
              theme={theme}
              hasError={!!confirmError}
              placeholder={t("auth.repeatPassword")}
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                if (confirmError) setConfirmError(undefined);
              }}
              autoComplete="password-new"
              editable={!loading}
              wrapStyle={styles.inputSpacing}
            />
            {confirmError ? <Text style={fieldStyles.errorText}>{confirmError}</Text> : null}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.resendTouch}
              onPress={() => void handleResend()}
              disabled={loading || resendSec > 0}
            >
              <Text
                allowFontScaling={false}
                style={[styles.resendText, (loading || resendSec > 0) && styles.resendDisabled]}
              >
                {resendSec > 0
                  ? t("verifyEmail.resendIn", { seconds: resendSec })
                  : t("verifyEmail.resend")}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (step === "code") {
                setStep("email");
                return;
              }
              onBack();
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="chevron-back" size={22} color="#00BBFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.buttonOuter, loading && styles.buttonDisabled]}
            onPress={() => void (step === "email" ? handleSendCode() : handleReset())}
            disabled={loading}
            activeOpacity={0.85}
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
                <Text allowFontScaling={false} style={styles.buttonText}>
                  {step === "email" ? t("auth.sendCode") : t("auth.updatePassword")}
                </Text>
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
      marginBottom: 28,
    },
    logoImage: {
      width: 172,
      height: 92,
    },
    header: {
      alignItems: "center",
      marginBottom: 22,
    },
    title: {
      fontSize: 28,
      fontFamily: theme.semiBoldFont,
      textAlign: "center",
      marginBottom: 8,
      color: "#FFFFFF",
    },
    subtitle: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: theme.regularFont,
      textAlign: "center",
      color: "rgba(255,255,255,0.62)",
    },
    inputSpacing: {
      marginBottom: 12,
    },
    resendTouch: {
      alignItems: "center",
      marginTop: 2,
      marginBottom: 8,
    },
    resendText: {
      color: "#18C0FF",
      fontSize: 13,
      fontFamily: theme.regularFont,
    },
    resendDisabled: {
      color: "rgba(255,255,255,0.4)",
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
    buttonOuter: {
      flex: 1,
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
