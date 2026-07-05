import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../context";
import { LanguageToggle } from "../components/LanguageToggle";
import type { SignUpDraft } from "./SignUp";
import {
  sendSignupVerificationCode,
  verifySignupVerificationCode,
} from "../lib/signupVerification";

const APP_LOGO = require("../../assets/logo.png");
const RESEND_COOLDOWN_SEC = 60;

type VerifyEmailProps = {
  draft: SignUpDraft;
  onVerified: (draft: SignUpDraft) => void;
  onBack: () => void;
};

export function VerifyEmail({ draft, onVerified, onBack }: VerifyEmailProps) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [resendSec, setResendSec] = useState(RESEND_COOLDOWN_SEC);
  const sentOnceRef = useRef(false);

  const requestCode = useCallback(
    async (isResend = false) => {
      if (isResend) setSending(true);
      const result = await sendSignupVerificationCode({
        email: draft.email,
        name: draft.name,
      });
      setSending(false);

      if (!result.ok) {
        if (result.retryAfterSec) setResendSec(result.retryAfterSec);
        Alert.alert(t("verifyEmail.sendFailedTitle"), result.message);
        return;
      }

      setResendSec(RESEND_COOLDOWN_SEC);
    },
    [draft.email, draft.name, t]
  );

  useEffect(() => {
    if (sentOnceRef.current) return;
    sentOnceRef.current = true;
    void requestCode(false);
  }, [requestCode]);

  useEffect(() => {
    if (resendSec <= 0) return;
    const id = setInterval(() => {
      setResendSec((sec) => (sec > 0 ? sec - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [resendSec]);

  const handleVerify = async () => {
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      Alert.alert(t("verifyEmail.invalidCodeTitle"), t("verifyEmail.invalidCodeMsg"));
      return;
    }

    setVerifying(true);
    const result = await verifySignupVerificationCode({
      email: draft.email,
      code: trimmed,
    });
    setVerifying(false);

    if (!result.ok) {
      Alert.alert(t("verifyEmail.verifyFailedTitle"), result.message);
      return;
    }

    onVerified({
      ...draft,
      verificationToken: result.verificationToken,
    });
  };

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.kasvContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Svg pointerEvents="none" style={styles.heroGlow}>
        <Defs>
          <SvgRadialGradient id="verifyEmailRadialBg" cx="50%" cy="-30%" rx="120%" ry="95%">
            <Stop offset="0%" stopColor="#071D47" stopOpacity={1} />
            <Stop offset="100%" stopColor="#071D47" stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#verifyEmailRadialBg)" />
      </Svg>

      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" />
        </View>

        <View style={styles.header}>
          <Text allowFontScaling={false} style={styles.heroTitle}>
            {t("verifyEmail.title")}
          </Text>
          <Text allowFontScaling={false} style={styles.subtitle}>
            {t("verifyEmail.subtitle", { email: draft.email })}
          </Text>
        </View>

        {sending ? (
          <View style={styles.sendingRow}>
            <ActivityIndicator color="#00BBFF" />
            <Text allowFontScaling={false} style={styles.sendingText}>
              {t("verifyEmail.sending")}
            </Text>
          </View>
        ) : null}

        <TextInput
          style={styles.codeInput}
          placeholder={t("verifyEmail.codePlaceholder")}
          placeholderTextColor={theme.placeholderTextColor}
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          editable={!verifying && !sending}
        />

        <TouchableOpacity
          style={styles.resendTouch}
          onPress={() => void requestCode(true)}
          disabled={sending || verifying || resendSec > 0}
          activeOpacity={0.85}
        >
          <Text allowFontScaling={false} style={[styles.resendText, (sending || resendSec > 0) && styles.resendDisabled]}>
            {resendSec > 0
              ? t("verifyEmail.resendIn", { seconds: resendSec })
              : t("verifyEmail.resend")}
          </Text>
        </TouchableOpacity>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
            <Ionicons name="chevron-back" size={22} color="#00BBFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.buttonOuter, { flex: 1 }, (verifying || sending) && styles.buttonDisabled]}
            onPress={() => void handleVerify()}
            disabled={verifying || sending}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#0022FF", "#00BBFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
              {verifying ? (
                <ActivityIndicator color={theme.tintTextColor} />
              ) : (
                <Text allowFontScaling={false} style={styles.buttonText}>
                  {t("verifyEmail.verify")}
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
    },
    heroGlow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 430,
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
    heroTitle: {
      fontSize: 34,
      fontFamily: theme.semiBoldFont,
      textAlign: "center",
      marginBottom: 8,
      color: "#FFFFFF",
    },
    subtitle: {
      fontSize: 13,
      fontFamily: theme.regularFont,
      color: "rgba(255,255,255,0.62)",
      textAlign: "center",
      lineHeight: 18,
    },
    sendingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      marginBottom: 14,
    },
    sendingText: {
      color: "#86A7D2",
      fontFamily: theme.regularFont,
      fontSize: 13,
    },
    codeInput: {
      borderWidth: 1,
      borderColor: "rgba(21, 102, 196, 0.45)",
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 16,
      fontSize: 28,
      letterSpacing: 8,
      textAlign: "center",
      fontFamily: theme.semiBoldFont,
      color: theme.textColor,
      backgroundColor: "#0B1F57",
      marginBottom: 12,
    },
    resendTouch: {
      alignItems: "center",
      marginBottom: 18,
    },
    resendText: {
      color: "#00BBFF",
      fontFamily: theme.mediumFont,
      fontSize: 14,
    },
    resendDisabled: {
      color: "rgba(134,167,210,0.7)",
    },
    actionRow: {
      marginTop: 8,
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
  });
}
