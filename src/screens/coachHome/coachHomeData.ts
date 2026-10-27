import { authClient } from '../../lib/auth-client'
import type { PhysicalHistoryItem } from '../../lib/physicalMetrics'

export type ActivityItem = {
  analysisId?: string
  status?: string
  createdAt?: string
  score?: number | null
  shotLabel?: string | null
  thumbnailUrl?: string | null
  durationMs?: number | null
  videoPath?: string | null
}

export type CoachHomeSnapshot = {
  userId: string
  physical: PhysicalHistoryItem[]
  latest: ActivityItem | null
  sessionsThisWeek: number
  hasHistory: boolean
  fetchedAt: number
}

const FRESH_MS = 5000

let snapshot: CoachHomeSnapshot | null = null
let inflight: { userId: string; promise: Promise<CoachHomeSnapshot | null> } | null = null

export function peekCoachHome(userId: string): CoachHomeSnapshot | null {
  return snapshot?.userId === userId ? snapshot : null
}

export function clearCoachHomeCache(): void {
  snapshot = null
  inflight = null
}

export function listFromFetch<T>(res: unknown): T[] | null {
  if (!res || typeof res !== 'object') return null
  const wrapped = res as { data?: unknown; error?: unknown }
  if (wrapped.error) return null
  const body = (
    wrapped.data && typeof wrapped.data === 'object' ? wrapped.data : wrapped
  ) as { items?: unknown; error?: unknown }
  if (body.error || !Array.isArray(body.items)) return null
  return body.items as T[]
}

function startOfWeek(date: Date): Date {
  const next = new Date(date)
  const day = next.getDay()
  const mondayOffset = day === 0 ? 6 : day - 1
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() - mondayOffset)
  return next
}

async function fetchOnce(userId: string): Promise<CoachHomeSnapshot | null> {
  const [activityRes, historyRes] = await Promise.all([
    authClient.$fetch<{ items?: ActivityItem[] }>('/technique/activities', { method: 'GET' }),
    authClient.$fetch<{ items?: PhysicalHistoryItem[] }>('/technique/physical-history?limit=24', {
      method: 'GET',
    }),
  ])
  const activities = listFromFetch<ActivityItem>(activityRes)
  const physicalItems = listFromFetch<PhysicalHistoryItem>(historyRes)
  if (!activities || !physicalItems) return null
  const completed = activities.filter((item) => item?.status === 'completed')
  const physical = physicalItems.filter(
    (row) => row && typeof row.analysisId === 'string' && row.physicalMetrics
  )
  const weekStart = startOfWeek(new Date()).getTime()
  const sessionsThisWeek = completed.filter((item) => {
    const at = item.createdAt ? Date.parse(item.createdAt) : NaN
    return Number.isFinite(at) && at >= weekStart
  }).length
  const next: CoachHomeSnapshot = {
    userId,
    physical,
    latest: completed[0] ?? null,
    sessionsThisWeek,
    hasHistory: completed.length > 0 || physical.length > 0,
    fetchedAt: Date.now(),
  }
  snapshot = next
  return next
}

/** Activities and physical stats for the coach home. Shares one request if a load is already running. */
export function prefetchCoachHome(userId: string): Promise<CoachHomeSnapshot | null> {
  const fresh = peekCoachHome(userId)
  if (fresh && Date.now() - fresh.fetchedAt < FRESH_MS) return Promise.resolve(fresh)
  if (inflight?.userId === userId) return inflight.promise
  const promise = (async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const next = await fetchOnce(userId)
        if (next) return next
      } catch {
        // Session cookie can lag the first paint. Retry before giving up.
      }
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)))
    }
    return peekCoachHome(userId)
  })()
  inflight = { userId, promise }
  void promise.finally(() => {
    if (inflight?.promise === promise) inflight = null
  })
  return promise
}
