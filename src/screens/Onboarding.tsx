import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useContext } from "react";
import { ThemeContext } from "../context";
import { SignIn } from "./SignIn";
import { SignUp, SignUpDraft } from "./SignUp";
import { ProfileSetup } from "./ProfileSetup";

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

function SignUpScreen({
  navigation,
  onContinue,
  initialDraft,
}: {
  navigation: any;
  onContinue: (draft: SignUpDraft) => void;
  initialDraft: SignUpDraft | null;
}) {
  const { theme } = useContext(ThemeContext);
  const styles = getStyles(theme);
  return (
    <View style={styles.screenContainer}>
      <SignUp
        initialDraft={initialDraft}
        onBack={() => navigation.navigate("SignIn")}
        onContinue={(draft) => {
          onContinue(draft);
          navigation.replace("ProfileSetup");
        }}
      />
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

export function Onboarding(props?: {
  initialRouteName?: "SignIn" | "SignUp" | "ProfileSetup";
  onProfileSetupComplete?: () => void;
}) {
  const { theme } = useContext(ThemeContext);
  const [signUpDraft, setSignUpDraft] = useState<SignUpDraft | null>(null);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.backgroundColor },
      }}
      initialRouteName={props?.initialRouteName || "SignIn"}
    >
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
      <Stack.Screen
        name="ProfileSetup"
        options={{ title: "Profile setup" }}
      >
        {({ navigation }) => (
          <ProfileSetup
            signUpDraft={signUpDraft}
            onBack={() => navigation.replace("SignUp")}
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
