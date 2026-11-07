import type { HologramKeypoints } from '../../lib/hologramJob'

/** Clockwise degrees from a front-on camera. The orbit starts at the filmed angle and turns clockwise. */
const CAMERA_YAW: Record<string, number> = {
  front: 0,
  behind: 180,
  side: 90,
  deg45_right_side_left_camera: 45,
  deg45_right_side_right_camera: 45,
  deg45_left_side_left_camera: 315,
  deg45_left_side_right_camera: 315,
}

export type OrbitPreset = 'view' | 'front' | 'side'

/** Where in the 360° orbit that preset sits for this camera. 0 is the filmed view. */
export function orbitFraction(preset: OrbitPreset, viewId: string | null | undefined): number {
  if (preset === 'view') return 0
  const yaw = CAMERA_YAW[viewId ?? ''] ?? 0
  const target = preset === 'front' ? 0 : 90
  return ((target - yaw + 360) % 360) / 360
}

function torso(kp: HologramKeypoints) {
  const ls = kp.left_shoulder
  const rs = kp.right_shoulder
  const lh = kp.left_hip
  const rh = kp.right_hip
  if (!ls || !rs || !lh || !rh) return null
  const shoulder = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 }
  const hip = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 }
  const len = Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y)
  if (len < 1e-4) return null
  return { shoulder, len }
}

/** Move `source` onto `onto` so the shoulders match and the torso is the same length. */
export function alignKeypoints(source: HologramKeypoints, onto: HologramKeypoints): HologramKeypoints {
  const from = torso(source)
  const to = torso(onto)
  if (!from || !to) return source
  const scale = to.len / from.len
  const out: HologramKeypoints = {}
  for (const [name, p] of Object.entries(source)) {
    out[name] = {
      x: to.shoulder.x + (p.x - from.shoulder.x) * scale,
      y: to.shoulder.y + (p.y - from.shoulder.y) * scale,
      score: p.score,
    }
  }
  return out
}
