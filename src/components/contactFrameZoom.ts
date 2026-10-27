import { useMemo, useRef } from 'react'
import { Platform, type ImageStyle } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'

/**
 * One zoom + pan shared by every contact frame (grid cells and the full-screen viewer).
 * The camera doesn't move within a clip, so the same crop keeps the player in place frame to frame
 * while the ball moves. `cx`/`cy` (0–1) is the picture point shown at the center.
 */
export type FrameView = { zoom: number; cx: number; cy: number }

export const FRAME_VIEW_RESET: FrameView = { zoom: 1, cx: 0.5, cy: 0.5 }
export const ZOOM_STEPS = [1, 2, 3] as const
const MIN_ZOOM = 1
const MAX_ZOOM = 4

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Keep the center far enough from the edges that the zoomed picture always fills the box. */
export function clampView(v: FrameView): FrameView {
  const zoom = clamp(v.zoom, MIN_ZOOM, MAX_ZOOM)
  const half = 0.5 / zoom
  return { zoom, cx: clamp(v.cx, half, 1 - half), cy: clamp(v.cy, half, 1 - half) }
}

/** Chip to highlight for a (possibly pinched, continuous) zoom. */
export function nearestZoomStep(zoom: number) {
  return ZOOM_STEPS.reduce((best, s) => (Math.abs(s - zoom) < Math.abs(best - zoom) ? s : best), ZOOM_STEPS[0])
}

/** Absolute style that draws the picture zoomed and centered on (cx, cy) inside a w×h box. */
export function zoomedImageStyle(view: FrameView, w: number, h: number): ImageStyle {
  const { zoom, cx, cy } = clampView(view)
  return {
    position: 'absolute',
    width: w * zoom,
    height: h * zoom,
    left: w / 2 - cx * w * zoom,
    top: h / 2 - cy * h * zoom,
  }
}

type GestureOpts = {
  view: FrameView
  onViewChange: (v: FrameView) => void
  /** Box size the picture is drawn in, to turn finger movement into picture movement. */
  width: number
  height: number
  /** Plain tap (no drag or pinch). */
  onTap?: () => void
}

/**
 * Pinch zooms, drag pans (only once zoomed), tap fires `onTap`. Tap loses to drag and pinch, so
 * moving a frame never picks it. No pan at 1x, so a drag there still scrolls the page. Updates are
 * batched to one per animation frame.
 */
export function useFrameZoomGesture({ view, onViewChange, width, height, onTap }: GestureOpts) {
  const latest = useRef({ view, onViewChange, width, height, onTap })
  latest.current = { view, onViewChange, width, height, onTap }
  const start = useRef(view)
  const pending = useRef<FrameView | null>(null)
  const raf = useRef<number | null>(null)
  const zoomed = view.zoom > 1

  return useMemo(() => {
    const push = (v: FrameView) => {
      pending.current = clampView(v)
      if (raf.current != null) return
      raf.current = requestAnimationFrame(() => {
        raf.current = null
        if (pending.current) latest.current.onViewChange(pending.current)
        pending.current = null
      })
    }
    const pan = Gesture.Pan()
      .runOnJS(true)
      .minDistance(6)
      .onStart(() => {
        start.current = latest.current.view
      })
      .onUpdate((e) => {
        const { width: w, height: h, view: v } = latest.current
        if (v.zoom <= 1 || w <= 0 || h <= 0) return
        const s = start.current
        push({ zoom: v.zoom, cx: s.cx - e.translationX / (w * s.zoom), cy: s.cy - e.translationY / (h * s.zoom) })
      })
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onStart(() => {
        start.current = latest.current.view
      })
      .onUpdate((e) => {
        const s = start.current
        push({ ...latest.current.view, zoom: s.zoom * e.scale })
      })
    const tap = Gesture.Tap()
      .runOnJS(true)
      .maxDistance(6)
      .onEnd((_e, success) => {
        if (success) latest.current.onTap?.()
      })
    // Pan is left out at 1x rather than disabled: a disabled gesture never fails, so the tap would
    // wait on it forever. Web has no pinch (a mouse never starts one; the chips cover zoom there).
    if (Platform.OS === 'web') return zoomed ? Gesture.Exclusive(pan, tap) : tap
    return zoomed ? Gesture.Exclusive(Gesture.Simultaneous(pinch, pan), tap) : Gesture.Exclusive(pinch, tap)
  }, [zoomed])
}
