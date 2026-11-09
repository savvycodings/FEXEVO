import { DOMAIN } from '../../constants'

/** Ngrok free interstitial blocks bare `<Image>` loads; query bypass matches authClient headers. */
function withNgrokSkip(url: string): string {
  if (!/ngrok/i.test(url)) return url
  if (/[?&]ngrok-skip-browser-warning=/i.test(url)) return url
  return `${url}${url.includes('?') ? '&' : '?'}ngrok-skip-browser-warning=69420`
}

/**
 * Train / pro-library files live on the Railway volume. When the app API is tunneled via ngrok
 * to a laptop without that volume, fall back to the production host so Save & Track still plays.
 */
function mediaHost(): string {
  const explicit = (process.env.EXPO_PUBLIC_TRAIN_MEDIA_URL || process.env.EXPO_PUBLIC_MEDIA_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '')
  if (explicit) return explicit
  const api = DOMAIN.replace(/\/+$/, '')
  if (/ngrok/i.test(api)) return 'https://bexevo-production.up.railway.app'
  return api
}

/** Resolve `/uploads/...` paths to absolute URLs for `<Image />`. */
export function resolveUploadUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const trimmed = path.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return withNgrokSkip(trimmed)
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/pro-library/')) {
    return withNgrokSkip(`${mediaHost()}${trimmed}`)
  }
  return trimmed
}

/** Any `/path` on the API host, including `/train/video/:id`. */
export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const trimmed = path.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return withNgrokSkip(trimmed)
  if (trimmed.startsWith('/train/') || trimmed.startsWith('/pro-library/')) {
    return withNgrokSkip(`${mediaHost()}${trimmed}`)
  }
  if (trimmed.startsWith('/')) return withNgrokSkip(`${DOMAIN.replace(/\/+$/, '')}${trimmed}`)
  return resolveUploadUrl(trimmed)
}

/** Playback URL for the pro-library clip matched to this analysis, when one was stored. */
export function proLibraryVideoUrl(retrieval: unknown): string | null {
  const block = retrieval as {
    neighbors?: Array<{ train_video_id?: unknown; train_sample_id?: unknown }>
    train_video_id?: unknown
  } | null
  const fromNeighbor = block?.neighbors?.[0]?.train_video_id
  const topLevel = block?.train_video_id
  const id =
    typeof fromNeighbor === 'string' && fromNeighbor.trim()
      ? fromNeighbor.trim()
      : typeof topLevel === 'string' && topLevel.trim()
        ? topLevel.trim()
        : ''
  if (!id) return null
  return resolveMediaUrl(`/train/video/${encodeURIComponent(id)}`)
}
