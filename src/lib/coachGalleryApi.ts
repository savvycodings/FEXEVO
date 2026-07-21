import { Platform } from 'react-native'
import { authClient } from './auth-client'
import { resolveUploadUrl } from './mediaUrl'

export type CoachGalleryPhoto = {
  id: string
  coachUserId: string
  imageUrl: string
  sortOrder: number
  createdAt: string
}

function normalizePhoto(row: Partial<CoachGalleryPhoto> | null | undefined): CoachGalleryPhoto | null {
  if (!row || typeof row.id !== 'string' || !row.id.trim()) return null
  const imageUrl = typeof row.imageUrl === 'string' ? row.imageUrl.trim() : ''
  if (!imageUrl) return null
  return {
    id: row.id.trim(),
    coachUserId: typeof row.coachUserId === 'string' ? row.coachUserId : '',
    imageUrl,
    sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : 0,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(0).toISOString(),
  }
}

export async function fetchCoachGalleryPhotos(coachUserId: string): Promise<CoachGalleryPhoto[]> {
  const trimmed = coachUserId.trim()
  if (!trimmed) return []

  const res = await authClient
    .$fetch(`/coach/gallery/${encodeURIComponent(trimmed)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    .catch(() => null)

  const body = ((res as { data?: unknown })?.data ?? res) as {
    photos?: CoachGalleryPhoto[]
    error?: string
  }

  if (!Array.isArray(body?.photos)) return []
  return body.photos
    .map((row) => normalizePhoto(row))
    .filter((row): row is CoachGalleryPhoto => row != null)
}

export async function uploadCoachGalleryPhotos(
  localUris: string[]
): Promise<CoachGalleryPhoto[]> {
  const uris = localUris.filter((u) => typeof u === 'string' && u.trim().length > 0)
  if (uris.length === 0) return []

  const form = new FormData()
  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i]!
    if (Platform.OS === 'web') {
      const r = await fetch(uri)
      const blob = await r.blob()
      const file = new File([blob], `gallery-${i}.jpg`, {
        type: blob.type || 'image/jpeg',
      })
      form.append('photos', file)
    } else {
      form.append('photos', {
        uri,
        name: `gallery-${i}.jpg`,
        type: 'image/jpeg',
      } as unknown as Blob)
    }
  }

  const res = await authClient
    .$fetch('/coach/gallery', {
      method: 'POST',
      body: form,
    })
    .catch(() => null)

  const body = ((res as { data?: unknown })?.data ?? res) as {
    ok?: boolean
    photos?: CoachGalleryPhoto[]
    error?: string
  }

  if (!Array.isArray(body?.photos)) {
    throw new Error(typeof body?.error === 'string' ? body.error : 'Upload failed')
  }

  return body.photos
    .map((row) => normalizePhoto(row))
    .filter((row): row is CoachGalleryPhoto => row != null)
}

export function coachGalleryDisplayUri(imageUrl: string): string | null {
  return resolveUploadUrl(imageUrl)
}
