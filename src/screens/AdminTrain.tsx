import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { ThemeContext } from "../context";
import { authClient } from "../lib/auth-client";
import { DOMAIN } from "../../constants";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AdminGradientCard } from "../components/AdminGradientCard";
import { MainTabBarBackground } from "../components/MainTabBarBackground";
import {
  NavIconAICoach,
  NavIconActivities,
  NavIconMyCoach,
  NavIconProgress,
  NavIconYou,
} from "../components/NavTabIcons";
import { formatTrainSkillLevel, TRAIN_SKILL_LEVEL_IDS } from "../lib/trainSkillLevel";
import {
  TRAIN_CATEGORIES,
  TRAIN_STROKE_PRESETS,
  type TrainCategory,
  type TrainStrokePreset,
} from "../lib/train-taxonomy";

const ADMIN_UI_PASSWORD = "xevodev";
const ADMIN_HEADER_SECRET = "xevodev";
type ViewProfile = "front" | "side" | "behind";

type TrainSkillLevel = "beginner" | "intermediate" | "advanced";
type TrainCategoryChoice = {
  id: TrainCategory;
  label: string;
};
type StrokeChoiceGroup = {
  title: string;
  items: { presetId: TrainStrokePreset; label: string }[];
};

const TRAIN_CATEGORY_CHOICES: TrainCategoryChoice[] = [
  { id: "save_return", label: "save & return" },
  { id: "ground_strokes", label: "ground storekes" },
  { id: "net_play", label: "net play" },
  { id: "defence_glass", label: "defence(walls)" },
  { id: "overhead", label: "overheads" },
  { id: "tactical_specials", label: "tactical & specials" },
];

const CATEGORY_SCREEN_TITLE: Record<TrainCategory, string> = {
  save_return: "Serve & Return",
  ground_strokes: "Groundstrokes",
  net_play: "Net Play",
  defence_glass: "Defense (Walls)",
  overhead: "Overheads",
  tactical_specials: "Tactical & Specials",
};

