import { authClient } from './auth-client'
import { resolveUploadUrl } from './mediaUrl'
import { fetchXpLeaderboard } from './leaderboardApi'
import { fetchPublicPlayerProfile } from './leaderboardPlayerApi'

export type CoachDirectoryEntry = {
  id: string
  name: string
  username: string | null
  imageUri: string | null
}

type DirectoryUser = {
  id: string
  name: string
  image: string | null
  username: string | null
  coachStudentRole: 'coach' | 'student' | 'none'
}

/** Real coaches (`coachStudentRole === 'coach'`) from the shared user directory — the same
 * endpoint the friend/student search flow already uses, just filtered to coaches here. */
export async function fetchCoachDirectory(): Promise<CoachDirectoryEntry[]> {
  const res = await authClient
    .$fetch<{ users: DirectoryUser[]; error?: string }>('/profile/directory', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    .catch(() => null)
  if (res == null) return []
  const body = ((res as { data?: unknown })?.data ?? res) as
    | { users: DirectoryUser[]; error?: string }
    | null
  if (!body || body.error || !Array.isArray(body.users)) return []

  return body.users
    .filter((u) => u.coachStudentRole === 'coach')
    .map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      imageUri: resolveUploadUrl(u.image),
    }))
}

export type CoachTier = 'gold' | 'silver' | 'bronze' | 'blue'

export type CoachCard = CoachDirectoryEntry & {
  areaLocation: string | null
  overallScore: number | null
  /** Gold, silver and bronze go to the three best-rated coaches, like the Ranking podium. */
  tier: CoachTier
}

/**
 * Coaches with their location and overall score. Scores come from the global leaderboard
 * (players with XP); locations from each coach's public profile.
 */
export async function fetchCoachCards(): Promise<CoachCard[]> {
  const [coaches, board] = await Promise.all([fetchCoachDirectory(), fetchXpLeaderboard('global')])
  const scoreById = new Map<string, number | null>()
  const areaById = new Map<string, string | null>()
  if (board.ok) {
    for (const e of board.data.entries) {
      scoreById.set(e.userId, e.overallScore)
      areaById.set(e.userId, e.areaLocation)
    }
  }
  const publics = await Promise.all(
    coaches.map((c) => (areaById.get(c.id) ? null : fetchPublicPlayerProfile(c.id))),
  )
  const ranked = coaches
    .map((c) => ({ id: c.id, score: scoreById.get(c.id) ?? null }))
    .filter((c): c is { id: string; score: number } => c.score != null)
    .sort((a, b) => b.score - a.score)
  const tierById = new Map<string, CoachTier>()
  const podium: CoachTier[] = ['gold', 'silver', 'bronze']
  ranked.slice(0, 3).forEach((c, i) => tierById.set(c.id, podium[i]!))

  return coaches.map((c, i) => ({
    ...c,
    areaLocation: areaById.get(c.id)?.trim() || publics[i]?.profile.areaLocation?.trim() || null,
    overallScore: scoreById.get(c.id) ?? null,
    tier: tierById.get(c.id) ?? 'blue',
  }))
}
