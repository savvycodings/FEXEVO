import React, { useContext, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  Image,
  Linking,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemeContext } from "../context";
import { authClient } from "../lib/auth-client";
import { DOMAIN } from "../../constants";
import { formatTrainSkillLevel, TRAIN_SKILL_LEVEL_IDS } from "../lib/trainSkillLevel";
import {
  TRAIN_CATEGORIES,
  TRAIN_STROKE_PRESETS,
  TRAIN_STROKE_PRESET_GROUPS,
  type TrainCategory,
  type TrainStrokePreset,
} from "../lib/train-taxonomy";

const ADMIN_UI_PASSWORD = "xevodev";
const ADMIN_HEADER_SECRET = "xevodev";

type ViewProfile = "front" | "side" | "behind";
type TrainSkillLevel = "beginner" | "intermediate" | "advanced";

function absoluteBackendUrl(relativeOrAbsolute: string): string {
  if (relativeOrAbsolute.startsWith("http://") || relativeOrAbsolute.startsWith("https://")) {
    return relativeOrAbsolute;
  }
  const base = DOMAIN.replace(/\/+$/, "");
  return `${base}${relativeOrAbsolute.startsWith("/") ? "" : "/"}${relativeOrAbsolute}`;
}

function flattenFalDetail(detail: unknown): string {
  if (Array.isArray(detail)) {
    return detail
      .map((item: unknown) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          const loc = Array.isArray(o.loc) ? (o.loc as unknown[]).join(".") : "";
          const m = typeof o.msg === "string" ? o.msg : JSON.stringify(item);
          return loc ? `${loc}: ${m}` : m;
        }
        return String(item);
      })
      .join("\n");
  }
  if (typeof detail === "string") return detail;
  return "";
}

function formatFalRunFailure(body: Record<string, unknown> | null | undefined): string {
  if (!body || typeof body !== "object") return "Train failed";
  const msg = typeof body.message === "string" ? body.message : "";
  const err = typeof body.error === "string" ? body.error : "";
  const hint = typeof body.hint === "string" ? body.hint : "";
  const status = typeof body.status === "number" ? `HTTP ${body.status}` : "";
  const topDetail = "detail" in body ? flattenFalDetail(body.detail) : "";
  const details = body.details;
  let detailsStr = "";
  if (details !== undefined && details !== null) {
    if (typeof details === "string") detailsStr = details;
    else if (typeof details === "object" && "detail" in details) {
      detailsStr = flattenFalDetail((details as Record<string, unknown>).detail);
    } else {
      detailsStr = JSON.stringify(details, null, 2);
    }
  }
  return [msg || err || status, hint, topDetail || detailsStr]
    .filter(Boolean)
    .join("\n\n")
    .trim() || "Train failed";
}

type PickedImage = {
  uri: string;
  fileName: string;
  mimeType: string;
};

type Props = {
  onClose: () => void;
  /** When true, skip the local password gate (hub already unlocked). */
  skipPasswordGate?: boolean;
};

