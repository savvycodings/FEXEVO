import i18n from "i18next";
import type { TrainCategory, TrainStrokePreset } from "../lib/train-taxonomy";

export function trainCategoryTranslationKey(id: TrainCategory | string): string {
  return `pillars.${id}`;
}

export function trainCategoryLabel(id: TrainCategory | string): string {
  const key = trainCategoryTranslationKey(id);
  return i18n.exists(key) ? i18n.t(key) : id.replace(/_/g, " ");
}

export function trainStrokeTranslationKey(preset: TrainStrokePreset | string): string {
  return `trainStrokes.${preset}`;
}

export function trainStrokeLabelTranslated(preset: TrainStrokePreset | string): string {
  const key = trainStrokeTranslationKey(preset);
  return i18n.exists(key) ? i18n.t(key) : preset.replace(/_/g, " ");
}

export function pillarTwoLineLabels(id: string): { labelTop: string; labelBottom: string } {
  const topKey = `pillars.${id}Top`;
  const bottomKey = `pillars.${id}Bottom`;
  if (i18n.exists(topKey) && i18n.exists(bottomKey)) {
    return { labelTop: i18n.t(topKey), labelBottom: i18n.t(bottomKey) };
  }
  const full = trainCategoryLabel(id);
  const parts = full.split(/\s+/, 2);
  return { labelTop: parts[0] ?? full, labelBottom: parts[1] ?? "" };
}
