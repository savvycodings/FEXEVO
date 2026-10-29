import React, { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useContext } from "react";
import { ThemeContext } from "../context";
import { SignIn } from "./SignIn";
import { ForgotPassword } from "./ForgotPassword";
import { SignUp, SignUpDraft } from "./SignUp";
import { ProfileSetup } from "./ProfileSetup";
import { AccountCreated } from "./AccountCreated";
import { VerifyEmail } from "./VerifyEmail";
import { WelcomeIntro } from "./WelcomeIntro";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WELCOME_SEEN_KEY } from "./WelcomeIntro";
const Stack = createNativeStackNavigator();

function SignInScreen({ navigation }: { navigation: any }) {
  return (
    <SignIn
      onForgotPassword={() => navigation.navigate("ForgotPassword")}
      onSignUp={() => navigation.navigate("SignUp")}
      onRestart={() => navigation.replace("WelcomeIntro")}
    />
  );
}

function SignUpScreen({
  navigation,
  route,
  onContinue,
  initialDraft,
}: {
  navigation: any;
  route: { params?: { coachSignup?: boolean } };
  onContinue: (draft: SignUpDraft) => void;
  initialDraft: SignUpDraft | null;
}) {
  const coachSignup = route.params?.coachSignup ?? initialDraft?.coachSignup ?? false;
  return (
    <SignUp
      initialDraft={initialDraft}
      coachSignup={coachSignup}
      onBack={() => navigation.navigate("SignIn")}
      onSignIn={() => navigation.navigate("SignIn")}
      onContinue={(draft) => {
        onContinue(draft);
        navigation.replace("VerifyEmail");
      }}
    />
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
        }}
      >
        {({ navigation }) => <WelcomeIntro navigation={navigation} />}
      </Stack.Screen>
      <Stack.Screen
        name="SignIn"
        component={SignInScreen}
        options={{ title: "Sign in" }}
      />
      <Stack.Screen name="ForgotPassword" options={{ title: "Reset password" }}>
        {({ navigation }) => <ForgotPassword onBack={() => navigation.navigate("SignIn")} />}
      </Stack.Screen>
      <Stack.Screen
        name="SignUp"
        options={{ title: "Sign up" }}
      >
        {({ navigation, route }) => (
          <SignUpScreen
            navigation={navigation}
            route={route as { params?: { coachSignup?: boolean } }}
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
