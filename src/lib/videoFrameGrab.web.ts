import { snapFps, type FrameGrabber, type GrabbedFrame } from './videoFrameGrabShared'

export type { FrameGrabber, GrabbedFrame } from './videoFrameGrabShared'

/** Longest side of a grabbed frame; sharp enough to see the ball at 3x zoom, still light as a data URI. */
const MAX_SIDE = 1280

/**
 * Web frame grabber: one hidden <video> that is seeked frame by frame and drawn to a canvas.
 * Calls are queued so seeks never overlap.
 */
export function createFrameGrabber(uri: string): FrameGrabber {
  const video = document.createElement('video')
  if (/^https?:/i.test(uri)) video.crossOrigin = 'anonymous'
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  // Chrome doesn't decode frames for detached media elements, so attach it, invisibly.
  Object.assign(video.style, { position: 'fixed', left: '-10000px', top: '0', width: '1px', height: '1px', opacity: '0' })
  document.body.appendChild(video)
  video.src = uri

  const canvas = document.createElement('canvas')
  let queue: Promise<unknown> = Promise.resolve()
  const enqueue = <T,>(job: () => Promise<T>): Promise<T> => {
    const next = queue.then(job, job)
    queue = next.catch(() => {})
    return next
  }

  const ready = new Promise<void>((resolve, reject) => {
    if (video.readyState >= 1) return resolve()
    video.addEventListener('loadedmetadata', () => resolve(), { once: true })
    video.addEventListener('error', () => reject(new Error('could not load the video')), { once: true })
  })

  const seek = (sec: number) =>
    new Promise<void>((resolve) => {
      const target = Math.max(0, Math.min(sec, (video.duration || sec) - 0.001))
      if (Math.abs(video.currentTime - target) < 1e-4 && video.readyState >= 2) return resolve()
      video.addEventListener('seeked', () => resolve(), { once: true })
      video.currentTime = target
    })

  return {
    grab: (timeMs) =>
      enqueue(async (): Promise<GrabbedFrame> => {
        await ready
        await seek(timeMs / 1000)
        const vw = video.videoWidth || 320
        const vh = video.videoHeight || 180
        const scale = Math.min(1, MAX_SIDE / Math.max(vw, vh))
        canvas.width = Math.round(vw * scale)
        canvas.height = Math.round(vh * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('no 2d canvas')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        return { uri: canvas.toDataURL('image/jpeg', 0.75), width: canvas.width, height: canvas.height }
      }),

    // Plays a moment of the video and reads the gap between decoded frames.
    detectFps: () =>
      enqueue(async () => {
        await ready
        const v = video as HTMLVideoElement & {
          requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number
        }
        if (typeof v.requestVideoFrameCallback !== 'function') return null
        const times: number[] = []
        const done = new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 1500)
          const onFrame = (_now: number, meta: { mediaTime: number }) => {
            times.push(meta.mediaTime)
            if (times.length >= 12) {
              clearTimeout(timer)
              resolve()
            } else v.requestVideoFrameCallback!(onFrame)
          }
          v.requestVideoFrameCallback!(onFrame)
        })
        const startAt = video.currentTime
        try {
          await video.play()
        } catch {
          return null
        }
        await done
        video.pause()
        await seek(startAt)
        // Rendering can skip frames, so the smallest gap is the frame duration.
        const gaps = times.slice(1).map((t, i) => t - times[i]!).filter((g) => g > 0.001)
        if (gaps.length < 3) return null
        return snapFps(1 / Math.min(...gaps))
      }),

    dispose: () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
      video.remove()
    },
  }
}
