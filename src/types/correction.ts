export type CorrectionFrameInsight = {
  frame: number
  label: string
  phase?: 'preparation' | 'impact' | 'follow_through' | 'other'
  summary: string
  focus_joints: string[]
  stats: {
    pro_match: number
    adjustment_need: number
    stability: number
    power_line: number
  }
  top_adjustments?: Array<{ joint: string; axis: string; direction: string }>
}

export type CorrectionContextPayload = {
  frames?: CorrectionFrameInsight[]
  coaching_summary?: {
    diagnosis?: string | null
    shot_context?: string | null
    actionable_corrections?: string[]
    recommendations?: string[]
  }
  frame_indices?: number[]
  frame_count?: number
}

export function parseCorrectionFrameInsights(
  raw: unknown,
  imageCount: number,
  fallbackDiagnosis?: string | null
): CorrectionFrameInsight[] {
  if (!raw || typeof raw !== 'object') {
    return buildFallbackInsights(imageCount, fallbackDiagnosis)
  }
  const frames = (raw as CorrectionContextPayload).frames
  if (!Array.isArray(frames) || frames.length === 0) {
    return buildFallbackInsights(imageCount, fallbackDiagnosis)
  }
  return frames
    .filter((f) => f && typeof f === 'object' && typeof f.frame === 'number')
    .map((f, idx) => ({
      frame: f.frame,
      label: typeof f.label === 'string' ? f.label : `Image ${idx + 1}`,
      phase: f.phase,
      summary:
        typeof f.summary === 'string' && f.summary.trim()
          ? f.summary.trim()
          : fallbackDiagnosis?.trim() || 'Corrected pose for this frame.',
      focus_joints: Array.isArray(f.focus_joints)
        ? f.focus_joints.filter((x): x is string => typeof x === 'string')
        : [],
      stats: {
        pro_match: clampPct(f.stats?.pro_match),
        adjustment_need: clampPct(f.stats?.adjustment_need),
        stability: clampPct(f.stats?.stability),
        power_line: clampPct(f.stats?.power_line),
      },
      top_adjustments: f.top_adjustments,
    }))
}

function clampPct(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return 50
  return Math.max(0, Math.min(100, Math.round(v)))
}

function buildFallbackInsights(
  imageCount: number,
  fallbackDiagnosis?: string | null
): CorrectionFrameInsight[] {
  const summary =
    fallbackDiagnosis?.trim() ||
    'This image shows how your body should move toward the pro library reference.'
  return Array.from({ length: Math.max(0, imageCount) }, (_, i) => ({
    frame: i,
    label: `Image ${i + 1}`,
    summary,
    focus_joints: [],
    stats: {
      pro_match: 50,
      adjustment_need: 50,
      stability: 50,
      power_line: 50,
    },
  }))
}

export function insightForCorrectionIndex(
  insights: CorrectionFrameInsight[],
  correctionImages: Array<{ frame: number }>,
  activeIndex: number
): CorrectionFrameInsight | null {
  const img = correctionImages[activeIndex]
  if (!img) return insights[activeIndex] ?? null
  return insights.find((f) => f.frame === img.frame) ?? insights[activeIndex] ?? null
}
