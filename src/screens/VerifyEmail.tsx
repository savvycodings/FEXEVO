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
const CODE_BOX_BG = "#041641";
const CODE_BOX_BORDER = "rgba(0, 184, 255, 0.25)";
const CODE_LENGTH = 6;
const SECTION_GAP = 32;

type VerifyEmailProps = {
  draft: SignUpDraft;
  onVerified: (draft: SignUpDraft) => void;
  onBack: () => void;
};

function InvitationCodeBoxes({
  code,
  onChangeCode,
  editable,
  theme,
}: {
  code: string;
  onChangeCode: (next: string) => void;
  editable: boolean;
  theme: { semiBoldFont: string };
}) {
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const styles = codeBoxStyles;

  const digits = useMemo(() => {
    const chars = code.split("");
    while (chars.length < CODE_LENGTH) chars.push("");
    return chars.slice(0, CODE_LENGTH);
  }, [code]);

  const focusIndex = useCallback((index: number) => {
    inputRefs.current[index]?.focus();
  }, []);

  const applyDigits = useCallback(
    (raw: string, startIndex: number) => {
      const only = raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
      if (!only) {
        const next = digits.map((d, i) => (i === startIndex ? "" : d)).join("");
        onChangeCode(next.replace(/\s/g, ""));
        return;
      }
      if (only.length > 1) {
        onChangeCode(only);
        const last = Math.min(CODE_LENGTH - 1, only.length - 1);
        focusIndex(last);
        return;
      }
      const nextDigits = [...digits];
      nextDigits[startIndex] = only;
      onChangeCode(nextDigits.join("").trimEnd());
      if (startIndex < CODE_LENGTH - 1) focusIndex(startIndex + 1);
    },
    [digits, focusIndex, onChangeCode]
  );

  const handleKeyPress = useCallback(
    (index: number, key: string) => {
      if (key !== "Backspace" || digits[index]) return;
      if (index <= 0) return;
      const nextDigits = [...digits];
      nextDigits[index - 1] = "";
      onChangeCode(nextDigits.join("").trimEnd());
      focusIndex(index - 1);
    },
    [digits, focusIndex, onChangeCode]
  );

  const renderBox = (index: number) => (
    <TextInput
      key={index}
      ref={(el) => {
        inputRefs.current[index] = el;
      }}
      style={[styles.codeBox, { fontFamily: theme.semiBoldFont }]}
      value={digits[index]}
      onChangeText={(value) => applyDigits(value, index)}
      onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
      keyboardType="number-pad"
      maxLength={index === 0 ? CODE_LENGTH : 1}
      selectTextOnFocus
      editable={editable}
      autoComplete={index === 0 ? "one-time-code" : "off"}
      textContentType={index === 0 ? "oneTimeCode" : "none"}
      allowFontScaling={false}
    />
  );

  return (
    <View style={styles.codeRow}>
      <View style={styles.codeGroup}>{[0, 1, 2].map(renderBox)}</View>
      <View style={styles.codeSep} />
      <View style={styles.codeGroup}>{[3, 4, 5].map(renderBox)}</View>
    </View>
  );
}

const codeBoxStyles = StyleSheet.create({
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 14,
  },
  codeGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  codeSep: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.45)",
    marginHorizontal: 4,
  },
  codeBox: {
    flex: 1,
    maxWidth: 52,
    minHeight: 68,
    borderWidth: 2,
    borderColor: CODE_BOX_BORDER,
    borderRadius: 12,
    backgroundColor: CODE_BOX_BG,
    textAlign: "center",
    fontSize: 24,
    color: "#FFFFFF",
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
});

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

  const inputsDisabled = verifying || sending;

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
        <View style={styles.body}>
          <View style={styles.logoWrap}>
            <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" />
          </View>

          <View style={styles.codeSection}>
          <Text allowFontScaling={false} style={styles.codeLabel}>
            {t("verifyEmail.invitationCodeLabel")}
          </Text>
          <Text allowFontScaling={false} style={styles.codeHint}>
            {t("verifyEmail.invitationCodeHint")}
          </Text>

          {sending ? (
            <View style={styles.sendingRow}>
              <ActivityIndicator color="#00BBFF" />
              <Text allowFontScaling={false} style={styles.sendingText}>
                {t("verifyEmail.sending")}
              </Text>
            </View>
          ) : (
            <InvitationCodeBoxes
              code={code}
              onChangeCode={setCode}
              editable={!inputsDisabled}
              theme={theme}
            />
          )}

          <TouchableOpacity
            style={styles.resendTouch}
            onPress={() => void requestCode(true)}
            disabled={inputsDisabled || resendSec > 0}
            activeOpacity={0.85}
          >
            <Text
              allowFontScaling={false}
              style={[styles.resendText, (sending || resendSec > 0) && styles.resendDisabled]}
            >
              {resendSec > 0
                ? t("verifyEmail.resendIn", { seconds: resendSec })
                : t("verifyEmail.resend")}
            </Text>
          </TouchableOpacity>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={22} color="#00BBFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonOuter, { flex: 1 }, inputsDisabled && styles.buttonDisabled]}
              onPress={() => void handleVerify()}
              disabled={inputsDisabled}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#0022FF", "#00BBFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.button}
              >
                {verifying ? (
                  <ActivityIndicator color={theme.tintTextColor} />
                ) : (
                  <Text allowFontScaling={false} style={styles.buttonText}>
                    {t("verifyEmail.next")}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

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
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingBottom: 28,
      minHeight: "100%",
    },
    body: {
      flex: 1,
      justifyContent: "center",
      paddingTop: 24,
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
      marginBottom: SECTION_GAP,
    },
    logoImage: {
      width: 172,
      height: 92,
    },
    codeSection: {
      marginBottom: 0,
    },
    codeLabel: {
      fontSize: 15,
      fontFamily: theme.mediumFont,
      color: "#FFFFFF",
      marginBottom: 4,
    },
    codeHint: {
      fontSize: 12,
      fontFamily: theme.regularFont,
      color: "rgba(255,255,255,0.55)",
      lineHeight: 16,
      marginBottom: 16,
    },
    sendingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      minHeight: 68,
      marginBottom: 14,
    },
    sendingText: {
      color: "#86A7D2",
      fontFamily: theme.regularFont,
      fontSize: 13,
    },
    resendTouch: {
      alignItems: "center",
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
      marginTop: SECTION_GAP,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    backButton: {
      width: 54,
      height: 54,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: CODE_BOX_BG,
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
