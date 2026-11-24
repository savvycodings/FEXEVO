import React, { useContext } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../../context";
import { glow } from "../progress/progressTheme";

const HERO = require("../../../assets/bodyscan/intro-hero.png");
const CHECK = require("../../../assets/bodyscan/checklist-tick.png");

const FEATURES = ["Photos", "Video", "Auto", "Time"] as const;

/**
 * Athlete Calibration → 3D Body Scan landing page.
 * Get Started opens the capture flow; back returns to the calibration chooser.
 */
export function BodyScanIntroSection({
  footer,
  onSkipPostPhotos,
  onSkipProcessing,
  onSkipModelView,
}: {
  footer: React.ReactNode;
  /** TEMP session helper — remove before shipping. */
  onSkipPostPhotos?: () => void;
  /** TEMP session helper — remove before shipping. */
  onSkipProcessing?: () => void;
  /** TEMP session helper — remove before shipping. */
  onSkipModelView?: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);

  return (
    <View style={st.root} testID="body-scan-intro">
      <Text allowFontScaling={false} style={[st.sub, { fontFamily: theme.regularFont }]}>
        {t("profileHub.scanIntroPageSub")}
      </Text>

      <View style={[st.heroWrap, glow(28, 0.85)]} testID="scan-intro-hero">
        <Image source={HERO} style={st.hero} resizeMode="cover" />
      </View>

      <View style={st.list}>
        {FEATURES.map((key) => (
          <View key={key} style={st.row} testID={`scan-intro-feature-${key.toLowerCase()}`}>
            <Image source={CHECK} style={st.check} resizeMode="contain" />
            <Text allowFontScaling={false} style={[st.feature, { fontFamily: theme.regularFont }]}>
              {t(`profileHub.scanIntroFeature${key}`)}
            </Text>
          </View>
        ))}
      </View>

      <View style={st.footer}>{footer}</View>

      {/* TEMP: skip helpers while building later steps. Remove before shipping. */}
      {onSkipPostPhotos ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onSkipPostPhotos}
          style={st.tempSkipBtn}
          testID="scan-skip-post-photos"
        >
          <Text allowFontScaling={false} style={[st.tempSkipText, { fontFamily: theme.mediumFont }]}>
            Post photos
          </Text>
        </TouchableOpacity>
      ) : null}
      {onSkipProcessing ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onSkipProcessing}
          style={st.tempSkipBtn}
          testID="scan-skip-processing"
        >
          <Text allowFontScaling={false} style={[st.tempSkipText, { fontFamily: theme.mediumFont }]}>
            Processing
          </Text>
        </TouchableOpacity>
      ) : null}
      {onSkipModelView ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onSkipModelView}
          style={st.tempSkipBtn}
          testID="scan-skip-model-view"
        >
          <Text allowFontScaling={false} style={[st.tempSkipText, { fontFamily: theme.mediumFont }]}>
            3D Model View
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: { gap: 18, alignItems: "stretch" },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    color: "#86A7D2",
    textAlign: "center",
    paddingHorizontal: 8,
  },
  heroWrap: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 370,
    aspectRatio: 370 / 320,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#010819",
  },
  hero: {
    width: "100%",
    height: "100%",
  },
  list: {
    gap: 14,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  check: {
    width: 22,
    height: 22,
  },
  feature: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    color: "#FFFFFF",
  },
  footer: {
    marginTop: 6,
  },
  tempSkipBtn: {
    alignSelf: "center",
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  tempSkipText: {
    fontSize: 14,
    color: "#86A7D2",
    textDecorationLine: "underline",
  },
});
