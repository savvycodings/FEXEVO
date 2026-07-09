import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useContext } from "react";
import { ThemeContext } from "../context";
import { SignIn } from "./SignIn";
import { SignUp, SignUpDraft } from "./SignUp";
import { ProfileSetup } from "./ProfileSetup";
import { AccountCreated } from "./AccountCreated";
import { VerifyEmail } from "./VerifyEmail";
import { WelcomeIntro } from "./WelcomeIntro";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WELCOME_SEEN_KEY } from "./WelcomeIntro";
const Stack = createNativeStackNavigator();

function SignInScreen({ navigation }: { navigation: any }) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme);
  return (
    <View style={styles.screenContainer}>
      <SignIn />
      <TouchableOpacity
        style={[styles.switchLink, { paddingBottom: insets.bottom + 20 }]}
        onPress={() => navigation.navigate("SignUp")}
      >
        <Text style={styles.switchText}>
          {t("auth.noAccount")}{" "}
          <Text style={styles.switchTextBold}>{t("auth.signUp")}</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SignUpScreen({
  navigation,
  onContinue,
  initialDraft,
}: {
  navigation: any;
  onContinue: (draft: SignUpDraft) => void;
  initialDraft: SignUpDraft | null;
}) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme);
  return (
    <View style={styles.screenContainer}>
      <SignUp
        initialDraft={initialDraft}
        onBack={() => navigation.navigate("SignIn")}
        onContinue={(draft) => {
          onContinue(draft);
          navigation.replace("VerifyEmail");
        }}
      />
      <TouchableOpacity
        style={[styles.switchLink, { paddingBottom: insets.bottom + 20 }]}
        onPress={() => navigation.navigate("SignIn")}
      >
        <Text style={styles.switchText}>
          {t("auth.hasAccount")}{" "}
          <Text style={styles.switchTextBold}>{t("auth.signIn")}</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export type OnboardingInitialRoute =
  | "WelcomeIntro"
  | "SignIn"
  | "SignUp"
  | "VerifyEmail"
  | "AccountCreated"
  | "ProfileSetup";

export function Onboarding(props?: {
  initialRouteName?: OnboardingInitialRoute;
  onProfileSetupComplete?: () => void;
}) {
  const { theme } = useContext(ThemeContext);
  const [signUpDraft, setSignUpDraft] = useState<SignUpDraft | null>(null);
  const [bootReady, setBootReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<OnboardingInitialRoute>("WelcomeIntro");

  useEffect(() => {
    const forced = props?.initialRouteName;
    if (forced === "ProfileSetup") {
      setInitialRoute("ProfileSetup");
      setBootReady(true);
      return;
    }
    if (forced === "SignIn" || forced === "SignUp") {
      setInitialRoute(forced);
      setBootReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(WELCOME_SEEN_KEY);
        if (!cancelled) {
          setInitialRoute(seen === "1" ? "SignIn" : "WelcomeIntro");
        }
      } catch {
        if (!cancelled) setInitialRoute("WelcomeIntro");
      } finally {
        if (!cancelled) setBootReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props?.initialRouteName]);

  if (!bootReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.backgroundColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#00BBFF" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      key={initialRoute}
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        /** No top padding — it left a dark strip above full-bleed screens (Profile setup, etc.). Safe area is handled inside each screen / Header. */
        contentStyle: {
          backgroundColor: theme.backgroundColor,
        },
      }}
    >
      <Stack.Screen
        name="WelcomeIntro"
        options={{
          title: "Welcome",
          contentStyle: { backgroundColor: "#030A17" },
          statusBarTranslucent: true,
          statusBarStyle: "light",
        }}
      >
        {({ navigation }) => <WelcomeIntro navigation={navigation} />}
      </Stack.Screen>
      <Stack.Screen
        name="SignIn"
        component={SignInScreen}
        options={{ title: "Sign in" }}
      />
      <Stack.Screen
        name="SignUp"
        options={{ title: "Sign up" }}
      >
        {({ navigation }) => (
          <SignUpScreen
            navigation={navigation}
            initialDraft={signUpDraft}
            onContinue={(draft) => {
              setSignUpDraft(draft);
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="VerifyEmail" options={{ title: "Verify email" }}>
        {({ navigation }) =>
          signUpDraft ? (
            <VerifyEmail
              draft={signUpDraft}
              onBack={() => navigation.replace("SignUp")}
              onVerified={(draft) => {
                setSignUpDraft(draft);
                navigation.replace("AccountCreated");
              }}
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: theme.backgroundColor }} />
          )
        }
      </Stack.Screen>
      <Stack.Screen
        name="AccountCreated"
        options={{ title: "Account created" }}
      >
        {({ navigation }) => (
          <AccountCreated
            onDone={() => {
              navigation.replace("ProfileSetup");
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="ProfileSetup"
        options={{ title: "Profile setup" }}
      >
        {({ navigation }) => (
          <ProfileSetup
            signUpDraft={signUpDraft}
            onBack={() => navigation.replace("SignUp")}
            onRestart={() => navigation.replace("SignUp")}
            onComplete={props?.onProfileSetupComplete}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function getStyles(theme: any) {
  return StyleSheet.create({
    screenContainer: {
      flex: 1,
    },
    switchLink: {
      paddingTop: 24,
      paddingHorizontal: 24,
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
