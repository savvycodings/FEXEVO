import { TRAIN_CATEGORIES, trainStrokeLabel, type TrainStrokePreset } from './train-taxonomy'

const TRAIN_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  TRAIN_CATEGORIES.map((c) => [c.id, c.label])
)

export const INSIGHT_HEADLINE_MAX_WORDS = 3
export const INSIGHT_HEADLINE_MAX_CHARS = 48
export const INSIGHT_BODY_MAX_CHARS = 220
export const ACTIVITY_SHOT_TITLE_MAX_CHARS = 40
export const STRENGTH_HEADLINE_FALLBACK = 'Your shot'
export const FOCUS_HEADLINE_FALLBACK = 'Next focus'
export const ACTIVITY_SHOT_TITLE_FALLBACK = 'Technique'

export type CoachInsightCardsInput = {
  strokeLabel?: string | null
  strokePreset?: string | null
  shotContext?: string | null
  primaryTrainCategory?: string | null
  strengths?: string[]
  observations?: string[]
  actionableCorrections?: string[]
  technicalErrors?: string[]
  diagnosis?: string | null
}

export type CoachInsightCardsContent = {
  strengthTitle: string
  strengthBody: string
  focusTitle: string
  focusBody: string
}

function trainCategoryLabel(raw: string | undefined): string {
  if (!raw?.trim()) return ''
  const id = raw.trim()
  return TRAIN_CATEGORY_LABELS[id] ?? id.replace(/_/g, ' ')
}

function clipInsightTitle(text: string, maxLen: number): string {
  const t = text.trim()
  if (!t) return ''
  if (t.length <= maxLen) return t
  return `${t.slice(0, Math.max(0, maxLen - 1)).trim()}…`
}

function firstInsightSentence(text: string | undefined, maxLen: number): string {
  if (!text?.trim()) return ''
  const t = text.trim()
  const m = t.match(/^[^.!?]+[.!?]?/)
  const s = (m ? m[0] : t.split('\n')[0]) ?? t
  return clipInsightTitle(s, maxLen)
}

function strokePresetDisplayLabel(raw: string): string {
  const id = raw.trim()
  if (!id) return ''
  return trainStrokeLabel(id as TrainStrokePreset)
}

function insightHeadlineWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function stripCoachingFillerForHeadline(text: string): string {
  let t = text.trim()
  if (!t) return ''
  const firstClause = t.split(/[.!?]\s+/)[0] ?? t
  t = firstClause.split(/[,;]/)[0]?.trim() ?? firstClause
  t = t
    .replace(/^next\s+time,?\s+/i, '')
    .replace(/^try\s+to\s+/i, '')
    .replace(/^remember\s+to\s+/i, '')
    .replace(/^aim\s+to\s+/i, '')
    .replace(/^work\s+on\s+/i, '')
    .replace(/^focus\s+on\s+/i, '')
    .replace(/^you\s+should\s+/i, '')
    .replace(/^you\s+need\s+to\s+/i, '')
    .replace(/^you\s+must\s+/i, '')
    .replace(/^your\s+priority\s+is\s+to\s+/i, '')
    .replace(/^you(?:'re|\s+are)\s+(?:hitting|playing|executing|performing)\s+(?:a\s+)?/i, '')
    .replace(/^this\s+(?:clip\s+)?(?:shows|is)\s+(?:a\s+)?/i, '')
    .replace(/^the\s+main\s+issue\s+is\s+(?:that\s+)?/i, '')
    .replace(/^the\s+technical\s+(?:issue|problem)\s+is\s+(?:that\s+)?/i, '')
    .trim()
  return t
}

function finalizeInsightHeadline(candidate: string, fallback: string): string {
  const t = candidate.trim()
  if (!t) return fallback
  if (t.length > INSIGHT_HEADLINE_MAX_CHARS) return fallback
  const words = insightHeadlineWordCount(t)
  if (words < 1 || words > INSIGHT_HEADLINE_MAX_WORDS) return fallback
  if (words === 1 && t.length > 32) return fallback
  return t
}

export function completeInsightHeadline(raw: string, maxWords: number, fallback: string): string {
  const t = raw.trim()
  if (!t) return fallback
  const stripped = stripCoachingFillerForHeadline(t)
  const base = stripped.length > 0 ? stripped : t
  const n = insightHeadlineWordCount(base)
  if (n >= 1 && n <= maxWords) {
    return finalizeInsightHeadline(base, fallback)
  }

  const segments = base.split(/\s*[:\u2013\u2014]\s*/)
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i].trim()
    if (!seg) continue
    const cn = insightHeadlineWordCount(seg)
    if (cn >= 1 && cn <= maxWords && seg.length >= 2) {
      return finalizeInsightHeadline(seg, fallback)
    }
  }

  return fallback
}

