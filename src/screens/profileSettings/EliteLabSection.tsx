import React, { useContext, useMemo, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../../context";
import { useSessionData } from "../../context/SessionDataContext";
import type { ActivitySession } from "../../lib/activitySession";
import { PG, glow } from "../progress/progressTheme";

const PLAYER_ART = require("../../../assets/elite/player.jpg");

/**
 * Elite thresholds. Provisional product numbers from the design, kept in one place so they are
 * easy to tune (or move to the backend) without touching the screen.
 */
export const ELITE_RULES = {
  validUploads: 100,
  qualificationDays: 90,
  activeDays: 20,
  latestAverageCount: 30,
  latestAverageScore: 95,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A finished analysis with a score counts as a valid upload. */
function isValid(a: ActivitySession): boolean {
  const done = a.status === "completed" || a.status === "done";
  const s = a.score ?? a.techniqueScore;
  return done && typeof s === "number" && Number.isFinite(s);
}

export type EliteProgress = {
  validUploads: number;
  qualificationDays: number;
  activeDays: number;
  latestAverage: number | null;
  unlocked: boolean;
};

export function computeEliteProgress(activities: ActivitySession[], now = Date.now()): EliteProgress {
  const valid = activities
    .filter(isValid)
    .map((a) => ({ at: Date.parse(a.createdAt), score: (a.score ?? a.techniqueScore) as number }))
    .filter((a) => Number.isFinite(a.at))
    .sort((x, y) => y.at - x.at);

  // The window is the last N days; uploads and active days only count inside it.
  const windowStart = now - ELITE_RULES.qualificationDays * DAY_MS;
  const inWindow = valid.filter((a) => a.at >= windowStart);
  const first = inWindow.length ? inWindow[inWindow.length - 1].at : null;
  const qualificationDays = first == null ? 0 : Math.min(ELITE_RULES.qualificationDays, Math.floor((now - first) / DAY_MS) + 1);
  const days = new Set(inWindow.map((a) => new Date(a.at).toISOString().slice(0, 10)));
  const latest = valid.slice(0, ELITE_RULES.latestAverageCount);
  const latestAverage = latest.length
    ? Math.round((latest.reduce((sum, a) => sum + a.score, 0) / latest.length) * 10) / 10
    : null;

  const p = {
    validUploads: inWindow.length,
    qualificationDays,
    activeDays: days.size,
    latestAverage,
  };
  const unlocked =
    p.validUploads >= ELITE_RULES.validUploads &&
    p.qualificationDays >= ELITE_RULES.qualificationDays &&
    p.activeDays >= ELITE_RULES.activeDays &&
    latest.length >= ELITE_RULES.latestAverageCount &&
    (latestAverage ?? 0) >= ELITE_RULES.latestAverageScore;
  return { ...p, unlocked };
}

export function EliteLabSection({
  renderFooter,
}: {
  renderFooter: (args: { label: string; onPress: () => void; disabled?: boolean; icon?: "lock-closed" }) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const { activities, activitiesLoading } = useSessionData();
  const progress = useMemo(() => computeEliteProgress(activities), [activities]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [openNotice, setOpenNotice] = useState(false);

  const bars: { key: string; label: string; value: number; target: number; text: string }[] = [
    {
      key: "uploads",
      label: t("profileHub.eliteUploads"),
      value: progress.validUploads,
      target: ELITE_RULES.validUploads,
      text: `${progress.validUploads} / ${ELITE_RULES.validUploads}`,
    },
    {
      key: "period",
      label: t("profileHub.elitePeriod"),
      value: progress.qualificationDays,
      target: ELITE_RULES.qualificationDays,
      text: t("profileHub.eliteDaysValue", { value: progress.qualificationDays, target: ELITE_RULES.qualificationDays }),
    },
    {
      key: "active",
      label: t("profileHub.eliteActiveDays"),
      value: progress.activeDays,
      target: ELITE_RULES.activeDays,
      text: `${progress.activeDays} / ${ELITE_RULES.activeDays}`,
    },
    {
      key: "average",
      label: t("profileHub.eliteAverage", { count: ELITE_RULES.latestAverageCount }),
      value: progress.latestAverage ?? 0,
      target: ELITE_RULES.latestAverageScore,
      text: `${progress.latestAverage == null ? "—" : progress.latestAverage.toFixed(1)} / ${ELITE_RULES.latestAverageScore}`,
    },
  ];

  return (
    <View style={{ gap: 16 }}>
      {/* Status */}
      <LinearGradient
        colors={[PG.cardTop, PG.cardBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[st.statusCard, glow(18, 0.55)]}
        testID="elite-status"
      >
        <Ionicons name={progress.unlocked ? "lock-open-outline" : "lock-closed-outline"} size={64} color={PG.barFill} />
        <Text allowFontScaling={false} style={[st.statusTitle, { fontFamily: theme.semiBoldFont }]}>
          {t(progress.unlocked ? "profileHub.eliteUnlockedTitle" : "profileHub.eliteLockedTitle")}
        </Text>
        <Text allowFontScaling={false} style={[st.statusBody, { fontFamily: theme.regularFont }]}>
          {t(progress.unlocked ? "profileHub.eliteUnlockedBody" : "profileHub.eliteLockedBody")}
        </Text>
      </LinearGradient>

      {/* Qualification progress */}
      <LinearGradient
        colors={[PG.cardTop, PG.cardBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[st.progressCard, glow(10, 0.3)]}
      >
        <View style={st.progressHead}>
          <Text allowFontScaling={false} style={[st.progressTitle, { fontFamily: theme.semiBoldFont }]}>
            {t("profileHub.eliteProgressTitle")}
          </Text>
          <TouchableOpacity onPress={() => setRulesOpen(true)} hitSlop={10} accessibilityRole="button" testID="elite-see-rules">
            <Text allowFontScaling={false} style={[st.link, { fontFamily: theme.mediumFont }]}>
              {t("profileHub.eliteSeeRules")}
            </Text>
          </TouchableOpacity>
        </View>
        {bars.map((b) => {
          const pct = Math.max(0, Math.min(1, b.target ? b.value / b.target : 0));
          const met = b.value >= b.target;
          return (
            <View key={b.key} style={st.barBlock} testID={`elite-bar-${b.key}`}>
              <View style={st.barLabelRow}>
                <Text allowFontScaling={false} style={[st.barLabel, { fontFamily: theme.regularFont }]}>
                  {b.label}
                </Text>
                <Text allowFontScaling={false} style={[st.barValue, met && st.barValueMet, { fontFamily: theme.mediumFont }]}>
                  {activitiesLoading && !activities.length ? "…" : b.text}
                </Text>
              </View>
              <View style={st.barTrack}>
                <View style={[st.barFill, { width: `${pct * 100}%` }]} />
              </View>
            </View>
          );
        })}
      </LinearGradient>

      {/* Promo */}
      <LinearGradient
        colors={[PG.cardTop, PG.cardBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[st.promoCard, glow(14, 0.45)]}
      >
        <View style={st.promoArtWrap}>
          <Image source={PLAYER_ART} style={st.promoArt} resizeMode="cover" />
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(4, 18, 54, 0)", "rgba(4, 18, 54, 0.6)", "#041236"]}
            locations={[0.3, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={st.promoText}>
          <Text allowFontScaling={false} style={[st.promoTitle, { fontFamily: theme.semiBoldFont }]}>
            {t("profileHub.elitePromoTitle")}
          </Text>
          <Text allowFontScaling={false} style={[st.promoBody, { fontFamily: theme.regularFont }]}>
            {t("profileHub.elitePromoBody")}
          </Text>
        </View>
      </LinearGradient>

      {openNotice ? (
        <Text allowFontScaling={false} style={[st.notice, { fontFamily: theme.mediumFont }]}>
          {t("profileHub.eliteOpenSoon")}
        </Text>
      ) : null}

      {renderFooter(
        progress.unlocked
          ? { label: t("profileHub.eliteOpen"), onPress: () => setOpenNotice(true) }
          : { label: t("profileHub.eliteLockedButton"), onPress: () => {}, disabled: true, icon: "lock-closed" }
      )}

      <Modal visible={rulesOpen} transparent animationType="fade" onRequestClose={() => setRulesOpen(false)}>
        <View style={st.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRulesOpen(false)} />
          <LinearGradient
            colors={[PG.cardTop, PG.cardBottom]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[st.modalCard, glow(18, 0.55)]}
          >
            <View style={st.modalHead}>
              <Text allowFontScaling={false} style={[st.modalTitle, { fontFamily: theme.semiBoldFont }]}>
                {t("profileHub.eliteRulesTitle")}
              </Text>
              <TouchableOpacity onPress={() => setRulesOpen(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("profileSettingsUi.close")}>
                <Ionicons name="close" size={22} color="#86A7D2" />
              </TouchableOpacity>
            </View>
            {(
              [
                ["cloud-upload-outline", t("profileHub.eliteRuleUploads", { n: ELITE_RULES.validUploads, days: ELITE_RULES.qualificationDays })],
                ["calendar-outline", t("profileHub.eliteRulePeriod", { days: ELITE_RULES.qualificationDays })],
                ["flame-outline", t("profileHub.eliteRuleActive", { n: ELITE_RULES.activeDays })],
                ["trophy-outline", t("profileHub.eliteRuleAverage", { count: ELITE_RULES.latestAverageCount, score: ELITE_RULES.latestAverageScore })],
              ] as const
            ).map(([icon, text]) => (
              <View key={icon} style={st.ruleRow}>
                <Ionicons name={icon} size={22} color="#2F7BFF" />
                <Text allowFontScaling={false} style={[st.ruleText, { fontFamily: theme.regularFont }]}>
                  {text}
                </Text>
              </View>
            ))}
          </LinearGradient>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  statusCard: {
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: "rgba(77, 166, 255, 0.75)",
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 10,
  },
  statusTitle: { fontSize: 20, color: "#FFFFFF", textAlign: "center", marginTop: 4 },
  statusBody: { fontSize: 14, lineHeight: 20, color: "#86A7D2", textAlign: "center" },
  progressCard: { borderRadius: 24, borderWidth: 1, borderColor: PG.border, padding: 18, gap: 14 },
  progressHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  progressTitle: { flex: 1, fontSize: 15, color: "#FFFFFF" },
  link: { fontSize: 14, color: PG.labelBlue },
  barBlock: { gap: 8 },
  barLabelRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  barLabel: { flex: 1, fontSize: 14, color: "#FFFFFF" },
  barValue: { fontSize: 14, color: "#FFFFFF" },
  barValueMet: { color: PG.labelBlue },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: PG.barTrack, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4, backgroundColor: PG.barFill },
  promoCard: {
    flexDirection: "row",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(77, 166, 255, 0.75)",
    overflow: "hidden",
    minHeight: 150,
  },
  promoArtWrap: { width: "42%" },
  promoArt: { width: "100%", height: "100%" },
  promoText: { flex: 1, paddingVertical: 18, paddingRight: 18, paddingLeft: 8, gap: 8, justifyContent: "center" },
  promoTitle: { fontSize: 17, color: "#FFFFFF" },
  promoBody: { fontSize: 13, lineHeight: 19, color: "#86A7D2" },
  notice: { color: PG.labelBlue, fontSize: 13, textAlign: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(1, 7, 25, 0.78)", justifyContent: "center", paddingHorizontal: 18 },
  modalCard: { borderRadius: 24, borderWidth: 1, borderColor: PG.border, padding: 18, gap: 14 },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 18, color: "#FFFFFF" },
  ruleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  ruleText: { flex: 1, fontSize: 14, lineHeight: 20, color: "#FFFFFF" },
});
