import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { useContext } from "react";
import { ThemeContext } from "../context";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "../components/LanguageToggle";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { TEST_IDS } from '../lib/testIds'
import { AuthBackdrop, GlowButton, UI } from "../components/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const APP_LOGO = require("../../assets/logo.png");

const RING_SIZE = 220;
const ARC_R = 74;
const ARC_LEN = 2 * Math.PI * ARC_R;

/** Glass disc with a gradient progress arc and check (design "Account created" art). */
function SuccessRing() {
  const c = RING_SIZE / 2;
  return (
    <View style={ringStyles.wrap}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Defs>
          <RadialGradient id="successDisc" cx="50%" cy="50%" r="50%">
            <Stop offset="55%" stopColor={UI.pageBg} stopOpacity={1} />
            <Stop offset="100%" stopColor={UI.surface} stopOpacity={0.9} />
          </RadialGradient>
          <SvgLinearGradient id="successArc" x1="0.7" y1="0" x2="0.3" y2="1">
            <Stop offset="0%" stopColor="#B8E6FF" />
            <Stop offset="45%" stopColor={UI.accent} />
            <Stop offset="100%" stopColor="#0022FF" />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c - 1} fill="url(#successDisc)" stroke={UI.trackBorder} strokeWidth={1} />
        <Circle cx={c} cy={c} r={ARC_R + 8} fill="none" stroke="rgba(0, 102, 255, 0.35)" strokeWidth={6} />
        <Circle cx={c} cy={c} r={ARC_R - 6} fill={UI.pageBg} stroke="rgba(0, 102, 255, 0.4)" strokeWidth={1} />
        {/* Arc from ~1 o'clock clockwise to ~7 o'clock. */}
        <Circle
          cx={c}
          cy={c}
          r={ARC_R}
          fill="none"
          stroke="url(#successArc)"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${ARC_LEN * 0.5} ${ARC_LEN}`}
          transform={`rotate(-62 ${c} ${c})`}
        />
        <Path
          d={`M ${c - 26} ${c + 4} L ${c - 8} ${c + 22} L ${c + 28} ${c - 22}`}
          fill="none"
          stroke={UI.accent}
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    alignSelf: "center",
    boxShadow: "0px 0px 40px 0px #0048FF55",
  },
});

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
      <AuthBackdrop id="accountCreatedRadialBg" />

      <View style={styles.logoWrap}>
        <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" />
      </View>

      <View style={styles.middle}>
        <SuccessRing />
      </View>

      <View style={styles.bottomBlock}>
        <Text allowFontScaling={false} style={styles.kicker}>{t("accountCreated.kicker")}</Text>
        <Text allowFontScaling={false} style={styles.title}>{t("accountCreated.title")}</Text>
        <Text allowFontScaling={false} style={styles.subtitle}>
          {t("accountCreated.subtitle")}
        </Text>
        <GlowButton
          label={t("common.done")}
          arrow
          onPress={onDone}
          testID={TEST_IDS.accountCreatedDone}
          accessibilityLabel={t("accountCreated.continueSetup")}
          style={styles.done}
        />
        <LanguageToggle />
      </View>
    </View>
  );
}

function getStyles(theme: any, insets: { top: number; bottom: number }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: UI.pageBg,
      paddingTop: insets.top + 32,
      paddingBottom: insets.bottom + 24,
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
    bottomBlock: {
      paddingHorizontal: 24,
    },
    kicker: {
      fontFamily: theme.regularFont,
      color: UI.text,
      fontSize: 17,
      marginBottom: 14,
    },
    title: {
      fontFamily: theme.mediumFont,
      color: UI.accent,
      fontSize: 34,
      lineHeight: 38,
      marginBottom: 14,
    },
    subtitle: {
      fontFamily: theme.regularFont,
      color: UI.textMuted,
      fontSize: 14,
    },
    done: {
      marginTop: 28,
    },
  });
}
