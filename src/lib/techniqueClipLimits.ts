/** Max motion window sent to Modal / scoring per user clip (AI Coach step 2). */
export const MAX_ANALYZE_CLIP_MS = 3000

export const MIN_ANALYZE_CLIP_MS = 500

export function clampClipRangeMs(
  startMs: number,
  endMs: number,
  videoDurationMs: number,
  opts?: { maxDurationMs?: number; minDurationMs?: number }
): { startMs: number; endMs: number } {
  const minDur = opts?.minDurationMs ?? MIN_ANALYZE_CLIP_MS
  const maxDur = opts?.maxDurationMs ?? MAX_ANALYZE_CLIP_MS
  const total = Math.max(0, Math.round(videoDurationMs))
  if (total <= 0) return { startMs: 0, endMs: 0 }

  let end = Math.round(Math.max(0, Math.min(total, endMs)))
  let start = Math.round(Math.max(0, Math.min(end, startMs)))
  if (end - start < minDur) {
    start = Math.max(0, end - minDur)
    if (end - start < minDur) end = Math.min(total, start + minDur)
  }
  if (end - start > maxDur) {
    start = end - maxDur
  }
  return { startMs: start, endMs: end }
}
