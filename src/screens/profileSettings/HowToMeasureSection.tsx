import React, { useContext, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../../context";
import { PG, glow } from "../progress/progressTheme";
import { SegmentedPills } from "../progress/SegmentedPills";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const GUIDE_PHOTO = require("../../../assets/calibration/howto.jpg");
/** Figma width ratio 206 : 151 — photo stretches to the tips tile height. */
const GUIDE_IMG_W = 206;
const GUIDE_TILE_W = 151;

/** Tip icons (tape / stand / clothing / follow / units) — framed blue art from Figma. */
const GUIDE_TIP_ICONS = {
  Tape: require("../../../assets/aicoach/profile-hub/how-tips/icon-tape.png"),
  Flat: require("../../../assets/aicoach/profile-hub/how-tips/icon-flat.png"),
  Clothing: require("../../../assets/aicoach/profile-hub/how-tips/icon-clothing.png"),
  Steps: require("../../../assets/aicoach/profile-hub/how-tips/icon-steps.png"),
  Units: require("../../../assets/aicoach/profile-hub/how-tips/icon-units.png"),
} as const;

const GUIDE_TIPS: { key: keyof typeof GUIDE_TIP_ICONS }[] = [
  { key: "Tape" },
  { key: "Flat" },
  { key: "Clothing" },
  { key: "Steps" },
  { key: "Units" },
];

/** One line per measurement, in the same order as the Body Measurements list. */
const HOW_TO: { key: string; icon: IconName }[] = [
  { key: "height", icon: "resize-outline" },
  { key: "weight", icon: "speedometer-outline" },
  { key: "wingspan", icon: "swap-horizontal-outline" },
  { key: "shoulder", icon: "accessibility-outline" },
  { key: "torso", icon: "shirt-outline" },
  { key: "upperArm", icon: "barbell-outline" },
  { key: "forearm", icon: "fitness-outline" },
  { key: "hand", icon: "hand-left-outline" },
  { key: "upperLeg", icon: "walk-outline" },
  { key: "lowerLeg", icon: "footsteps-outline" },
];

export function HowToMeasureSection({ footer }: { footer: React.ReactNode }) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const [tab, setTab] = useState<"guide" | "tips">("guide");

  return (
    <View>
      <SegmentedPills<"guide" | "tips">
        variant="flat"
        options={[
          { key: "guide", label: t("profileHub.howGuide"), testID: "howto-tab-guide" },
          { key: "tips", label: t("profileHub.howTips"), testID: "howto-tab-tips" },
        ]}
        value={tab}
        onChange={setTab}
        fontFamily={theme.mediumFont}
        activeFontFamily={theme.semiBoldFont}
        style={st.segment}
      />

      {tab === "guide" ? (
        <View style={st.guideRow}>
          <View style={st.photoWrap}>
            <Image source={GUIDE_PHOTO} style={st.photo} resizeMode="cover" />
          </View>
          <View style={st.tipsCard}>
            {GUIDE_TIPS.map((tip) => (
              <View key={tip.key} style={st.tipRow}>
                <Image source={GUIDE_TIP_ICONS[tip.key]} style={st.tipIcon} resizeMode="contain" />
                <Text allowFontScaling={false} style={[st.tipText, { fontFamily: theme.regularFont }]}>
                  {t(`profileHub.howTip${tip.key}`)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <LinearGradient
          colors={[PG.cardTop, PG.cardBottom]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[st.howCard, glow(10, 0.3)]}
        >
          {HOW_TO.map((m, i) => (
            <View key={m.key} style={[st.howRow, i > 0 && st.howRowDivided]}>
              <Ionicons name={m.icon} size={22} color="#2F7BFF" style={{ marginTop: 1 }} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text allowFontScaling={false} style={[st.howTitle, { fontFamily: theme.semiBoldFont }]}>
                  {t(`profileHub.m_${m.key}`)}
                </Text>
                <Text allowFontScaling={false} style={[st.howBody, { fontFamily: theme.regularFont }]}>
                  {t(`profileHub.how_${m.key}`)}
                </Text>
              </View>
            </View>
          ))}
        </LinearGradient>
      )}

      <View style={{ marginTop: 18 }}>{footer}</View>
    </View>
  );
}

const st = StyleSheet.create({
  segment: { marginBottom: 14 },
  guideRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  },
  /** Wider than the tips tile — stretches to match the tile height. */
  photoWrap: {
    flexGrow: GUIDE_IMG_W,
    flexShrink: 1,
    flexBasis: 0,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: PG.cardBottom,
    minHeight: 320,
  },
  photo: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  /** Narrower tips tile — sets the row height the photo stretches to. */
  tipsCard: {
    flexGrow: GUIDE_TILE_W,
    flexShrink: 1,
    flexBasis: 0,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#07256D",
    backgroundColor: "#030A17",
    padding: 10,
    gap: 20,
    justifyContent: "space-evenly",
  },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tipIcon: { width: 28, height: 28, flexShrink: 0 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 17, color: "#FFFFFF" },
  howCard: { borderRadius: 24, borderWidth: 1, borderColor: PG.border, paddingHorizontal: 16 },
  howRow: { flexDirection: "row", gap: 14, paddingVertical: 14 },
  howRowDivided: { borderTopWidth: 1, borderTopColor: PG.borderSoft },
  howTitle: { fontSize: 15, color: "#FFFFFF" },
  howBody: { fontSize: 13, lineHeight: 19, color: "#86A7D2" },
});
