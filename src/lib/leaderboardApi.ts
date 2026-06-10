import { authClient } from './auth-client'
import { formatApiError } from './formatApiError'

export type LeaderboardScope = 'global' | 'country' | 'city' | 'friends'

export type LeaderboardEntry = {
  rank: number
  userId: string
  name: string
  image: string | null
  areaLocation: string | null
  totalXp: number
  overallScore: number | null
}

export type LeaderboardResponse = {
  scope: LeaderboardScope
  entries: LeaderboardEntry[]
}

export type LeaderboardFetchResult =
  | { ok: true; data: LeaderboardResponse }
  | { ok: false; error: string }

function normalizeEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries.map((entry) => ({
    ...entry,
    totalXp: Number(entry.totalXp) || 0,
    rank: Number(entry.rank) || 0,
  }))
}

export async function fetchXpLeaderboard(
  scope: LeaderboardScope = 'global'
): Promise<LeaderboardFetchResult> {
  const res = await authClient
    .$fetch<LeaderboardResponse & { error?: string }>(
      `/profile/gamification/leaderboard?scope=${encodeURIComponent(scope)}`,
      { method: 'GET', headers: { Accept: 'application/json' } }
    )
    .catch((err) => ({ error: formatApiError(err, 'Network error') }))

  if (res == null) {
    return { ok: false, error: 'Could not reach the server' }
  }

  const wrapped = res as {
    data?: LeaderboardResponse & { error?: string }
    error?: { status?: number; statusText?: string; message?: string } | string
  }

  if (wrapped.error && wrapped.data == null) {
    const status =
      typeof wrapped.error === 'object' && wrapped.error != null
        ? wrapped.error.status
        : undefined
    if (status === 404) {
      return {
        ok: false,
        error:
          'Leaderboard API not found. Restart the server and make sure the app .env ngrok URL matches your active tunnel.',
      }
    }
    return { ok: false, error: formatApiError(wrapped.error, 'Failed to load leaderboard') }
  }

  const body = (wrapped.data ?? res) as LeaderboardResponse & { error?: string }
  if (body?.error) {
    return { ok: false, error: formatApiError(body.error, 'Failed to load leaderboard') }
  }
  if (!Array.isArray(body.entries)) {
    return { ok: false, error: 'Invalid leaderboard response from server' }
  }

  return {
    ok: true,
    data: {
      scope: body.scope ?? scope,
      entries: normalizeEntries(body.entries),
    },
  }
}
