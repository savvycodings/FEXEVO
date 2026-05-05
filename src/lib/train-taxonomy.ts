/**
 * Shared train upload taxonomy (AI Coach → Admin → Pro library / Train upload).
 * Keep in sync with `server/src/db/schema.ts` train_stroke_preset enum and
 * `server/src/train/trainRouter.ts` allowlists.
 */

export type TrainCategory =
  | "ground_strokes"
  | "net_play"
  | "defence_glass"
  | "save_return"
  | "overhead"
  | "tactical_specials";

export type TrainStrokePreset =
  | "forehand_drive"
  | "backhand_drive"
  | "forehand_lob"
  | "backhand_lob"
  | "backhand_volley"
  | "forehand_volley"
  | "backhand_return"
  | "backhand_return_with_lob"
  | "forehand_return_with_lob"
  | "backhand_drive_with_wall"
  | "forehand_chiquita"
  | "half_volley"
  | "back_wall_backhand"
  | "back_wall_forehand"
  | "contrapared_boast"
  | "side_wall_backhand"
  | "side_wall_forehand"
  | "bandeja";

export type TrainCategoryDef = {
  id: TrainCategory;
  label: string;
  /** Two-letter code for Progress section titles (e.g. SR · Save & return). */
  progressCode: string;
};

export const TRAIN_CATEGORIES: TrainCategoryDef[] = [
  { id: "ground_strokes", label: "Ground strokes", progressCode: "GS" },
  { id: "net_play", label: "Net play", progressCode: "NP" },
  { id: "defence_glass", label: "Defence & glass", progressCode: "DG" },
  { id: "save_return", label: "Save & return", progressCode: "SR" },
  { id: "overhead", label: "Overhead", progressCode: "OH" },
  { id: "tactical_specials", label: "Tactical specials", progressCode: "TS" },
];

export const TRAIN_STROKE_PRESETS: { id: TrainStrokePreset; label: string }[] = [
  { id: "forehand_drive", label: "Forehand drive" },
  { id: "backhand_drive", label: "Backhand drive" },
  { id: "forehand_lob", label: "Forehand lob" },
  { id: "backhand_lob", label: "Backhand lob" },
  { id: "forehand_chiquita", label: "Forehand chiquita" },
  { id: "backhand_drive_with_wall", label: "Backhand drive (wall)" },
  { id: "forehand_volley", label: "Forehand volley" },
  { id: "backhand_volley", label: "Backhand volley" },
  { id: "half_volley", label: "Half volley" },
  { id: "backhand_return", label: "Backhand return" },
  { id: "backhand_return_with_lob", label: "Backhand return with lob" },
  { id: "forehand_return_with_lob", label: "Forehand return with lob" },
  { id: "back_wall_backhand", label: "Back wall backhand" },
  { id: "back_wall_forehand", label: "Back wall forehand" },
  { id: "side_wall_backhand", label: "Side wall backhand" },
  { id: "side_wall_forehand", label: "Side wall forehand" },
  { id: "contrapared_boast", label: "Contrapared boast" },
  { id: "bandeja", label: "Bandeja" },
];

/**
 * UI grouping for admin stroke picker (every preset appears once).
 * Category is chosen separately; pick the stroke that best describes the clip.
 */
export const TRAIN_STROKE_PRESET_GROUPS: {
  title: string;
  presetIds: readonly TrainStrokePreset[];
}[] = [
  {
    title: "Drives & lobs",
    presetIds: [
      "forehand_drive",
      "backhand_drive",
      "forehand_lob",
      "backhand_lob",
      "forehand_chiquita",
      "backhand_drive_with_wall",
    ],
  },
  {
    title: "Net",
    presetIds: ["forehand_volley", "backhand_volley", "half_volley"],
  },
  {
    title: "Returns",
    presetIds: ["backhand_return", "backhand_return_with_lob", "forehand_return_with_lob"],
  },
  {
    title: "Walls & glass",
    presetIds: [
      "back_wall_backhand",
      "back_wall_forehand",
      "side_wall_backhand",
      "side_wall_forehand",
      "contrapared_boast",
    ],
  },
  {
    title: "Overhead",
    presetIds: ["bandeja"],
  },
];

export function trainStrokeLabel(id: TrainStrokePreset): string {
  return TRAIN_STROKE_PRESETS.find((p) => p.id === id)?.label ?? id;
}

export function trainStrokePresetById(id: TrainStrokePreset): { id: TrainStrokePreset; label: string } | undefined {
  return TRAIN_STROKE_PRESETS.find((p) => p.id === id);
}
