/** Fields needed to derive good / bad / unknown from stored analysis (list card + video overlay). */
export type TechniqueQualityInput = {
  rating?: string | null
  score?: number | null
}

export type TechniqueQuality = 'good' | 'bad' | 'unknown'

/** Maps AI rating / score to a tone (scores are 0–100; 60+ treated as “good” band without rating). */
export function techniqueQualityTone(s: TechniqueQualityInput): TechniqueQuality {
  const r = (s.rating || '').toLowerCase()
  if (r === 'excellent' || r === 'good') return 'good'
  if (r === 'poor' || r === 'needs_improvement') return 'bad'
  const sc = s.score
  if (typeof sc === 'number') return sc >= 60 ? 'good' : 'bad'
  return 'unknown'
}
