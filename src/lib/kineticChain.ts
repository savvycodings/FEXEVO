import { angleDeg, landmarkVisOk } from "./poseJointAngles";
import type { LandmarkPoint, PoseFrameRow } from "./techniquePose";

export type ChainSegment = "legs" | "hips" | "torso" | "arm" | "racket";
export type ChainStatus = "onTime" | "early" | "late";

export type SegmentTiming = {
  id: ChainSegment;
  /** Seconds relative to contact (negative = before). Null when the segment never clearly moved. */
  startS: number | null;
  peakS: number | null;
  /** Against the proximal-to-distal order: each segment should peak after the one before it. */
  status: ChainStatus | null;
};

/** Legs drive first, the racket last. */
export const CHAIN_ORDER: ChainSegment[] = [
  "legs",
  "hips",
  "torso",
  "arm",
  "racket",
];

/** How far before and after contact to look for each segment's burst. */
const WINDOW_BEFORE_S = 1;
const WINDOW_AFTER_S = 0.25;
/** A segment "starts" when its speed first rises past this share of its peak. */
const START_SHARE = 0.25;
/** Peaks closer than this count as together, not out of order. */
const ORDER_SLACK_S = 0.02;

type Pt = { x: number; y: number };

function point(lm: Record<string, LandmarkPoint>, name: string): Pt | null {
  const p = lm[name];
  return landmarkVisOk(p) ? { x: p!.x, y: p!.y } : null;
}

