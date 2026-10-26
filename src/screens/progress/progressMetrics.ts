import type { ActivitySession } from '../../lib/activitySession'

export const MAX_ALL_TIME_WEEKS = 52
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export type PeriodKey = 4 | 8 | 12 | 'all'
export type ChartMetric = 'overall' | 'technique' | 'outcome' | 'tactics'

export function mondayLocal(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

export function pickMetric(s: ActivitySession, m: ChartMetric): number | null {
  switch (m) {
    case 'overall':
      return typeof s.score === 'number' && Number.isFinite(s.score) ? s.score : null
    case 'technique':
      return typeof s.techniqueScore === 'number' ? s.techniqueScore : null
    case 'outcome':
      return typeof s.outcomeScore === 'number' ? s.outcomeScore : null
    case 'tactics':
      return typeof s.tacticsScore === 'number' ? s.tacticsScore : null
    default:
      return null
  }
}

export function completedSessions(sessions: ActivitySession[]): ActivitySession[] {
  return sessions.filter((s) => s.status === 'completed')
}

/** Average numeric field over sessions in [start, end). */
export function avgInRange(
  sessions: ActivitySession[],
  start: Date,
  end: Date,
  getter: (s: ActivitySession) => number | null
): number | null {
  const vals: number[] = []
  const t0 = start.getTime()
  const t1 = end.getTime()
  for (const s of sessions) {
    const t = new Date(s.createdAt).getTime()
    if (t < t0 || t >= t1) continue
    const v = getter(s)
    if (v != null && Number.isFinite(v)) vals.push(Math.max(0, Math.min(100, v)))
  }
  if (!vals.length) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

export function resolveNumWeeks(period: PeriodKey, sessions: ActivitySession[]): number {
  if (period !== 'all') return period
  const done = completedSessions(sessions)
  if (!done.length) return 8
  let oldest = new Date(done[0].createdAt)
  for (const s of done) {
    const d = new Date(s.createdAt)
    if (d < oldest) oldest = d
  }
  const curMon = mondayLocal(new Date())
  const firstMon = mondayLocal(oldest)
  const diffMs = curMon.getTime() - firstMon.getTime()
  const weeks = Math.max(1, Math.ceil(diffMs / WEEK_MS) + 1)
  return Math.min(MAX_ALL_TIME_WEEKS, Math.max(4, weeks))
}

/** Monday that starts an N-week window ending with the current week. */
export function windowStart(numWeeks: number): Date {
  const currentMonday = mondayLocal(new Date())
  const start = new Date(currentMonday)
  start.setDate(currentMonday.getDate() - (numWeeks - 1) * 7)
  return start
}

export function weeklySeries(
  sessions: ActivitySession[],
  numWeeks: number,
  metric: ChartMetric
): (number | null)[] {
  const done = completedSessions(sessions)
  const oldestMonday = windowStart(numWeeks)

  const out: (number | null)[] = []
  for (let w = 0; w < numWeeks; w++) {
    const ws = new Date(oldestMonday)
    ws.setDate(oldestMonday.getDate() + w * 7)
    const we = new Date(ws)
    we.setDate(ws.getDate() + 7)
    out.push(avgInRange(done, ws, we, (s) => pickMetric(s, metric)))
  }
  return out
}

export function carryForward(series: (number | null)[]): number[] {
  let last: number | null = null
  return series.map((v) => {
    if (v != null) {
      last = v
      return v
    }
    return last ?? 0
  })
}

/**
 * Current N-week window average minus the average of the N weeks before it.
 * `null` when either window has no scored sessions, or for All Time (no prior window).
 */
export function previousWindowDelta(
  sessions: ActivitySession[],
  period: PeriodKey,
  metric: ChartMetric
): number | null {
  if (period === 'all') return null
  const done = completedSessions(sessions)
  const curStart = windowStart(period)
  const prevStart = new Date(curStart)
  prevStart.setDate(curStart.getDate() - period * 7)
  // Ends with the current week (like the chart), so a just-finished session isn't lost to clock skew.
  const curEnd = new Date(curStart)
  curEnd.setDate(curStart.getDate() + period * 7)
  const getter = (s: ActivitySession) => pickMetric(s, metric)
  const cur = avgInRange(done, curStart, curEnd, getter)
  const prev = avgInRange(done, prevStart, curStart, getter)
  if (cur == null || prev == null) return null
  return Math.round(cur - prev)
}

export function pillarAveragesWindow(
  sessions: ActivitySession[],
  start: Date,
  end: Date
): { technique: number | null; outcome: number | null; tactics: number | null } {
  return {
    technique: avgInRange(sessions, start, end, (s) => pickMetric(s, 'technique')),
    outcome: avgInRange(sessions, start, end, (s) => pickMetric(s, 'outcome')),
    tactics: avgInRange(sessions, start, end, (s) => pickMetric(s, 'tactics')),
  }
}

export function sessionsThisCalendarWeek(sessions: ActivitySession[]): number {
  const mon = mondayLocal(new Date())
  const next = new Date(mon)
  next.setDate(mon.getDate() + 7)
  let n = 0
  for (const s of sessions) {
    if (s.status !== 'completed') continue
    const t = new Date(s.createdAt).getTime()
    if (t >= mon.getTime() && t < next.getTime()) n += 1
  }
  return n
}

/** Mon=0 … Sun=6 for current calendar week */
export function activityDaysThisWeek(sessions: ActivitySession[]): boolean[] {
  const days = [false, false, false, false, false, false, false]
  const mon = mondayLocal(new Date())
  const next = new Date(mon)
  next.setDate(mon.getDate() + 7)
  for (const s of sessions) {
    if (s.status !== 'completed') continue
    const d = new Date(s.createdAt)
    const t = d.getTime()
    if (t < mon.getTime() || t >= next.getTime()) continue
    days[(d.getDay() + 6) % 7] = true
  }
  return days
}
