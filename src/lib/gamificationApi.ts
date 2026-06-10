import { authClient } from './auth-client'

export type GamificationQuestRow = {
  questKey: string
  progress: number
  goal: number
  xp: number
  claimed: boolean
}

export type GamificationState = {
  totalXp: number
  level: number
  xpInLevel: number
  xpGoal: number
  tier: string
  loginStreak: number
  achievements: { key: string; unlockedAt: string; claimedAt: string }[]
  claimableAchievements: { key: string; earnedAt: string }[]
  dailyQuests: GamificationQuestRow[]
  dateKey: string
  newlyEarnedAchievements?: string[]
}

export async function fetchGamificationState(
  dateKey?: string
): Promise<GamificationState | null> {
  const query = dateKey ? `?dateKey=${encodeURIComponent(dateKey)}` : ''
  const res = await authClient
    .$fetch<GamificationState & { error?: string }>(`/profile/gamification/state${query}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    .catch(() => null)

  if (res == null) return null
  const body = ((res as { data?: unknown })?.data ?? res) as GamificationState & {
    error?: string
  }
  if (body?.error || typeof body.totalXp !== 'number') return null
  return body
}

export async function claimDailyQuest(
  questKey: string,
  dateKey?: string
): Promise<{ state: GamificationState; xpAwarded: number } | null> {
  const res = await authClient
    .$fetch<{ ok?: boolean; error?: string; xpAwarded?: number } & GamificationState>(
      `/profile/gamification/daily-quests/${encodeURIComponent(questKey)}/claim`,
      {
        method: 'POST',
        body: dateKey ? { dateKey } : {},
      }
    )
    .catch(() => null)

  if (res == null) return null
  const body = ((res as { data?: unknown })?.data ?? res) as {
    ok?: boolean
    error?: string
    xpAwarded?: number
  } & GamificationState
  if (!body.ok || body.error) return null
  return { state: body, xpAwarded: body.xpAwarded ?? 0 }
}

export async function trackGamificationQuest(
  questKey: string,
  dateKey?: string
): Promise<GamificationState | null> {
  const res = await authClient
    .$fetch<{ ok?: boolean; error?: string } & GamificationState>(
      '/profile/gamification/track',
      {
        method: 'POST',
        body: { questKey, ...(dateKey ? { dateKey } : {}) },
      }
    )
    .catch(() => null)

  if (res == null) return null
  const body = ((res as { data?: unknown })?.data ?? res) as { ok?: boolean; error?: string } & GamificationState
  if (!body.ok || body.error) return null
  return body
}

export async function claimAchievement(
  achievementKey: string
): Promise<GamificationState | null> {
  const res = await authClient
    .$fetch<{ ok?: boolean; error?: string } & GamificationState>(
      `/profile/gamification/achievements/${encodeURIComponent(achievementKey)}/claim`,
      { method: 'POST', body: {} }
    )
    .catch(() => null)

  if (res == null) return null
  const body = ((res as { data?: unknown })?.data ?? res) as {
    ok?: boolean
    error?: string
  } & GamificationState
  if (!body.ok || body.error) return null
  return body
}

export async function claimAchievement(
  achievementKey: string
): Promise<GamificationState | null> {
  const res = await authClient
    .$fetch<{ ok?: boolean; error?: string } & GamificationState>(
      `/profile/gamification/achievements/${encodeURIComponent(achievementKey)}/claim`,
      { method: 'POST', body: {} }
    )
    .catch(() => null)

  if (res == null) return null
  const body = ((res as { data?: unknown })?.data ?? res) as {
    ok?: boolean
    error?: string
  } & GamificationState
  if (!body.ok || body.error) return null
  return body
}
