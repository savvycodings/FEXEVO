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

export function SignUp() {
  const { theme } = useContext(ThemeContext);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const styles = getStyles(theme);

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert("Error", "Please fill in name, email, and password.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const { error } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      Alert.alert("Sign up failed", error.message || "Could not create account.");
      return;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <Header />
      <View style={styles.content}>
        <View style={styles.header}>
          {Platform.OS === "web" ? (
            <Text style={styles.heroTitleTechniqueWeb}>Sign up</Text>
          ) : (
            <MaskedView
              style={styles.heroTitleMask}
              maskElement={
                <Text style={[styles.heroTitleTechnique, { color: "#ffffff" }]}>
                  Sign up
                </Text>
              }
            >
              <LinearGradient
                colors={["#0022FF", "#00BBFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={[styles.heroTitleTechnique, { color: "transparent" }]}>
                  Sign up
                </Text>
              </LinearGradient>
            </MaskedView>
          )}
          <Text style={styles.subtitle}>Join the best AI padel training experience.</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor={theme.placeholderTextColor}
          value={name}
          onChangeText={setName}
          autoComplete="name"
          editable={!loading}
        />
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
          placeholder="Password (min 8 characters)"
          placeholderTextColor={theme.placeholderTextColor}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password-new"
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.buttonOuter, loading && styles.buttonDisabled]}
          onPress={handleSignUp}
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
              <Text style={styles.buttonText}>Sign up</Text>
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
      display: "none",
    },
  });
}
