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
