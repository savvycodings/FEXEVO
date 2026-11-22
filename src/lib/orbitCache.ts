import { File, Paths } from 'expo-file-system'

/** Survives leaving Smart 3D mid-download so reopen does not start from scratch. */
const inflight = new Map<string, Promise<string>>()

function fileNameFor(remote: string): string {
  return remote.split('/').pop()?.split('?')[0] || 'orbit.mp4'
}

function withNgrokSkip(url: string): string {
  if (!/ngrok/i.test(url)) return url
  if (/[?&]ngrok-skip-browser-warning=/i.test(url)) return url
  return `${url}${url.includes('?') ? '&' : '?'}ngrok-skip-browser-warning=69420`
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Download an orbit mp4 once per URL; later callers share the same promise/file.
 * Retries a few times — emulator + ngrok often abort the first attempt (SocketException).
 */
export function cacheOrbitVideo(remote: string): Promise<string> {
  const url = withNgrokSkip(remote.trim())
  const existing = inflight.get(url)
  if (existing) return existing
  const dest = new File(Paths.document, fileNameFor(url))
  const next = (async () => {
    let lastErr: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0 && dest.exists) {
          try {
            dest.delete()
          } catch {
            // replace on next download
          }
        }
        const file = await File.downloadFileAsync(url, dest, {
          idempotent: true,
          headers: {
            // Free ngrok interstitial breaks binary downloads without this.
            'ngrok-skip-browser-warning': '69420',
          },
        })
        return file.uri
      } catch (err) {
        lastErr = err
        await sleep(350 * (attempt + 1))
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
  })().catch((err) => {
    inflight.delete(url)
    throw err
  })
  inflight.set(url, next)
  return next
}

/** Kick a download without awaiting — used while hologram polling finds a new clip. */
export function prefetchOrbitVideo(remote: string | null | undefined): void {
  if (!remote) return
  void cacheOrbitVideo(remote).catch(() => {})
}
