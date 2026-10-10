/**
 * Web version of expo-video-thumbnails' getThumbnailAsync: seeks an off-screen <video> to the
 * requested time and draws the frame to a canvas. Returns a data: URI, like a file URI on native.
 */
export type VideoThumbnailsOptions = { time?: number; quality?: number; headers?: Record<string, string> }
export type VideoThumbnailsResult = { uri: string; width: number; height: number }

export function getThumbnailAsync(source: string, options: VideoThumbnailsOptions = {}): Promise<VideoThumbnailsResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    // Chrome doesn't load frame data for detached media elements, so attach it, invisibly.
    Object.assign(video.style, { position: 'fixed', left: '-10000px', top: '0', width: '1px', height: '1px', opacity: '0' })
    document.body.appendChild(video)
    const fail = (msg: string) => {
      cleanup()
      reject(new Error(`getThumbnailAsync (web): ${msg}`))
    }
    const timer = setTimeout(() => fail('timed out'), 15_000)
    const cleanup = () => {
      clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      video.remove()
    }
    video.onerror = () => fail('could not load the video')
    video.onloadedmetadata = () => {
      const t = Math.max(0, (options.time ?? 0) / 1000)
      video.currentTime = Math.min(t, Math.max(0, (video.duration || t) - 0.01))
    }
    video.onseeked = () => {
      const w = video.videoWidth
      const h = video.videoHeight
      if (!w || !h) return fail('video has no frame size')
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return fail('no 2d canvas')
      ctx.drawImage(video, 0, 0, w, h)
      const uri = canvas.toDataURL('image/jpeg', options.quality ?? 0.8)
      cleanup()
      resolve({ uri, width: w, height: h })
    }
    video.src = source
    video.load()
  })
}
