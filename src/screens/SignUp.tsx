import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useContext } from "react";
import { ThemeContext } from "../context";
import { LinearGradient } from "expo-linear-gradient";
import { Header } from "../components";
// @ts-ignore - web + native masked view
import MaskedView from "@react-native-masked-view/masked-view";
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";

export type SignUpDraft = {
  name: string;
  email: string;
  password: string;
};

type SignUpProps = {
  onContinue?: (draft: SignUpDraft) => void;
  onBack?: () => void;
  initialDraft?: SignUpDraft | null;
};

export function SignUp(props?: SignUpProps) {
  const { theme } = useContext(ThemeContext);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const styles = getStyles(theme);

  useEffect(() => {
    if (!props?.initialDraft) return;
    setName(props.initialDraft.name || "");
    setEmail(props.initialDraft.email || "");
    setPassword(props.initialDraft.password || "");
  }, [props?.initialDraft]);

  const handleContinue = async () => {
    const nextErrors: { name?: string; email?: string; password?: string } = {};
    if (!name.trim()) nextErrors.name = "Name is required.";
    if (!email.trim()) nextErrors.email = "Email is required.";
    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      Alert.alert("Missing info", "Please fix the highlighted fields.");
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
    });
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
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
      <Header />
      <View style={styles.progressSection}>
        <View style={styles.progressWrap}>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[styles.progressSegment, i <= 1 && styles.progressSegmentActive]}
            />
          ))}
        </View>
        <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.stepTitle}>
          Create your account.
        </Text>
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          {Platform.OS === "web" ? (
            <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.heroTitleTechniqueWeb}>
              Create your account
            </Text>
          ) : (
            <MaskedView
              style={styles.heroTitleMask}
              maskElement={
                <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={[styles.heroTitleTechnique, { color: "#ffffff" }]}>
                  Create your account
                </Text>
              }
            >
              <LinearGradient
                colors={["#0022FF", "#00BBFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={[styles.heroTitleTechnique, { color: "transparent" }]}>
                  Create your account
                </Text>
              </LinearGradient>
            </MaskedView>
          )}
          <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.subtitle}>
            Start your onboarding and set up your player profile.
          </Text>
        </View>

        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          placeholder="Name"
          placeholderTextColor={theme.placeholderTextColor}
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          autoComplete="name"
          editable={!loading}
        />
        {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          placeholder="Email"
          placeholderTextColor={theme.placeholderTextColor}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={!loading}
        />
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
        <TextInput
          style={[styles.input, errors.password && styles.inputError]}
          placeholder="Password (min 8 characters)"
          placeholderTextColor={theme.placeholderTextColor}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          secureTextEntry
          autoComplete="password-new"
          editable={!loading}
        />
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

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
            style={[styles.buttonOuter, { flex: 1 }, loading && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={loading}
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
                <Text allowFontScaling={false} style={styles.buttonText}>Continue</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function getStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
      justifyContent: "flex-start",
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
    content: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    header: {
      alignItems: "center",
      marginTop: 24,
      marginBottom: 32,
    },
    heroTitlePrefix: {
      fontSize: 28,
      fontFamily: theme.semiBoldFont,
      color: theme.textColor,
    },
    heroTitleTechnique: {
      fontSize: 40,
      fontFamily: theme.semiBoldFont,
      textAlign: "center",
      marginBottom: 8,
    },
    heroTitleTechniqueWeb: {
      fontSize: 40,
      fontFamily: theme.semiBoldFont,
      textAlign: "center",
      marginBottom: 8,
      color: "#00BBFF",
    },
    heroTitleMask: {
      marginTop: 2,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      fontFamily: theme.regularFont,
      color: theme.mutedForegroundColor,
      textAlign: "center",
      marginTop: 0,
    },
    input: {
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      fontFamily: theme.regularFont,
      color: theme.textColor,
      backgroundColor: "#0E1830",
      marginBottom: 16,
    },
    inputError: {
      borderColor: "#FF5A6A",
      backgroundColor: "rgba(70, 12, 20, 0.35)",
      marginBottom: 6,
    },
    errorText: {
      color: "#FF6B7A",
      fontSize: 12,
      fontFamily: theme.mediumFont,
      marginBottom: 10,
      marginTop: -2,
      paddingHorizontal: 4,
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
      marginTop: 10,
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
