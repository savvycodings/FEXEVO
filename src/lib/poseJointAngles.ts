import type { LandmarkPoint } from './techniquePose'

export type Pt2 = { x: number; y: number }

/** Interior angle at `b` for points a–b–c, in degrees (2D image plane). Matches server biomechanicsSummary. */
export function angleDeg(a: Pt2, b: Pt2, c: Pt2): number | null {
  const bax = a.x - b.x
  const bay = a.y - b.y
  const bcx = c.x - b.x
  const bcy = c.y - b.y
  const denom = Math.hypot(bax, bay) * Math.hypot(bcx, bcy)
  if (denom < 1e-8) return null
  let cos = (bax * bcx + bay * bcy) / denom
  cos = Math.max(-1, Math.min(1, cos))
  return (Math.acos(cos) * 180) / Math.PI
}

export const JOINT_VISIBILITY_MIN = 0.5

export function landmarkVisOk(
  lm: LandmarkPoint | undefined,
  minVis = JOINT_VISIBILITY_MIN
): boolean {
  if (!lm || typeof lm.x !== 'number' || typeof lm.y !== 'number') return false
  if (!Number.isFinite(lm.x) || !Number.isFinite(lm.y)) return false
  const v = lm.visibility
  if (typeof v === 'number' && Number.isFinite(v) && v < minVis) return false
  return true
}

/** Light EMA so scrubbed degrees don’t flicker. */
export function emaAngle(
  prev: number | null | undefined,
  next: number | null,
  alpha = 0.35
): number | null {
  if (next == null || !Number.isFinite(next)) return prev ?? null
  if (prev == null || !Number.isFinite(prev)) return next
  return prev * (1 - alpha) + next * alpha
}

export type JointAngleKind = 'elbow' | 'knee' | 'shoulder' | 'wrist' | 'torso' | 'head' | 'ankle' | 'racket'

export type JointAngleDef = {
  id: string
  kind: JointAngleKind
  /** MediaPipe names: proximal, vertex, distal */
  a: string
  b: string
  c: string
  color: string
}

/** Included angles drawn on overlay (mock-aligned). */
export const OVERLAY_JOINT_ANGLES: JointAngleDef[] = [
  {
    id: 'LEFT_ELBOW',
    kind: 'elbow',
    a: 'LEFT_SHOULDER',
    b: 'LEFT_ELBOW',
    c: 'LEFT_WRIST',
    color: '#34C759',
  },
  {
    id: 'RIGHT_ELBOW',
    kind: 'elbow',
    a: 'RIGHT_SHOULDER',
    b: 'RIGHT_ELBOW',
    c: 'RIGHT_WRIST',
    color: '#34C759',
  },
  {
    id: 'LEFT_KNEE',
    kind: 'knee',
    a: 'LEFT_HIP',
    b: 'LEFT_KNEE',
    c: 'LEFT_ANKLE',
    color: '#34C759',
  },
  {
    id: 'RIGHT_KNEE',
    kind: 'knee',
    a: 'RIGHT_HIP',
    b: 'RIGHT_KNEE',
    c: 'RIGHT_ANKLE',
    color: '#34C759',
  },
  {
    id: 'LEFT_SHOULDER',
    kind: 'shoulder',
    a: 'LEFT_ELBOW',
    b: 'LEFT_SHOULDER',
    c: 'LEFT_HIP',
    color: '#FFD400',
  },
  {
    id: 'RIGHT_SHOULDER',
    kind: 'shoulder',
    a: 'RIGHT_ELBOW',
    b: 'RIGHT_SHOULDER',
    c: 'RIGHT_HIP',
    color: '#FFD400',
  },
]

/** Wrist bend, elbow–wrist–index, as the server measures it. Only drawn when asked for by id. */
export const WRIST_JOINT_ANGLES: JointAngleDef[] = (['LEFT', 'RIGHT'] as const).map((side) => ({
  id: `${side}_WRIST`,
  kind: 'wrist',
  a: `${side}_ELBOW`,
  b: `${side}_WRIST`,
  c: `${side}_INDEX`,
  color: '#FF2D55',
}))

/** Head tilt, ear–nose–shoulder (the server's body-mobility head angle). Only drawn when asked for by id. */
export const HEAD_JOINT_ANGLES: JointAngleDef[] = (['LEFT', 'RIGHT'] as const).map((side) => ({
  id: `${side}_HEAD`,
  kind: 'head',
  a: `${side}_EAR`,
  b: 'NOSE',
  c: `${side}_SHOULDER`,
  color: '#34C759',
}))

/** Ankle bend, knee–ankle–toe. Only drawn when asked for by id. */
export const ANKLE_JOINT_ANGLES: JointAngleDef[] = (['LEFT', 'RIGHT'] as const).map((side) => ({
  id: `${side}_ANKLE`,
  kind: 'ankle',
  a: `${side}_KNEE`,
  b: `${side}_ANKLE`,
  c: `${side}_FOOT_INDEX`,
  color: '#00E5FF',
}))

