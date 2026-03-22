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
  Image,
} from "react-native";
import { useContext } from "react";
import { ThemeContext } from "../context";
import { authClient } from "../lib/auth-client";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";

const APP_LOGO = require("../../assets/logo.png");

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
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" />
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

        <TouchableOpacity activeOpacity={0.8} style={styles.forgotWrap}>
          <Text allowFontScaling={false} style={styles.forgotText}>Forgot my password</Text>
        </TouchableOpacity>

        <View style={styles.socialDividerRow}>
          <View style={styles.socialDividerLine} />
          <Text allowFontScaling={false} style={styles.socialDividerText}>Or sign in with</Text>
          <View style={styles.socialDividerLine} />
        </View>

        <View style={styles.socialRow}>
          <TouchableOpacity style={styles.socialButton} activeOpacity={0.85}>
            <Ionicons name="logo-google" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialButton} activeOpacity={0.85}>
            <Ionicons name="logo-facebook" size={22} color="#2D7DFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialButton} activeOpacity={0.85}>
            <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
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
    input: {
      borderWidth: 1,
      borderColor: "rgba(21, 102, 196, 0.45)",
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 13,
      fontSize: 15,
      fontFamily: theme.regularFont,
      color: theme.textColor,
      backgroundColor: "#0B1F57",
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
