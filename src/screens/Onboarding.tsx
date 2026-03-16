import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useContext } from "react";
import { ThemeContext } from "../context";
import { SignIn } from "./SignIn";
import { SignUp } from "./SignUp";

const Stack = createNativeStackNavigator();

function SignInScreen({ navigation }: { navigation: any }) {
  const { theme } = useContext(ThemeContext);
  const styles = getStyles(theme);
  return (
    <View style={styles.screenContainer}>
      <SignIn />
      <TouchableOpacity
        style={styles.switchLink}
        onPress={() => navigation.navigate("SignUp")}
      >
        <Text style={styles.switchText}>
          Don't have an account? <Text style={styles.switchTextBold}>Sign up</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SignUpScreen({ navigation }: { navigation: any }) {
  const { theme } = useContext(ThemeContext);
  const styles = getStyles(theme);
  return (
    <View style={styles.screenContainer}>
      <SignUp />
      <TouchableOpacity
        style={styles.switchLink}
        onPress={() => navigation.navigate("SignIn")}
      >
        <Text style={styles.switchText}>
          Already have an account? <Text style={styles.switchTextBold}>Sign in</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export function Onboarding() {
  const { theme } = useContext(ThemeContext);
  const styles = getStyles(theme);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.backgroundColor },
      }}
      initialRouteName="SignIn"
    >
      <Stack.Screen
        name="SignIn"
        component={SignInScreen}
        options={{ title: "Sign in" }}
      />
      <Stack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={{ title: "Sign up" }}
      />
    </Stack.Navigator>
  );
}

function getStyles(theme: any) {
  return StyleSheet.create({
    screenContainer: {
      flex: 1,
    },
    switchLink: {
      padding: 24,
      alignItems: "center",
    },
    switchText: {
      fontSize: 15,
      fontFamily: theme.regularFont,
      color: theme.mutedForegroundColor,
    },
    switchTextBold: {
      fontFamily: theme.semiBoldFont,
      color: "#00BBFF",
    },
  });
}
