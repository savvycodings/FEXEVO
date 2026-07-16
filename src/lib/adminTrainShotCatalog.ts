/**
 * Admin Train upload shot list (category + label → strokePreset).
 * `label` is the human shot title (stored as train_video.strokeLabel).
 * `presetId` is the coarse ML/taxonomy bucket only — many distinct shots share one preset.
 * UI must show `label`, not presetId. Keep presetIds within `TrainStrokePreset` / DB enum.
 */
import type { TrainCategory, TrainStrokePreset } from "./train-taxonomy";

export type AdminTrainShotItem = {
  label: string;
  presetId: TrainStrokePreset;
};

/** Category picker on the Admin Train hub screen. */
export const ADMIN_TRAIN_CATEGORY_CHOICES: { id: TrainCategory; label: string }[] = [
  { id: "save_return", label: "Serve & Return" },
  { id: "ground_strokes", label: "Groundstrokes" },
  { id: "net_play", label: "Net Play" },
  { id: "defence_glass", label: "Defense & Glass" },
  { id: "overhead", label: "Overheads" },
];

export const ADMIN_TRAIN_SCREEN_TITLE: Record<TrainCategory, string> = {
  save_return: "Serve & Return",
  ground_strokes: "Groundstrokes",
  net_play: "Net Play",
  defence_glass: "Defense & Glass",
  overhead: "Overheads",
  tactical_specials: "Tactical & Specials",
};

/** All upload shots per category (order matches ops spreadsheet). */
export const ADMIN_TRAIN_SHOTS_BY_CATEGORY: Record<
  TrainCategory,
  readonly AdminTrainShotItem[]
> = {
  save_return: [
    { label: "Forehand Return", presetId: "forehand_return_with_lob" },
    { label: "Forehand Return with lob", presetId: "forehand_return_with_lob" },
    { label: "Backhand Return", presetId: "backhand_return" },
    { label: "Backhand Return with lob", presetId: "backhand_return_with_lob" },
    { label: "Forehand Return glass", presetId: "side_wall_forehand" },
    { label: "backhand Return glass", presetId: "side_wall_backhand" },
  ],
  ground_strokes: [
    { label: "Forehand Drive 1", presetId: "forehand_drive" },
    { label: "Backhand Drive", presetId: "backhand_drive" },
    { label: "Forehand Lob", presetId: "forehand_lob" },
    { label: "Backhand Lob 1", presetId: "backhand_lob" },
    { label: "forehand chiquita", presetId: "forehand_chiquita" },
    { label: "Chiquita revez", presetId: "backhand_drive" },
    { label: "Half Volley (BH) 1", presetId: "half_volley" },
    { label: "Half Volley (FH) 1", presetId: "half_volley" },
  ],
  net_play: [
    { label: "Forehand Volley", presetId: "forehand_volley" },
    { label: "Backhand Volley 1", presetId: "backhand_volley" },
    { label: "Forehand Half Volley", presetId: "half_volley" },
    { label: "Backhand Half Volley", presetId: "half_volley" },
    { label: "Drop Shot backhand", presetId: "contrapared_boast" },
    { label: "Drop Shot forehand", presetId: "contrapared_boast" },
    { label: "Block Volley (FH)", presetId: "half_volley" },
    { label: "Block Volley (BH)", presetId: "half_volley" },
  ],
  defence_glass: [
    { label: "Back Wall Forehand Lob after wall", presetId: "back_wall_forehand" },
    { label: "Back Wall backhand Lob after wall", presetId: "back_wall_backhand" },
    { label: "Back Wall Forehand low", presetId: "back_wall_forehand" },
    { label: "Back Wall Backhand 1", presetId: "back_wall_backhand" },
    { label: "double  back Wall forehand low", presetId: "back_wall_forehand" },
    { label: "double  back Wall backhand lob", presetId: "back_wall_backhand" },
    { label: "Side Wall Forehand", presetId: "side_wall_forehand" },
    { label: "Side Wall Backhand", presetId: "side_wall_backhand" },
    { label: "Double Wall Recovery right side low", presetId: "side_wall_backhand" },
    { label: "Double Wall Recovery forehand lob", presetId: "side_wall_forehand" },
    { label: "Double Wall backhand low", presetId: "back_wall_backhand" },
    { label: "Contrapared forehand", presetId: "contrapared_boast" },
    { label: "Contrapared backhand", presetId: "contrapared_boast" },
  ],
  overhead: [
    { label: "Bandeja (jump)", presetId: "bandeja" },
    { label: "Bandeja 1", presetId: "bandeja" },
    { label: "Vibora", presetId: "backhand_volley" },
    { label: "Gancho", presetId: "forehand_chiquita" },
    { label: "Flat Smash", presetId: "forehand_drive" },
    { label: "Topspin Smash 1", presetId: "forehand_drive" },
    { label: "Por Cuatro Smash", presetId: "forehand_lob" },
    { label: "Rulo", presetId: "backhand_return" },
  ],
  tactical_specials: [],
};
