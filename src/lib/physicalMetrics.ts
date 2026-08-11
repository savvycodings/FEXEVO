export type PhysicalMetricKey =
  | 'stability'
  | 'power'
  | 'agility'
  | 'reactions'
  | 'acceleration'

export type PhysicalMetricsValues = Record<PhysicalMetricKey, number>

export const PHYSICAL_METRIC_KEYS: PhysicalMetricKey[] = [
  'stability',
  'power',
  'agility',
  'reactions',
  'acceleration',
]

export const PHYSICAL_METRIC_ABBREV: Record<PhysicalMetricKey, string> = {
  stability: 'ST',
  power: 'PW',
  agility: 'AG',
  reactions: 'RT',
  acceleration: 'AC',
}

export const PHYSICAL_CURRENT_COLOR = '#00B8FF'
export const PHYSICAL_PRIOR_COLOR = '#0022FF'

export type PhysicalHistoryItem = {
  analysisId: string
  createdAt: string
  score: number | null
  physicalMetrics: PhysicalMetricsValues
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function parsePhysicalMetricsFromAnalysis(
  aiAnalysis: Record<string, unknown> | null | undefined
): PhysicalMetricsValues | null {
  if (!aiAnalysis) return null
  const raw = aiAnalysis.physical_metrics
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const out: Partial<PhysicalMetricsValues> = {}
  for (const key of PHYSICAL_METRIC_KEYS) {
    const v = o[key]
    if (typeof v !== 'number' && typeof v !== 'string') return null
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(n)) return null
    out[key] = clampPercent(n)
  }
  return out as PhysicalMetricsValues
}

export function physicalMetricsRadarValues(metrics: PhysicalMetricsValues): number[] {
  return PHYSICAL_METRIC_KEYS.map((k) => metrics[k])
}

/**
 * History is newest-first from the API.
 * Selected session → current (cyan); the next older item → prior (dark blue).
 */
export function pickCurrentAndPrior(
  historyNewestFirst: PhysicalHistoryItem[],
  selectedAnalysisId: string | null | undefined
): {
  selectedIndex: number
  current: PhysicalHistoryItem | null
  prior: PhysicalHistoryItem | null
} {
  if (!historyNewestFirst.length) {
    return { selectedIndex: -1, current: null, prior: null }
  }
  let selectedIndex = 0
  if (selectedAnalysisId) {
    const found = historyNewestFirst.findIndex((h) => h.analysisId === selectedAnalysisId)
    if (found >= 0) selectedIndex = found
  }
  const current = historyNewestFirst[selectedIndex] ?? null
  const prior = historyNewestFirst[selectedIndex + 1] ?? null
  return { selectedIndex, current, prior }
}

/** Chronological oldest→newest for the bar strip (Today on the right). */
export function historyBarsOldestFirst(
  historyNewestFirst: PhysicalHistoryItem[]
): PhysicalHistoryItem[] {
  return [...historyNewestFirst].reverse()
}

export function isSameCalendarDay(iso: string, now = new Date()): boolean {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return false
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export function shortHistoryBarLabel(iso: string, now = new Date()): string {
  if (isSameCalendarDay(iso, now)) return 'Today'
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