export function AdminFalLora({ onClose, skipPasswordGate }: Props) {
  const { theme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme);

  const [unlocked, setUnlocked] = useState(!!skipPasswordGate);
  const [gatePassword, setGatePassword] = useState("");

  const [datasetName, setDatasetName] = useState("Pro strokes (team)");
  const [triggerWord, setTriggerWord] = useState("xevoStroke");
  const [isStyle, setIsStyle] = useState(false);
  /** fal.ai training optimizer steps (not image count); fal docs often use ~500–1500 */
  const [steps, setSteps] = useState("1000");

  const [category, setCategory] = useState<TrainCategory>("ground_strokes");
  const [strokePreset, setStrokePreset] = useState<TrainStrokePreset>("forehand_drive");
  const [skillLevel, setSkillLevel] = useState<TrainSkillLevel>("intermediate");
  const [viewProfile, setViewProfile] = useState<ViewProfile>("side");

  const [images, setImages] = useState<PickedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [training, setTraining] = useState(false);

  const [lastDataset, setLastDataset] = useState<{
    datasetId: string;
    zipPath: string;
    zipUrl: string;
    imageCount: number;
  } | null>(null);

  const [lastRun, setLastRun] = useState<{
    runId: string;
    loraUrl: string | null;
    configUrl: string | null;
    datasetImageCount?: number | null;
    trainingStepsRequested?: number | null;
  } | null>(null);

  const canTrain = useMemo(() => {
    return !!lastDataset?.zipUrl && !uploading && !training;
  }, [lastDataset?.zipUrl, uploading, training]);

  function tryUnlock() {
    if (gatePassword.trim() === ADMIN_UI_PASSWORD) {
      setUnlocked(true);
      setGatePassword("");
      return;
    }
    Alert.alert("Incorrect", "Password is wrong.");
  }

  async function pickImages() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: 30,
    } as any);
    if (result.canceled || !result.assets?.length) return;
    const picked = result.assets.map((a) => {
      const fileName = a.fileName || `image-${Math.random().toString(16).slice(2)}.jpg`;
      const mimeType =
        (a as any).mimeType ||
        (fileName.toLowerCase().endsWith(".png")
          ? "image/png"
          : fileName.toLowerCase().endsWith(".webp")
          ? "image/webp"
          : "image/jpeg");
      return { uri: a.uri, fileName, mimeType } as PickedImage;
    });
    setImages((prev) => [...prev, ...picked]);
  }

  function clearImages() {
    setImages([]);
  }

  async function uploadDataset() {
    if (!datasetName.trim()) {
      Alert.alert("Name", "Dataset name is required.");
      return;
    }
    if (images.length === 0) {
      Alert.alert("Images", "Pick at least 1 image.");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("name", datasetName.trim());
      form.append("triggerWord", triggerWord.trim());
      form.append("isStyle", String(!!isStyle));
      form.append("category", category);
      form.append("strokePreset", strokePreset);
      form.append("skillLevel", skillLevel);
      form.append("viewProfile", viewProfile);

      for (const img of images) {
        if (Platform.OS === "web") {
          const r = await fetch(img.uri);
          const blob = await r.blob();
          const file = new File([blob], img.fileName, { type: img.mimeType || blob.type || "image/jpeg" });
          form.append("images", file);
        } else {
          form.append("images", { uri: img.uri, name: img.fileName, type: img.mimeType } as any);
        }
      }

      const res = await authClient
        .$fetch<{ ok?: boolean; datasetId?: string; zipPath?: string; imageCount?: number; error?: string }>(
          "/train/fal-lora/dataset",
          {
            method: "POST",
            body: form,
            headers: { "X-Admin-Train-Secret": ADMIN_HEADER_SECRET },
          }
        )
        .catch((err) => ({ error: err?.message || "Upload failed" } as any));

      const data = ((res as any)?.data ?? res) as any;
      if (!data?.ok || !data?.datasetId || !data?.zipPath) {
        throw new Error(data?.error || "Upload failed");
      }

      const zipUrl = absoluteBackendUrl(data.zipPath);
      setLastDataset({
        datasetId: data.datasetId,
        zipPath: data.zipPath,
        zipUrl,
        imageCount: data.imageCount ?? images.length,
      });
      setLastRun(null);
      if (Platform.OS !== "web") Alert.alert("Saved", `ZIP: ${zipUrl}`);
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message || "Unknown error");
    } finally {
      setUploading(false);
    }
  }

  async function copyToClipboard(text: string, label: string) {
    const t = text?.trim();
    if (!t) {
      Alert.alert("Nothing to copy", `${label} is empty.`);
      return;
    }
    try {
      await Clipboard.setStringAsync(t);
      Alert.alert("Copied", `${label} copied to clipboard.`);
    } catch (e: any) {
      Alert.alert("Copy failed", e?.message || "Could not copy.");
    }
  }

  async function runTraining() {
    if (!lastDataset?.datasetId) return;
    setTraining(true);
    try {
      const stepsNum = Number(steps);
      const payload = {
        datasetId: lastDataset.datasetId,
        triggerWord: triggerWord.trim(),
        isStyle,
        steps: Number.isFinite(stepsNum) ? stepsNum : undefined,
      };

      let data: Record<string, unknown> & {
        ok?: boolean;
        runId?: string;
        diffusers_lora_file_url?: string | null;
        config_file_url?: string | null;
      };
      try {
        const result = await authClient.$fetch<typeof data & { error?: string; message?: string; details?: unknown }>(
          "/train/fal-lora/run",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Admin-Train-Secret": ADMIN_HEADER_SECRET,
            },
            body: JSON.stringify(payload),
          }
        );
        data = ((result as { data?: typeof data })?.data ?? result) as typeof data;
      } catch (err: any) {
        const body = (err?.data ?? err?.body ?? err?.cause?.data ?? err?.response?.data) as Record<
          string,
          unknown
        > | undefined;
        Alert.alert("Training failed", formatFalRunFailure(body).slice(0, 2000));
        return;
      }

      if (!data?.ok || !data?.runId) {
        Alert.alert("Training failed", formatFalRunFailure(data).slice(0, 2000));
        return;
      }
      const imgCount =
        typeof (data as { dataset_image_count?: number }).dataset_image_count === "number"
          ? (data as { dataset_image_count: number }).dataset_image_count
          : null;
      const stepsReq =
        typeof (data as { training_steps_requested?: number }).training_steps_requested === "number"
          ? (data as { training_steps_requested: number }).training_steps_requested
          : null;
      setLastRun({
        runId: String(data.runId),
        loraUrl: (data.diffusers_lora_file_url as string | null) ?? null,
        configUrl: (data.config_file_url as string | null) ?? null,
        datasetImageCount: imgCount,
        trainingStepsRequested: stepsReq,
      });
      const doneMsg = [
        "LoRA file ready.",
        imgCount != null ? `Dataset images: ${imgCount}.` : null,
        stepsReq != null
          ? `Training steps (optimizer): ${stepsReq} — not image count.`
          : null,
      ]
        .filter(Boolean)
        .join(" ");
      if (Platform.OS !== "web") Alert.alert("Training complete", doneMsg || String(data.diffusers_lora_file_url || "Done"));
    } catch (e: any) {
      Alert.alert("Training failed!", e?.message || "Unknown error");
    } finally {
      setTraining(false);
    }
  }

  const taxonomySummary = useMemo(() => {
    const cat = TRAIN_CATEGORIES.find((c) => c.id === category)?.label ?? category;
    const preset = TRAIN_STROKE_PRESETS.find((s) => s.id === strokePreset)?.label ?? strokePreset;
    return `${cat} · ${preset} · ${formatTrainSkillLevel(skillLevel)} · ${viewProfile}`;
  }, [category, strokePreset, skillLevel, viewProfile]);

  if (!unlocked) {
    return (
      <View style={styles.screen}>
        <View style={[styles.topBar, { paddingTop: insets.top + 6, paddingBottom: 10 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#00BBFF" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Admin</Text>
          <View style={{ width: 28 }} />
        </View>
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.gateScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={insets.bottom + 12}
        >
        <View style={styles.centerBlock}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={gatePassword}
            onChangeText={setGatePassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={tryUnlock} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
        </KeyboardAwareScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6, paddingBottom: 10 }]}>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#00BBFF" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Fal LoRA upload</Text>
        <View style={{ width: 28 }} />
      </View>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={insets.bottom + 12}
      >
        <Text style={styles.label}>Dataset name</Text>
        <TextInput value={datasetName} onChangeText={setDatasetName} style={styles.input} />

        <Text style={styles.label}>Trigger word</Text>
        <TextInput value={triggerWord} onChangeText={setTriggerWord} style={styles.input} autoCapitalize="none" />

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.togglePill, isStyle && styles.togglePillOn]}
            onPress={() => setIsStyle((v) => !v)}
            activeOpacity={0.85}
          >
            <Text style={[styles.togglePillText, isStyle && styles.togglePillTextOn]}>
              {isStyle ? "Style training: ON" : "Style training: OFF"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Training steps (optimizer)</Text>
        <Text style={styles.fileHint}>
          Number of LoRA training iterations sent to fal — not how many photos you zipped. Typical 500–1500; fal
          examples often use 1000. Your dataset size is the image count shown after &quot;Upload + build ZIP&quot;.
        </Text>
        <TextInput value={steps} onChangeText={setSteps} style={styles.input} keyboardType="numeric" />

        <Text style={styles.label}>Category</Text>
        <View style={styles.pillGrid}>
          {TRAIN_CATEGORIES.map(({ id, label }) => {
            const active = category === id;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.taxonomyPill, active && styles.taxonomyPillActive]}
                onPress={() => setCategory(id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.taxonomyPillText, active && styles.taxonomyPillTextActive]} numberOfLines={2}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Stroke</Text>
        {TRAIN_STROKE_PRESET_GROUPS.map((group) => (
          <View key={group.title} style={styles.strokeGroup}>
            <Text style={styles.strokeGroupTitle}>{group.title}</Text>
            <View style={styles.pillGrid}>
              {group.presetIds.map((id) => {
                const def = TRAIN_STROKE_PRESETS.find((p) => p.id === id);
                if (!def) return null;
                const active = strokePreset === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.taxonomyPill, active && styles.taxonomyPillActive]}
                    onPress={() => setStrokePreset(id)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[styles.taxonomyPillText, active && styles.taxonomyPillTextActive]}
                      numberOfLines={3}
                    >
                      {def.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <Text style={styles.label}>Level</Text>
        <View style={styles.viewProfileRow}>
          {TRAIN_SKILL_LEVEL_IDS.map((id) => {
            const active = skillLevel === id;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.viewProfilePill, active && styles.viewProfilePillActive]}
                onPress={() => setSkillLevel(id as any)}
                activeOpacity={0.85}
              >
                <Text style={[styles.viewProfilePillText, active && styles.viewProfilePillTextActive]}>
                  {formatTrainSkillLevel(id)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>View profile</Text>
        <View style={styles.viewProfileRow}>
          {(["front", "side", "behind"] as ViewProfile[]).map((v) => {
            const active = viewProfile === v;
            return (
              <TouchableOpacity
                key={v}
                style={[styles.viewProfilePill, active && styles.viewProfilePillActive]}
                onPress={() => setViewProfile(v)}
                activeOpacity={0.85}
              >
                <Text style={[styles.viewProfilePillText, active && styles.viewProfilePillTextActive]}>
                  {v}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Images</Text>
        <Text style={styles.fileHint}>{taxonomySummary}</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={pickImages} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>Pick images ({images.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={clearImages} activeOpacity={0.85}>
            <Text style={styles.ghostBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {images.slice(0, 12).map((img, i) => (
                <Image key={`${img.uri}-${i}`} source={{ uri: img.uri }} style={styles.thumb} />
              ))}
            </View>
          </ScrollView>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, uploading && { opacity: 0.6 }]}
          onPress={uploadDataset}
          disabled={uploading}
          activeOpacity={0.85}
        >
          {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Upload + build ZIP</Text>}
        </TouchableOpacity>

        {lastDataset ? (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>Saved — dataset</Text>
            <Text style={styles.successMeta}>
              id <Text style={styles.successMono}>{lastDataset.datasetId}</Text>
            </Text>
            <Text style={styles.successMeta}>{lastDataset.imageCount} images</Text>
            <Text style={styles.successLabel}>ZIP URL (use as fal images_data_url)</Text>
            <Text selectable style={styles.successUrl}>
              {lastDataset.zipUrl}
            </Text>
            <View style={styles.urlActionRow}>
              <TouchableOpacity
                style={styles.copyUrlBtn}
                onPress={() => void copyToClipboard(lastDataset.zipUrl, "ZIP URL")}
                activeOpacity={0.85}
              >
                <Ionicons name="copy-outline" size={16} color="#00BBFF" />
                <Text style={styles.copyUrlBtnText}>Copy ZIP URL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.openStreamBtn}
                onPress={() => Linking.openURL(lastDataset.zipUrl)}
                activeOpacity={0.85}
              >
                <Text style={styles.openStreamBtnText}>Open ZIP</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, !canTrain && { opacity: 0.5 }]}
          onPress={runTraining}
          disabled={!canTrain}
          activeOpacity={0.85}
        >
          {training ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Train LoRA on fal.ai</Text>}
        </TouchableOpacity>

        {lastRun ? (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>Training complete</Text>
            <Text style={styles.successMeta}>
              run <Text style={styles.successMono}>{lastRun.runId}</Text>
            </Text>
            {lastRun.datasetImageCount != null ? (
              <Text style={styles.successMeta}>Images in dataset (zip): {lastRun.datasetImageCount}</Text>
            ) : null}
            {lastRun.trainingStepsRequested != null ? (
              <Text style={styles.successMeta}>
                Training steps (fal optimizer): {lastRun.trainingStepsRequested} — not “images generated”
              </Text>
            ) : null}
            <Text style={styles.successLabel}>LoRA URL (set on API server as FAL_CORRECTION_LORA_URL)</Text>
            <Text selectable style={styles.successUrl}>{lastRun.loraUrl || "—"}</Text>
            <Text style={styles.successMeta}>
              Put the LoRA URL in the server env and restart. Technique corrections (Flux img2img) use it with conservative defaults: FAL_CORRECTION_STRENGTH (0.38), FAL_CORRECTION_GUIDANCE_SCALE (2.6), FAL_CORRECTION_LORA_SCALE (0.85). Config URL is optional metadata for reproducing training.
            </Text>
            {lastRun.loraUrl ? (
              <View style={styles.urlActionRow}>
                <TouchableOpacity
                  style={styles.copyUrlBtn}
                  onPress={() => void copyToClipboard(lastRun.loraUrl!, "LoRA URL")}
                  activeOpacity={0.85}
                >
                  <Ionicons name="copy-outline" size={16} color="#00BBFF" />
                  <Text style={styles.copyUrlBtnText}>Copy LoRA URL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.openStreamBtn}
                  onPress={() => Linking.openURL(lastRun.loraUrl!)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.openStreamBtnText}>Open LoRA</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {lastRun.configUrl ? (
              <>
                <Text style={[styles.successLabel, { marginTop: 12 }]}>Config URL</Text>
                <Text selectable style={styles.successUrl}>
                  {lastRun.configUrl}
                </Text>
                <View style={styles.urlActionRow}>
                  <TouchableOpacity
                    style={styles.copyUrlBtn}
                    onPress={() => void copyToClipboard(lastRun.configUrl!, "Config URL")}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="copy-outline" size={16} color="#00BBFF" />
                    <Text style={styles.copyUrlBtnText}>Copy config URL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.openStreamBtn}
                    onPress={() => Linking.openURL(lastRun.configUrl!)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.openStreamBtnText}>Open config</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

function getStyles(theme: any) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.backgroundColor },
    gateScroll: { flexGrow: 1, justifyContent: "center", paddingVertical: 24 },
    centerBlock: { justifyContent: "center", paddingHorizontal: 24, gap: 12 },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "rgba(255,255,255,0.1)",
    },
    backBtn: { padding: 4 },
    topTitle: { color: theme.textColor, fontFamily: theme.semiBoldFont, fontSize: 17 },
    scroll: { padding: 20, paddingBottom: 48, gap: 12 },
    label: { color: "rgba(255,255,255,0.85)", fontFamily: theme.mediumFont, fontSize: 13 },
    strokeGroup: { marginTop: 10, gap: 6 },
    strokeGroupTitle: {
      color: "rgba(255,255,255,0.65)",
      fontFamily: theme.semiBoldFont,
      fontSize: 12,
      letterSpacing: 0.3,
      textTransform: "uppercase",
    },
    input: {
      borderWidth: 1,
      borderColor: "rgba(0, 120, 255, 0.45)",
      backgroundColor: "rgba(2, 26, 92, 0.45)",
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.textColor,
      fontFamily: theme.regularFont,
      fontSize: 15,
    },
    row: { flexDirection: "row", gap: 10, alignItems: "center" },
    togglePill: {
      borderWidth: 1,
      borderColor: "rgba(0, 187, 255, 0.45)",
      borderRadius: 999,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: "rgba(2, 26, 92, 0.3)",
      alignSelf: "flex-start",
    },
    togglePillOn: { backgroundColor: "rgba(0, 187, 255, 0.2)", borderColor: "#00BBFF" },
    togglePillText: { color: "rgba(255,255,255,0.75)", fontFamily: theme.mediumFont, fontSize: 13 },
    togglePillTextOn: { color: "#00BBFF" },
    primaryBtn: {
      backgroundColor: "#0022FF",
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    primaryBtnText: { color: "#fff", fontFamily: theme.semiBoldFont, fontSize: 15 },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: "rgba(0, 187, 255, 0.5)",
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 4,
      flex: 1,
    },
    secondaryBtnText: { color: "#00BBFF", fontFamily: theme.mediumFont, fontSize: 14 },
    ghostBtn: {
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.15)",
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginTop: 4,
    },
    ghostBtnText: { color: theme.mutedForegroundColor, fontFamily: theme.mediumFont, fontSize: 13 },
    pillGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 4,
    },
    taxonomyPill: {
      borderWidth: 1,
      borderColor: "rgba(0, 187, 255, 0.45)",
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 10,
      backgroundColor: "rgba(2, 26, 92, 0.3)",
      minWidth: "30%",
      flexGrow: 1,
      maxWidth: "48%",
    },
    taxonomyPillHalf: { maxWidth: "48%", minWidth: "45%" },
    taxonomyPillActive: { backgroundColor: "rgba(0, 187, 255, 0.2)", borderColor: "#00BBFF" },
    taxonomyPillText: {
      color: "rgba(255,255,255,0.85)",
      fontFamily: theme.mediumFont,
      fontSize: 12,
      lineHeight: 16,
      textAlign: "center",
    },
    taxonomyPillTextActive: { color: "#00BBFF" },
    viewProfileRow: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
    viewProfilePill: {
      borderWidth: 1,
      borderColor: "rgba(0, 187, 255, 0.45)",
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: "rgba(2, 26, 92, 0.3)",
    },
    viewProfilePillActive: { backgroundColor: "rgba(0, 187, 255, 0.2)", borderColor: "#00BBFF" },
    viewProfilePillText: { color: "rgba(255,255,255,0.75)", fontFamily: theme.mediumFont, fontSize: 13, textTransform: "capitalize" },
    viewProfilePillTextActive: { color: "#00BBFF" },
    fileHint: { color: theme.mutedForegroundColor, fontSize: 12, fontFamily: theme.regularFont },
    thumb: { width: 72, height: 72, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
    successBox: {
      marginTop: 16,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(46, 204, 113, 0.45)",
      backgroundColor: "rgba(46, 204, 113, 0.08)",
    },
    successTitle: { color: "#2ecc71", fontFamily: theme.semiBoldFont, fontSize: 14, marginBottom: 6 },
    successMeta: { color: theme.mutedForegroundColor, fontFamily: theme.regularFont, fontSize: 12, marginBottom: 8 },
    successMono: { fontFamily: theme.regularFont },
    successLabel: { color: "rgba(255,255,255,0.7)", fontFamily: theme.mediumFont, fontSize: 11, marginBottom: 4 },
    successUrl: { color: theme.textColor, fontFamily: theme.regularFont, fontSize: 12, lineHeight: 18 },
    urlActionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 10,
      marginTop: 12,
    },
    copyUrlBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: "rgba(0, 187, 255, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(0, 187, 255, 0.45)",
    },
    copyUrlBtnText: { color: "#00BBFF", fontFamily: theme.semiBoldFont, fontSize: 13 },
    openStreamBtn: {
      alignSelf: "flex-start",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: "rgba(46, 204, 113, 0.25)",
    },
    openStreamBtnText: { color: "#2ecc71", fontFamily: theme.semiBoldFont, fontSize: 13 },
  });
}

