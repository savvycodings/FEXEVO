import React, { useState } from "react";
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
import { authClient } from "../lib/auth-client";
import { LinearGradient } from "expo-linear-gradient";
import { Header } from "../components";
// @ts-ignore - web + native masked view
import MaskedView from "@react-native-masked-view/masked-view";
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from "react-native-svg";

export function SignIn() {
  const { theme } = useContext(ThemeContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const styles = getStyles(theme);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Please enter email and password.");
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
      Alert.alert("Sign in failed", error.message || "Could not establish a session.");
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
      Alert.alert(
        "Sign in failed",
        "Could not establish a session. Please try again."
      );
      return;
    }
    console.log("[Auth] SignIn success", {
      email: email.trim(),
      userId: sessionData.user.id,
      sessionId: sessionData.session.id,
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
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
      <Header />
      <View style={styles.content}>
        <View style={styles.header}>
          {Platform.OS === "web" ? (
            <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.heroTitleTechniqueWeb}>
              Sign in
            </Text>
          ) : (
            <MaskedView
              style={styles.heroTitleMask}
              maskElement={
                <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={[styles.heroTitleTechnique, { color: "#ffffff" }]}>
                  Sign in
                </Text>
              }
            >
              <LinearGradient
                colors={["#0022FF", "#00BBFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={[styles.heroTitleTechnique, { color: "transparent" }]}>
                  Sign in
                </Text>
              </LinearGradient>
            </MaskedView>
          )}
          <Text allowFontScaling={false} maxFontSizeMultiplier={1.05} style={styles.subtitle}>
            Sign in to your AI padel coach.
          </Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={theme.placeholderTextColor}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={theme.placeholderTextColor}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.buttonOuter, loading && styles.buttonDisabled]}
          onPress={handleSignIn}
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
              <Text allowFontScaling={false} style={styles.buttonText}>Sign in</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
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
    buttonOuter: {
      borderRadius: 14,
      overflow: "hidden",
      marginTop: 8,
    },
    button: {
      borderRadius: 14,
      paddingVertical: 16,
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
