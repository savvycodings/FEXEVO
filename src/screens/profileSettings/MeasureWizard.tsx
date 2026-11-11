import React, { useContext, useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../../context";
import { PG, glow } from "../progress/progressTheme";
import { SegmentedPills } from "../progress/SegmentedPills";
import Svg, { Circle, Defs, LinearGradient as SvgLinear, Path, RadialGradient, Stop } from "react-native-svg";
import { GlowButton, UI } from "../../components/ui";
import { ProfileHubRow } from "./ProfileHubParts";
import {
  EMPTY_PAIR,
  EditMeasurementModal,
  RANGE_CM,
  lenOut,
  type Extras,
  type PairKey,
  type SingleKey,
  type System,
} from "./BodyMeasurementsSection";
import { genderTranslationKey } from "../../i18n/profileOptionValues";
import { ageFromIso } from "./BasicInfoSection";
import { cmToFtIn, formatTenth, getBodyUnits, kgToLb, roundTenth } from "../../lib/bodyUnits";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
export type WizardStep = "upper" | "lower" | "circ";
type MKey = SingleKey | PairKey;

const PAIR_KEYS: MKey[] = ["arm", "upperArm", "forearm", "hand", "upperLeg", "lowerLeg", "armCirc", "thighCirc", "calfCirc"];
const isPair = (k: MKey): k is PairKey => PAIR_KEYS.includes(k);

/** Overlay geometry in fractions of the square photo frame (x from the left, y from the top). */
type Callout = { key: MKey; side?: "left" | "right"; x: number; y: number; center?: boolean };
type Ring = { cx: number; cy: number; w: number; h?: number; rotate?: number };
type StepConfig = {
  photo: number;
  rows: { key: MKey; icon: IconName; label?: string }[];
  callouts: Callout[];
  /** Horizontal measuring line with end + inner dots. */
  hLine?: { x1: number; x2: number; y: number };
  /** Vertical lines (x) from y1 to y2 with a dot at each y in `dots`. */
  vLines?: { x: number; y1: number; y2: number; dots: number[] }[];
  elbowDots?: { x: number; y: number }[];
  rings?: Ring[];
};

export const STEP_CONFIG: Record<WizardStep, StepConfig> = {
  upper: {
    photo: require("../../../assets/calibration/upper.jpg"),
    rows: [
      { key: "shoulder", icon: "accessibility-outline" },
      { key: "chest", icon: "ellipse-outline" },
      { key: "arm", icon: "git-branch-outline" },
      { key: "forearm", icon: "fitness-outline" },
    ],
    callouts: [
      { key: "shoulder", x: 0.06, y: 0.16 },
      { key: "chest", x: 0.7, y: 0.27 },
      // The player's right side is on the viewer's left.
      { key: "arm", side: "right", x: 0.05, y: 0.39 },
      { key: "arm", side: "left", x: 0.7, y: 0.5 },
      { key: "forearm", side: "right", x: 0.06, y: 0.62 },
      { key: "forearm", side: "left", x: 0.71, y: 0.72 },
    ],
    hLine: { x1: 0.34, x2: 0.66, y: 0.335 },
    elbowDots: [
      { x: 0.3, y: 0.66 },
      { x: 0.7, y: 0.66 },
    ],
  },
  lower: {
    photo: require("../../../assets/calibration/lower.jpg"),
    rows: [
      { key: "hip", icon: "git-compare-outline" },
      { key: "upperLeg", icon: "walk-outline", label: "profileHub.m_thigh" },
      { key: "lowerLeg", icon: "footsteps-outline", label: "profileHub.m_lowerLegLong" },
    ],
    callouts: [
      { key: "hip", x: 0.5, y: 0.035, center: true },
      { key: "upperLeg", side: "right", x: 0.06, y: 0.3 },
      { key: "upperLeg", side: "left", x: 0.7, y: 0.3 },
      { key: "lowerLeg", side: "right", x: 0.06, y: 0.6 },
      { key: "lowerLeg", side: "left", x: 0.7, y: 0.6 },
    ],
    hLine: { x1: 0.36, x2: 0.63, y: 0.2 },
    vLines: [
      { x: 0.385, y1: 0.2, y2: 0.81, dots: [0.52, 0.81] },
      { x: 0.595, y1: 0.2, y2: 0.81, dots: [0.52, 0.81] },
    ],
  },
  circ: {
    photo: require("../../../assets/calibration/upper.jpg"),
    rows: [
      { key: "chest", icon: "ellipse-outline" },
      { key: "waist", icon: "radio-button-off-outline" },
      { key: "armCirc", icon: "barbell-outline" },
      { key: "thighCirc", icon: "walk-outline" },
      { key: "calfCirc", icon: "footsteps-outline" },
    ],
    callouts: [
      { key: "chest", x: 0.68, y: 0.14 },
      { key: "waist", x: 0.03, y: 0.6 },
    ],
    rings: [
      // chest, waist, then upper arms and thighs (no calves in this crop)
      { cx: 0.5, cy: 0.46, w: 0.3 },
      { cx: 0.5, cy: 0.62, w: 0.27 },
      { cx: 0.32, cy: 0.52, w: 0.09, rotate: 75 },
      { cx: 0.69, cy: 0.52, w: 0.09, rotate: -75 },
      { cx: 0.42, cy: 0.92, w: 0.13 },
      { cx: 0.58, cy: 0.92, w: 0.13 },
    ],
  },
};

export const STEP_TITLE: Record<WizardStep, string> = {
  upper: "profileHub.upperTitle",
  lower: "profileHub.lowerTitle",
  circ: "profileHub.circTitle",
};

function useSystem(): System {
  const [system, setSystem] = useState<System>("metric");
  useEffect(() => {
    void getBodyUnits().then((u) => setSystem(u.height === "cm" ? "metric" : "imperial"));
  }, []);
  return system;
}

/** "65 cm" when both sides match (most people), "64 / 65 cm" when they differ, L first like the (L/R) labels. */
function valueText(extras: Extras, key: MKey, system: System): string {
  const unit = system === "metric" ? "cm" : "in";
  if (isPair(key)) {
    const p = extras[key];
    if (p.left == null && p.right == null) return "—";
    if (p.left != null && p.right != null && p.left === p.right) return `${lenOut(p.right, system)} ${unit}`;
    const r = p.right == null ? "—" : lenOut(p.right, system);
    const l = p.left == null ? "—" : lenOut(p.left, system);
    return `${l} / ${r} ${unit}`;
  }
  const v = extras[key];
  return v == null ? "—" : `${lenOut(v, system)} ${unit}`;
}

function sideValue(extras: Extras, c: Callout, system: System): string {
  const unit = system === "metric" ? "cm" : "in";
  const v = isPair(c.key) ? (c.side ? extras[c.key][c.side] : null) : extras[c.key];
  return v == null ? "—" : `${lenOut(v, system)} ${unit}`;
}

function useEditor(extras: Extras, setExtras: (e: Extras) => void, system: System) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<{ key: MKey; label: string } | null>(null);
  const modal = editing ? (
    <EditMeasurementModal
      key={editing.key}
      title={editing.label}
      kind={isPair(editing.key) ? "pair" : "single"}
      system={system}
      heightCm={null}
      weightKg={null}
      single={isPair(editing.key) ? null : extras[editing.key as SingleKey]}
      pair={isPair(editing.key) ? extras[editing.key] : EMPTY_PAIR}
      rangeCm={RANGE_CM[editing.key]}
      onClose={() => setEditing(null)}
      onDone={(r) => {
        const k = editing.key;
        setExtras({ ...extras, [k]: isPair(k) ? r.pair : r.single } as Extras);
        setEditing(null);
      }}
    />
  ) : null;
  return { open: (key: MKey, label?: string) => setEditing({ key, label: t(label ?? `profileHub.m_${key}`) }), modal };
}