function clipInsightBody(text: string): string {
  const t = text.trim()
  if (!t) return '—'
  return clipInsightTitle(t, INSIGHT_BODY_MAX_CHARS) || '—'
}

/** Short nav title for Activities / lists — never a full coaching paragraph. */
export function formatActivityShotTitle(opts: {
  /** Admin / pro-library shot name (preferred for titles). */
  strokeLabel?: string | null
  strokePreset?: string | null
  shotContext?: string | null
  sessionLabel?: string | null
}): string {
  const humanLabel = typeof opts.strokeLabel === 'string' ? opts.strokeLabel.trim() : ''
  if (humanLabel) {
    return clipInsightTitle(humanLabel, ACTIVITY_SHOT_TITLE_MAX_CHARS) || ACTIVITY_SHOT_TITLE_FALLBACK
  }
  const preset = typeof opts.strokePreset === 'string' ? opts.strokePreset.trim() : ''
  if (preset) {
    const label = strokePresetDisplayLabel(preset) || trainCategoryLabel(preset)
    if (label) {
      return clipInsightTitle(label, ACTIVITY_SHOT_TITLE_MAX_CHARS) || ACTIVITY_SHOT_TITLE_FALLBACK
    }
  }
  const sc = typeof opts.shotContext === 'string' ? opts.shotContext.trim() : ''
  if (sc) {
    const cleaned = sc.replace(/\s*\(?\s*(?:low|medium|high)\s*confidence\s*\)?\.?$/i, '').trim()
    const phrase = (cleaned.split(/[.!?]/)[0]?.trim() ?? cleaned).slice(0, 120)
    const headline = completeInsightHeadline(
      phrase,
      INSIGHT_HEADLINE_MAX_WORDS,
      ACTIVITY_SHOT_TITLE_FALLBACK
    )
    if (headline !== ACTIVITY_SHOT_TITLE_FALLBACK && headline !== STRENGTH_HEADLINE_FALLBACK) {
      return clipInsightTitle(headline, ACTIVITY_SHOT_TITLE_MAX_CHARS) || ACTIVITY_SHOT_TITLE_FALLBACK
    }
  }
  const sess = typeof opts.sessionLabel === 'string' ? opts.sessionLabel.trim() : ''
  if (sess) {
    const titled = sess.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    return clipInsightTitle(titled, ACTIVITY_SHOT_TITLE_MAX_CHARS) || ACTIVITY_SHOT_TITLE_FALLBACK
  }
  return ACTIVITY_SHOT_TITLE_FALLBACK
}

