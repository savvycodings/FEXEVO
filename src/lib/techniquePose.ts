/** MediaPipe pose segments for a simple skeleton overlay (normalized 0–1 coords). */
export const MEDIAPIPE_POSE_CONNECTIONS: [string, string][] = [
  ['LEFT_SHOULDER', 'RIGHT_SHOULDER'],
  ['LEFT_SHOULDER', 'LEFT_ELBOW'],
  ['LEFT_ELBOW', 'LEFT_WRIST'],
  ['RIGHT_SHOULDER', 'RIGHT_ELBOW'],
  ['RIGHT_ELBOW', 'RIGHT_WRIST'],
  ['LEFT_SHOULDER', 'LEFT_HIP'],
  ['RIGHT_SHOULDER', 'RIGHT_HIP'],
  ['LEFT_HIP', 'RIGHT_HIP'],
  ['LEFT_HIP', 'LEFT_KNEE'],
  ['LEFT_KNEE', 'LEFT_ANKLE'],
  ['LEFT_ANKLE', 'LEFT_HEEL'],
  ['LEFT_HEEL', 'LEFT_FOOT_INDEX'],
  ['RIGHT_HIP', 'RIGHT_KNEE'],
  ['RIGHT_KNEE', 'RIGHT_ANKLE'],
  ['RIGHT_ANKLE', 'RIGHT_HEEL'],
  ['RIGHT_HEEL', 'RIGHT_FOOT_INDEX'],
]

export type LandmarkPoint = { x: number; y: number; visibility?: number; z?: number }

export type PoseFrameRow = {
  frame: number
  landmarks: Record<string, LandmarkPoint>
  racket_bbox?: [number, number, number, number] | null
  racket_conf?: number | null
  racket_hand?: 'left' | 'right' | null
  ball_bbox?: [number, number, number, number] | null
  ball_conf?: number | null
}

const LEG_KEYS = ['KNEE', 'ANKLE', 'HEEL', 'FOOT_INDEX', 'FOOT']

/** Pink legs / pelvis band vs green arms & torso — matches product legend. */
export function poseSegmentColor(a: string, b: string, goodHex: string, wrongHex: string): string {
  if (a === 'LEFT_HIP' && b === 'RIGHT_HIP') return wrongHex
  const lower = (k: string) => LEG_KEYS.some((s) => k.includes(s))
  if (lower(a) || lower(b)) return wrongHex
  return goodHex
}

export function normalizePoseData(raw: unknown): PoseFrameRow[] {
  if (!Array.isArray(raw)) return []
  const out: PoseFrameRow[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const frame =
      typeof r.frame === 'number'
        ? r.frame
        : typeof r.frame_idx === 'number'
          ? r.frame_idx
          : NaN
    const lm = r.landmarks
    if (!Number.isFinite(frame) || !lm || typeof lm !== 'object') continue
    const rb = r.racket_bbox
    const racket_bbox =
      Array.isArray(rb) &&
      rb.length === 4 &&
      rb.every((n) => typeof n === 'number' && Number.isFinite(n))
        ? ([rb[0], rb[1], rb[2], rb[3]] as [number, number, number, number])
        : null
    const racket_conf =
      typeof r.racket_conf === 'number' && Number.isFinite(r.racket_conf)
        ? r.racket_conf
        : null
    const handRaw = String(r.racket_hand ?? '').toLowerCase()
    const racket_hand =
      handRaw === 'left' || handRaw === 'right' ? (handRaw as 'left' | 'right') : null
    const bb = r.ball_bbox
    const ball_bbox =
      Array.isArray(bb) &&
      bb.length === 4 &&
      bb.every((n) => typeof n === 'number' && Number.isFinite(n))
        ? ([bb[0], bb[1], bb[2], bb[3]] as [number, number, number, number])
        : null
    const ball_conf =
      typeof r.ball_conf === 'number' && Number.isFinite(r.ball_conf)
        ? r.ball_conf
        : null
    out.push({
      frame,
      landmarks: lm as Record<string, LandmarkPoint>,
      racket_bbox,
      racket_conf,
      racket_hand,
      ball_bbox,
      ball_conf,
    })
  }
  return out.sort((x, y) => x.frame - y.frame)
}

export function resolveTotalFrames(
  metrics: Record<string, unknown> | null | undefined,
  poseFrames: PoseFrameRow[]
): number {
  const tf = metrics?.total_frames
  if (typeof tf === 'number' && tf > 0) return tf
  if (poseFrames.length) {
    const last = poseFrames[poseFrames.length - 1]!.frame
    return Math.max(last + 1, 1)
  }
  return 1
}