export function MeasureStep({
  step,
  extras,
  setExtras,
  footer,
}: {
  step: WizardStep;
  extras: Extras;
  setExtras: (e: Extras) => void;
  footer: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const system = useSystem();
  const cfg = STEP_CONFIG[step];
  const editor = useEditor(extras, setExtras, system);
  const labelFor = (key: MKey) => cfg.rows.find((r) => r.key === key)?.label;

  return (
    <View>
      <View style={[st.frame, glow(14, 0.4)]} testID={`wizard-photo-${step}`}>
        <Image source={cfg.photo} style={st.photo} resizeMode="cover" />
        {cfg.hLine ? <HLine {...cfg.hLine} /> : null}
        {cfg.vLines?.map((v, i) => <VLine key={i} {...v} />)}
        {cfg.elbowDots?.map((d, i) => <Dot key={i} x={d.x} y={d.y} />)}
        {cfg.rings?.map((r, i) => <RingView key={i} {...r} />)}
        {cfg.callouts.map((c) => (
          <TouchableOpacity
            key={`${c.key}-${c.side ?? "x"}`}
            activeOpacity={0.85}
            onPress={() => editor.open(c.key, labelFor(c.key))}
            style={[
              st.callout,
              { top: `${c.y * 100}%` },
              c.center ? { left: 0, right: 0, alignSelf: "center", alignItems: "center" } : { left: `${c.x * 100}%` },
            ]}
            accessibilityRole="button"
          >
            <View style={st.calloutBox}>
              <Text allowFontScaling={false} style={[st.calloutLabel, { fontFamily: theme.regularFont }]}>
                {t(`profileHub.c_${c.key}${c.side ? `_${c.side}` : ""}`)}
              </Text>
              <Text allowFontScaling={false} style={[st.calloutValue, { fontFamily: theme.mediumFont }]}>
                {sideValue(extras, c, system)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ marginTop: 16 }}>
        {cfg.rows.map((r) => (
          <ProfileHubRow
            key={r.key}
            compact
            icon={r.icon}
            title={t(r.label ?? `profileHub.m_${r.key}`)}
            value={valueText(extras, r.key, system)}
            onPress={() => editor.open(r.key, r.label)}
            testID={`wizard-row-${r.key}`}
          />
        ))}
      </View>
      <View style={{ marginTop: 6 }}>{footer}</View>
      {editor.modal}
    </View>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Review Measurements: Overview (tap a row → its step) / Edit (tap a row → edit in place).
 * ---------------------------------------------------------------------------------------------- */

export function ReviewMeasurements({
  profile,
  extras,
  setExtras,
  onGoToStep,
  onEditBasic,
  footer,
}: {
  profile: { heightCm?: number | null; weightKg?: number | null; birthDate?: string | null; gender?: string | null; dominantHand?: string | null };
  extras: Extras;
  setExtras: (e: Extras) => void;
  onGoToStep: (step: WizardStep) => void;
  onEditBasic: () => void;
  footer: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const system = useSystem();
  const [tab, setTab] = useState<"overview" | "edit">("overview");
  const editor = useEditor(extras, setExtras, system);

  const h = profile.heightCm ?? null;
  const w = profile.weightKg ?? null;
  const heightText =
    h == null ? "—" : system === "metric" ? `${formatTenth(roundTenth(h))} cm` : `${cmToFtIn(h).ft}' ${cmToFtIn(h).inches}"`;
  const weightText = w == null ? "—" : system === "metric" ? `${formatTenth(roundTenth(w))} kg` : `${formatTenth(kgToLb(w))} lb`;
  const age = ageFromIso(profile.birthDate ?? null);
  const hand = (profile.dominantHand ?? "").toLowerCase();
  const basicRows: { icon: IconName; title: string; value: string }[] = [
    { icon: "resize-outline", title: t("profileHub.m_height"), value: heightText },
    { icon: "speedometer-outline", title: t("profileHub.m_weight"), value: weightText },
    { icon: "people-outline", title: t("profileHub.age"), value: age == null ? "—" : String(age) },
    {
      icon: "male-female-outline",
      title: t("profileSettingsUi.gender"),
      value: profile.gender ? t(genderTranslationKey(profile.gender[0].toUpperCase() + profile.gender.slice(1))) : "—",
    },
    {
      icon: "hand-right-outline",
      title: t("profileHub.dominantHand"),
      value: hand === "left" ? t("profileHub.handLeft") : hand === "right" ? t("profileHub.handRight") : "—",
    },
  ];

  return (
    <View>
      <SegmentedPills<"overview" | "edit">
        size="lg"
        options={[
          { key: "overview", label: t("profileHub.reviewOverview"), testID: "review-tab-overview" },
          { key: "edit", label: t("profileHub.reviewEdit"), testID: "review-tab-edit" },
        ]}
        value={tab}
        onChange={setTab}
        fontFamily={theme.mediumFont}
        activeFontFamily={theme.semiBoldFont}
        style={{ marginBottom: 14 }}
      />
      {tab === "edit" ? (
        <Text allowFontScaling={false} style={[st.hint, { fontFamily: theme.regularFont }]}>
          {t("profileHub.reviewEditHint")}
        </Text>
      ) : null}

      {basicRows.map((r) => (
        <ProfileHubRow key={r.title} compact icon={r.icon} title={r.title} value={r.value} onPress={onEditBasic} />
      ))}

      {(["upper", "lower", "circ"] as const).map((step) => (
        <View key={step}>
          <Text allowFontScaling={false} style={[st.groupTitle, { fontFamily: theme.semiBoldFont }]}>
            {t(`profileHub.group_${step}`)}
          </Text>
          {STEP_CONFIG[step].rows
            .filter((r) => !(step === "circ" && r.key === "chest"))
            .map((r) => (
              <ProfileHubRow
                key={`${step}-${r.key}`}
                compact
                icon={r.icon}
                title={t(r.label ?? `profileHub.m_${r.key}`)}
                value={valueText(extras, r.key, system)}
                onPress={() => (tab === "edit" ? editor.open(r.key, r.label) : onGoToStep(step))}
                testID={`review-row-${r.key}`}
              />
            ))}
        </View>
      ))}
      <View style={{ marginTop: 6 }}>{footer}</View>
      {editor.modal}
    </View>
  );
}

/* ---------------------------------------------------------------------------------------------- */

const pct = (n: number) => `${n * 100}%` as const;

function Dot({ x, y, big }: { x: number; y: number; big?: boolean }) {
  const size = big ? 14 : 8;
  return (
    <View
      pointerEvents="none"
      style={[st.dot, { width: size, height: size, borderRadius: size / 2, left: pct(x), top: pct(y), marginLeft: -size / 2, marginTop: -size / 2 }]}
    />
  );
}

function HLine({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <>
      <View pointerEvents="none" style={[st.line, { left: pct(x1), width: pct(x2 - x1), top: pct(y), height: 1.5 }]} />
      <Dot x={x1} y={y} big />
      <Dot x={x1 + (x2 - x1) / 3} y={y} />
      <Dot x={x1 + ((x2 - x1) * 2) / 3} y={y} />
      <Dot x={x2} y={y} big />
    </>
  );
}

function VLine({ x, y1, y2, dots }: { x: number; y1: number; y2: number; dots: number[] }) {
  return (
    <>
      <View pointerEvents="none" style={[st.line, { left: pct(x), top: pct(y1), height: pct(y2 - y1), width: 1.5 }]} />
      {dots.map((d) => (
        <Dot key={d} x={x} y={d} big />
      ))}
    </>
  );
}

function RingView({ cx, cy, w, h, rotate }: Ring) {
  // Height as a share of the frame; an ellipse about a fifth as tall as it is wide reads as a tape loop.
  const hh = h ?? w * 0.18;
  return (
    <View
      pointerEvents="none"
      style={[
        st.ring,
        glow(8, 0.9),
        {
          left: pct(cx - w / 2),
          top: pct(cy - hh / 2),
          width: pct(w),
          height: pct(hh),
          transform: rotate ? [{ rotate: `${rotate}deg` }] : undefined,
        },
      ]}
    />
  );
}

const st = StyleSheet.create({
  frame: { width: "100%", aspectRatio: 1, borderRadius: 26, overflow: "hidden", backgroundColor: PG.cardBottom },
  // Explicit size: on web an absolutely filled Image still grows to its intrinsic pixels.
  photo: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  callout: { position: "absolute" },
  calloutBox: {
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(77, 123, 255, 0.75)",
    backgroundColor: "rgba(16, 28, 92, 0.72)",
    alignItems: "center",
  },
  calloutLabel: { fontSize: 11, color: "#A9C1F5", textAlign: "center" },
  calloutValue: { fontSize: 16, color: "#FFFFFF", marginTop: 1 },
  dot: { position: "absolute", backgroundColor: "#A9D8FF", borderWidth: 1, borderColor: "#FFFFFF" },
  line: { position: "absolute", backgroundColor: "#6E8BFF" },
  ring: { position: "absolute", borderRadius: 999, borderWidth: 2, borderColor: "#8FB8FF" },
  groupTitle: { fontSize: 16, color: "#FFFFFF", marginTop: 10, marginBottom: 10 },
  hint: { fontSize: 13, color: "#86A7D2", marginBottom: 10 },
});

/* ------------------------------------------------------------------------------------------------
 * Manual Complete: shown after Review → Confirm. Offers the 3D scan next, or finishing for now.
 * ---------------------------------------------------------------------------------------------- */

export function ManualComplete({ onScan, onFinish }: { onScan: () => void; onFinish: () => void }) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const S = 240;
  const r = 92;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ alignItems: "center" }}>
      <View style={[{ width: S, height: S, marginTop: 8, borderRadius: S / 2 }, glow(30, 0.55)]}>
        <Svg width={S} height={S}>
          <Defs>
            <RadialGradient id="mcFill" cx="50%" cy="50%" r="50%">
              <Stop offset="0.55" stopColor="#05081A" stopOpacity="1" />
              <Stop offset="0.85" stopColor="#1B1F7A" stopOpacity="0.9" />
              <Stop offset="1" stopColor="#2A2FA8" stopOpacity="0.7" />
            </RadialGradient>
            <SvgLinear id="mcArc" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#E4EEFF" />
              <Stop offset="1" stopColor="#5B7BFF" />
            </SvgLinear>
          </Defs>
          <Circle cx={S / 2} cy={S / 2} r={S / 2 - 2} fill="url(#mcFill)" stroke="#3B4BC8" strokeOpacity={0.6} strokeWidth={1} />
          <Circle cx={S / 2} cy={S / 2} r={r} fill="none" stroke="#3E46C9" strokeOpacity={0.55} strokeWidth={10} />
          {/* Bright arc from 12 o'clock clockwise to about 6, like the design. */}
          <Circle
            cx={S / 2}
            cy={S / 2}
            r={r}
            fill="none"
            stroke="url(#mcArc)"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${circ * 0.5} ${circ}`}
            transform={`rotate(-80 ${S / 2} ${S / 2})`}
          />
          <Path
            d={`M ${S / 2 - 34} ${S / 2 + 2} L ${S / 2 - 10} ${S / 2 + 26} L ${S / 2 + 34} ${S / 2 - 24}`}
            fill="none"
            stroke="#8FB8FF"
            strokeWidth={11}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Text allowFontScaling={false} style={[doneSt.doneTitle, { fontFamily: theme.mediumFont }]}>
        {t("profileHub.doneTitle")}
      </Text>
      <Text allowFontScaling={false} style={[doneSt.doneBody, { fontFamily: theme.regularFont }]}>
        {t("profileHub.doneBody")}
      </Text>
      <GlowButton
        label={t("profileHub.doneScan")}
        onPress={onScan}
        testID="manual-done-scan"
        style={{ alignSelf: "stretch", marginTop: 28 }}
      />
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onFinish}
        style={doneSt.secondaryBtn}
        accessibilityRole="button"
        testID="manual-done-finish"
      >
        <Text allowFontScaling={false} style={[doneSt.secondaryLabel, { fontFamily: theme.mediumFont }]}>
          {t("profileHub.doneFinish")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const doneSt = StyleSheet.create({
  doneTitle: { fontSize: 20, color: "#FFFFFF", marginTop: 32, textAlign: "center" },
  doneBody: { fontSize: 14, lineHeight: 20, color: "#8D9BC9", marginTop: 14, textAlign: "center", paddingHorizontal: 12 },
  secondaryBtn: {
    alignSelf: "stretch",
    height: UI.buttonHeight,
    borderRadius: UI.btnRadius,
    backgroundColor: "#131A55",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  secondaryLabel: { fontSize: 17, color: "#7FA8FF" },
});
