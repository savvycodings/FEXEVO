/**
 * Align with server `storedAiScoreToPercent`.
 * Legacy rows: 0–10 without `score_scale`; new rows: `score_scale === 'percent'`.
 */
export function storedAiScoreToPercent(
  ai: Record<string, unknown> | null | undefined
): number | null {
  const score = typeof ai?.score === 'number' ? ai.score : null
  if (score == null || !Number.isFinite(score)) return null
  if (String(ai?.score_scale).toLowerCase() === 'percent') {
    return Math.round(Math.max(0, Math.min(100, score)))
  }
  const raw = typeof ai?.score_model_raw === 'number' ? ai.score_model_raw : null
  const legacyDecile = score <= 10 && score >= 0 && (raw == null || raw <= 10)
  if (legacyDecile) {
    return Math.round(Math.max(0, Math.min(100, score * 10)))
  }
  return Math.round(Math.max(0, Math.min(100, score)))
}

function normalize0to100(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value >= 0 && value <= 1) return Math.round(value * 100)
  return Math.round(Math.max(0, Math.min(100, value)))
}

export function storedAiBreakdownToPercent(
  ai: Record<string, unknown> | null | undefined
): { technique: number | null; outcome: number | null; tactics: number | null } {
  const breakdown =
    ai?.breakdown && typeof ai.breakdown === 'object'
      ? (ai.breakdown as Record<string, unknown>)
      : null
  return {
    technique: normalize0to100(ai?.technique_score) ?? normalize0to100(breakdown?.technique),
    outcome: normalize0to100(ai?.outcome_score) ?? normalize0to100(breakdown?.outcome),
    tactics: normalize0to100(ai?.tactics_score) ?? normalize0to100(breakdown?.tactics),
  }
}

export function storedAiConfidenceToPercent(
  ai: Record<string, unknown> | null | undefined
): { score: number | null; band: string | null; uncertaintyPlusMinus: number | null } {
  const confidence =
    ai?.confidence && typeof ai.confidence === 'object'
      ? (ai.confidence as Record<string, unknown>)
      : null
  const uncertainty = confidence?.uncertainty_plus_minus
  return {
    score: normalize0to100(ai?.confidence_score) ?? normalize0to100(confidence?.score),
    band: typeof confidence?.band === 'string' ? confidence.band : null,
    uncertaintyPlusMinus:
      typeof uncertainty === 'number' && Number.isFinite(uncertainty)
        ? Math.max(0, Math.round(uncertainty))
        : null,
  }
}
