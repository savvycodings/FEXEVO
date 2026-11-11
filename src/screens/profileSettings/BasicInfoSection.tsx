import React, { useContext, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../../context";
import { GlowButton } from "../../components/ui";
import { PG, glow } from "../progress/progressTheme";
import { ProfileHubRow } from "./ProfileHubParts";
import { EditMeasurementModal, type System } from "./BodyMeasurementsSection";
import { GENDER_OPTION_VALUES, genderTranslationKey } from "../../i18n/profileOptionValues";
import { cmToFtIn, formatTenth, getBodyUnits, isHeightCmValid, isWeightKgValid, kgToLb, roundTenth } from "../../lib/bodyUnits";

type Hand = "left" | "right";
type Values = {
  heightCm: number | null;
  weightKg: number | null;
  /** ISO YYYY-MM-DD */
  birthDate: string | null;
  gender: string | null;
  dominantHand: Hand | null;
};
type Editing = "height" | "weight" | "age" | "gender" | "hand" | null;

export type BasicInfoChanges = {
  /** For /profile/player-details */
  details: { heightCm?: number; weightKg?: number; dominantHand?: Hand };
  /** For /profile/basic (caller adds name + username so they are not wiped). */
  basic: { gender?: string; birthDate?: string | null } | null;
};

export function ageFromIso(iso: string | null, now = new Date()): number | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--;
  return age;
}

/** Stored gender can be lowercase (onboarding) or capitalized (Profile Edit); match either. */
function asGender(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  return GENDER_OPTION_VALUES.find((g) => g.toLowerCase() === s.toLowerCase()) ?? s;
}

function asHand(v: unknown): Hand | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return s === "left" || s === "right" ? s : null;
}

