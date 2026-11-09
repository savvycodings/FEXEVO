import type { HologramKeypoints, HologramOrbitFrame } from './hologramJob'

/**
 * MediaPipe pose for a scrub index on an orbit clip.
 * Maps by absolute frame index (0..frameCount-1), not by stretching across sparse samples —
 * stretching made the back of the turn reuse the front pose when Modal skipped mid frames.
 * Returns null when the nearest sample is too far from the scrub position.
 */
export function orbitKeypointsAt(
  frames: HologramOrbitFrame[] | null | undefined,
  index: number,
  frameCount: number
): HologramKeypoints | null {
  if (!frames?.length) return null
  const last = Math.max(frameCount - 1, 1)
  const target = Math.round(Math.max(0, Math.min(1, index / last)) * last)
  let best = frames[0]!
  let dist = Math.abs(best.frame - target)
  for (const row of frames) {
    const d = Math.abs(row.frame - target)
    if (d < dist) {
      best = row
      dist = d
    }
  }
  const maxGap = Math.max(5, Math.round(last * 0.05))
  if (dist > maxGap) return null
  return best.keypoints
}

/** Same mapping for joint overlay presets that scrub by 0..1 fraction of the turn. */
export function orbitKeypointsAtFraction(
  frames: HologramOrbitFrame[] | null | undefined,
  fraction: number,
  frameCount: number | null | undefined
): HologramKeypoints | null {
  if (!frames?.length) return null
  const last = Math.max((frameCount ?? frames[frames.length - 1]!.frame) - 0, 1)
  const index = Math.round(Math.max(0, Math.min(1, fraction)) * last)
  return orbitKeypointsAt(frames, index, last + 1)
}