const CATEGORY_STROKE_CHOICES: Record<TrainCategory, StrokeChoiceGroup[]> = {
  save_return: [
    {
      title: "Serve",
      items: [
        { presetId: "forehand_drive", label: "Flat serve" },
        { presetId: "backhand_drive_with_wall", label: "Slice serve" },
        { presetId: "forehand_lob", label: "Kick serve" },
      ],
    },
    {
      title: "Return",
      items: [
        { presetId: "forehand_return_with_lob", label: "Forehand return" },
        { presetId: "backhand_return", label: "Backhand return" },
        { presetId: "backhand_return_with_lob", label: "Backhand return lob" },
        { presetId: "forehand_return_with_lob", label: "Forehand return lob" },
        { presetId: "forehand_chiquita", label: "Chiquita return" },
      ],
    },
  ],
  ground_strokes: [
    {
      title: "Drives",
      items: [
        { presetId: "forehand_drive", label: "Forehand drive" },
        { presetId: "backhand_drive", label: "Backhand drive" },
        { presetId: "forehand_drive", label: "Forehand drive (wall exit)" },
        { presetId: "backhand_drive_with_wall", label: "Backhand drive (wall exit)" },
      ],
    },
    {
      title: "Lobs",
      items: [
        { presetId: "forehand_lob", label: "Forehand lob" },
        { presetId: "backhand_lob", label: "Backhand lob" },
      ],
    },
    {
      title: "Control Shots",
      items: [
        { presetId: "forehand_chiquita", label: "Forehand chiquita" },
        { presetId: "backhand_drive", label: "Backhand chiquita" },
        { presetId: "contrapared_boast", label: "Drop shot (dejada)" },
      ],
    },
  ],
  net_play: [
    {
      title: "Volleys",
      items: [
        { presetId: "forehand_volley", label: "Forehand volley" },
        { presetId: "backhand_volley", label: "Backhand volley" },
        { presetId: "half_volley", label: "Block volley" },
      ],
    },
    {
      title: "Transition",
      items: [
        { presetId: "half_volley", label: "Half volley" },
      ],
    },
    {
      title: "Control & Finishing",
      items: [
        { presetId: "contrapared_boast", label: "Drop volley (dormilona)" },
        { presetId: "forehand_chiquita", label: "Angle volley" },
        { presetId: "backhand_return", label: "Deep volley" },
      ],
    },
  ],
  defence_glass: [
    {
      title: "Back Wall",
      items: [
        { presetId: "back_wall_forehand", label: "Back wall forehand" },
        { presetId: "back_wall_backhand", label: "Back wall backhand" },
      ],
    },
    {
      title: "Side Wall",
      items: [
        { presetId: "side_wall_forehand", label: "Side wall forehand" },
        { presetId: "side_wall_backhand", label: "Side wall backhand" },
      ],
    },
    {
      title: "Double Wall",
      items: [
        { presetId: "back_wall_forehand", label: "Double wall forehand" },
        { presetId: "back_wall_backhand", label: "Double wall backhand" },
      ],
    },
    {
      title: "Wall Combinations",
      items: [
        { presetId: "side_wall_forehand", label: "Back wall -> side wall" },
        { presetId: "side_wall_backhand", label: "Side wall -> back wall" },
      ],
    },
    {
      title: "Advanced Defense",
      items: [
        { presetId: "contrapared_boast", label: "Contrapared (boast)" },
        { presetId: "back_wall_forehand", label: "Counter-wall forehand" },
        { presetId: "back_wall_backhand", label: "Counter-wall backhand" },
        { presetId: "side_wall_forehand", label: "Glass exit (salida de pared)" },
      ],
    },
  ],
  overhead: [
    {
      title: "Control",
      items: [
        { presetId: "forehand_volley", label: "Bandeja" },
        { presetId: "backhand_volley", label: "Vibora" },
      ],
    },
    {
      title: "Power",
      items: [
        { presetId: "forehand_drive", label: "Flat smash" },
        { presetId: "backhand_drive", label: "Kick smash" },
      ],
    },
    {
      title: "Winners",
      items: [
        { presetId: "forehand_lob", label: "Por 3 smash" },
        { presetId: "backhand_lob", label: "Por 4 smash" },
      ],
    },
    {
      title: "Advanced",
      items: [
        { presetId: "forehand_chiquita", label: "Gancho" },
        { presetId: "backhand_return", label: "Rulo" },
        { presetId: "contrapared_boast", label: "Bajada" },
        { presetId: "backhand_return_with_lob", label: "Cuchilla" },
      ],
    },
  ],
  tactical_specials: [
    {
      title: "Transition",
      items: [
        { presetId: "half_volley", label: "Bajada (wall to attack)" },
        { presetId: "backhand_return", label: "Approach shot" },
      ],
    },
    {
      title: "Tactical",
      items: [
        { presetId: "forehand_chiquita", label: "Passing shot" },
        { presetId: "contrapared_boast", label: "Body shot" },
        { presetId: "backhand_drive", label: "Shot to feet" },
        { presetId: "forehand_lob", label: "Tactical lob" },
      ],
    },
    {
      title: "Creative / Emergency",
      items: [
        { presetId: "backhand_return_with_lob", label: "Off-court recovery" },
        { presetId: "forehand_return_with_lob", label: "Behind-the-back (cadete)" },
        { presetId: "side_wall_forehand", label: "Fake shot / feint" },
      ],
    },
  ],
};

function absoluteBackendUrl(relativeOrAbsolute: string): string {
  if (relativeOrAbsolute.startsWith("http://") || relativeOrAbsolute.startsWith("https://")) {
    return relativeOrAbsolute;
  }
  const base = DOMAIN.replace(/\/+$/, "");
  return `${base}${relativeOrAbsolute.startsWith("/") ? "" : "/"}${relativeOrAbsolute}`;
}

