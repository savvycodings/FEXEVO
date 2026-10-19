import { getThumbnailAsync } from './videoThumbnails'
import type { FrameGrabber } from './videoFrameGrabShared'

export type { FrameGrabber, GrabbedFrame } from './videoFrameGrabShared'

/** Native frame grabber over expo-video-thumbnails. The web build uses videoFrameGrab.web.ts. */
export function createFrameGrabber(uri: string): FrameGrabber {
  return {
    grab: async (timeMs) => {
      const r = await getThumbnailAsync(uri, { time: Math.max(0, Math.round(timeMs)), quality: 0.7 })
      return { uri: r.uri, width: r.width, height: r.height }
    },
    // expo-av and expo-video-thumbnails don't expose the frame rate.
    detectFps: async () => null,
    dispose: () => {},
  }
}
