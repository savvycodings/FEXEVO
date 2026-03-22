import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useContext } from "react";
import { ThemeContext } from "../context";
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from "react-native-svg";

const APP_LOGO = require("../../assets/logo.png");

type AccountCreatedProps = {
  onDone?: () => void;
};

export function AccountCreated({ onDone }: AccountCreatedProps) {
  const { theme } = useContext(ThemeContext);
  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <Svg pointerEvents="none" style={styles.heroGlow}>
        <Defs>
          <SvgRadialGradient id="accountCreatedRadialBg" cx="50%" cy="-30%" rx="120%" ry="95%">
            <Stop offset="0%" stopColor="#071D47" stopOpacity={1} />
            <Stop offset="100%" stopColor="#071D47" stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#accountCreatedRadialBg)" />
      </Svg>

      <View style={styles.logoWrap}>
        <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" />
      </View>

      <View style={styles.bottomBlock}>
        <Text allowFontScaling={false} style={styles.kicker}>Account created</Text>
        <Text allowFontScaling={false} style={styles.title}>Welcome to{"\n"}Xevo Padel</Text>
        <Text allowFontScaling={false} style={styles.subtitle}>
          Your account has been created successfully
        </Text>

        <TouchableOpacity
          style={styles.buttonOuter}
          onPress={onDone}
          activeOpacity={0.9}
          accessibilityLabel="Continue to profile setup"
        >
          <LinearGradient
            colors={["#18B8F3", "#0A2DFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            <Text allowFontScaling={false} style={styles.buttonText}>Done</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
      justifyContent: "space-between",
    },
    heroGlow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 430,
      opacity: 1,
    },
    logoWrap: {
      marginTop: 220,
      alignItems: "center",
      justifyContent: "center",
    },
    logoImage: {
      width: 210,
      height: 120,
    },
    bottomBlock: {
      paddingHorizontal: 20,
      paddingBottom: 64,
    },
    kicker: {
      fontFamily: theme.regularFont,
      color: "rgba(255,255,255,0.9)",
      fontSize: 36 / 2,
      marginBottom: 16,
    },
    title: {
      fontFamily: theme.semiBoldFont,
      color: "#12BEFF",
      fontSize: 66 / 2,
      lineHeight: 72 / 2,
      marginBottom: 18,
    },
    subtitle: {
      fontFamily: theme.regularFont,
      color: "rgba(165,196,235,0.92)",
      fontSize: 25 / 2,
      marginBottom: 30,
    },
    buttonOuter: {
      borderRadius: 18,
      overflow: "hidden",
    },
    button: {
      borderRadius: 18,
      minHeight: 58,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonText: {
      fontFamily: theme.semiBoldFont,
      color: "#FFFFFF",
      fontSize: 17,
    },
  });
}