/** Same as technique upload: authClient.$fetch sends session on web + native. */
async function postTrainUpload(opts: {
  category: TrainCategory;
  strokePreset: TrainStrokePreset;
  skillLevel: TrainSkillLevel;
  viewProfile: ViewProfile;
  uri: string;
  fileName: string;
  mimeType: string;
}): Promise<{
  id: string;
  sampleId?: string;
  url: string;
  strokeName: string;
  category: TrainCategory;
  strokePreset: TrainStrokePreset;
  skillLevel: TrainSkillLevel;
  viewProfile?: ViewProfile;
}> {
  const form = new FormData();
  form.append("category", opts.category);
  form.append("strokePreset", opts.strokePreset);
  form.append("skillLevel", opts.skillLevel);
  form.append("viewProfile", opts.viewProfile);
  if (Platform.OS === "web") {
    const r = await fetch(opts.uri);
    const blob = await r.blob();
    const file = new File([blob], opts.fileName, { type: opts.mimeType || blob.type || "video/mp4" });
    form.append("video", file);
  } else {
    form.append("video", { uri: opts.uri, name: opts.fileName, type: opts.mimeType } as any);
  }

  const path = "/train/upload";
  if (__DEV__) {
    console.log("[AdminTrain] POST", `${DOMAIN.replace(/\/+$/, "")}${path}`, {
      category: opts.category,
      strokePreset: opts.strokePreset,
      skillLevel: opts.skillLevel,
      viewProfile: opts.viewProfile,
      fileName: opts.fileName,
      mimeType: opts.mimeType,
    });
  }

  const res = await authClient
    .$fetch<{
      id?: string;
      sampleId?: string;
      url?: string;
      error?: string;
      strokeName?: string;
      category?: TrainCategory;
      strokePreset?: TrainStrokePreset;
      skillLevel?: TrainSkillLevel;
      viewProfile?: ViewProfile;
    }>(path, {
      method: "POST",
      body: form,
      headers: {
        "X-Admin-Train-Secret": ADMIN_HEADER_SECRET,
      },
    })
    .catch((err) => ({ error: err?.message || "Upload failed" } as any));

  const data = ((res as any)?.data ?? res) as {
    id?: string;
    sampleId?: string;
    url?: string;
    error?: string;
    strokeName?: string;
    category?: TrainCategory;
    strokePreset?: TrainStrokePreset;
    skillLevel?: TrainSkillLevel;
    viewProfile?: ViewProfile;
  };
  if (__DEV__) {
    console.log("[AdminTrain] Response", data);
  }

  if (!data?.id || !data?.url) {
    throw new Error(data?.error || "Upload failed");
  }
  return {
    id: data.id,
    sampleId: data.sampleId,
    url: data.url,
    strokeName: data.strokeName || "",
    category: data.category ?? opts.category,
    strokePreset: data.strokePreset ?? opts.strokePreset,
    skillLevel: data.skillLevel ?? opts.skillLevel,
    viewProfile: data.viewProfile || opts.viewProfile,
  };
}

async function deleteTrainVideo(id: string): Promise<void> {
  const path = `/train/video/${encodeURIComponent(id)}`;
  const res = await authClient
    .$fetch<{ ok?: boolean; error?: string }>(path, {
      method: "DELETE",
      headers: {
        "X-Admin-Train-Secret": ADMIN_HEADER_SECRET,
      },
    })
    .catch((err) => ({ error: err?.message || "Delete failed" } as any));

  const data = ((res as any)?.data ?? res) as { ok?: boolean; error?: string };
  if (!data?.ok) {
    throw new Error(data?.error || "Delete failed");
  }
}

type PoseLandmarksCoverageRow = {
  sampleId: string;
  trainVideoId: string;
  category: string;
  strokePreset: string;
  skillLevel: string;
  viewProfile: string;
  strokeName: string;
  status: string;
  poseFrameCount: number | null;
  poseLandmarksReady: boolean;
  updatedAt: string | null;
};

async function fetchPoseLandmarksCoverage(): Promise<{
  rows: PoseLandmarksCoverageRow[];
  comboKeys: string[];
  categoryHasPoseLandmarks: Record<string, boolean>;
}> {
  const path = "/train/admin/pose-landmarks-coverage";
  const res = await authClient
    .$fetch<{
      rows?: PoseLandmarksCoverageRow[];
      comboKeys?: string[];
      categoryHasPoseLandmarks?: Record<string, boolean>;
      error?: string;
    }>(path, {
      method: "GET",
      headers: {
        "X-Admin-Train-Secret": ADMIN_HEADER_SECRET,
      },
    })
    .catch((err) => ({ error: err?.message || "Request failed" } as any));

  const data = ((res as any)?.data ?? res) as {
    rows?: PoseLandmarksCoverageRow[];
    comboKeys?: string[];
    categoryHasPoseLandmarks?: Record<string, boolean>;
    error?: string;
  };
  if (data?.error || !Array.isArray(data?.rows)) {
    throw new Error(data?.error || "Failed to load pose coverage");
  }
  return {
    rows: data.rows,
    comboKeys: Array.isArray(data.comboKeys) ? data.comboKeys : [],
    categoryHasPoseLandmarks:
      data.categoryHasPoseLandmarks && typeof data.categoryHasPoseLandmarks === "object"
        ? data.categoryHasPoseLandmarks
        : {},
  };
}

function trainComboKey(
  category: TrainCategory,
  strokePreset: TrainStrokePreset,
  skillLevel: TrainSkillLevel,
  viewProfile: ViewProfile
): string {
  return `${category}|${strokePreset}|${skillLevel}|${viewProfile}`;
}

function presetShortLabel(preset: string): string {
  return TRAIN_STROKE_PRESETS.find((p) => p.id === preset)?.label ?? preset;
}

