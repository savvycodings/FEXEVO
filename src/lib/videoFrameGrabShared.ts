/** One decoded video frame as an image URI plus its pixel size. */
export type GrabbedFrame = { uri: string; width: number; height: number }

/** Pulls single frames out of one video. */
export type FrameGrabber = {
  grab: (timeMs: number) => Promise<GrabbedFrame>
  /** Capture frame rate when the platform can measure it, else null. */
  detectFps: () => Promise<number | null>
  dispose: () => void
}

const COMMON_FPS = [24, 25, 30, 48, 50, 60, 90, 120, 240]

/** Snaps a measured rate to the nearest common capture rate (phones report 29.97 and similar). */
export function snapFps(measured: number): number {
  return COMMON_FPS.reduce((best, f) => (Math.abs(f - measured) < Math.abs(best - measured) ? f : best), 30)
}
