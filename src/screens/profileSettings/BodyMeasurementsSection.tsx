import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../../context";
import { GlowButton } from "../../components/ui";
import { PG, glow } from "../progress/progressTheme";
import { SegmentedPills } from "../progress/SegmentedPills";
import { MockNotice, ProfileHubRow } from "./ProfileHubParts";
import {
  cmToFtIn,
  formatTenth,
  ftInToCm,
  getBodyUnits,
  heightRangeLabels,
  isHeightCmValid,
  isWeightKgValid,
  kgToLb,
  lbToKg,
  parseDecimalInput,
  roundTenth,
  setBodyUnits,
  weightRangeLabels,
} from "../../lib/bodyUnits";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Segment lengths are not on the backend yet; they live on the device until they are. */
const EXTRAS_STORAGE_KEY = "xevo_body_measurements_v1";
export const CM_PER_IN = 2.54;

export type System = "metric" | "imperial";
export type Pair = { left: number | null; right: number | null };
export type Extras = {
  wingspan: number | null;
  shoulder: number | null;
  chest: number | null;
  torso: number | null;
  hip: number | null;
  waist: number | null;
  arm: Pair;
  upperArm: Pair;
  forearm: Pair;
  hand: Pair;
  upperLeg: Pair;
  lowerLeg: Pair;
  armCirc: Pair;
  thighCirc: Pair;
  calfCirc: Pair;
};
export type SingleKey = "wingspan" | "shoulder" | "chest" | "torso" | "hip" | "waist";
export type PairKey = "arm" | "upperArm" | "forearm" | "hand" | "upperLeg" | "lowerLeg" | "armCirc" | "thighCirc" | "calfCirc";
type EditKey = "height" | "weight" | SingleKey | PairKey;

export const EMPTY_PAIR: Pair = { left: null, right: null };
export const EMPTY_EXTRAS: Extras = {
  wingspan: null,
  shoulder: null,
  chest: null,
  torso: null,
  hip: null,
  waist: null,
  arm: EMPTY_PAIR,
  upperArm: EMPTY_PAIR,
  forearm: EMPTY_PAIR,
  hand: EMPTY_PAIR,
  upperLeg: EMPTY_PAIR,
  lowerLeg: EMPTY_PAIR,
  armCirc: EMPTY_PAIR,
  thighCirc: EMPTY_PAIR,
  calfCirc: EMPTY_PAIR,
};

/** Plausible adult ranges in cm, used to catch typos (e.g. inches typed in cm mode). */
export const RANGE_CM: Record<SingleKey | PairKey, { min: number; max: number }> = {
  wingspan: { min: 100, max: 260 },
  shoulder: { min: 25, max: 70 },
  chest: { min: 60, max: 160 },
  torso: { min: 30, max: 100 },
  // Wide on purpose: the design shows 96 cm, which reads like a hip circumference.
  hip: { min: 20, max: 150 },
  arm: { min: 40, max: 95 },
  upperArm: { min: 15, max: 60 },
  forearm: { min: 15, max: 50 },
  hand: { min: 10, max: 30 },
  upperLeg: { min: 25, max: 80 },
  lowerLeg: { min: 25, max: 75 },
  waist: { min: 45, max: 160 },
  armCirc: { min: 18, max: 60 },
  thighCirc: { min: 35, max: 90 },
  calfCirc: { min: 25, max: 60 },
};

const ROWS: { key: EditKey; icon: IconName; pair?: boolean }[] = [
  { key: "height", icon: "resize-outline" },
  { key: "weight", icon: "speedometer-outline" },
  { key: "wingspan", icon: "swap-horizontal-outline" },
  { key: "shoulder", icon: "accessibility-outline" },
  { key: "chest", icon: "ellipse-outline" },
  { key: "torso", icon: "shirt-outline" },
  { key: "hip", icon: "git-compare-outline" },
  { key: "arm", icon: "git-branch-outline", pair: true },
  { key: "upperArm", icon: "barbell-outline", pair: true },
  { key: "forearm", icon: "fitness-outline", pair: true },
  { key: "hand", icon: "hand-left-outline", pair: true },
  { key: "upperLeg", icon: "walk-outline", pair: true },
  { key: "lowerLeg", icon: "footsteps-outline", pair: true },
];

