import { angleDeg, landmarkVisOk } from "./poseJointAngles";
import type { LandmarkPoint, PoseFrameRow } from "./techniquePose";

export type ChainSegment = "legs" | "hips" | "torso" | "arm" | "racket";
export type ChainStatus = "onTime" | "early" | "late";

export type SegmentTiming = {
  id: ChainSegment;
  /** Seconds relative to contact (negative = before). Null when the segment never clearly moved. */
  startS: number | null;
  peakS: number | null;
  /** Ideal Form peak (always available — reference kinetic chain). */
  idealPeakS: number;
  /** you.peakS − idealPeakS; positive = late. */
  deltaS: number | null;
  /** Against Ideal Form peak timing (Figma Your Timing vs Ideal Form). */
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

/**
 * Ideal Form peak times relative to contact (Figma 6196:105815).
 * Always shown in the Pro column — these are the reference kinetic chain.
 */
export const IDEAL_PEAK_S: Record<ChainSegment, number> = {
  legs: -0.42,
  hips: -0.28,
  torso: -0.18,
  arm: -0.1,
  racket: -0.0,
};

/** Within this of ideal = On Time. */
const IDEAL_SLACK_S = 0.015;

/** How far before and after contact to look for each segment's burst. */
const WINDOW_BEFORE_S = 1;
const WINDOW_AFTER_S = 0.25;
/** A segment "starts" when its speed first rises past this share of its peak. */
const START_SHARE = 0.25;
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
    const idealPeakS = IDEAL_PEAK_S[id];
    const peakS = b ? rel(b.peak) : null;
    const deltaS =
      peakS != null ? Math.round((peakS - idealPeakS) * 100) / 100 : null;
    let status: ChainStatus | null = null;
    if (deltaS != null) {
      if (deltaS > IDEAL_SLACK_S) status = "late";
      else if (deltaS < -IDEAL_SLACK_S) status = "early";
      else status = "onTime";
    }
    return {
      id,
      startS: b ? rel(b.start) : null,
      peakS,
      idealPeakS,
      deltaS,
      status,
    };
  });
  if (out.every((s) => s.peakS == null)) return null;
  return out;
}

/** Ideal-only rows when pose timing is unavailable — Pro column always has values. */
export function idealChainTiming(): SegmentTiming[] {
  return CHAIN_ORDER.map((id) => ({
    id,
    startS: null,
    peakS: null,
    idealPeakS: IDEAL_PEAK_S[id],
    deltaS: null,
    status: null,
  }));
}
