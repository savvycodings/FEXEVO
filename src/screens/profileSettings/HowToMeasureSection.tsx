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
const GUIDE_ASPECT = 376 / 640;

const GUIDE_TIPS: { key: string; icon: IconName }[] = [
  { key: "Tape", icon: "resize-outline" },
  { key: "Flat", icon: "layers-outline" },
  { key: "Clothing", icon: "shirt-outline" },
  { key: "Steps", icon: "list-outline" },
  { key: "Units", icon: "options-outline" },
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
        size="lg"
        options={[
          { key: "guide", label: t("profileHub.howGuide"), testID: "howto-tab-guide" },
          { key: "tips", label: t("profileHub.howTips"), testID: "howto-tab-tips" },
        ]}
        value={tab}
        onChange={setTab}
        fontFamily={theme.mediumFont}
        activeFontFamily={theme.semiBoldFont}
        style={{ marginBottom: 14 }}
      />

      {tab === "guide" ? (
        <View style={st.guideRow}>
          <View style={[st.photoWrap, glow(14, 0.4)]}>
            <Image source={GUIDE_PHOTO} style={st.photo} resizeMode="cover" />
          </View>
          <LinearGradient
            colors={[PG.cardTop, PG.cardBottom]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[st.tipsCard, glow(10, 0.3)]}
          >
            {GUIDE_TIPS.map((tip) => (
              <View key={tip.key} style={st.tipRow}>
                <View style={st.tipIcon}>
                  <Ionicons name={tip.icon} size={20} color="#4D7BFF" />
                </View>
                <Text allowFontScaling={false} style={[st.tipText, { fontFamily: theme.regularFont }]}>
                  {t(`profileHub.howTip${tip.key}`)}
                </Text>
              </View>
            ))}
          </LinearGradient>
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
  guideRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  photoWrap: { flex: 1.1, borderRadius: 24, overflow: "hidden", backgroundColor: PG.cardBottom },
  photo: { width: "100%", aspectRatio: GUIDE_ASPECT },
  tipsCard: { flex: 1, borderRadius: 24, borderWidth: 1, borderColor: PG.border, paddingVertical: 10, paddingHorizontal: 12 },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(77, 123, 255, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  tipText: { flex: 1, fontSize: 13, lineHeight: 17, color: "#FFFFFF" },
  howCard: { borderRadius: 24, borderWidth: 1, borderColor: PG.border, paddingHorizontal: 16 },
  howRow: { flexDirection: "row", gap: 14, paddingVertical: 14 },
  howRowDivided: { borderTopWidth: 1, borderTopColor: PG.borderSoft },
  howTitle: { fontSize: 15, color: "#FFFFFF" },
  howBody: { fontSize: 13, lineHeight: 19, color: "#86A7D2" },
});
