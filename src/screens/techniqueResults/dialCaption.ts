import { stripCoachRichMarkers } from '../../lib/coachRichText'

export type DialPearlTone = 'strength' | 'weakness' | 'cue'

export type DialPearl = {
  label: string
  tone: DialPearlTone
}

export type DialCaptionModel = {
  /** Short natural sentence for the dial (may include [[chips]]). */
  blurb: string | null
  /** Keyword pearls — strength / weakness / coaching cues. */
  pearls: DialPearl[]
}

const MAX_BLURB = 110
/** Pearls are single keywords — never long ellipsized phrases. */
const MAX_PEARL = 14

function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  const cut = clean.search(/(?<=[.!?])\s+/)
  return cut > 0 ? clean.slice(0, cut + 1).trim() : clean
}

function shorten(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const slice = t.slice(0, max - 1)
  const at = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf(','))
  return `${(at > 40 ? slice.slice(0, at) : slice).trimEnd()}…`
}

/** One keyword for a pearl pill (marked chip wins; otherwise first meaningful word). */
export function pearlLabel(line: string, max = MAX_PEARL): string | null {
  const marked = line.match(/\[\[([^\]]{2,48})\]\]|\*\*([^*]{2,48})\*\*/)
  if (marked) {
    const chip = String(marked[1] ?? marked[2] ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!chip) return null
    // Prefer a single token from multi-word chips ("racket face" → "racket").
    const first = chip.split(/\s+/)[0]?.replace(/[^a-zA-ZÀ-ÿ0-9'-]/g, '') ?? ''
    const word = first.length >= 3 ? first : chip.replace(/\s+/g, ' ').trim()
    return word ? word.slice(0, max) : null
  }
  const clean = stripCoachRichMarkers(line)
  if (!clean) return null
  const word = clean.match(/\b([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]{2,})\b/)
  const raw = (word?.[1] ?? '').trim()
  if (raw.length < 3) return null
  return raw.slice(0, max)
}

function pushPearl(out: DialPearl[], label: string | null, tone: DialPearlTone, seen: Set<string>) {
  if (!label) return
  const key = label.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  out.push({ label, tone })
}

/**
 * Dial copy next to the score ring: one short natural line + a few keyword pearls.
 * Strengths read green, mistakes read as “wrong” coral, cues stay blue.
 */
export function buildDialCaption(input: {
  diagnosis?: string | null
  strengths?: string[] | null
  weaknesses?: string[] | null
}): DialCaptionModel {
  const diagnosis = typeof input.diagnosis === 'string' ? input.diagnosis.trim() : ''
  const strengths = (input.strengths ?? []).filter((s) => typeof s === 'string' && s.trim())
  const weaknesses = (input.weaknesses ?? []).filter((s) => typeof s === 'string' && s.trim())

  const plainDiagnosis = stripCoachRichMarkers(diagnosis)
  const plainStrength = strengths[0] ? stripCoachRichMarkers(strengths[0]) : ''
  const plainWeakness = weaknesses[0] ? stripCoachRichMarkers(weaknesses[0]) : ''

  let blurbSource = firstSentence(plainDiagnosis)
  if (!blurbSource && plainStrength) {
    blurbSource = firstSentence(plainStrength)
  }
  if (!blurbSource && plainWeakness) {
    blurbSource = firstSentence(plainWeakness)
  }
  // Plain sentence only — keyword pearls sit in the pills beside the dial, not spaced chips in the line.
  const blurb = blurbSource ? shorten(blurbSource, MAX_BLURB) : null

  const pearls: DialPearl[] = []
  const seen = new Set<string>()
  pushPearl(pearls, pearlLabel(strengths[0] ?? ''), 'strength', seen)
  pushPearl(pearls, pearlLabel(weaknesses[0] ?? ''), 'weakness', seen)
  // Extra cue from diagnosis markers / auto terms, if different.
  if (diagnosis) {
    const chip = diagnosis.match(/\[\[([^\]]{2,48})\]\]|\*\*([^*]{2,48})\*\*/)
    if (chip) pushPearl(pearls, String(chip[1] ?? chip[2] ?? '').trim(), 'cue', seen)
  }
  // Second strength / weakness if we still have room.
  pushPearl(pearls, pearlLabel(strengths[1] ?? ''), 'strength', seen)
  pushPearl(pearls, pearlLabel(weaknesses[1] ?? ''), 'weakness', seen)

  return { blurb, pearls: pearls.slice(0, 3) }
}