function isPairKey(k: EditKey): k is PairKey {
  return ROWS.find((r) => r.key === k)?.pair === true;
}

/** cm → display number in the chosen system (1 decimal, trailing .0 dropped). */
export function lenOut(cm: number, system: System): string {
  return formatTenth(system === "metric" ? roundTenth(cm) : roundTenth(cm / CM_PER_IN));
}
function lenIn(raw: string, system: System): number | null {
  const n = parseDecimalInput(raw);
  if (n == null) return null;
  return roundTenth(system === "metric" ? n : n * CM_PER_IN);
}

export async function saveExtras(extras: Extras): Promise<void> {
  try {
    await AsyncStorage.setItem(EXTRAS_STORAGE_KEY, JSON.stringify(extras));
  } catch {
    /* best effort until the backend stores these */
  }
}

export async function loadExtras(): Promise<Extras> {
  try {
    const raw = await AsyncStorage.getItem(EXTRAS_STORAGE_KEY);
    if (!raw) return EMPTY_EXTRAS;
    return { ...EMPTY_EXTRAS, ...(JSON.parse(raw) as Partial<Extras>) };
  } catch {
    return EMPTY_EXTRAS;
  }
}

export function BodyMeasurementsSection({
  initialMode = "manual",
  initialHeightCm,
  initialWeightKg,
  onSaveRemote,
  renderFooter,
}: {
  /** Which tab to open on (Athlete Calibration links straight to 3D Scan). */
  initialMode?: "manual" | "scan";
  initialHeightCm: number | null;
  initialWeightKg: number | null;
  /** Saves height / weight to the account; resolves to an error message or null. */
  onSaveRemote: (changes: { heightCm?: number; weightKg?: number }) => Promise<string | null>;
  /** Screen-owned footer (back + primary) so this matches the other Profile Edit sections. */
  renderFooter: (args: { label: string; onPress: () => void; saving: boolean; disabled?: boolean }) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const [mode, setMode] = useState<"manual" | "scan">(initialMode);
  const [system, setSystem] = useState<System>("metric");
  const [heightCm, setHeightCm] = useState<number | null>(initialHeightCm);
  const [weightKg, setWeightKg] = useState<number | null>(initialWeightKg);
  const [extras, setExtras] = useState<Extras>(EMPTY_EXTRAS);
  const [editing, setEditing] = useState<EditKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void getBodyUnits().then((u) => setSystem(u.height === "cm" ? "metric" : "imperial"));
    void loadExtras().then(setExtras);
  }, []);
  useEffect(() => setHeightCm(initialHeightCm), [initialHeightCm]);
  useEffect(() => setWeightKg(initialWeightKg), [initialWeightKg]);

  function changeSystem(next: System) {
    setSystem(next);
    void setBodyUnits(next === "metric" ? { height: "cm", weight: "kg" } : { height: "ftin", weight: "lb" });
  }

  const lenUnit = system === "metric" ? "cm" : "in";

  function displayValue(key: EditKey): string {
    const dash = "—";
    if (key === "height") {
      if (heightCm == null) return dash;
      if (system === "metric") return `${formatTenth(roundTenth(heightCm))} cm`;
      const { ft, inches } = cmToFtIn(heightCm);
      return `${ft}' ${inches}"`;
    }
    if (key === "weight") {
      if (weightKg == null) return dash;
      return system === "metric" ? `${formatTenth(roundTenth(weightKg))} kg` : `${formatTenth(kgToLb(weightKg))} lb`;
    }
    if (isPairKey(key)) {
      const p = extras[key];
      if (p.left == null && p.right == null) return dash;
      const l = p.left == null ? dash : lenOut(p.left, system);
      const r = p.right == null ? dash : lenOut(p.right, system);
      return `${l} / ${r} ${lenUnit}`;
    }
    const v = extras[key];
    return v == null ? dash : `${lenOut(v, system)} ${lenUnit}`;
  }

  const filledCount = useMemo(() => {
    let n = 0;
    if (heightCm != null) n++;
    if (weightKg != null) n++;
    for (const r of ROWS) {
      if (r.key === "height" || r.key === "weight") continue;
      if (isPairKey(r.key)) {
        const p = extras[r.key];
        if (p.left != null && p.right != null) n++;
      } else if (extras[r.key as SingleKey] != null) n++;
    }
    return n;
  }, [heightCm, weightKg, extras]);

  async function saveAll() {
    setError(null);
    setNotice(null);
    if (!isHeightCmValid(heightCm)) {
      setError(t("profileSettingsUi.heightRangeError", heightRangeLabels(system === "metric" ? "cm" : "ftin")));
      return;
    }
    if (!isWeightKgValid(weightKg)) {
      setError(t("profileSettingsUi.weightRangeError", weightRangeLabels(system === "metric" ? "kg" : "lb")));
      return;
    }
    setSaving(true);
    try {
      await AsyncStorage.setItem(EXTRAS_STORAGE_KEY, JSON.stringify(extras));
    } catch {
      /* best effort until the backend stores these */
    }
    const changes: { heightCm?: number; weightKg?: number } = {};
    if (heightCm !== initialHeightCm) changes.heightCm = heightCm;
    if (weightKg !== initialWeightKg) changes.weightKg = weightKg;
    const err = Object.keys(changes).length ? await onSaveRemote(changes) : null;
    setSaving(false);
    if (err) setError(err);
    else setNotice(t("profileHub.bodySaved"));
  }

  const editingRow = editing ? ROWS.find((r) => r.key === editing) : null;

  return (
    <View>
      <Text allowFontScaling={false} style={[st.intro, { fontFamily: theme.regularFont }]}>
        {t(mode === "scan" ? "profileHub.scanIntro" : "profileHub.bodyIntro")}
      </Text>

      <SegmentedPills<"manual" | "scan">
        size="lg"
        options={[
          { key: "manual", label: t("profileHub.manualInput"), testID: "body-mode-manual" },
          { key: "scan", label: t("profileHub.scan3d"), testID: "body-mode-scan" },
        ]}
        value={mode}
        onChange={setMode}
        fontFamily={theme.mediumFont}
        activeFontFamily={theme.semiBoldFont}
        style={st.segment}
      />

      {mode === "scan" ? (
        <BodyScanPanel renderFooter={renderFooter} />
      ) : (
        <>
          <SegmentedPills<System>
            role="radio"
            options={[
              { key: "metric", label: t("profileHub.unitMetric"), testID: "body-units-metric" },
              { key: "imperial", label: t("profileHub.unitImperial"), testID: "body-units-imperial" },
            ]}
            value={system}
            onChange={changeSystem}
            fontFamily={theme.mediumFont}
            activeFontFamily={theme.semiBoldFont}
            style={st.segment}
            accessibilityLabel={t("profileHub.units")}
          />

          <View style={st.progressRow}>
            <Text allowFontScaling={false} style={[st.progressText, { fontFamily: theme.mediumFont }]}>
              {t("profileHub.bodyProgress", { done: filledCount, total: ROWS.length })}
            </Text>
          </View>

          {ROWS.map((row) => (
            <ProfileHubRow
              key={row.key}
              compact
              icon={row.icon}
              title={t(`profileHub.m_${row.key}`)}
              value={displayValue(row.key)}
              onPress={() => setEditing(row.key)}
              testID={`body-row-${row.key}`}
            />
          ))}

          <MockNotice text={t("profileHub.bodyLocalNotice")} />

          {error ? (
            <Text allowFontScaling={false} style={st.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          {notice ? (
            <Text allowFontScaling={false} style={[st.notice, { fontFamily: theme.mediumFont }]}>
              {notice}
            </Text>
          ) : null}
          {renderFooter({ label: t("profileHub.saveMeasurements"), onPress: () => void saveAll(), saving })}
        </>
      )}

      {editingRow ? (
        <EditMeasurementModal
          key={editingRow.key}
          title={t(`profileHub.m_${editingRow.key}`)}
          kind={editingRow.key === "height" ? "height" : editingRow.key === "weight" ? "weight" : editingRow.pair ? "pair" : "single"}
          system={system}
          heightCm={heightCm}
          weightKg={weightKg}
          single={!editingRow.pair && editingRow.key !== "height" && editingRow.key !== "weight" ? extras[editingRow.key as SingleKey] : null}
          pair={editingRow.pair ? extras[editingRow.key as PairKey] : EMPTY_PAIR}
          rangeCm={editingRow.key in RANGE_CM ? RANGE_CM[editingRow.key as SingleKey | PairKey] : null}
          onClose={() => setEditing(null)}
          onDone={(result) => {
            const k = editingRow.key;
            if (k === "height") setHeightCm(result.single);
            else if (k === "weight") setWeightKg(result.single);
            else if (editingRow.pair) setExtras((e) => ({ ...e, [k]: result.pair }));
            else setExtras((e) => ({ ...e, [k]: result.single }));
            setNotice(null);
            setEditing(null);
          }}
        />
      ) : null}
    </View>
  );
}

/** Hologram guide per view. Side / back art is not drawn yet, so they reuse the front figure. */
const SCAN_ART: Record<ScanView, number> = {
  front: require("../../../assets/bodyscan/front.jpg"),
  side: require("../../../assets/bodyscan/front.jpg"),
  back: require("../../../assets/bodyscan/front.jpg"),
};
const SCAN_ART_ASPECT = 640 / 1030;
type ScanView = "front" | "side" | "back";

const SCAN_TIPS: { key: string; icon: IconName }[] = [
  { key: "Light", icon: "scan-outline" },
  { key: "Clothing", icon: "flash-outline" },
  { key: "Guide", icon: "bulb-outline" },
  { key: "Phone", icon: "phone-portrait-outline" },
];

function BodyScanPanel({
  renderFooter,
}: {
  renderFooter: (args: { label: string; onPress: () => void; saving: boolean; disabled?: boolean }) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const [view, setView] = useState<ScanView>("front");
  const [notice, setNotice] = useState(false);
  return (
    <View>
      <SegmentedPills<ScanView>
        options={[
          { key: "front", label: t("profileHub.scanFront"), testID: "scan-view-front" },
          { key: "side", label: t("profileHub.scanSide"), testID: "scan-view-side" },
          { key: "back", label: t("profileHub.scanBack"), testID: "scan-view-back" },
        ]}
        value={view}
        onChange={setView}
        fontFamily={theme.mediumFont}
        activeFontFamily={theme.semiBoldFont}
        style={st.segment}
      />

      <View style={[st.artCard, glow(18, 0.5)]} testID="scan-art">
        <Image source={SCAN_ART[view]} style={st.artImage} resizeMode="cover" />
        {view !== "front" ? (
          <View style={st.artBadge}>
            <Text allowFontScaling={false} style={[st.artBadgeText, { fontFamily: theme.mediumFont }]}>
              {t("profileHub.scanArtPending")}
            </Text>
          </View>
        ) : null}
        {(["tl", "tr", "bl", "br"] as const).map((c) => (
          <View key={c} pointerEvents="none" style={[st.corner, st[`corner_${c}`]]} />
        ))}
      </View>

      <LinearGradient
        colors={[PG.cardTop, PG.cardBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[st.tipsCard, glow(10, 0.3)]}
      >
        {SCAN_TIPS.map((tip) => (
          <View key={tip.key} style={st.tipRow}>
            <Ionicons name={tip.icon} size={24} color="#2F7BFF" />
            <Text allowFontScaling={false} style={[st.tipText, { fontFamily: theme.regularFont }]}>
              {t(`profileHub.scanTip${tip.key}`)}
            </Text>
          </View>
        ))}
      </LinearGradient>

      {notice ? (
        <Text allowFontScaling={false} style={[st.notice, { fontFamily: theme.mediumFont }]}>
          {t("profileHub.scanSoonNotice")}
        </Text>
      ) : null}
      {renderFooter({ label: t("profileHub.startScan"), onPress: () => setNotice(true), saving: false })}
    </View>
  );
}

export function EditMeasurementModal({
  title,
  kind,
  system,
  heightCm,
  weightKg,
  single,
  pair,
  rangeCm,
  onClose,
  onDone,
}: {
  title: string;
  kind: "height" | "weight" | "single" | "pair";
  system: System;
  heightCm: number | null;
  weightKg: number | null;
  single: number | null;
  pair: Pair;
  rangeCm: { min: number; max: number } | null;
  onClose: () => void;
  onDone: (r: { single: number | null; pair: Pair }) => void;
}) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const metric = system === "metric";
  const lenUnit = metric ? "cm" : "in";
  const ftIn = heightCm != null ? cmToFtIn(heightCm) : null;

  const [a, setA] = useState(() => {
    if (kind === "height") return heightCm == null ? "" : metric ? formatTenth(roundTenth(heightCm)) : String(ftIn!.ft);
    if (kind === "weight") return weightKg == null ? "" : formatTenth(metric ? roundTenth(weightKg) : kgToLb(weightKg));
    if (kind === "pair") return pair.left == null ? "" : lenOut(pair.left, system);
    return single == null ? "" : lenOut(single, system);
  });
  const [b, setB] = useState(() => {
    if (kind === "height") return !metric && ftIn ? String(ftIn.inches) : "";
    if (kind === "pair") return pair.right == null ? "" : lenOut(pair.right, system);
    return "";
  });
  /** Right side mirrors left until the player edits it (most people are symmetric). */
  const rightTouched = useRef(kind === "pair" && pair.right != null && pair.right !== pair.left);
  const [err, setErr] = useState<string | null>(null);

  function rangeText(): string {
    if (!rangeCm) return "";
    return metric
      ? `${rangeCm.min}–${rangeCm.max} cm`
      : `${formatTenth(roundTenth(rangeCm.min / CM_PER_IN))}–${formatTenth(roundTenth(rangeCm.max / CM_PER_IN))} in`;
  }
  function inRange(cm: number | null) {
    return cm == null || !rangeCm || (cm >= rangeCm.min && cm <= rangeCm.max);
  }

  function done() {
    setErr(null);
    if (kind === "height") {
      const cm = metric
        ? parseDecimalInput(a)
        : a.trim() === ""
          ? null
          : ftInToCm(Number(a) || 0, Number(b) || 0);
      if (!isHeightCmValid(cm)) {
        setErr(t("profileSettingsUi.heightRangeError", heightRangeLabels(metric ? "cm" : "ftin")));
        return;
      }
      onDone({ single: roundTenth(cm), pair: EMPTY_PAIR });
      return;
    }
    if (kind === "weight") {
      const n = parseDecimalInput(a);
      const kg = n == null ? null : metric ? roundTenth(n) : lbToKg(n);
      if (!isWeightKgValid(kg)) {
        setErr(t("profileSettingsUi.weightRangeError", weightRangeLabels(metric ? "kg" : "lb")));
        return;
      }
      onDone({ single: kg, pair: EMPTY_PAIR });
      return;
    }
    const left = lenIn(a, system);
    const right = kind === "pair" ? lenIn(b, system) : null;
    if (!inRange(left) || !inRange(right)) {
      setErr(t("profileHub.rangeError", { range: rangeText() }));
      return;
    }
    onDone({ single: left, pair: { left, right } });
  }

  const fields: { label?: string; value: string; onChange: (v: string) => void; suffix: string; testID: string }[] =
    kind === "height"
      ? metric
        ? [{ value: a, onChange: setA, suffix: "cm", testID: "body-edit-a" }]
        : [
            { value: a, onChange: setA, suffix: "ft", testID: "body-edit-a" },
            { value: b, onChange: setB, suffix: "in", testID: "body-edit-b" },
          ]
      : kind === "weight"
        ? [{ value: a, onChange: setA, suffix: metric ? "kg" : "lb", testID: "body-edit-a" }]
        : kind === "pair"
          ? [
              {
                label: t("profileHub.left"),
                value: a,
                onChange: (v) => {
                  setA(v);
                  if (!rightTouched.current) setB(v);
                },
                suffix: lenUnit,
                testID: "body-edit-a",
              },
              {
                label: t("profileHub.right"),
                value: b,
                onChange: (v) => {
                  rightTouched.current = true;
                  setB(v);
                },
                suffix: lenUnit,
                testID: "body-edit-b",
              },
            ]
          : [{ value: a, onChange: setA, suffix: lenUnit, testID: "body-edit-a" }];

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={st.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("profileSettingsUi.close")} />
        <LinearGradient
          colors={[PG.cardTop, PG.cardBottom]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[st.modalCard, glow(18, 0.55)]}
        >
          <View style={st.modalHead}>
            <Text allowFontScaling={false} style={[st.modalTitle, { fontFamily: theme.semiBoldFont }]}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("profileSettingsUi.close")}>
              <Ionicons name="close" size={22} color="#86A7D2" />
            </TouchableOpacity>
          </View>
          {rangeCm ? (
            <Text allowFontScaling={false} style={[st.modalHint, { fontFamily: theme.regularFont }]}>
              {t("profileHub.typicalRange", { range: rangeText() })}
            </Text>
          ) : null}
          <View style={st.fieldRow}>
            {fields.map((f, i) => (
              <View key={f.testID} style={{ flex: 1, gap: 6 }}>
                {f.label ? (
                  <Text allowFontScaling={false} style={[st.fieldLabel, { fontFamily: theme.mediumFont }]}>
                    {f.label}
                  </Text>
                ) : null}
                <View style={st.fieldBox}>
                  <TextInput
                    value={f.value}
                    onChangeText={(v) => f.onChange(v.replace(/[^0-9.,]/g, "").slice(0, 5))}
                    keyboardType="decimal-pad"
                    autoFocus={i === 0}
                    selectTextOnFocus
                    placeholder="0"
                    placeholderTextColor="rgba(134, 167, 210, 0.45)"
                    style={[st.fieldInput, { fontFamily: theme.semiBoldFont }]}
                    testID={f.testID}
                    onSubmitEditing={done}
                  />
                  <Text allowFontScaling={false} style={[st.fieldSuffix, { fontFamily: theme.mediumFont }]}>
                    {f.suffix}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          {err ? (
            <Text allowFontScaling={false} style={st.error} accessibilityRole="alert">
              {err}
            </Text>
          ) : null}
          <GlowButton label={t("profileHub.done")} onPress={done} testID="body-edit-done" />
        </LinearGradient>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  intro: { fontSize: 14, lineHeight: 20, color: "#86A7D2", marginBottom: 16 },
  segment: { marginBottom: 12 },
  progressRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 },
  progressText: { fontSize: 12, color: PG.labelBlue },
  error: { color: "#FF6B5E", fontSize: 13, marginTop: 8, textAlign: "center" },
  notice: { color: PG.labelBlue, fontSize: 13, marginTop: 8, textAlign: "center" },
  artCard: {
    width: "100%",
    aspectRatio: SCAN_ART_ASPECT,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(77, 166, 255, 0.85)",
    overflow: "hidden",
    backgroundColor: PG.cardBottom,
  },
  artImage: { width: "100%", height: "100%" },
  artBadge: {
    position: "absolute",
    top: 14,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(2, 11, 34, 0.8)",
    borderWidth: 1,
    borderColor: PG.borderSoft,
  },
  artBadgeText: { fontSize: 12, color: "#86A7D2" },
  corner: { position: "absolute", width: 26, height: 26, borderColor: PG.accent },
  corner_tl: { top: 14, left: 14, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 10 },
  corner_tr: { top: 14, right: 14, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 10 },
  corner_bl: { bottom: 14, left: 14, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 10 },
  corner_br: { bottom: 14, right: 14, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 10 },
  tipsCard: {
    marginTop: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: PG.border,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 10 },
  tipText: { flex: 1, fontSize: 15, color: "#FFFFFF" },
  overlay: { flex: 1, backgroundColor: "rgba(1, 7, 25, 0.78)", justifyContent: "center", paddingHorizontal: 18 },
  modalCard: { borderRadius: 24, borderWidth: 1, borderColor: PG.border, padding: 18, gap: 14 },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 18, color: "#FFFFFF" },
  modalHint: { fontSize: 13, color: "#86A7D2", marginTop: -6 },
  fieldRow: { flexDirection: "row", gap: 12 },
  fieldLabel: { fontSize: 13, color: "#86A7D2" },
  fieldBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(143, 184, 255, 0.6)",
    backgroundColor: "#041641",
    paddingHorizontal: 14,
  },
  // outlineStyle: hide the browser focus ring on web; the box border already shows focus.
  fieldInput: { flex: 1, minWidth: 0, fontSize: 22, color: "#FFFFFF", paddingVertical: 0, outlineStyle: "none" } as object,
  fieldSuffix: { fontSize: 15, color: "#86A7D2", marginLeft: 6 },
});
