import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useContext } from "react";
import { ThemeContext } from "../context";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "../components/LanguageToggle";
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from "react-native-svg";
import { TEST_IDS } from '../lib/testIds'
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { glow } from "./progress/progressTheme";

const APP_LOGO = require("../../assets/logo.png");

type AccountCreatedProps = {
  onDone?: () => void;
};

export function AccountCreated({ onDone }: AccountCreatedProps) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, insets);

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

      <View style={styles.middle}>
        <View style={[styles.ringOuter, glow(28, 0.9)]}>
          <View style={styles.ringInner}>
            <Ionicons name="checkmark" size={64} color="#FFFFFF" />
          </View>
        </View>
        <Text allowFontScaling={false} style={styles.kicker}>{t("accountCreated.kicker")}</Text>
        <Text allowFontScaling={false} style={styles.title}>{t("accountCreated.title").replace(/\n/g, " ")}</Text>
        <Text allowFontScaling={false} style={styles.subtitle}>
          {t("accountCreated.subtitle")}
        </Text>
      </View>

      <View style={styles.bottomBlock}>
        <TouchableOpacity
          style={styles.buttonOuter}
          onPress={onDone}
          testID={TEST_IDS.accountCreatedDone}
          activeOpacity={0.9}
          accessibilityLabel={t("accountCreated.continueSetup")}
        >
          <LinearGradient
            colors={["#0022FF", "#00BBFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            <Text allowFontScaling={false} style={styles.buttonText}>{t("common.done")}</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
        <LanguageToggle />
      </View>
    </View>
  );
}

function getStyles(theme: any, insets: { top: number; bottom: number }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
      paddingTop: insets.top + 32,
      paddingBottom: insets.bottom + 24,
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
      alignItems: "center",
      justifyContent: "center",
    },
    logoImage: {
      width: 172,
      height: 92,
    },
    middle: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    ringOuter: {
      width: 148,
      height: 148,
      borderRadius: 74,
      borderWidth: 4,
      borderColor: "#18C0FF",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 36,
      backgroundColor: "rgba(4, 22, 65, 0.6)",
    },
    ringInner: {
      width: 112,
      height: 112,
      borderRadius: 56,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0B2A6B",
    },
    kicker: {
      fontFamily: theme.semiBoldFont,
      color: "#FFFFFF",
      fontSize: 28,
      textAlign: "center",
      marginBottom: 10,
    },
    title: {
      fontFamily: theme.semiBoldFont,
      color: "#18C0FF",
      fontSize: 20,
      textAlign: "center",
      marginBottom: 10,
    },
    subtitle: {
      fontFamily: theme.regularFont,
      color: "rgba(165,196,235,0.92)",
      fontSize: 15,
      textAlign: "center",
    },
    bottomBlock: {
      paddingHorizontal: 24,
    },
    buttonOuter: {
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 8,
    },
    button: {
      borderRadius: 16,
      minHeight: 56,
      flexDirection: "row",
      gap: 8,
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