/** Id prefix of the racket-tilt reading (wrist to index finger, from vertical): `RACKET_LEFT` / `RACKET_RIGHT`. */
export const RACKET_ANGLE_ID = 'RACKET'

/** Id of the trunk-lean reading (hips to shoulders, from vertical). */
export const TORSO_ANGLE_ID = 'TORSO'

/** Joint marker colors (mock). */
export const JOINT_DOT_COLOR: Record<string, string> = {
  LEFT_SHOULDER: '#FFD400',
  RIGHT_SHOULDER: '#FFD400',
  LEFT_ELBOW: '#34C759',
  RIGHT_ELBOW: '#34C759',
  LEFT_WRIST: '#FF2D55',
  RIGHT_WRIST: '#FF2D55',
  LEFT_HIP: '#00E5FF',
  RIGHT_HIP: '#00E5FF',
  LEFT_KNEE: '#34C759',
  RIGHT_KNEE: '#34C759',
  LEFT_ANKLE: '#00E5FF',
  RIGHT_ANKLE: '#00E5FF',
  NOSE: '#34C759',
}

export const OVERLAY_JOINT_DOT_NAMES = Object.keys(JOINT_DOT_COLOR)

export type ComputedJointAngle = {
  id: string
  kind: JointAngleKind
  deg: number
  color: string
  a: Pt2
  b: Pt2
  c: Pt2
}

export function computeOverlayJointAngles(
  getPx: (name: string) => Pt2 | null,
  landmarks: Record<string, LandmarkPoint>,
  minVis = JOINT_VISIBILITY_MIN,
  defs: JointAngleDef[] = OVERLAY_JOINT_ANGLES
): ComputedJointAngle[] {
  const out: ComputedJointAngle[] = []
  for (const def of defs) {
    if (
      !landmarkVisOk(landmarks[def.a], minVis) ||
      !landmarkVisOk(landmarks[def.b], minVis) ||
      !landmarkVisOk(landmarks[def.c], minVis)
    ) {
      continue
    }
    const pa = getPx(def.a)
    const pb = getPx(def.b)
    const pc = getPx(def.c)
    if (!pa || !pb || !pc) continue
    const deg = angleDeg(pa, pb, pc)
    if (deg == null || !Number.isFinite(deg)) continue
    out.push({
      id: def.id,
      kind: def.kind,
      deg,
      color: def.color,
      a: pa,
      b: pb,
      c: pc,
    })
  }
  return out
}

