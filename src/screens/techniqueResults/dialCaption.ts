import { enrichCoachRichMarkers, stripCoachRichMarkers } from '../../lib/coachRichText'

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
const MAX_PEARL = 26

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

/** Pull a short keyword from a coach line (marked chip wins, else a short lead phrase). */
export function pearlLabel(line: string, max = MAX_PEARL): string | null {
  const marked = line.match(/\[\[([^\]]{2,48})\]\]|\*\*([^*]{2,48})\*\*/)
  if (marked) {
    const chip = String(marked[1] ?? marked[2] ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    return chip ? chip.slice(0, max) : null
  }
  const clean = stripCoachRichMarkers(line)
  if (!clean) return null
  const lead = clean.match(
    /^(.{3,36}?)(?:\s+(?:is|are|was|were|looks|feels|needs|could|should|seems|stays|gets)\b|,|\.|$)/i
  )
  const raw = (lead?.[1] ?? clean).replace(/\s+/g, ' ').trim()
  if (raw.length < 3) return null
  return raw.length > max ? `${raw.slice(0, max - 1).trimEnd()}…` : raw
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
  const blurbPlain = blurbSource ? shorten(blurbSource, MAX_BLURB) : null
  // Re-mark coaching keywords so the line stays conversational with pearl highlights inline.
  const blurb = blurbPlain ? enrichCoachRichMarkers(blurbPlain) : null

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
