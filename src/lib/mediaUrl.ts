import { DOMAIN } from '../../constants'

/** Resolve `/uploads/...` paths to absolute URLs for `<Image />`. */
export function resolveUploadUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const trimmed = path.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  if (trimmed.startsWith('/uploads/')) {
    return `${DOMAIN.replace(/\/+$/, '')}${trimmed}`
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