export function buildCoachInsightCardsContent(
  input: CoachInsightCardsInput
): CoachInsightCardsContent {
  const strengthsList = Array.isArray(input.strengths) ? input.strengths : []
  const technicalErrorsList = Array.isArray(input.technicalErrors) ? input.technicalErrors : []
  const actionableCorrectionsList = Array.isArray(input.actionableCorrections)
    ? input.actionableCorrections
    : []

  const strengthCandidates: string[] = []
  const fromLabel =
    typeof input.strokeLabel === 'string' ? input.strokeLabel.trim() : ''
  if (fromLabel) {
    strengthCandidates.push(
      completeInsightHeadline(fromLabel, INSIGHT_HEADLINE_MAX_WORDS, STRENGTH_HEADLINE_FALLBACK)
    )
  }
  const fromHyp =
    typeof input.strokePreset === 'string' ? input.strokePreset.trim() : ''
  if (fromHyp && !fromLabel) {
    const label = strokePresetDisplayLabel(fromHyp)
    if (label) {
      strengthCandidates.push(
        completeInsightHeadline(label, INSIGHT_HEADLINE_MAX_WORDS, STRENGTH_HEADLINE_FALLBACK)
      )
    }
  }
  const sc = typeof input.shotContext === 'string' ? input.shotContext : ''
  if (sc.trim()) {
    const cleaned = sc.replace(/\s*\(?\s*(?:low|medium|high)\s*confidence\s*\)?\.?$/i, '').trim()
    const phrase = (cleaned.split(/[.!?]/)[0]?.trim() ?? cleaned).slice(0, 120)
    strengthCandidates.push(
      completeInsightHeadline(phrase, INSIGHT_HEADLINE_MAX_WORDS, STRENGTH_HEADLINE_FALLBACK)
    )
  }
  const cat =
    typeof input.primaryTrainCategory === 'string' ? input.primaryTrainCategory.trim() : ''
  if (cat) {
    strengthCandidates.push(
      completeInsightHeadline(
        trainCategoryLabel(cat),
        INSIGHT_HEADLINE_MAX_WORDS,
        STRENGTH_HEADLINE_FALLBACK
      )
    )
  }
  const strengthTitle =
    strengthCandidates.find((c) => c.length > 0 && c !== STRENGTH_HEADLINE_FALLBACK) ??
    strengthCandidates.find((c) => c.length > 0) ??
    '—'

  let strengthBody = '—'
  if (strengthsList.length > 0) strengthBody = clipInsightBody(strengthsList[0])
  else {
    const obs = input.observations
    const first = Array.isArray(obs) ? obs[0] : null
    if (typeof first === 'string' && first.trim()) strengthBody = clipInsightBody(first)
  }

  let focusRaw = ''
  if (actionableCorrectionsList.length > 0) focusRaw = actionableCorrectionsList[0].trim()
  if (!focusRaw && technicalErrorsList.length > 0) focusRaw = technicalErrorsList[0].trim()
  const focusTitle = focusRaw
    ? completeInsightHeadline(focusRaw, INSIGHT_HEADLINE_MAX_WORDS, FOCUS_HEADLINE_FALLBACK)
    : '—'

  let focusBody = '—'
  if (technicalErrorsList.length > 0 && actionableCorrectionsList.length > 0) {
    focusBody = clipInsightBody(actionableCorrectionsList[0])
  } else if (actionableCorrectionsList.length > 1) {
    focusBody = clipInsightBody(actionableCorrectionsList[1])
  } else if (actionableCorrectionsList.length > 0) {
    focusBody = clipInsightBody(actionableCorrectionsList[0])
  } else {
    const d = typeof input.diagnosis === 'string' ? input.diagnosis : ''
    if (d) focusBody = clipInsightBody(firstInsightSentence(d, INSIGHT_BODY_MAX_CHARS))
  }

  return { strengthTitle, strengthBody, focusTitle, focusBody }
}

export function shouldShowCoachInsightCards(input: CoachInsightCardsInput): boolean {
  const hasStructured =
    (Array.isArray(input.strengths) && input.strengths.length > 0) ||
    (Array.isArray(input.observations) && input.observations.length > 0) ||
    (Array.isArray(input.actionableCorrections) && input.actionableCorrections.length > 0) ||
    (Array.isArray(input.technicalErrors) && input.technicalErrors.length > 0)
  const hasShotLabel =
    Boolean(input.strokePreset?.trim()) ||
    (typeof input.shotContext === 'string' &&
      input.shotContext.trim().length > 0 &&
      input.shotContext.trim().length <= 200)
  return hasStructured || hasShotLabel
}
