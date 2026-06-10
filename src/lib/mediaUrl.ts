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
