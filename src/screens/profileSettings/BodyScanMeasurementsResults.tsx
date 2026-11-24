import React, { useContext, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../../context";
import { GlowButton } from "../../components/ui";
import { genderTranslationKey } from "../../i18n/profileOptionValues";
import { cmToFtIn, formatTenth, getBodyUnits, kgToLb, roundTenth } from "../../lib/bodyUnits";
import { SegmentedPills } from "../progress/SegmentedPills";
import { ageFromIso } from "./BasicInfoSection";
import {
  EMPTY_EXTRAS,
  lenOut,
  loadExtras,
  MEAS_ICONS,
  type Extras,
  type PairKey,
  type SingleKey,
  type System,
} from "./BodyMeasurementsSection";
import { ProfileHubRow, ProfileHubTitleBar } from "./ProfileHubParts";

type IconName = ComponentProps<typeof Ionicons>["name"];
type ResultsTab = "key" | "all";
type MeasKey = SingleKey | PairKey;

export type ScanResultsProfile = {
  heightCm?: number | null;
  weightKg?: number | null;
  birthDate?: string | null;
  gender?: string | null;
  dominantHand?: string | null;
  bodyMeasurements?: Partial<Extras> | null;
};

const PAIR_KEYS = new Set<string>([
  "arm",
  "upperArm",
  "forearm",
  "hand",
  "upperLeg",
  "lowerLeg",
  "armCirc",
  "thighCirc",
  "calfCirc",
]);

const UPPER_ROWS: { key: MeasKey; iconImage?: number; icon?: IconName }[] = [
  { key: "shoulder", iconImage: MEAS_ICONS.shoulder },
  { key: "chest", iconImage: MEAS_ICONS.chest },
  { key: "arm", iconImage: MEAS_ICONS.arm },
];

const ALL_ROWS: { key: "height" | "weight" | MeasKey; iconImage?: number; icon?: IconName; short?: boolean }[] = [
  { key: "height", iconImage: MEAS_ICONS.height, short: true },
  { key: "weight", iconImage: MEAS_ICONS.weight, short: true },
  { key: "wingspan", iconImage: MEAS_ICONS.wingspan, short: true },
  { key: "shoulder", iconImage: MEAS_ICONS.shoulder },
  { key: "chest", iconImage: MEAS_ICONS.chest },
  { key: "torso", icon: "shirt-outline" },
  { key: "hip", iconImage: MEAS_ICONS.hip },
  { key: "arm", iconImage: MEAS_ICONS.arm },
  { key: "upperArm", iconImage: MEAS_ICONS.upperArm },
  { key: "forearm", iconImage: MEAS_ICONS.forearm },
  { key: "hand", iconImage: MEAS_ICONS.hand },
  { key: "upperLeg", iconImage: MEAS_ICONS.upperLeg },
  { key: "lowerLeg", iconImage: MEAS_ICONS.lowerLeg },
];

function isPairKey(k: string): k is PairKey {
  return PAIR_KEYS.has(k);
}

function heightText(cm: number | null | undefined, system: System): string {
  if (cm == null) return "—";
  if (system === "metric") return `${formatTenth(roundTenth(cm))} cm`;
  const { ft, inches } = cmToFtIn(cm);
  return `${ft}' ${inches}"`;
}

function weightText(kg: number | null | undefined, system: System): string {
  if (kg == null) return "—";
  return system === "metric" ? `${formatTenth(roundTenth(kg))} kg` : `${formatTenth(kgToLb(kg))} lb`;
}

function extrasText(extras: Extras, key: MeasKey, system: System): string {
  const unit = system === "metric" ? "cm" : "in";
  if (isPairKey(key)) {
    const p = extras[key];
    if (p.left == null && p.right == null) return "—";
    if (p.left != null && p.right != null && p.left === p.right) return `${lenOut(p.left, system)} ${unit}`;
    const l = p.left == null ? "—" : lenOut(p.left, system);
    const r = p.right == null ? "—" : lenOut(p.right, system);
    return `${l} / ${r} ${unit}`;
  }
  const v = extras[key];
  return v == null ? "—" : `${lenOut(v, system)} ${unit}`;
}

/** Measurements Results — Key Metrics vs All Measurements after the 3D model view. */
export function BodyScanMeasurementsResults({
  profile,
  onBack,
  onFinish,
}: {
  profile: ScanResultsProfile;
  onBack: () => void;
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const [tab, setTab] = useState<ResultsTab>("key");
  const [system, setSystem] = useState<System>("metric");
  const [extras, setExtras] = useState<Extras>(EMPTY_EXTRAS);

  useEffect(() => {
    void getBodyUnits().then((u) => setSystem(u.height === "cm" ? "metric" : "imperial"));
    void loadExtras(profile.bodyMeasurements ?? null).then(setExtras);
  }, [profile.bodyMeasurements]);

  const age = ageFromIso(profile.birthDate ?? null);
  const hand = (profile.dominantHand ?? "").toLowerCase();
  const basicRows: { key: string; iconImage: number; title: string; value: string }[] = [
    {
      key: "height",
      iconImage: require("../../../assets/aicoach/profile-hub/basic-info/icon-height.png"),
      title: t("profileHub.m_height"),
      value: heightText(profile.heightCm, system),
    },
    {
      key: "weight",
      iconImage: require("../../../assets/aicoach/profile-hub/basic-info/icon-weight.png"),
      title: t("profileHub.m_weight"),
      value: weightText(profile.weightKg, system),
    },
    {
      key: "age",
      iconImage: require("../../../assets/aicoach/profile-hub/basic-info/icon-age.png"),
      title: t("profileHub.age"),
      value: age == null ? "—" : String(age),
    },
    {
      key: "gender",
      iconImage: require("../../../assets/aicoach/profile-hub/basic-info/icon-gender.png"),
      title: t("profileSettingsUi.gender"),
      value: profile.gender
        ? t(genderTranslationKey(profile.gender[0].toUpperCase() + profile.gender.slice(1)))
        : "—",
    },
    {
      key: "hand",
      iconImage: require("../../../assets/aicoach/profile-hub/basic-info/icon-dominant.png"),
      title: t("profileHub.dominantHand"),
      value: hand === "left" ? t("profileHub.handLeft") : hand === "right" ? t("profileHub.handRight") : "—",
    },
  ];

  return (
    <View style={st.screen} testID="scan-results-screen">
      <ProfileHubTitleBar title={t("profileHub.scanResultsTitle")} onBack={onBack} />

      <SegmentedPills<ResultsTab>
        variant="flat"
        options={[
          { key: "key", label: t("profileHub.scanResultsTabKey"), testID: "scan-results-tab-key" },
          { key: "all", label: t("profileHub.scanResultsTabAll"), testID: "scan-results-tab-all" },
        ]}
        value={tab}
        onChange={setTab}
        fontFamily={theme.mediumFont}
        activeFontFamily={theme.semiBoldFont}
        style={st.segment}
      />

      {tab === "key" ? (
        <>
          {basicRows.map((r) => (
            <ProfileHubRow
              key={r.key}
              iconImage={r.iconImage}
              rowHeight={46}
              title={r.title}
              value={r.value}
              onPress={() => {}}
              testID={`scan-results-basic-${r.key}`}
            />
          ))}
          <Text allowFontScaling={false} style={[st.groupTitle, { fontFamily: theme.semiBoldFont }]}>
            {t("profileHub.group_upper")}
          </Text>
          {UPPER_ROWS.map((r) => (
            <ProfileHubRow
              key={r.key}
              icon={r.icon}
              iconImage={r.iconImage}
              rowHeight={70}
              title={t(`profileHub.m_${r.key}`)}
              value={extrasText(extras, r.key, system)}
              onPress={() => {}}
              testID={`scan-results-upper-${r.key}`}
            />
          ))}
        </>
      ) : (
        ALL_ROWS.map((r) => (
          <ProfileHubRow
            key={r.key}
            icon={r.icon}
            iconImage={r.iconImage}
            rowHeight={r.short ? 46 : 70}
            title={t(`profileHub.m_${r.key}`)}
            value={
              r.key === "height"
                ? heightText(profile.heightCm, system)
                : r.key === "weight"
                  ? weightText(profile.weightKg, system)
                  : extrasText(extras, r.key, system)
            }
            onPress={() => {}}
            testID={`scan-results-all-${r.key}`}
          />
        ))
      )}

      <GlowButton
        label={t("profileHub.scanResultsEdit")}
        onPress={onFinish}
        variant="accent"
        testID="scan-results-finish"
        style={{ alignSelf: "stretch", marginTop: 20 }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { width: "100%" },
  segment: { marginTop: 4, marginBottom: 14 },
  groupTitle: {
    fontSize: 16,
    color: "#FFFFFF",
    marginTop: 14,
    marginBottom: 8,
  },
});
