import { trainStrokeLabel, type TrainStrokePreset } from "./train-taxonomy";
import i18n from "../i18n";
import { trainStrokeLabelTranslated } from "../i18n/taxonomyLabels";

const LEVEL_SUFFIXES = / · (Beginner|Intermediate|Advanced)$/;

/**
 * Drop train-library clip indices from admin labels ("Bandeja 1" → "Bandeja").
 */
export function stripTrainClipIndexSuffix(label: string): string {
  const t = label.trim();
  if (!t) return t;
  const stripped = t
    .replace(/\s*[#._-]\s*\d+\s*$/i, "")
    .replace(/\s+\d+\s*$/i, "")
    .trim();
  return stripped || t;
}

/** Title for UI: admin shot label, not strokePreset enum. */
export function displayTrainShotTitle(opts: {
  strokeLabel?: string | null;
  strokeName?: string | null;
  strokePreset?: string | null;
}): string {
  const label = (opts.strokeLabel ?? "").trim();
  if (label) return stripTrainClipIndexSuffix(label);
  const name = (opts.strokeName ?? "").trim();
  if (name) {
    const stripped = stripTrainClipIndexSuffix(name.replace(LEVEL_SUFFIXES, "").trim());
    if (stripped) return stripped;
  }
  const preset = (opts.strokePreset ?? "").trim();
  if (preset) {
    const key = `trainStrokes.${preset}`;
    if (i18n.exists(key)) return trainStrokeLabelTranslated(preset);
    return trainStrokeLabel(preset as TrainStrokePreset);
  }
  return i18n.t("common.shot");
}

/** Read human shot title from saved analysis metrics (Activities detail). */
export function humanShotLabelFromStoredMetrics(
  metrics: Record<string, unknown> | null | undefined
): string | null {
  if (!metrics || typeof metrics !== "object") return null;

  const retrieval = metrics.retrieval as Record<string, unknown> | undefined;
  const hyp = retrieval?.shot_hypothesis as Record<string, unknown> | undefined;
  if (typeof hyp?.stroke_label === "string" && hyp.stroke_label.trim()) {
    const sl = stripTrainClipIndexSuffix(hyp.stroke_label);
    if (!/^[a-z0-9]+(_[a-z0-9]+)+$/.test(sl)) return sl;
  }

  const neighbors = Array.isArray(retrieval?.neighbors)
    ? (retrieval.neighbors as Array<Record<string, unknown>>)
    : [];
  for (const n of neighbors.slice(0, 6)) {
    if (typeof n.stroke_label === "string" && n.stroke_label.trim()) {
      return stripTrainClipIndexSuffix(n.stroke_label);
    }
    const strokeName = typeof n.stroke_name === "string" ? n.stroke_name.trim() : "";
    if (strokeName) {
      const stripped = stripTrainClipIndexSuffix(strokeName.replace(LEVEL_SUFFIXES, "").trim());
      if (stripped && !/^[a-z0-9]+(_[a-z0-9]+)+$/.test(stripped)) return stripped;
    }
  }

  return null;
}
