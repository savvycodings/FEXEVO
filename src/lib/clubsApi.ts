import { authClient } from './auth-client'
import { resolveUploadUrl } from './mediaUrl'

export type ClubCourt = {
  id: string
  name: string
  indoorOutdoor: 'indoor' | 'outdoor' | 'covered'
  hasLighting: boolean
}

export type ClubSummary = {
  id: string
  slug: string
  name: string
  description: string | null
  address: string
  city: string | null
  region: string | null
  country: string | null
  phone: string | null
  email: string | null
  website: string | null
  hoursText: string | null
  bannerImageUrl: string | null
  logoImageUrl: string | null
  courts: ClubCourt[]
  amenityKeys: string[]
  galleryImageUrls: string[]
}

async function fetchClubJson<T>(path: string): Promise<T | null> {
  const res = await authClient
    .$fetch<T & { error?: string }>(path, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    .catch(() => null)
  if (res == null) return null
  const body = ((res as { data?: unknown })?.data ?? res) as (T & { error?: string }) | null
  if (!body || (body as { error?: string }).error) return null
  return body as T
}

/** Approved clubs only — matches BEXevo's public `/club` listing. */
export async function fetchClubs(): Promise<ClubSummary[]> {
  const body = await fetchClubJson<{ clubs: ClubSummary[] }>('/club')
  return body?.clubs ?? []
}

export async function fetchClubDetail(slug: string): Promise<ClubSummary | null> {
  const body = await fetchClubJson<{ club: ClubSummary }>(`/club/${encodeURIComponent(slug)}`)
  return body?.club ?? null
}

export function clubBannerUri(club: Pick<ClubSummary, 'bannerImageUrl'>): string | null {
  return resolveUploadUrl(club.bannerImageUrl)
}

export function clubLogoUri(club: Pick<ClubSummary, 'logoImageUrl'>): string | null {
  return resolveUploadUrl(club.logoImageUrl)
}

export function clubGalleryUris(club: Pick<ClubSummary, 'galleryImageUrls'>): string[] {
  return club.galleryImageUrls
    .map((url) => resolveUploadUrl(url))
    .filter((uri): uri is string => uri != null)
}