export function BasicInfoSection({
  initial,
  onSave,
  renderFooter,
}: {
  initial: {
    heightCm?: number | null;
    weightKg?: number | null;
    birthDate?: string | null;
    gender?: string | null;
    dominantHand?: string | null;
  };
  /** Persists the changes; resolves to an error message or null, then the caller moves on. */
  onSave: (changes: BasicInfoChanges) => Promise<string | null>;
  renderFooter: (args: { label: string; onPress: () => void; saving: boolean }) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const start: Values = {
    heightCm: initial.heightCm ?? null,
    weightKg: initial.weightKg ?? null,
    birthDate: initial.birthDate ?? null,
    gender: asGender(initial.gender),
    dominantHand: asHand(initial.dominantHand),
  };
  const [v, setV] = useState<Values>(start);
  const [system, setSystem] = useState<System>("metric");
  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getBodyUnits().then((u) => setSystem(u.height === "cm" ? "metric" : "imperial"));
  }, []);

  const dash = "—";
  const heightText =
    v.heightCm == null
      ? dash
      : system === "metric"
        ? `${formatTenth(roundTenth(v.heightCm))} cm`
        : (() => {
            const { ft, inches } = cmToFtIn(v.heightCm!);
            return `${ft}' ${inches}"`;
          })();
  const weightText =
    v.weightKg == null
      ? dash
      : system === "metric"
        ? `${formatTenth(roundTenth(v.weightKg))} kg`
        : `${formatTenth(kgToLb(v.weightKg))} lb`;
  const age = ageFromIso(v.birthDate);

  async function next() {
    setError(null);
    if (!isHeightCmValid(v.heightCm) || !isWeightKgValid(v.weightKg)) {
      setError(t("profileHub.basicNeedHeightWeight"));
      return;
    }
    if (!v.dominantHand) {
      setError(t("profileSettingsUi.chooseHand"));
      return;
    }
    const details: BasicInfoChanges["details"] = {};
    if (v.heightCm !== start.heightCm) details.heightCm = v.heightCm;
    if (v.weightKg !== start.weightKg) details.weightKg = v.weightKg;
    if (v.dominantHand !== start.dominantHand) details.dominantHand = v.dominantHand;
    const basicChanged = v.gender !== start.gender || v.birthDate !== start.birthDate;
    const basic = basicChanged ? { gender: v.gender ?? "", birthDate: v.birthDate } : null;
    setSaving(true);
    const err = await onSave({ details, basic });
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <View>
      <ProfileHubRow compact icon="resize-outline" title={t("profileHub.m_height")} value={heightText} onPress={() => setEditing("height")} testID="basic-row-height" />
      <ProfileHubRow compact icon="speedometer-outline" title={t("profileHub.m_weight")} value={weightText} onPress={() => setEditing("weight")} testID="basic-row-weight" />
      <ProfileHubRow
        compact
        icon="people-outline"
        title={t("profileHub.age")}
        value={age == null ? dash : String(age)}
        onPress={() => setEditing("age")}
        testID="basic-row-age"
      />
      <ProfileHubRow
        compact
        icon="male-female-outline"
        title={t("profileSettingsUi.gender")}
        value={v.gender ? t(genderTranslationKey(v.gender)) : dash}
        onPress={() => setEditing("gender")}
        testID="basic-row-gender"
      />
      <ProfileHubRow
        compact
        icon="hand-right-outline"
        title={t("profileHub.dominantHand")}
        value={v.dominantHand ? t(v.dominantHand === "left" ? "profileHub.handLeft" : "profileHub.handRight") : dash}
        onPress={() => setEditing("hand")}
        testID="basic-row-hand"
      />

      {error ? (
        <Text allowFontScaling={false} style={st.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <View style={{ marginTop: 8 }}>{renderFooter({ label: t("profileHub.next"), onPress: () => void next(), saving })}</View>

      {editing === "height" || editing === "weight" ? (
        <EditMeasurementModal
          title={t(`profileHub.m_${editing}`)}
          kind={editing}
          system={system}
          heightCm={v.heightCm}
          weightKg={v.weightKg}
          single={null}
          pair={{ left: null, right: null }}
          rangeCm={null}
          onClose={() => setEditing(null)}
          onDone={(r) => {
            setV((p) => (editing === "height" ? { ...p, heightCm: r.single } : { ...p, weightKg: r.single }));
            setEditing(null);
          }}
        />
      ) : null}
      {editing === "age" ? (
        <BirthDateModal
          value={v.birthDate}
          onClose={() => setEditing(null)}
          onDone={(iso) => {
            setV((p) => ({ ...p, birthDate: iso }));
            setEditing(null);
          }}
        />
      ) : null}
      {editing === "gender" ? (
        <OptionModal
          title={t("profileSettingsUi.gender")}
          options={GENDER_OPTION_VALUES.map((g) => ({ value: g as string, label: t(genderTranslationKey(g)) }))}
          value={v.gender}
          onClose={() => setEditing(null)}
          onPick={(g) => {
            setV((p) => ({ ...p, gender: g }));
            setEditing(null);
          }}
        />
      ) : null}
      {editing === "hand" ? (
        <OptionModal
          title={t("profileHub.dominantHand")}
          options={[
            { value: "left", label: t("profileHub.handLeft") },
            { value: "right", label: t("profileHub.handRight") },
          ]}
          value={v.dominantHand}
          onClose={() => setEditing(null)}
          onPick={(h) => {
            setV((p) => ({ ...p, dominantHand: h as Hand }));
            setEditing(null);
          }}
        />
      ) : null}
    </View>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={st.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("profileSettingsUi.close")} />
        <LinearGradient colors={[PG.cardTop, PG.cardBottom]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[st.modalCard, glow(18, 0.55)]}>
          <View style={st.modalHead}>
            <Text allowFontScaling={false} style={[st.modalTitle, { fontFamily: theme.semiBoldFont }]}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("profileSettingsUi.close")}>
              <Ionicons name="close" size={22} color="#86A7D2" />
            </TouchableOpacity>
          </View>
          {children}
        </LinearGradient>
      </View>
    </Modal>
  );
}

function OptionModal({
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  title: string;
  options: { value: string; label: string }[];
  value: string | null;
  onPick: (v: string) => void;
  onClose: () => void;
}) {
  const { theme } = useContext(ThemeContext);
  return (
    <ModalShell title={title} onClose={onClose}>
      <View style={{ gap: 8 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <TouchableOpacity
              key={o.value}
              onPress={() => onPick(o.value)}
              activeOpacity={0.85}
              style={[st.option, on && st.optionOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              testID={`basic-option-${o.value}`}
            >
              <Text allowFontScaling={false} style={[st.optionText, on && st.optionTextOn, { fontFamily: on ? theme.semiBoldFont : theme.mediumFont }]}>
                {o.label}
              </Text>
              {on ? <Ionicons name="checkmark" size={20} color={PG.pillText} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </ModalShell>
  );
}

function BirthDateModal({ value, onDone, onClose }: { value: string | null; onDone: (iso: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  const [d, setD] = useState(m ? m[3] : "");
  const [mo, setMo] = useState(m ? m[2] : "");
  const [y, setY] = useState(m ? m[1] : "");
  const [err, setErr] = useState<string | null>(null);

  function done() {
    const dd = Number(d);
    const mm = Number(mo);
    const yy = Number(y);
    const date = new Date(Date.UTC(yy, mm - 1, dd));
    const valid =
      y.length === 4 &&
      date.getUTCFullYear() === yy &&
      date.getUTCMonth() === mm - 1 &&
      date.getUTCDate() === dd;
    const iso = `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const age = ageFromIso(iso);
    if (!valid || age == null || age < 5 || age > 100) {
      setErr(t("profileSettings.birthdateInvalid"));
      return;
    }
    onDone(iso);
  }

  const fields = [
    { label: t("profileSettingsUi.day"), value: d, set: setD, max: 2, ph: "DD", flex: 1, id: "basic-birth-day" },
    { label: t("profileSettingsUi.month"), value: mo, set: setMo, max: 2, ph: "MM", flex: 1, id: "basic-birth-month" },
    { label: t("profileSettingsUi.year"), value: y, set: setY, max: 4, ph: "YYYY", flex: 1.4, id: "basic-birth-year" },
  ];
  return (
    <ModalShell title={t("profileSettingsUi.dateOfBirth")} onClose={onClose}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {fields.map((f, i) => (
          <View key={f.id} style={{ flex: f.flex, gap: 6 }}>
            <Text allowFontScaling={false} style={[st.fieldLabel, { fontFamily: theme.mediumFont }]}>
              {f.label}
            </Text>
            <TextInput
              value={f.value}
              onChangeText={(x) => f.set(x.replace(/[^0-9]/g, "").slice(0, f.max))}
              keyboardType="number-pad"
              placeholder={f.ph}
              placeholderTextColor="rgba(134, 167, 210, 0.45)"
              autoFocus={i === 0}
              style={[st.fieldInput, { fontFamily: theme.semiBoldFont }]}
              testID={f.id}
              onSubmitEditing={done}
            />
          </View>
        ))}
      </View>
      {err ? (
        <Text allowFontScaling={false} style={st.error} accessibilityRole="alert">
          {err}
        </Text>
      ) : null}
      <GlowButton label={t("profileHub.done")} onPress={done} testID="basic-birth-done" />
    </ModalShell>
  );
}

const st = StyleSheet.create({
  error: { color: "#FF6B5E", fontSize: 13, marginTop: 8, textAlign: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(1, 7, 25, 0.78)", justifyContent: "center", paddingHorizontal: 18 },
  modalCard: { borderRadius: 24, borderWidth: 1, borderColor: PG.border, padding: 18, gap: 14 },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 18, color: "#FFFFFF" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PG.border,
    backgroundColor: PG.cardTop,
  },
  optionOn: { backgroundColor: PG.pillBottom, borderColor: "transparent" },
  optionText: { fontSize: 15, color: PG.pillIdleText },
  optionTextOn: { color: PG.pillText },
  fieldLabel: { fontSize: 13, color: "#86A7D2" },
  fieldInput: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(143, 184, 255, 0.6)",
    backgroundColor: "#041641",
    paddingHorizontal: 14,
    fontSize: 20,
    color: "#FFFFFF",
    outlineStyle: "none",
  } as object,
});