function categoryLabel(id: string): string {
  return TRAIN_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

type Props = {
  onClose: () => void;
  /** When true, skip the local password gate (hub already unlocked). */
  skipPasswordGate?: boolean;
};

export function AdminTrain({ onClose, skipPasswordGate }: Props) {
  const { theme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme);
  const [unlocked, setUnlocked] = useState(!!skipPasswordGate);
  const [gatePassword, setGatePassword] = useState("");
  const [category, setCategory] = useState<TrainCategory>("ground_strokes");
  const [strokePreset, setStrokePreset] = useState<TrainStrokePreset>("forehand_drive");
  const [skillLevel, setSkillLevel] = useState<TrainSkillLevel>("intermediate");
  const [viewProfile, setViewProfile] = useState<ViewProfile>("side");
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState("video.mp4");
  const [pickedMime, setPickedMime] = useState("video/mp4");
  const [uploading, setUploading] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  /** Shown after upload — Alert is unreliable on web, so we always surface this in the UI. */
  const [lastUpload, setLastUpload] = useState<{
    id: string;
    sampleId?: string;
    strokeName: string;
    category: TrainCategory;
    strokePreset: TrainStrokePreset;
    skillLevel: TrainSkillLevel;
    viewProfile: ViewProfile;
    streamUrl: string;
  } | null>(null);
  const [showUploadEditor, setShowUploadEditor] = useState(false);

  const [poseCoverageRows, setPoseCoverageRows] = useState<PoseLandmarksCoverageRow[]>([]);
  const [poseComboKeys, setPoseComboKeys] = useState<string[]>([]);
  const [categoryHasPoseLandmarks, setCategoryHasPoseLandmarks] = useState<Record<string, boolean>>(
    {}
  );
  const [poseCoverageLoading, setPoseCoverageLoading] = useState(false);
  const [poseCoverageError, setPoseCoverageError] = useState<string | null>(null);
  const [poseCoverageRefreshKey, setPoseCoverageRefreshKey] = useState(0);

  const trainedComboSet = useMemo(() => new Set(poseComboKeys), [poseComboKeys]);

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    (async () => {
      setPoseCoverageLoading(true);
      setPoseCoverageError(null);
      try {
        const out = await fetchPoseLandmarksCoverage();
        if (!cancelled) {
          setPoseCoverageRows(out.rows);
          setPoseComboKeys(out.comboKeys);
          setCategoryHasPoseLandmarks(out.categoryHasPoseLandmarks);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setPoseCoverageError(e instanceof Error ? e.message : "Failed to load coverage");
        }
      } finally {
        if (!cancelled) setPoseCoverageLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unlocked, poseCoverageRefreshKey]);

  function strokePresetHasPoseLandmarks(preset: TrainStrokePreset): boolean {
    return trainedComboSet.has(trainComboKey(category, preset, skillLevel, viewProfile));
  }

  function skillLevelHasPoseLandmarks(level: TrainSkillLevel): boolean {
    const groups = CATEGORY_STROKE_CHOICES[category];
    for (const g of groups) {
      for (const item of g.items) {
        if (trainedComboSet.has(trainComboKey(category, item.presetId, level, viewProfile))) {
          return true;
        }
      }
    }
    return false;
  }

  function viewProfileHasPoseLandmarks(v: ViewProfile): boolean {
    const groups = CATEGORY_STROKE_CHOICES[category];
    for (const g of groups) {
      for (const item of g.items) {
        if (trainedComboSet.has(trainComboKey(category, item.presetId, skillLevel, v))) {
          return true;
        }
      }
    }
    return false;
  }

  function tryUnlock() {
    if (gatePassword.trim() === ADMIN_UI_PASSWORD) {
      setUnlocked(true);
      setGatePassword("");
      return;
    }
    Alert.alert("Incorrect", "Password is wrong.");
  }

  async function pickVideo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const a = result.assets[0];
    setPickedUri(a.uri);
    const name = a.fileName || "video.mp4";
    setPickedName(name);
    const mt =
      name.toLowerCase().endsWith(".mov") || name.toLowerCase().endsWith(".qt")
        ? "video/quicktime"
        : "video/mp4";
    setPickedMime(mt);
  }

  async function upload() {
    if (!pickedUri) {
      Alert.alert("Video", "Pick a video first.");
      return;
    }
    setUploading(true);
    try {
      if (__DEV__) console.log("[AdminTrain] Starting upload…");
      const out = await postTrainUpload({
        category,
        strokePreset,
        skillLevel,
        viewProfile,
        uri: pickedUri,
        fileName: pickedName,
        mimeType: pickedMime,
      });
      const streamUrl = absoluteBackendUrl(out.url);
      setLastId(out.id);
      setLastUpload({
        id: out.id,
        sampleId: out.sampleId,
        strokeName: out.strokeName,
        category: out.category,
        strokePreset: out.strokePreset,
        skillLevel: out.skillLevel,
        viewProfile: out.viewProfile || viewProfile,
        streamUrl,
      });
      if (__DEV__) {
        console.log("[AdminTrain] Upload success", {
          id: out.id,
          sampleId: out.sampleId,
          strokeName: out.strokeName,
          category: out.category,
          strokePreset: out.strokePreset,
          skillLevel: out.skillLevel,
          viewProfile: out.viewProfile || viewProfile,
          path: out.url,
          streamUrl,
        });
      }
      if (Platform.OS !== "web") {
        Alert.alert("Saved", `id: ${out.id}\nsample: ${out.sampleId || "-"}\n${out.strokeName}\n${streamUrl}`);
      }
      setPoseCoverageRefreshKey((k) => k + 1);
    } catch (e: any) {
      if (__DEV__) console.warn("[AdminTrain] Upload error", e);
      Alert.alert("Upload failed", e?.message || "Unknown error");
    } finally {
      setUploading(false);
    }
  }

  async function removeLast() {
    if (!lastId) {
      Alert.alert("Nothing", "No last upload id in this session.");
      return;
    }
    try {
      await deleteTrainVideo(lastId);
      setLastUpload((prev) => (prev?.id === lastId ? null : prev));
      setLastId(null);
      setPoseCoverageRefreshKey((k) => k + 1);
      Alert.alert("Deleted", lastId);
    } catch (e: any) {
      Alert.alert("Delete failed", e?.message || "Unknown error");
    }
  }

  const chromeBottom = (
    <View style={[styles.chromeBottomBar, { paddingBottom: Math.max(insets.bottom + 8, 14) }]}>
      <MainTabBarBackground />
      <View style={styles.chromeBottomItemWrap}>
        <NavIconAICoach color="#5B9DFF" size={22} />
        <Text style={styles.chromeBottomItem}>AI Coach</Text>
      </View>
      <View style={styles.chromeBottomItemWrap}>
        <NavIconMyCoach color="#FFFFFF" size={22} />
        <Text style={styles.chromeBottomItemActive}>My Coach</Text>
      </View>
      <View style={styles.chromeBottomItemWrap}>
        <NavIconActivities color="#5B9DFF" size={22} />
        <Text style={styles.chromeBottomItem}>Activities</Text>
      </View>
      <View style={styles.chromeBottomItemWrap}>
        <NavIconProgress color="#5B9DFF" size={22} />
        <Text style={styles.chromeBottomItem}>Progress</Text>
      </View>
      <View style={styles.chromeBottomItemWrap}>
        <NavIconYou color="#5B9DFF" size={22} />
        <Text style={styles.chromeBottomItem}>You</Text>
      </View>
    </View>
  );

  if (!unlocked) {
    return (
      <View style={styles.screen}>
        <View style={{ height: insets.top }} />
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.gateScroll, { paddingTop: 16 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={insets.bottom + 12}
        >
        <TouchableOpacity style={styles.detailBackRow} onPress={onClose} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={16} color="rgba(255,255,255,0.72)" />
          <Text style={styles.detailBackText}>Back to admin</Text>
        </TouchableOpacity>
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

  if (!showUploadEditor) {
    return (
      <View style={styles.screen}>
        <View style={{ height: insets.top }} />
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scroll, { paddingTop: 16 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={insets.bottom + 12}
        >
          <TouchableOpacity style={styles.detailBackRow} onPress={onClose} activeOpacity={0.85}>
            <Ionicons name="chevron-back" size={16} color="rgba(255,255,255,0.72)" />
            <Text style={styles.detailBackText}>Back to admin</Text>
          </TouchableOpacity>
          <Text style={styles.label}>Pose landmarks already trained</Text>
          <Text style={styles.hintBelowLabel}>
            Videos processed by the train Modal (completed + pose frames). Green highlights match these
            combos.
          </Text>
          {poseCoverageLoading ? (
            <ActivityIndicator color="#2ecc71" style={{ marginVertical: 12 }} />
          ) : null}
          {poseCoverageError ? (
            <Text style={styles.coverageErrorText}>{poseCoverageError}</Text>
          ) : null}
          {!poseCoverageLoading && !poseCoverageError && poseCoverageRows.length === 0 ? (
            <Text style={styles.coverageEmptyText}>
              No pose extractions yet for this account. Upload a clip and wait for Modal to finish.
            </Text>
          ) : null}
          {!poseCoverageLoading && poseCoverageRows.length > 0 ? (
            <View style={styles.coverageTable}>
              <View style={styles.coverageHeaderRow}>
                <Text style={[styles.coverageHeaderCell, styles.coverageColCat]}>Category</Text>
                <Text style={[styles.coverageHeaderCell, styles.coverageColStroke]}>Stroke</Text>
                <Text style={[styles.coverageHeaderCell, styles.coverageColLvl]}>Lvl</Text>
                <Text style={[styles.coverageHeaderCell, styles.coverageColView]}>View</Text>
                <Text style={[styles.coverageHeaderCell, styles.coverageColFrames]}>Frames</Text>
              </View>
              {poseCoverageRows.map((row) => (
                <View key={row.sampleId} style={styles.coverageDataRow}>
                  <Text
                    style={[styles.coverageCell, styles.coverageColCat]}
                    numberOfLines={2}
                  >
                    {categoryLabel(row.category)}
                  </Text>
                  <Text
                    style={[styles.coverageCell, styles.coverageColStroke]}
                    numberOfLines={3}
                  >
                    {presetShortLabel(row.strokePreset)}
                  </Text>
                  <Text style={[styles.coverageCell, styles.coverageColLvl]}>
                    {row.skillLevel.slice(0, 3)}
                  </Text>
                  <Text style={[styles.coverageCell, styles.coverageColView]}>{row.viewProfile}</Text>
                  <Text style={[styles.coverageCell, styles.coverageColFrames]}>
                    {row.poseFrameCount ?? "—"}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={[styles.label, { marginTop: 18 }]}>Choose training category</Text>
          <View style={styles.categoryList}>
            {TRAIN_CATEGORY_CHOICES.map((choice) => {
              const hasPose = categoryHasPoseLandmarks[choice.id] === true;
              return (
                <AdminGradientCard
                  key={choice.id}
                  style={styles.categoryCardTouch}
                  innerStyle={
                    hasPose
                      ? {
                          borderLeftWidth: 4,
                          borderLeftColor: "#2ecc71",
                          paddingLeft: 12,
                        }
                      : undefined
                  }
                  onPress={() => {
                    setCategory(choice.id);
                    setShowUploadEditor(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${choice.label}`}
                >
                  <View style={styles.categoryCardInner}>
                    <Text style={styles.categoryCardTitle}>{choice.label}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {hasPose ? (
                        <Ionicons name="checkmark-circle" size={22} color="#2ecc71" />
                      ) : null}
                      <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.35)" />
                    </View>
                  </View>
                </AdminGradientCard>
              );
            })}
          </View>
        </KeyboardAwareScrollView>
        {chromeBottom}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top }} />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: 16 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={insets.bottom + 12}
      >
        <TouchableOpacity style={styles.detailBackRow} onPress={() => setShowUploadEditor(false)} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={16} color="rgba(255,255,255,0.72)" />
          <Text style={styles.detailBackText}>Back to category</Text>
        </TouchableOpacity>
        <Text style={styles.detailScreenTitle}>{CATEGORY_SCREEN_TITLE[category]}</Text>
        <Text style={styles.label}>Select a sub-category</Text>
        <View style={styles.subCategoryPanel}>
          {CATEGORY_STROKE_CHOICES[category].map((group) => (
            <View key={group.title} style={styles.strokeGroup}>
              <Text style={styles.strokeGroupTitle}>{group.title}</Text>
              <View style={styles.pillGrid}>
                {group.items.map((item) => {
                  const active = strokePreset === item.presetId;
                  const poseReady = strokePresetHasPoseLandmarks(item.presetId);
                  return (
                    <TouchableOpacity
                      key={`${group.title}-${item.presetId}-${item.label}`}
                      style={[
                        styles.taxonomyPill,
                        poseReady && styles.taxonomyPillPoseReady,
                        active && styles.taxonomyPillActive,
                      ]}
                      onPress={() => setStrokePreset(item.presetId)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.taxonomyPillText,
                          poseReady && !active && styles.taxonomyPillTextPoseReady,
                          active && styles.taxonomyPillTextActive,
                        ]}
                        numberOfLines={3}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.label}>Level</Text>
        <View style={styles.pillGrid}>
          {TRAIN_SKILL_LEVEL_IDS.map((id) => {
            const active = skillLevel === id;
            const poseReady = skillLevelHasPoseLandmarks(id);
            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.taxonomyPill,
                  poseReady && styles.taxonomyPillPoseReady,
                  active && styles.taxonomyPillActive,
                ]}
                onPress={() => setSkillLevel(id)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.taxonomyPillText,
                    poseReady && !active && styles.taxonomyPillTextPoseReady,
                    active && styles.taxonomyPillTextActive,
                  ]}
                  numberOfLines={2}
                >
                  {formatTrainSkillLevel(id)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.label}>View profile</Text>
        <View style={styles.pillGrid}>
          {(["front", "side", "behind"] as ViewProfile[]).map((v) => {
            const active = viewProfile === v;
            const poseReady = viewProfileHasPoseLandmarks(v);
            return (
              <TouchableOpacity
                key={v}
                style={[
                  styles.taxonomyPill,
                  poseReady && styles.taxonomyPillPoseReady,
                  active && styles.taxonomyPillActive,
                ]}
                onPress={() => setViewProfile(v)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.taxonomyPillText,
                    poseReady && !active && styles.taxonomyPillTextPoseReady,
                    active && styles.taxonomyPillTextActive,
                  ]}
                >
                  {v}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={styles.secondaryBtn} onPress={pickVideo} activeOpacity={0.85}>
          <Text style={styles.secondaryBtnText}>{pickedUri ? "Change video" : "Pick video"}</Text>
        </TouchableOpacity>
        {pickedUri ? <Text style={styles.fileHint}>{pickedName}</Text> : null}
        <TouchableOpacity
          style={[styles.primaryBtn, uploading && { opacity: 0.6 }]}
          onPress={upload}
          disabled={uploading}
          activeOpacity={0.85}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Upload</Text>
          )}
        </TouchableOpacity>
        {lastUpload ? (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>Saved — last upload</Text>
            <Text style={styles.successMeta}>{lastUpload.strokeName}</Text>
            <Text style={styles.successMetaSmall}>
              {TRAIN_CATEGORIES.find((c) => c.id === lastUpload.category)?.label} ·{" "}
              {TRAIN_STROKE_PRESETS.find((s) => s.id === lastUpload.strokePreset)?.label} ·{" "}
              {formatTrainSkillLevel(lastUpload.skillLevel)} · {lastUpload.viewProfile}
            </Text>
            <Text style={styles.successMeta}>
              id <Text style={styles.successMono}>{lastUpload.id}</Text>
            </Text>
            {lastUpload.sampleId ? (
              <Text style={styles.successMeta}>
                sample: <Text style={styles.successMono}>{lastUpload.sampleId}</Text>
              </Text>
            ) : null}
            <Text style={styles.successLabel}>Stream URL (GET, no auth)</Text>
            <Text selectable style={styles.successUrl}>
              {lastUpload.streamUrl}
            </Text>
            <TouchableOpacity
              style={styles.openStreamBtn}
              onPress={() => Linking.openURL(lastUpload.streamUrl)}
              activeOpacity={0.85}
            >
              <Text style={styles.openStreamBtnText}>Open stream</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {lastId ? (
          <TouchableOpacity style={styles.dangerBtn} onPress={removeLast} activeOpacity={0.85}>
            <Text style={styles.dangerBtnText}>Delete last upload ({lastId.slice(0, 8)}…)</Text>
          </TouchableOpacity>
        ) : null}
      </KeyboardAwareScrollView>
      {chromeBottom}
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
    hintBelowLabel: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.regularFont,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
      marginBottom: 4,
    },
    strokeGroup: { marginTop: 10, gap: 6 },
    detailBackRow: {
      marginTop: 2,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      alignSelf: "flex-start",
    },
    detailBackText: {
      color: "rgba(255,255,255,0.72)",
      fontFamily: theme.mediumFont,
      fontSize: 11,
    },
    detailScreenTitle: {
      marginTop: 10,
      marginBottom: 12,
      color: theme.textColor,
      fontFamily: theme.semiBoldFont,
      fontSize: 40,
      lineHeight: 44,
    },
    chromeBottomBar: {
      position: "relative",
      overflow: "hidden",
      paddingHorizontal: 14,
      paddingTop: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    chromeBottomItemWrap: {
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      minWidth: 50,
    },
    chromeBottomItem: {
      color: "#5B9DFF",
      fontFamily: theme.mediumFont,
      fontSize: 10,
    },
    chromeBottomItemActive: {
      color: "#FFFFFF",
      fontFamily: theme.mediumFont,
      fontSize: 10,
    },
    subCategoryPanel: {
      marginTop: 10,
      borderRadius: 18,
      backgroundColor: "#041641",
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
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
    },
    secondaryBtnText: { color: "#00BBFF", fontFamily: theme.mediumFont, fontSize: 14 },
    pillGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 4,
    },
    categoryList: {
      marginTop: 6,
      gap: 10,
    },
    categoryCardTouch: {
      alignSelf: "stretch",
    },
    categoryCardInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 16,
      paddingHorizontal: 16,
    },
    categoryCardTitle: {
      color: theme.textColor,
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      textTransform: "capitalize",
    },
    taxonomyPill: {
      borderWidth: 1,
      borderColor: "transparent",
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 10,
      backgroundColor: "#00278480",
      width: "48%",
    },
    taxonomyPillHalf: {
      maxWidth: "48%",
      minWidth: "45%",
    },
    taxonomyPillActive: {
      backgroundColor: "#0034A6",
      borderColor: "#00B8FF",
      borderWidth: 1.5,
    },
    taxonomyPillText: {
      color: "#2A88F4",
      fontFamily: theme.mediumFont,
      fontSize: 12,
      lineHeight: 16,
      textAlign: "center",
    },
    taxonomyPillTextActive: {
      color: "#00B8FF",
    },
    viewProfileRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 4,
    },
    viewProfilePill: {
      borderWidth: 1,
      borderColor: "rgba(0, 187, 255, 0.45)",
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: "rgba(2, 26, 92, 0.3)",
    },
    viewProfilePillActive: {
      backgroundColor: "rgba(0, 187, 255, 0.2)",
      borderColor: "#00BBFF",
    },
    viewProfilePillText: {
      color: "rgba(255,255,255,0.75)",
      fontFamily: theme.mediumFont,
      fontSize: 13,
      textTransform: "capitalize",
    },
    viewProfilePillTextActive: {
      color: "#00BBFF",
    },
    fileHint: { color: theme.mutedForegroundColor, fontSize: 12, fontFamily: theme.regularFont },
    dangerBtn: { marginTop: 20, alignItems: "center", paddingVertical: 10 },
    dangerBtnText: { color: "#FF6B6B", fontFamily: theme.mediumFont, fontSize: 13 },
    successBox: {
      marginTop: 16,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(46, 204, 113, 0.45)",
      backgroundColor: "rgba(46, 204, 113, 0.08)",
    },
    successTitle: {
      color: "#2ecc71",
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      marginBottom: 6,
    },
    successMeta: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.regularFont,
      fontSize: 12,
      marginBottom: 10,
    },
    successMetaSmall: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.regularFont,
      fontSize: 11,
      lineHeight: 16,
      marginBottom: 10,
    },
    successMono: { fontFamily: theme.regularFont },
    successLabel: {
      color: "rgba(255,255,255,0.7)",
      fontFamily: theme.mediumFont,
      fontSize: 11,
      marginBottom: 4,
    },
    successUrl: {
      color: theme.textColor,
      fontFamily: theme.regularFont,
      fontSize: 12,
      lineHeight: 18,
    },
    openStreamBtn: {
      marginTop: 12,
      alignSelf: "flex-start",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: "rgba(46, 204, 113, 0.25)",
    },
    openStreamBtnText: {
      color: "#2ecc71",
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
    },
    coverageErrorText: {
      color: "#FF6B6B",
      fontFamily: theme.regularFont,
      fontSize: 13,
      marginBottom: 8,
    },
    coverageEmptyText: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.regularFont,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 8,
    },
    coverageTable: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(46, 204, 113, 0.35)",
      backgroundColor: "rgba(46, 204, 113, 0.06)",
      overflow: "hidden",
      marginBottom: 4,
    },
    coverageHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 8,
      backgroundColor: "rgba(46, 204, 113, 0.15)",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "rgba(46, 204, 113, 0.4)",
    },
    coverageDataRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "rgba(255,255,255,0.08)",
    },
    coverageHeaderCell: {
      color: "rgba(255,255,255,0.85)",
      fontFamily: theme.semiBoldFont,
      fontSize: 10,
      textTransform: "uppercase",
    },
    coverageCell: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.regularFont,
      fontSize: 11,
      lineHeight: 14,
    },
    coverageColCat: { flex: 1.15, paddingRight: 4 },
    coverageColStroke: { flex: 1.35, paddingRight: 4 },
    coverageColLvl: { width: 34 },
    coverageColView: { width: 44 },
    coverageColFrames: { width: 40, textAlign: "right" as const },
    taxonomyPillPoseReady: {
      backgroundColor: "rgba(46, 204, 113, 0.22)",
      borderColor: "rgba(46, 204, 113, 0.55)",
      borderWidth: 1,
    },
    taxonomyPillTextPoseReady: {
      color: "#2ecc71",
    },
  });
}
