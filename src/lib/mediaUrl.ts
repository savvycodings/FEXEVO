import { DOMAIN } from '../../constants'

/** Ngrok free interstitial blocks bare `<Image>` loads; query bypass matches authClient headers. */
function withNgrokSkip(url: string): string {
  if (!/ngrok-free\.(dev|app)/i.test(url)) return url
  if (/[?&]ngrok-skip-browser-warning=/i.test(url)) return url
  return `${url}${url.includes('?') ? '&' : '?'}ngrok-skip-browser-warning=69420`
}

/** Resolve `/uploads/...` paths to absolute URLs for `<Image />`. */
export function resolveUploadUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const trimmed = path.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return withNgrokSkip(trimmed)
  if (trimmed.startsWith('/uploads/')) {
    return withNgrokSkip(`${DOMAIN.replace(/\/+$/, '')}${trimmed}`)
  }
  return trimmed
}

/** Any `/path` on the API host, including `/train/video/:id`. */
export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const trimmed = path.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  if (trimmed.startsWith('/')) return `${DOMAIN.replace(/\/+$/, '')}${trimmed}`
  return resolveUploadUrl(trimmed)
}

/** Playback URL for the pro-library clip matched to this analysis, when one was stored. */
export function proLibraryVideoUrl(retrieval: unknown): string | null {
  const neighbors = (retrieval as { neighbors?: Array<{ train_video_id?: unknown }> } | null)?.neighbors
  const id = neighbors?.[0]?.train_video_id
  if (typeof id !== 'string' || !id.trim()) return null
  return resolveMediaUrl(`/train/video/${encodeURIComponent(id.trim())}`)
}