export function nearestPoseByFrame(frames: PoseFrameRow[], estimatedFrame: number): PoseFrameRow | null {
  if (!frames.length) return null
  let best = frames[0]!
  let bestD = Math.abs(best.frame - estimatedFrame)
  for (let i = 1; i < frames.length; i++) {
    const p = frames[i]!
    const d = Math.abs(p.frame - estimatedFrame)
    if (d < bestD) {
      best = p
      bestD = d
    }
  }
  return best
}

/** Max |frame| gap when borrowing YOLO bbox from a neighbor pose row (sparse detections). */
const DEFAULT_MAX_BBOX_FRAME_GAP = 45

function hasValidBbox2d(
  bbox: [number, number, number, number] | null | undefined
): boolean {
  if (!bbox || bbox.length !== 4) return false
  const [x1, y1, x2, y2] = bbox
  if (![x1, y1, x2, y2].every((n) => typeof n === 'number' && Number.isFinite(n))) return false
  return x2 > x1 && y2 > y1
}

/** Nearest pose row to `targetFrame` that has a `racket_bbox` (for overlay when the time-synced row has none). */
export function nearestPoseWithRacket(
  frames: PoseFrameRow[],
  targetFrame: number,
  maxFrameDistance: number = DEFAULT_MAX_BBOX_FRAME_GAP
): PoseFrameRow | null {
  if (!frames.length || !Number.isFinite(targetFrame)) return null
  let best: PoseFrameRow | null = null
  let bestD = Infinity
  for (const f of frames) {
    if (!hasValidBbox2d(f.racket_bbox ?? null)) continue
    const d = Math.abs(f.frame - targetFrame)
    if (d > maxFrameDistance) continue
    if (d < bestD) {
      bestD = d
      best = f
    }
  }
  return best
}

/** Nearest pose row to `targetFrame` that has a `ball_bbox` and optional `minBallConf` on `ball_conf`. */
export function nearestPoseWithBall(
  frames: PoseFrameRow[],
  targetFrame: number,
  maxFrameDistance: number = DEFAULT_MAX_BBOX_FRAME_GAP,
  minBallConf?: number
): PoseFrameRow | null {
  if (!frames.length || !Number.isFinite(targetFrame)) return null
  let best: PoseFrameRow | null = null
  let bestD = Infinity
  for (const f of frames) {
    if (!hasValidBbox2d(f.ball_bbox ?? null)) continue
    const c = f.ball_conf
    if (minBallConf != null && Number.isFinite(minBallConf)) {
      if (typeof c !== 'number' || !Number.isFinite(c) || c < minBallConf) continue
    }
    const d = Math.abs(f.frame - targetFrame)
    if (d > maxFrameDistance) continue
    if (d < bestD) {
      bestD = d
      best = f
    }
  }
  return best
}

export type OverlayRect = { x: number; y: number; w: number; h: number }

function bboxNormRotate90LikeLandmarks(ox1: number, oy1: number, ox2: number, oy2: number) {
  const rx1 = oy1
  const ry1 = 1 - ox2
  const rx2 = oy2
  const ry2 = 1 - ox1
  return {
    x1: Math.min(rx1, rx2),
    y1: Math.min(ry1, ry2),
    x2: Math.max(rx1, rx2),
    y2: Math.max(ry1, ry2),
  }
}

function normBboxToOverlayRectPixels(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  videoW: number,
  videoH: number,
  naturalSize: { w: number; h: number } | null
): OverlayRect | null {
  if (x2 <= x1 || y2 <= y1) return null
  if (naturalSize) {
    const videoAR = naturalSize.w / naturalSize.h
    const boxAR = videoW / videoH
    let scale = 1
    let offsetX = 0
    let offsetY = 0
    if (videoAR > boxAR) {
      scale = videoW / naturalSize.w
      offsetY = (videoH - naturalSize.h * scale) / 2
    } else {
      scale = videoH / naturalSize.h
      offsetX = (videoW - naturalSize.w * scale) / 2
    }
    return {
      x: x1 * naturalSize.w * scale + offsetX,
      y: y1 * naturalSize.h * scale + offsetY,
      w: (x2 - x1) * naturalSize.w * scale,
      h: (y2 - y1) * naturalSize.h * scale,
    }
  }
  return {
    x: x1 * videoW,
    y: y1 * videoH,
    w: (x2 - x1) * videoW,
    h: (y2 - y1) * videoH,
  }
}

function overlayRectSensible(
  r: OverlayRect,
  videoW: number,
  videoH: number
): boolean {
  if (!Number.isFinite(r.x) || !Number.isFinite(r.y) || !Number.isFinite(r.w) || !Number.isFinite(r.h)) {
    return false
  }
  if (r.w < 0.5 || r.h < 0.5) return false
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  return cx >= -r.w * 0.5 && cx <= videoW + r.w * 0.5 && cy >= -r.h * 0.5 && cy <= videoH + r.h * 0.5
}

/**
 * Map normalized 0–1 paddle/ball box to overlay pixels (same contain + rotation as Activities / technique UIs).
 */
