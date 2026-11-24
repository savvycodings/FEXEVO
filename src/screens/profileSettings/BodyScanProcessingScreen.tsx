import React, { useContext } from "react";
import { Image, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../../context";
import { ProfileHubTitleBar } from "./ProfileHubParts";

const PROCESSING_HERO = require("../../../assets/bodyscan/processing-hero.png");
const CHECKLIST_TICK = require("../../../assets/bodyscan/checklist-tick.png");

const HERO_FRAME_W = 360;
const HERO_FRAME_H = 426;
/** Source art is taller; pin to top so the wireframe fills the 360×426 frame. */
const HERO_SRC_H = 561;
const PROGRESS = 0.85;

const TIP_KEYS = [
  "scanProcessingTipImages",
  "scanProcessingTipModel",
  "scanProcessingTipLandmarks",
  "scanProcessingTipMeasurements",
  "scanProcessingTipAccuracy",
] as const;

/** Static Processing UI — AI analysis mock after photos + video. */
export function BodyScanProcessingScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const windowDims = useWindowDimensions();
  const heroW = Math.min(HERO_FRAME_W, Math.max(1, windowDims.width - 40));
  const heroH = Math.round((heroW * HERO_FRAME_H) / HERO_FRAME_W);
  const heroImgH = Math.round((heroW * HERO_SRC_H) / HERO_FRAME_W);
  const percentLabel = `${Math.round(PROGRESS * 100)}%`;

  return (
    <View style={st.screen} testID="scan-processing-screen">
      <ProfileHubTitleBar title={t("profileHub.scanProcessingTitle")} onBack={onBack} />

      <View style={[st.column, { width: heroW }]}>
        <View style={[st.hero, { width: heroW, height: heroH }]} testID="scan-processing-hero">
          <Image source={PROCESSING_HERO} style={{ width: heroW, height: heroImgH }} resizeMode="cover" />
          <LinearGradient
            colors={["rgba(3,10,23,0)", "rgba(3,10,23,0.35)", "#030A17"]}
            locations={[0.55, 0.78, 1]}
            style={st.heroFade}
            pointerEvents="none"
          />
        </View>

        <View style={[st.checklist, { marginTop: 10 }]} testID="scan-processing-checklist">
          {TIP_KEYS.map((key) => (
            <View key={key} style={st.tipRow}>
              <Image source={CHECKLIST_TICK} style={st.tipTick} resizeMode="contain" />
              <Text allowFontScaling={false} style={[st.tipText, { fontFamily: theme.mediumFont }]}>
                {t(`profileHub.${key}`)}
              </Text>
            </View>
          ))}
        </View>

        <View style={st.progressRow} testID="scan-processing-progress">
          <View style={st.progressTrack}>
            <View style={[st.progressFill, { width: `${PROGRESS * 100}%` }]} />
          </View>
          <Text allowFontScaling={false} style={[st.progressLabel, { fontFamily: theme.semiBoldFont }]}>
            {percentLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { width: "100%" },
  column: { alignSelf: "center" },
  hero: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    backgroundColor: "#030A17",
  },
  heroFade: { ...StyleSheet.absoluteFillObject },
  checklist: { width: "100%", gap: 12, paddingHorizontal: 0 },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  tipTick: { width: 22, height: 22 },
  tipText: { flex: 1, fontSize: 15, color: "#FFFFFF" },
  progressRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  progressTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#07256D",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#00B8FF",
  },
  progressLabel: { fontSize: 14, color: "#FFFFFF", minWidth: 40, textAlign: "right" },
});
