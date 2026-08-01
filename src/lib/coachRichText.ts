export type CoachRichSegment =
  | { type: 'text'; value: string }
  | { type: 'chip'; value: string }

/**
 * Match [[chip]] or **chip** (LLM often emits markdown bold instead of brackets).
 * Fresh regex each call so global lastIndex never leaks.
 */
function highlightPattern(): RegExp {
  return /\[\[([^\]]{1,48})\]\]|\*\*([^*]{1,48})\*\*/g
}

/** Longer phrases first so "weight transfer" wins over bare "weight". */
const AUTO_CHIP_TERMS = [
  'weight transfer',
  'split step',
  'racket face',
  'racket arm',
  'support arm',
  'contact point',
  'follow-through',
  'follow through',
  'ready position',
  'preparation',
  'acceleration',
  'stability',
  'reactions',
  'agility',
  'power',
] as const

const MAX_AUTO_CHIPS = 3

/**
 * When the model forgot [[markers]], wrap up to two known coaching terms so
 * ghost chips still appear for existing / untagged analyses.
 */
export function enrichCoachRichMarkers(input: string): string {
  if (!input?.trim()) return input
  if (/\[\[/.test(input) || /\*\*[^*]+\*\*/.test(input)) return input
  let out = input
  let count = 0
  for (const term of AUTO_CHIP_TERMS) {
    if (count >= MAX_AUTO_CHIPS) break
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\b(${escaped})\\b`, 'i')
    if (!re.test(out)) continue
    out = out.replace(re, '[[$1]]')
    count += 1
  }
  return out
}

/** Strip [[chip]] / **bold** markers for plain-text uses (headlines, titles). */
export function stripCoachRichMarkers(input: string): string {
  if (!input) return ''
  return input
    .replace(highlightPattern(), (_m, bracket, stars) => String(bracket ?? stars ?? ''))
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parse coach narrative into text + chip segments.
 * Supports [[phrase]] and **phrase**; auto-enriches common cues when unmarked.
 */
export function parseCoachRichText(input: string): CoachRichSegment[] {
  if (!input) return []
  const enriched = enrichCoachRichMarkers(input)
  const segments: CoachRichSegment[] = []
  let lastIndex = 0
  const re = highlightPattern()
  let match: RegExpExecArray | null
  while ((match = re.exec(enriched)) != null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: enriched.slice(lastIndex, match.index) })
    }
    const chip = String(match[1] ?? match[2] ?? '')
      .trim()
      .replace(/\s+/g, ' ')
    if (chip) {
      segments.push({ type: 'chip', value: chip })
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < enriched.length) {
    segments.push({ type: 'text', value: enriched.slice(lastIndex) })
  }
  if (segments.length === 0 && enriched) {
    return [{ type: 'text', value: enriched }]
  }
  return segments
}
