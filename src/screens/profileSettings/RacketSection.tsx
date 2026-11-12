import React, { useContext, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import Svg, { Circle, ClipPath, Defs, G, LinearGradient as SvgLinear, Path, Rect, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../../context";
import { GlowButton } from "../../components/ui";
import { authClient } from "../../lib/auth-client";
import { PG, glow } from "../progress/progressTheme";
import { ProfileHubRow } from "./ProfileHubParts";
import { ModalShell, OptionModal, modalSt } from "./BasicInfoSection";
import { formatTenth, parseDecimalInput } from "../../lib/bodyUnits";

/** Mirrors the backend's src/profile/racket.ts. */
export type Racket = {
  brand?: string | null;
  model?: string | null;
  weightG?: number | null;
  balanceCm?: number | null;
  lengthMm?: number | null;
  grip?: string | null;
  swingweight?: number | null;
  surface?: string | null;
};

/**
 * Brands and model lines for the pickers. Names only: specs differ per year and edition, so the
 * player types them. Anything missing can be typed into search and used as-is.
 */
const CATALOG: Record<string, string[]> = {
  Adidas: ["Metalbone 3.4 2025", "Metalbone HRD+", "Metalbone CTRL", "Adipower Multiweight", "Adipower CTRL", "Cross It"],
  Babolat: ["Technical Viper", "Air Viper", "Counter Viper", "Technical Veron", "Air Veron", "Counter Veron"],
  Bullpadel: ["Vertex 04", "Vertex 04 Comfort", "Hack 03", "Neuron", "Ionic Power", "Ionic Control"],
  "Drop Shot": ["Conqueror", "Explorer", "Canyon"],
  Dunlop: ["FX Pro", "FX Hybrid", "Aero-Star", "Galactica Pro", "Galactica Lite", "Tristorm Pro", "FX Lite", "Aero-Star Pro"],
  Head: ["Delta Pro", "Speed Pro", "Speed Motion", "Extreme Pro", "Extreme Motion", "Gravity Pro", "Radical Pro"],
  Nox: ["AT10 Genius", "AT10 Genius Attack", "ML10 Pro Cup", "TL10 Quantum", "X-One"],
  Siux: ["Electra", "Diablo", "Fenix", "Pegasus"],
  StarVie: ["Triton", "Metheora", "Raptor", "Aquila"],
  Varlion: ["LW Carbon", "Bourne Summum", "Cañón"],
  Wilson: ["Bela Pro", "Bela LT", "Blade Elite", "Blade Pro", "Defy", "Optix"],
};
const BRANDS = Object.keys(CATALOG).sort((a, b) => a.localeCompare(b));

const GRIPS = ["L0", "L1", "L2", "L3", "L4"] as const;
const GRIP_INCHES: Record<string, string> = { L0: '4"', L1: '4 1/8"', L2: '4 1/4"', L3: '4 3/8"', L4: '4 1/2"' };
const SURFACES = ["Fiberglass", "Carbon 3K", "Carbon 12K", "Carbon 18K", "Carbon 24K", "Hybrid"];

type NumKey = "weightG" | "balanceCm" | "lengthMm" | "swingweight";
const NUM: Record<NumKey, { min: number; max: number; unit: string; decimals: boolean; ph: string }> = {
  weightG: { min: 300, max: 420, unit: "g", decimals: false, ph: "360" },
  balanceCm: { min: 22, max: 30, unit: "cm", decimals: true, ph: "26.5" },
  lengthMm: { min: 420, max: 480, unit: "mm", decimals: false, ph: "455" },
  swingweight: { min: 200, max: 450, unit: "kg·cm²", decimals: false, ph: "325" },
};

/** Measured from the butt cap: padel rackets sit around 25.5–26.5 cm. */
function balanceKind(cm: number): "heavy" | "even" | "light" {
  if (cm >= 26.5) return "heavy";
  if (cm >= 25.5) return "even";
  return "light";
}

type Editing = "brand" | "model" | "grip" | "surface" | NumKey | null;

export async function saveRacket(r: Racket): Promise<string | null> {
  const body: Record<string, unknown> = {};
  for (const k of ["brand", "model", "weightG", "balanceCm", "lengthMm", "grip", "swingweight", "surface"] as const) {
    body[k] = r[k] ?? null;
  }
  const res = await authClient
    .$fetch<{ ok?: boolean; error?: string }>("/profile/racket", { method: "POST", body: body as any })
    .catch((e) => ({ error: e?.message } as any));
  const data = ((res as any)?.data ?? res) as { ok?: boolean; error?: unknown };
  if (data?.ok) return null;
  const err = (res as any)?.error ?? data?.error;
  return (typeof err === "string" ? err : typeof err?.message === "string" ? err.message : null) || "Could not save racket.";
}

export function RacketSection({
  initial,
  onSaved,
}: {
  initial: Racket | null | undefined;
  /** Refreshes the profile after a successful save. */
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const [r, setR] = useState<Racket>(initial ?? {});
  const [editing, setEditing] = useState<Editing>(null);
  /** "Change Racket" walks brand → model in one go. */
  const [changing, setChanging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);

  const set = (patch: Racket) => {
    setR((prev) => ({ ...prev, ...patch }));
    setNotice(false);
  };
  const dash = "—";
  const numText = (k: NumKey) => {
    const v = r[k];
    if (v == null) return dash;
    return `${NUM[k].decimals ? formatTenth(v) : v} ${NUM[k].unit}`;
  };
  const balanceKindText = r.balanceCm == null ? undefined : t(`profileHub.balance_${balanceKind(r.balanceCm)}`);
  const gripText = r.grip ? (GRIP_INCHES[r.grip] ? `${r.grip} (${GRIP_INCHES[r.grip]})` : r.grip) : dash;

  async function save() {
    setError(null);
    setSaving(true);
    const err = await saveRacket(r);
    setSaving(false);
    if (err) setError(err);
    else {
      setNotice(true);
      onSaved();
    }
  }

  const rows: { key: Exclude<Editing, null>; title: string; value: string; subtitle?: string }[] = [
    { key: "brand", title: t("profileHub.racketBrand"), value: r.brand || dash },
    { key: "model", title: t("profileHub.racketModel"), value: r.model || dash },
    { key: "weightG", title: t("profileHub.racketWeight"), value: numText("weightG") },
    { key: "balanceCm", title: t("profileHub.racketBalancePoint"), value: numText("balanceCm"), subtitle: balanceKindText },
    { key: "lengthMm", title: t("profileHub.racketLength"), value: numText("lengthMm") },
    { key: "grip", title: t("profileHub.racketGrip"), value: gripText },
    { key: "swingweight", title: t("profileHub.racketSwingweight"), value: numText("swingweight") },
    { key: "surface", title: t("profileHub.racketSurface"), value: r.surface || dash },
  ];

  return (
    <View>
      <LinearGradient
        colors={["#0E2A8C", "#0A1652"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[st.hero, glow(16, 0.5)]}
      >
        <RacketArt />
        <View style={st.heroInfo}>
          <Text allowFontScaling={false} style={[st.heroName, { fontFamily: theme.regularFont }]} numberOfLines={3}>
            {r.brand || r.model ? [r.brand, r.model].filter(Boolean).join(" ") : t("profileHub.racketNone")}
          </Text>
          <GlowButton
            label={r.brand ? t("profileHub.racketChange") : t("profileHub.racketPick")}
            onPress={() => {
              setChanging(true);
              setEditing("brand");
            }}
            height={48}
            paddingX={10}
            testID="racket-change"
          />
        </View>
      </LinearGradient>

      <View style={{ marginTop: 18 }}>
        {rows.map((row) => (
          <ProfileHubRow
            key={row.key}
            compact
            icon="add-circle-outline"
            title={row.title}
            subtitle={row.subtitle}
            value={row.value}
            onPress={() => setEditing(row.key)}
            testID={`racket-row-${row.key}`}
          />
        ))}
      </View>

      {error ? (
        <Text allowFontScaling={false} style={modalSt.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {notice ? (
        <Text allowFontScaling={false} style={[st.saved, { fontFamily: theme.mediumFont }]} testID="racket-saved">
          {t("profileHub.racketSaved")}
        </Text>
      ) : null}
      <GlowButton
        label={saving ? "Saving..." : t("profileHub.saveRacketInfo")}
        onPress={() => void save()}
        disabled={saving}
        style={{ marginTop: 14 }}
        testID="racket-save"
      />

      {editing === "brand" ? (
        <SearchPicker
          title={t("profileHub.selectBrand")}
          placeholder={t("profileHub.searchBrand")}
          items={BRANDS}
          value={r.brand ?? null}
          withLogos
          withIndex
          testIDPrefix="racket-brand"
          onClose={() => {
            setChanging(false);
            setEditing(null);
          }}
          onPick={(brand) => {
            // A different brand makes the old model meaningless.
            set(brand === r.brand ? { brand } : { brand, model: null });
            setEditing(changing ? "model" : null);
            setChanging(false);
          }}
        />
      ) : editing === "model" ? (
        <SearchPicker
          title={t("profileHub.selectModel")}
          placeholder={t("profileHub.searchModel")}
          items={(r.brand && CATALOG[r.brand]) || []}
          prefix={r.brand && CATALOG[r.brand] ? `${r.brand} ` : ""}
          value={r.model ?? null}
          testIDPrefix="racket-model"
          onClose={() => setEditing(null)}
          onPick={(model) => {
            set({ model });
            setEditing(null);
          }}
        />
      ) : editing === "grip" ? (
        <OptionModal
          title={t("profileHub.racketGrip")}
          options={GRIPS.map((g) => ({ value: g, label: `${g} (${GRIP_INCHES[g]})` }))}
          value={r.grip ?? null}
          testIDPrefix="racket-grip"
          onClose={() => setEditing(null)}
          onPick={(grip) => {
            set({ grip });
            setEditing(null);
          }}
        />
      ) : editing === "surface" ? (
        <OptionModal
          title={t("profileHub.racketSurface")}
          options={SURFACES.map((s) => ({ value: s, label: s }))}
          value={r.surface ?? null}
          testIDPrefix="racket-surface"
          onClose={() => setEditing(null)}
          onPick={(surface) => {
            set({ surface });
            setEditing(null);
          }}
        />
      ) : editing ? (
        <NumberModal
          key={editing}
          title={rows.find((x) => x.key === editing)!.title}
          spec={NUM[editing]}
          value={r[editing] ?? null}
          onClose={() => setEditing(null)}
          onDone={(v) => {
            set({ [editing]: v } as Racket);
            setEditing(null);
          }}
        />
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Search picker used for brand (logos + A–Z rail) and model.
 * ---------------------------------------------------------------------------------------------- */

const ROW_H = 64;

function SearchPicker({
  title,
  placeholder,
  items,
  value,
  prefix = "",
  withLogos,
  withIndex,
  testIDPrefix,
  onPick,
  onClose,
}: {
  title: string;
  placeholder: string;
  items: string[];
  value: string | null;
  /** Shown before each item (models read "Dunlop FX Pro" like the design) but not stored. */
  prefix?: string;
  withLogos?: boolean;
  withIndex?: boolean;
  testIDPrefix: string;
  onPick: (v: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const [q, setQ] = useState("");
  const list = useRef<ScrollView>(null);
  const query = q.trim().toLowerCase();
  const shown = useMemo(
    () => (query ? items.filter((i) => `${prefix}${i}`.toLowerCase().includes(query)) : items),
    [items, query, prefix]
  );
  // Typed text that isn't in the catalog can still be used (new or niche rackets).
  const custom = q.trim() && !items.some((i) => i.toLowerCase() === query) ? q.trim().replace(/\s+/g, " ") : null;
  const letters = useMemo(() => new Set(shown.map((i) => i[0].toUpperCase())), [shown]);

  function jump(letter: string) {
    const idx = shown.findIndex((i) => i[0].toUpperCase() === letter);
    if (idx >= 0) list.current?.scrollTo({ y: idx * ROW_H, animated: true });
  }

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={modalSt.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("profileSettingsUi.close")} />
        <LinearGradient
          colors={[PG.cardTop, PG.cardBottom]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[modalSt.modalCard, st.pickerCard, glow(18, 0.55)]}
        >
          <View style={modalSt.modalHead}>
            <Text allowFontScaling={false} style={[modalSt.modalTitle, { fontFamily: theme.semiBoldFont }]}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("profileSettingsUi.close")}>
              <Ionicons name="close" size={24} color="#4D7BFF" />
            </TouchableOpacity>
          </View>
          <View style={[st.search, glow(10, 0.45)]}>
            <Ionicons name="search-outline" size={24} color="#3FA9FF" />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={placeholder}
              placeholderTextColor="rgba(134, 167, 210, 0.6)"
              style={[st.searchInput, { fontFamily: theme.regularFont }]}
              autoCorrect={false}
              testID={`${testIDPrefix}-search`}
            />
          </View>
          <View style={{ flexDirection: "row", flexShrink: 1 }}>
            <ScrollView ref={list} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {shown.map((item) => {
                const on = item === value;
                return (
                  <TouchableOpacity
                    key={item}
                    activeOpacity={0.85}
                    onPress={() => onPick(item)}
                    style={[st.pickRow, on && [st.pickRowOn, glow(12, 0.7)]]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    testID={`${testIDPrefix}-${item}`}
                  >
                    {withLogos ? <BrandMark name={item} /> : null}
                    <Text allowFontScaling={false} style={[st.pickText, { fontFamily: theme.regularFont }]} numberOfLines={1}>
                      {prefix}
                      {item}
                    </Text>
                    {on ? (
                      <View style={st.check}>
                        <Ionicons name="checkmark" size={18} color="#0A1652" />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
              {custom ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => onPick(custom)}
                  style={st.pickRow}
                  testID={`${testIDPrefix}-custom`}
                >
                  <View style={st.customIcon}>
                    <Ionicons name="add" size={20} color="#8FB8FF" />
                  </View>
                  <Text allowFontScaling={false} style={[st.pickText, { fontFamily: theme.regularFont }]} numberOfLines={1}>
                    {t("profileHub.useCustom", { value: custom })}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {!shown.length && !custom ? (
                <Text allowFontScaling={false} style={[st.empty, { fontFamily: theme.regularFont }]}>
                  {t("profileHub.racketTypeModel")}
                </Text>
              ) : null}
            </ScrollView>
            {withIndex ? (
              <View style={st.rail}>
                {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((L) => {
                  const has = letters.has(L);
                  const active = !!value && value[0].toUpperCase() === L;
                  return (
                    <TouchableOpacity key={L} disabled={!has} onPress={() => jump(L)} hitSlop={4} style={[st.railItem, active && st.railActive]}>
                      <Text
                        allowFontScaling={false}
                        style={[st.railText, { fontFamily: theme.mediumFont }, !has && { opacity: 0.35 }, active && { color: "#FFFFFF" }]}
                      >
                        {L}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

/** Placeholder brand mark (initials on white) until official logo files are added to assets. */
function BrandMark({ name }: { name: string }) {
  const { theme } = useContext(ThemeContext);
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <View style={st.mark}>
      <Text allowFontScaling={false} style={[st.markText, { fontFamily: theme.semiBoldFont }]}>
        {initials}
      </Text>
    </View>
  );
}

function NumberModal({
  title,
  spec,
  value,
  onDone,
  onClose,
}: {
  title: string;
  spec: (typeof NUM)[NumKey];
  value: number | null;
  onDone: (v: number | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const [text, setText] = useState(value == null ? "" : spec.decimals ? formatTenth(value) : String(value));
  const [err, setErr] = useState<string | null>(null);
  function done() {
    if (!text.trim()) return onDone(null);
    const n = parseDecimalInput(text);
    if (n == null || n < spec.min || n > spec.max) {
      setErr(t("profileHub.racketRange", { min: spec.min, max: spec.max, unit: spec.unit }));
      return;
    }
    onDone(spec.decimals ? Math.round(n * 10) / 10 : Math.round(n));
  }
  return (
    <ModalShell title={title} onClose={onClose}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TextInput
          value={text}
          onChangeText={(x) => setText(x.replace(spec.decimals ? /[^0-9.,]/g : /[^0-9]/g, "").slice(0, 5))}
          keyboardType={spec.decimals ? "decimal-pad" : "number-pad"}
          placeholder={spec.ph}
          placeholderTextColor="rgba(134, 167, 210, 0.45)"
          autoFocus
          onSubmitEditing={done}
          style={[modalSt.fieldInput, { flex: 1, fontFamily: theme.semiBoldFont }]}
          testID="racket-number-input"
        />
        <Text allowFontScaling={false} style={[modalSt.fieldLabel, { fontSize: 15, fontFamily: theme.mediumFont }]}>
          {spec.unit}
        </Text>
      </View>
      {err ? (
        <Text allowFontScaling={false} style={modalSt.error} accessibilityRole="alert">
          {err}
        </Text>
      ) : null}
      <GlowButton label={t("profileHub.done")} onPress={done} testID="racket-number-done" />
    </ModalShell>
  );
}

/** Generic padel racket (no brand) for the hero card until real product photos exist. */
function RacketArt() {
  const W = 104;
  const H = 139;
  const head = "M60 6 C92 6 112 26 112 58 C112 86 96 104 76 114 L66 120 L54 120 L44 114 C24 104 8 86 8 58 C8 26 28 6 60 6 Z";
  const holes: { x: number; y: number }[] = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      holes.push({ x: 20 + col * 10 + (row % 2) * 5, y: 22 + row * 10 });
    }
  }
  return (
    <Svg width={W} height={H} viewBox="0 0 120 160">
      <Defs>
        <SvgLinear id="rkFace" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2A2F3A" />
          <Stop offset="1" stopColor="#0B0E14" />
        </SvgLinear>
        <SvgLinear id="rkRim" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#5B6170" />
          <Stop offset="0.5" stopColor="#C9CED8" />
          <Stop offset="1" stopColor="#5B6170" />
        </SvgLinear>
        <ClipPath id="rkClip">
          <Path d={head} />
        </ClipPath>
      </Defs>
      <Rect x={53} y={118} width={14} height={36} rx={4} fill="#1A1F2B" />
      <Rect x={53} y={146} width={14} height={8} rx={3} fill="#2F5BFF" />
      <Path d={head} fill="url(#rkFace)" stroke="url(#rkRim)" strokeWidth={4} />
      <G clipPath="url(#rkClip)">
        {holes.map((h, i) => (
          <Circle key={i} cx={h.x} cy={h.y} r={2.4} fill="#05070C" stroke="#3A4150" strokeWidth={0.6} />
        ))}
        <Path d="M14 96 L46 90" stroke="#E0353B" strokeWidth={2} />
        <Path d="M74 90 L106 96" stroke="#E0353B" strokeWidth={2} />
      </G>
    </Svg>
  );
}

const st = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "rgba(77, 123, 255, 0.8)",
    padding: 18,
  },
  heroInfo: {
    flex: 1,
    gap: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(77, 123, 255, 0.5)",
    backgroundColor: "rgba(6, 14, 52, 0.55)",
    padding: 14,
  },
  heroName: { fontSize: 15, lineHeight: 22, color: "#9DB3DA" },
  saved: { color: "#7FE3A0", fontSize: 13, textAlign: "center", marginTop: 12 },
  pickerCard: { maxHeight: "86%", paddingBottom: 10 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 64,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#2F6BFF",
    backgroundColor: "rgba(10, 22, 82, 0.9)",
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#FFFFFF", height: "100%" },
  pickRow: {
    height: ROW_H - 6,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  pickRowOn: { borderColor: "#4FA3FF", backgroundColor: "rgba(16, 36, 110, 0.9)" },
  pickText: { flex: 1, fontSize: 16, color: "#FFFFFF" },
  check: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#4FB2FF", alignItems: "center", justifyContent: "center" },
  mark: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  markText: { fontSize: 15, color: "#0A1652", letterSpacing: 0.5 },
  customIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "rgba(143, 184, 255, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { color: "#86A7D2", fontSize: 14, textAlign: "center", paddingVertical: 24, paddingHorizontal: 12 },
  rail: { width: 28, alignItems: "center", marginLeft: 4 },
  railItem: { width: 24, height: 22, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  railActive: { backgroundColor: "#4FB2FF" },
  railText: { fontSize: 12, color: "#D6E2FF" },
});
