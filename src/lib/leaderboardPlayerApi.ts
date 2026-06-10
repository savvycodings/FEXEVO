import { authClient } from './auth-client'

export type RatingCategoryRow = {
  id: string
  thisWeek: number
  lastWeek: number
}

export type PublicPlayerProfile = {
  user: {
    id: string
    name: string
    image: string | null
  }
  profile: {
    username: string | null
    areaLocation: string | null
    birthDate: string | null
    birthDisplay: string | null
    level: string | null
    rankingOrg: string | null
    rankingValue: string | null
    hasRanking: boolean | null
    headline: string
  }
  totalXp: number
}

export async function fetchPublicPlayerProfile(
  userId: string
): Promise<PublicPlayerProfile | null> {
  const res = await authClient
    .$fetch<PublicPlayerProfile & { error?: string }>(
      `/profile/users/${encodeURIComponent(userId)}/public`,
      { method: 'GET', headers: { Accept: 'application/json' } }
    )
    .catch(() => null)

  if (res == null) return null
  const body = ((res as { data?: unknown })?.data ?? res) as PublicPlayerProfile & {
    error?: string
  }
  if (body?.error || !body?.user?.id) return null
  return body
}

export async function fetchPlayerRatingCategories(
  userId: string
): Promise<RatingCategoryRow[]> {
  const res = await authClient
    .$fetch<{ categories?: RatingCategoryRow[]; error?: string }>(
      `/profile/rating-by-category?userId=${encodeURIComponent(userId)}`,
      { method: 'GET', headers: { Accept: 'application/json' } }
    )
    .catch(() => null)

  if (res == null) return []
  const body = ((res as { data?: unknown })?.data ?? res) as {
    categories?: RatingCategoryRow[]
    overall?: { thisWeek: number | null }
  }
  return Array.isArray(body?.categories) ? body.categories : []
}

export type PlayerRecentVideo = {
  analysisId: string
  techniqueVideoId: string
  createdAt: string
  videoPath: string
}

export async function fetchPlayerRecentVideos(
  userId: string,
  limit = 5
): Promise<PlayerRecentVideo[]> {
  const res = await authClient
    .$fetch<{ items?: PlayerRecentVideo[]; error?: string }>(
      `/technique/users/${encodeURIComponent(userId)}/recent-videos?limit=${limit}`,
      { method: 'GET', headers: { Accept: 'application/json' } }
    )
    .catch(() => null)

  if (res == null) return []
  const body = ((res as { data?: unknown })?.data ?? res) as {
    items?: PlayerRecentVideo[]
  }
  return Array.isArray(body?.items) ? body.items : []
}

export async function fetchPlayerOverallScore(userId: string): Promise<number | null> {
  const res = await authClient
    .$fetch<{ overall?: { thisWeek: number | null } }>(
      `/profile/rating-by-category?userId=${encodeURIComponent(userId)}`,
      { method: 'GET', headers: { Accept: 'application/json' } }
    )
    .catch(() => null)

  if (res == null) return null
  const body = ((res as { data?: unknown })?.data ?? res) as {
    overall?: { thisWeek: number | null }
  }
  const score = body?.overall?.thisWeek
  return typeof score === 'number' && Number.isFinite(score) ? Math.round(score) : null
}