/** SVG arc path between directions vertex→a and vertex→c. */
export function jointArcSvgPath(
  vertex: Pt2,
  pA: Pt2,
  pC: Pt2,
  radius: number
): string | null {
  if (radius < 4) return null
  const a1 = Math.atan2(pA.y - vertex.y, pA.x - vertex.x)
  const a2 = Math.atan2(pC.y - vertex.y, pC.x - vertex.x)
  let delta = a2 - a1
  while (delta > Math.PI) delta -= 2 * Math.PI
  while (delta < -Math.PI) delta += 2 * Math.PI
  if (Math.abs(delta) < 0.08) return null
  const large = Math.abs(delta) > Math.PI ? 1 : 0
  const sweep = delta > 0 ? 1 : 0
  const x1 = vertex.x + radius * Math.cos(a1)
  const y1 = vertex.y + radius * Math.sin(a1)
  const x2 = vertex.x + radius * Math.cos(a2)
  const y2 = vertex.y + radius * Math.sin(a2)
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius} ${radius} 0 ${large} ${sweep} ${x2.toFixed(1)} ${y2.toFixed(1)}`
}

/** Label offset along the angle bisector, outward from the limb. */
export function jointLabelOffset(
  vertex: Pt2,
  pA: Pt2,
  pC: Pt2,
  distance: number
): Pt2 {
  const a1 = Math.atan2(pA.y - vertex.y, pA.x - vertex.x)
  const a2 = Math.atan2(pC.y - vertex.y, pC.x - vertex.x)
  let mid = (a1 + a2) / 2
  let delta = a2 - a1
  while (delta > Math.PI) delta -= 2 * Math.PI
  while (delta < -Math.PI) delta += 2 * Math.PI
  mid = a1 + delta / 2
  return {
    x: vertex.x + Math.cos(mid) * distance,
    y: vertex.y + Math.sin(mid) * distance,
  }
}

/**
 * Trunk lean from vertical, drawn at the hip midpoint (matches the server's torso reading).
 * `a` is a point straight above the hips, `c` the shoulder midpoint.
 */
export function computeTrunkLean(
  getPx: (name: string) => Pt2 | null,
  landmarks: Record<string, LandmarkPoint>,
  minVis = JOINT_VISIBILITY_MIN
): ComputedJointAngle | null {
  const names = ['LEFT_HIP', 'RIGHT_HIP', 'LEFT_SHOULDER', 'RIGHT_SHOULDER']
  if (!names.every((n) => landmarkVisOk(landmarks[n], minVis))) return null
  const [lh, rh, ls, rs] = names.map(getPx)
  if (!lh || !rh || !ls || !rs) return null
  const hips = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 }
  const shoulders = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 }
  const len = Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y)
  if (len < 1) return null
  const up = { x: hips.x, y: hips.y - len }
  const deg = angleDeg(up, hips, shoulders)
  if (deg == null) return null
  return { id: TORSO_ANGLE_ID, kind: 'torso', deg, color: '#00E5FF', a: up, b: hips, c: shoulders }
}

/**
 * Racket tilt from vertical, drawn at the wrist: wrist → index finger stands in for the racket
 * shaft. `a` is a point straight above the wrist, `c` the index finger.
 */
export function computeRacketTilt(
  getPx: (name: string) => Pt2 | null,
  landmarks: Record<string, LandmarkPoint>,
  side: 'LEFT' | 'RIGHT',
  minVis = JOINT_VISIBILITY_MIN
): ComputedJointAngle | null {
  const w = `${side}_WRIST`
  const i = `${side}_INDEX`
  if (!landmarkVisOk(landmarks[w], minVis) || !landmarkVisOk(landmarks[i], minVis)) return null
  const wrist = getPx(w)
  const index = getPx(i)
  if (!wrist || !index) return null
  const len = Math.max(24, Math.hypot(index.x - wrist.x, index.y - wrist.y) * 2)
  const up = { x: wrist.x, y: wrist.y - len }
  // Draw the shaft out past the hand so the arc has room.
  const k = len / Math.max(1, Math.hypot(index.x - wrist.x, index.y - wrist.y))
  const tip = { x: wrist.x + (index.x - wrist.x) * k, y: wrist.y + (index.y - wrist.y) * k }
  const deg = angleDeg(up, wrist, tip)
  if (deg == null) return null
  return { id: `${RACKET_ANGLE_ID}_${side}`, kind: 'racket', deg, color: '#FF9F0A', a: up, b: wrist, c: tip }
}

export type PoseAngleJoint = 'head' | 'shoulder' | 'elbow' | 'wrist' | 'torso' | 'knee' | 'feet' | 'racket'

/**
 * Contact angle from the pose itself, same definitions as the server (jointMetrics.ts).
 * Used when the joints endpoint has nothing for this shot. Head, feet and racket are client-only.
 */
export function poseAngle(
  row: { landmarks: Record<string, LandmarkPoint | undefined> } | null,
  joint: PoseAngleJoint,
  side: 'LEFT' | 'RIGHT'
): number | null {
  if (!row) return null
  const lm = row.landmarks
  const pt = (n: string) => (landmarkVisOk(lm[n]) ? lm[n]! : null)
  const tri = (a: string, b: string, c: string) => {
    const pa = pt(a)
    const pb = pt(b)
    const pc = pt(c)
    return pa && pb && pc ? angleDeg(pa, pb, pc) : null
  }
  const S = side
  switch (joint) {
    case 'shoulder':
      return tri(`${S}_ELBOW`, `${S}_SHOULDER`, `${S}_HIP`)
    case 'elbow':
      return tri(`${S}_SHOULDER`, `${S}_ELBOW`, `${S}_WRIST`)
    case 'wrist':
      return tri(`${S}_ELBOW`, `${S}_WRIST`, `${S}_INDEX`)
    case 'knee':
      return tri(`${S}_HIP`, `${S}_KNEE`, `${S}_ANKLE`)
    case 'head':
      return tri(`${S}_EAR`, 'NOSE', `${S}_SHOULDER`)
    case 'feet':
      return tri(`${S}_KNEE`, `${S}_ANKLE`, `${S}_FOOT_INDEX`)
    case 'racket': {
      // Wrist → index finger stands in for the shaft; tilt from vertical.
      const w = pt(`${S}_WRIST`)
      const i = pt(`${S}_INDEX`)
      if (!w || !i || Math.hypot(i.x - w.x, i.y - w.y) < 1e-8) return null
      return (Math.atan2(Math.abs(i.x - w.x), w.y - i.y) * 180) / Math.PI
    }
    case 'torso': {
      const [lh, rh, ls, rs] = ['LEFT_HIP', 'RIGHT_HIP', 'LEFT_SHOULDER', 'RIGHT_SHOULDER'].map(pt)
      if (!lh || !rh || !ls || !rs) return null
      const dx = (ls.x + rs.x - lh.x - rh.x) / 2
      const up = (lh.y + rh.y - ls.y - rs.y) / 2
      if (Math.hypot(dx, up) < 1e-8) return null
      return (Math.atan2(Math.abs(dx), up) * 180) / Math.PI
    }
  }
}
