import { angleDeg, landmarkVisOk } from '../../lib/poseJointAngles'
import type { LandmarkPoint, PoseFrameRow } from '../../lib/techniquePose'

export const TIMELINE_SAMPLES = 12

export type TimelineId = 'shoulder' | 'elbow' | 'racket' | 'hip'

export type TimelineSeries = Record<TimelineId, (number | null)[]>

function point(frame: PoseFrameRow, name: string): { x: number; y: number } | null {
  const p = frame.landmarks[name] as LandmarkPoint | undefined
  if (!landmarkVisOk(p)) return null
  return { x: p!.x, y: p!.y }
}

function included(frame: PoseFrameRow, a: string, b: string, c: string): number | null {
  const pa = point(frame, a)
  const pb = point(frame, b)
  const pc = point(frame, c)
  if (!pa || !pb || !pc) return null
  return angleDeg(pa, pb, pc)
}

/** Wrist-to-index tilt, folded into 0–180°. A stand-in for racket-face angle. */
function racketTilt(frame: PoseFrameRow, side: 'LEFT' | 'RIGHT'): number | null {
  const wrist = point(frame, `${side}_WRIST`)
  const index = point(frame, `${side}_INDEX`)
  if (!wrist || !index) return null
  const dx = index.x - wrist.x
  const dy = index.y - wrist.y
  if (Math.hypot(dx, dy) < 1e-4) return null
  return Math.min(180, Math.abs((Math.atan2(dx, -dy) * 180) / Math.PI))
}

function dominantSide(frames: PoseFrameRow[]): 'LEFT' | 'RIGHT' {
  let left = 0
  let right = 0
  for (const frame of frames) {
    if (frame.racket_hand === 'left') left += 2
    if (frame.racket_hand === 'right') right += 2
    if (landmarkVisOk(frame.landmarks.LEFT_WRIST)) left += 1
    if (landmarkVisOk(frame.landmarks.RIGHT_WRIST)) right += 1
  }
  return left > right ? 'LEFT' : 'RIGHT'
}

function nearest(frames: PoseFrameRow[], target: number): PoseFrameRow {
  let best = frames[0]!
  let bestD = Math.abs(best.frame - target)
  for (const frame of frames) {
    const d = Math.abs(frame.frame - target)
    if (d < bestD) {
      best = frame
      bestD = d
    }
  }
  return best
}

export function sampleMovementTimeline(frames: PoseFrameRow[]): TimelineSeries {
  const blank = (): (number | null)[] => Array.from({ length: TIMELINE_SAMPLES }, () => null)
  const series: TimelineSeries = {
    shoulder: blank(),
    elbow: blank(),
    racket: blank(),
    hip: blank(),
  }
  if (frames.length < 2) return series
  const side = dominantSide(frames)
  const first = frames[0]!.frame
  const last = frames[frames.length - 1]!.frame
  const span = Math.max(1, last - first)
  for (let i = 0; i < TIMELINE_SAMPLES; i++) {
    const frame = nearest(frames, first + (span * i) / (TIMELINE_SAMPLES - 1))
    series.shoulder[i] = included(frame, `${side}_ELBOW`, `${side}_SHOULDER`, `${side}_HIP`)
    series.elbow[i] = included(frame, `${side}_SHOULDER`, `${side}_ELBOW`, `${side}_WRIST`)
    series.hip[i] = included(frame, `${side}_SHOULDER`, `${side}_HIP`, `${side}_KNEE`)
    series.racket[i] = racketTilt(frame, side)
  }
  return series
}

export function impactSampleIndex(frames: PoseFrameRow[], impactFrame: number | null): number {
  const fallback = Math.round((TIMELINE_SAMPLES - 1) * 0.62)
  if (impactFrame == null || frames.length < 2) return fallback
  const first = frames[0]!.frame
  const last = frames[frames.length - 1]!.frame
  const t = (impactFrame - first) / Math.max(1, last - first)
  return Math.max(0, Math.min(TIMELINE_SAMPLES - 1, Math.round(t * (TIMELINE_SAMPLES - 1))))
}

export function seriesHasPoints(values: (number | null)[]): boolean {
  return values.some((value) => value != null)
}
