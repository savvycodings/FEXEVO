import React, { useContext, useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View, type ImageSourcePropType, type LayoutChangeEvent } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../../context";
import { PG, glow } from "../progress/progressTheme";
import { SegmentedPills } from "../progress/SegmentedPills";
import { GlowButton, UI } from "../../components/ui";
import { ProfileHubRow } from "./ProfileHubParts";
import {
  EMPTY_PAIR,
  EditMeasurementModal,
  MEAS_ICONS,
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
type Callout = { key: MKey; side?: "left" | "right"; x: number; y: number; center?: boolean; labelKey?: string };
type Ring = { cx: number; cy: number; w: number; h?: number; rotate?: number };
type StepRow = { key: MKey; icon?: IconName; iconImage?: ImageSourcePropType; label?: string };
type StepConfig = {
  photo: number;
  rows: StepRow[];
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
      { key: "shoulder", iconImage: MEAS_ICONS.shoulder },
      { key: "arm", iconImage: MEAS_ICONS.arm },
      { key: "forearm", iconImage: MEAS_ICONS.forearm },
      { key: "upperArm", iconImage: MEAS_ICONS.upperArm },
    ],
    // Tile layout only — no shoulder line / forearm dots (hard to align on this photo).
    callouts: [
      { key: "shoulder", x: 0.03, y: 0.07 },
      { key: "upperArm", x: 0.03, y: 0.42 },
      { key: "arm", x: 0.63, y: 0.37 },
      { key: "forearm", x: 0.63, y: 0.65 },
    ],
  },
  lower: {
    photo: require("../../../assets/calibration/lower.jpg"),
    rows: [
      { key: "hip", iconImage: MEAS_ICONS.hip },
      { key: "upperLeg", iconImage: MEAS_ICONS.upperLeg, label: "profileHub.m_thigh" },
      { key: "lowerLeg", iconImage: MEAS_ICONS.lowerLeg, label: "profileHub.m_lowerLegLong" },
    ],
    // Viewer-left = player's right (R), viewer-right = player's left (L).
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
    photo: require("../../../assets/calibration/circum.png"),
    rows: [
      { key: "chest", iconImage: MEAS_ICONS.chest },
      { key: "hip", iconImage: MEAS_ICONS.widthCirc, label: "profileHub.m_widthCirc" },
      { key: "thighCirc", iconImage: MEAS_ICONS.thighCirc },
      { key: "calfCirc", iconImage: MEAS_ICONS.calfCirc },
    ],
    // Width top-right; chest mid-left; calf bottom-left; thigh bottom-right.
    callouts: [
      { key: "hip", x: 0.62, y: 0.14, labelKey: "profileHub.c_width" },
      { key: "chest", x: 0.03, y: 0.48 },
      { key: "thighCirc", x: 0.62, y: 0.78 },
      { key: "calfCirc", x: 0.03, y: 0.9 },
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
  // No side → combined L/R (or the single value) for the Figma one-callout-per-measure look.
  if (!c.side) return valueText(extras, c.key, system);
  const unit = system === "metric" ? "cm" : "in";
  const v = isPair(c.key) ? extras[c.key][c.side] : extras[c.key];
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
  // Pixel positions — % left/top is flaky on Android absolute overlays.
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const onFrameLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== frameSize.w || height !== frameSize.h) setFrameSize({ w: width, h: height });
  };

  return (
    <View>
      <View style={[st.frame, glow(14, 0.4)]} testID={`wizard-photo-${step}`} onLayout={onFrameLayout}>
        <Image source={cfg.photo} style={st.photo} resizeMode="cover" />
        {cfg.hLine ? <HLine {...cfg.hLine} /> : null}
        {cfg.vLines?.map((v, i) => <VLine key={i} {...v} />)}
        {cfg.elbowDots?.map((d, i) => <Dot key={i} x={d.x} y={d.y} />)}
        {cfg.rings?.map((r, i) => <RingView key={i} {...r} />)}
        {frameSize.w > 0
          ? cfg.callouts.map((c) => (
              <TouchableOpacity
                key={`${c.key}-${c.side ?? "x"}`}
                activeOpacity={0.85}
                onPress={() => editor.open(c.key, labelFor(c.key))}
                style={[
                  st.callout,
                  c.center
                    ? { top: c.y * frameSize.h, left: 0, right: 0, alignItems: "center" }
                    : { top: c.y * frameSize.h, left: c.x * frameSize.w },
                ]}
                accessibilityRole="button"
                testID={`wizard-callout-${c.key}`}
              >
                <View style={st.calloutBox}>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={[st.calloutLabel, { fontFamily: theme.regularFont }]}
                  >
                    {t(c.labelKey ?? `profileHub.c_${c.key}${c.side ? `_${c.side}` : ""}`)}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[st.calloutValue, { fontFamily: theme.mediumFont }]}
                  >
                    {sideValue(extras, c, system)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          : null}
      </View>

      <View style={{ marginTop: 16 }}>
        {cfg.rows.map((r) => (
          <ProfileHubRow
            key={r.key}
            icon={r.icon}
            iconImage={r.iconImage}
            rowHeight={70}
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
  // Short Figma tiles (46× radius 20) + the new basic-info icons.
  const basicRows: { key: string; iconImage: number; title: string; value: string }[] = [
    {
      key: "height",
      iconImage: require("../../../assets/aicoach/profile-hub/basic-info/icon-height.png"),
      title: t("profileHub.m_height"),
      value: heightText,
    },
    {
      key: "weight",
      iconImage: require("../../../assets/aicoach/profile-hub/basic-info/icon-weight.png"),
      title: t("profileHub.m_weight"),
      value: weightText,
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
      value: profile.gender ? t(genderTranslationKey(profile.gender[0].toUpperCase() + profile.gender.slice(1))) : "—",
    },
    {
      key: "hand",
      iconImage: require("../../../assets/aicoach/profile-hub/basic-info/icon-dominant.png"),
      title: t("profileHub.dominantHand"),
      value: hand === "left" ? t("profileHub.handLeft") : hand === "right" ? t("profileHub.handRight") : "—",
    },
  ];

  return (
    <View>
      <SegmentedPills<"overview" | "edit">
        variant="flat"
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
        <ProfileHubRow
          key={r.key}
          iconImage={r.iconImage}
          rowHeight={46}
          title={r.title}
          value={r.value}
          onPress={onEditBasic}
          testID={`review-row-${r.key}`}
        />
      ))}

      {(["upper", "lower", "circ"] as const).map((step) => (
        <View key={step}>
          <Text allowFontScaling={false} style={[st.groupTitle, { fontFamily: theme.semiBoldFont }]}>
            {t(`profileHub.group_${step}`)}
          </Text>
          {STEP_CONFIG[step].rows.map((r) => (
            <ProfileHubRow
              key={`${step}-${r.key}`}
              icon={r.icon}
              iconImage={r.iconImage}
              rowHeight={70}
              title={t(r.label ?? `profileHub.m_${r.key}`)}
              value={valueText(extras, r.key, system)}
              onPress={() => (tab === "edit" ? editor.open(r.key, r.label) : onGoToStep(step))}
              testID={`review-row-${step}-${r.key}`}
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
      style={[
        st.dot,
        glow(6, 0.85),
        { width: size, height: size, borderRadius: size / 2, left: pct(x), top: pct(y), marginLeft: -size / 2, marginTop: -size / 2 },
      ]}
    />
  );
}

function HLine({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <>
      <View pointerEvents="none" style={[st.line, { left: pct(x1), width: pct(x2 - x1), top: pct(y), height: 2 }]} />
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
      <View pointerEvents="none" style={[st.line, { left: pct(x), top: pct(y1), height: pct(y2 - y1), width: 2 }]} />
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
  callout: { position: "absolute", zIndex: 20, elevation: 20 },
  // Figma: 83×39, padding 5, gap 5, bg #030A1780, border #07256D, inset #0048FF80.
  calloutBox: {
    width: 83,
    height: 39,
    padding: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#07256D",
    backgroundColor: "rgba(3, 10, 23, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    // RN has no inset box-shadow; soft blue glow approximates the Figma inset.
    shadowColor: "#0048FF",
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  calloutLabel: { fontSize: 8, lineHeight: 10, color: "#A9C1F5", textAlign: "center" },
  calloutValue: { fontSize: 11, lineHeight: 13, color: "#FFFFFF" },
  dot: {
    position: "absolute",
    zIndex: 8,
    elevation: 8,
    backgroundColor: "#B8E0FF",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  line: { position: "absolute", zIndex: 7, elevation: 7, backgroundColor: "#7EA0FF" },
  ring: { position: "absolute", zIndex: 3, borderRadius: 999, borderWidth: 2, borderColor: "#8FB8FF" },
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
  return (
    <View style={{ alignItems: "center" }}>
      <View style={[{ width: S, height: S, marginTop: 8 }, glow(30, 0.55)]}>
        <Image
          source={require("../../../assets/aicoach/profile-hub/manual-complete-check.png")}
          style={{ width: S, height: S }}
          resizeMode="contain"
        />
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
        variant="accent"
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