/** Angle of the line a → b in the image, in degrees. */
function lineAngle(a: Pt | null, b: Pt | null): number | null {
  if (!a || !b) return null;
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/** Per-frame raw value for each segment. Angles in degrees; the racket is the wrist position. */
function sample(row: PoseFrameRow, side: "LEFT" | "RIGHT") {
  const lm = row.landmarks;
  const S = side;
  const tri = (a: string, b: string, c: string) => {
    const pa = point(lm, a);
    const pb = point(lm, b);
    const pc = point(lm, c);
    return pa && pb && pc ? angleDeg(pa, pb, pc) : null;
  };
  const knees = [
    tri("LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"),
    tri("RIGHT_HIP", "RIGHT_KNEE", "RIGHT_ANKLE"),
  ].filter((v): v is number => v != null);
  const sh = point(lm, `${S}_SHOULDER`);
  const hip = point(lm, `${S}_HIP`);
  return {
    legs: knees.length ? knees.reduce((a, b) => a + b, 0) / knees.length : null,
    hips: lineAngle(point(lm, "LEFT_HIP"), point(lm, "RIGHT_HIP")),
    torso: lineAngle(point(lm, "LEFT_SHOULDER"), point(lm, "RIGHT_SHOULDER")),
    arm: tri(`${S}_SHOULDER`, `${S}_ELBOW`, `${S}_WRIST`),
    wrist: point(lm, `${S}_WRIST`),
    /** Shoulder-to-hip length, to put wrist speed in body lengths. */
    scale: sh && hip ? Math.hypot(sh.x - hip.x, sh.y - hip.y) : null,
  };
}

/** Unwrap a run of line angles so a turn past ±180° doesn't read as a jump. */
function unwrap(values: (number | null)[]): (number | null)[] {
  let prev: number | null = null;
  let offset = 0;
  return values.map((v) => {
    if (v == null) return null;
    if (prev != null) {
      const d = v + offset - prev;
      if (d > 180) offset -= 360;
      else if (d < -180) offset += 360;
    }
    prev = v + offset;
    return prev;
  });
}

function smooth(values: (number | null)[]): (number | null)[] {
  return values.map((v, i) => {
    if (v == null) return null;
    const near = [values[i - 1], v, values[i + 1]].filter(
      (x): x is number => x != null,
    );
    return near.reduce((a, b) => a + b, 0) / near.length;
  });
}

/** Speed between neighbouring samples, per second. `extendOnly` keeps opening joints only. */
function speeds(
  values: (number | null)[],
  frames: number[],
  fps: number,
  extendOnly: boolean,
): (number | null)[] {
  return values.map((v, i) => {
    const a = values[i - 1];
    const b = values[i + 1];
    if (v == null || a == null || b == null) return null;
    const dt = (frames[i + 1]! - frames[i - 1]!) / fps;
    if (dt <= 0) return null;
    const rate = (b - a) / dt;
    return extendOnly ? Math.max(0, rate) : Math.abs(rate);
  });
}

/** Peak inside the window, then walk back to where the burst began. */
function burst(
  speed: (number | null)[],
  frames: number[],
  from: number,
  to: number,
) {
  let peakIdx = -1;
  for (let i = 0; i < speed.length; i++) {
    const f = frames[i]!;
    const v = speed[i];
    if (f < from || f > to || v == null) continue;
    if (peakIdx < 0 || v > (speed[peakIdx] ?? 0)) peakIdx = i;
  }
  if (peakIdx < 0 || !(speed[peakIdx]! > 0)) return null;
  const floor = speed[peakIdx]! * START_SHARE;
  let startIdx = peakIdx;
  while (
    startIdx > 0 &&
    frames[startIdx - 1]! >= from &&
    (speed[startIdx - 1] ?? 0) > floor
  )
    startIdx--;
  return { start: frames[startIdx]!, peak: frames[peakIdx]! };
}

/**
 * When each segment of the chain starts and peaks, from the player's own pose. Joints use how
 * fast they open (knees, elbow), the hips and shoulders how fast their line turns, and the racket
 * how fast the hitting wrist moves.
 */
export function kineticChainTiming(
  frames: PoseFrameRow[],
  impactFrame: number | null,
  fps: number | null,
  side: "LEFT" | "RIGHT",
): SegmentTiming[] | null {
  if (frames.length < 5) return null;
  const rate = fps && fps > 0 ? fps : 30;
  const rows = [...frames].sort((a, b) => a.frame - b.frame);
  const idx = rows.map((r) => r.frame);
  const first = idx[0]!;
  const last = idx[idx.length - 1]!;
  const impact =
    impactFrame != null && impactFrame >= first && impactFrame <= last
      ? impactFrame
      : null;
  if (impact == null) return null;
  const from = impact - WINDOW_BEFORE_S * rate;
  const to = impact + WINDOW_AFTER_S * rate;

  const raw = rows.map((r) => sample(r, side));
  const series: Record<ChainSegment, (number | null)[]> = {
    legs: speeds(smooth(raw.map((s) => s.legs)), idx, rate, true),
    hips: speeds(smooth(unwrap(raw.map((s) => s.hips))), idx, rate, false),
    torso: speeds(smooth(unwrap(raw.map((s) => s.torso))), idx, rate, false),
    arm: speeds(smooth(raw.map((s) => s.arm)), idx, rate, true),
    racket: smooth(
      raw.map((s, i) => {
        const a = raw[i - 1]?.wrist;
        const b = raw[i + 1]?.wrist;
        const scale = s.scale;
        if (!a || !b || !scale) return null;
        const dt = (idx[i + 1]! - idx[i - 1]!) / rate;
        return dt > 0 ? Math.hypot(b.x - a.x, b.y - a.y) / scale / dt : null;
      }),
    ),
  };

  const rel = (frame: number) =>
    Math.round(((frame - impact) / rate) * 100) / 100;
  const out: SegmentTiming[] = CHAIN_ORDER.map((id) => {
    const b = burst(series[id], idx, from, to);
    return {
      id,
      startS: b ? rel(b.start) : null,
      peakS: b ? rel(b.peak) : null,
      status: null,
    };
  });
  if (out.every((s) => s.peakS == null)) return null;

  // Judge each segment against the one before it, so one swap flags one segment. The legs have
  // nothing before them: they're late when the hips beat them.
  return out.map((s, i) => {
    if (s.peakS == null) return s
    const prev = out[i - 1]?.peakS
    const next = out[i + 1]?.peakS
    if (prev != null && s.peakS < prev - ORDER_SLACK_S) return { ...s, status: 'early' }
    if (i === 0 && next != null && s.peakS > next + ORDER_SLACK_S) return { ...s, status: 'late' }
    return { ...s, status: 'onTime' }
  })
}