export function projectBboxToOverlayRect(
  rb: [number, number, number, number] | null | undefined,
  options: {
    videoW: number
    videoH: number
    encodedNatural: { w: number; h: number } | null
    naturalSize: { w: number; h: number } | null
  }
): OverlayRect | null {
  if (!hasValidBbox2d(rb ?? null) || !rb) return null
  const [ox1, oy1, ox2, oy2] = rb
  const { videoW, videoH, encodedNatural, naturalSize } = options

  if (encodedNatural && naturalSize && landmarksNeedRotateForContainer(encodedNatural, naturalSize)) {
    const r = bboxNormRotate90LikeLandmarks(ox1, oy1, ox2, oy2)
    let rRot: OverlayRect | null = null
    if (r.x2 > r.x1 && r.y2 > r.y1) {
      rRot = normBboxToOverlayRectPixels(r.x1, r.y1, r.x2, r.y2, videoW, videoH, naturalSize)
    }
    const rNo = normBboxToOverlayRectPixels(ox1, oy1, ox2, oy2, videoW, videoH, naturalSize)
    if (rRot && rNo) {
      const okRot = overlayRectSensible(rRot, videoW, videoH)
      const okNo = overlayRectSensible(rNo, videoW, videoH)
      if (okRot && !okNo) return rRot
      if (!okRot && okNo) return rNo
    }
    if (rRot && overlayRectSensible(rRot, videoW, videoH)) return rRot
    if (rNo && overlayRectSensible(rNo, videoW, videoH)) return rNo
    return rRot ?? rNo
  }

  if (ox2 <= ox1 || oy2 <= oy1) return null
  return normBboxToOverlayRectPixels(ox1, oy1, ox2, oy2, videoW, videoH, naturalSize)
}

function landmarkVisible(lm: LandmarkPoint | undefined): boolean {
  if (!lm || typeof lm.x !== 'number' || typeof lm.y !== 'number') return false
  const v = lm.visibility
  if (typeof v === 'number' && v < 0.35) return false
  return true
}

/** Expo `naturalSize`: use with `orientation` so layout aspect matches how the player presents the clip. */
export function containerSizeFromNatural(ns: {
  width: number
  height: number
  orientation?: 'portrait' | 'landscape'
}): { w: number; h: number } {
  const iw = ns.width
  const ih = ns.height
  if (iw <= 0 || ih <= 0) return { w: 16, h: 9 }
  const o = ns.orientation
  if (o === 'portrait') {
    return iw < ih ? { w: iw, h: ih } : { w: ih, h: iw }
  }
  if (o === 'landscape') {
    return iw >= ih ? { w: iw, h: ih } : { w: ih, h: iw }
  }
  return { w: iw, h: ih }
}

export function landmarksNeedRotateForContainer(
  encoded: { w: number; h: number },
  container: { w: number; h: number }
): boolean {
  return encoded.w !== container.w || encoded.h !== container.h
}

/** Encoded frame → display frame when container swaps WxH (90° CW in normalized coords). */
export function rotateLandmarksNormalized90CW(
  landmarks: Record<string, LandmarkPoint>
): Record<string, LandmarkPoint> {
  const out: Record<string, LandmarkPoint> = {}
  for (const [name, p] of Object.entries(landmarks)) {
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') continue
    out[name] = {
      ...p,
      x: p.y,
      y: 1 - p.x,
    }
  }
  return out
}

/** Map normalized landmark to overlay pixels when video uses object-fit: contain (full frame visible, letterboxed if needed). */
export function landmarkToContainPx(
  name: string,
  landmarks: Record<string, LandmarkPoint>,
  naturalW: number,
  naturalH: number,
  boxW: number,
  boxH: number
): { x: number; y: number } | null {
  const lm = landmarks[name]
  if (!landmarkVisible(lm)) return null
  const videoAR = naturalW / naturalH
  const boxAR = boxW / boxH
  let scale: number
  let offsetX = 0
  let offsetY = 0
  if (videoAR > boxAR) {
    // Wider than box → fit width, letterbox top/bottom
    scale = boxW / naturalW
    offsetY = (boxH - naturalH * scale) / 2
  } else {
    // Taller or equal → fit height, pillarbox sides
    scale = boxH / naturalH
    offsetX = (boxW - naturalW * scale) / 2
  }
  const px = lm!.x * naturalW * scale + offsetX
  const py = lm!.y * naturalH * scale + offsetY
  return { x: px, y: py }
}

/** Fallback when natural size is not known yet (approximate). */
export function projectLandmark(
  name: string,
  landmarks: Record<string, LandmarkPoint>,
  width: number,
  height: number
): { x: number; y: number } | null {
  const lm = landmarks[name]
  if (!landmarkVisible(lm)) return null
  return { x: lm!.x * width, y: lm!.y * height }
}
