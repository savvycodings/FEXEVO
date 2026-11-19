import type { ContactJoint, ContactJoints, JointReading } from '../../lib/jointsApi'
import type { BodyPartId } from './jointIcons'
import { mistakeFocusOrder, type MistakeId } from './BiggestMistakesView'

export type PriorityFix = {
  id: BodyPartId
  /** High = red pill; adjust = orange. */
  tone: 'high' | 'adjust'
}

const PART_ORDER: BodyPartId[] = [
  'head',
  'shoulder',
  'elbow',
  'wrist',
  'torso',
  'knee',
  'feet',
  'racket',
]

const JOINT_FOR_PART: Partial<Record<BodyPartId, ContactJoint>> = {
  shoulder: 'shoulder',
  elbow: 'elbow',
  wrist: 'wrist',
  torso: 'torso',
  knee: 'knee',
  /** Racket face is inferred from wrist angle when the coach names the racket. */
  racket: 'wrist',
}

const ERROR_WORDS: Record<BodyPartId, string[]> = {
  head: ['head', 'cabeza'],
  shoulder: ['shoulder', 'hombro'],
  elbow: ['elbow', 'codo'],
  wrist: ['wrist', 'muñeca'],
  torso: ['torso', 'rotation', 'rotación', 'hip', 'cadera'],
  knee: ['knee', 'rodilla'],
  feet: ['foot', 'feet', 'pie', 'base', 'stance'],
  racket: ['racket', 'raqueta', 'pala', 'face'],
}

type Ranked = PriorityFix & { weight: number }

function readingSeverity(reading: JointReading | undefined): 'high' | 'adjust' | null {
  if (reading?.status === 'bad') return 'high'
  if (reading?.status === 'warn') return 'adjust'
  const delta = reading?.deltaDeg
  if (delta != null && Number.isFinite(delta)) {
    const a = Math.abs(delta)
    if (a >= 15) return 'high'
    if (a > 5) return 'adjust'
  }
  return null
}

function errorSeverity(part: BodyPartId, errors: string[]): 'high' | null {
  const words = ERROR_WORDS[part]
  if (words.some((w) => errors.some((e) => e.toLowerCase().includes(w)))) return 'high'
  return null
}

function weightOf(reading: JointReading | undefined, tone: 'high' | 'adjust'): number {
  const delta = reading?.deltaDeg
  if (delta != null && Number.isFinite(delta)) return Math.abs(delta)
  return tone === 'high' ? 20 : 10
}

function sortRanked(rows: Ranked[]): Ranked[] {
  return rows.sort((a, b) => {
    if (a.tone !== b.tone) return a.tone === 'high' ? -1 : 1
    return b.weight - a.weight
  })
}

function fromMistakeOrder(errors: string[], limit: number): PriorityFix[] {
  const mapped: BodyPartId[] = mistakeFocusOrder(errors).map((id) =>
    id === 'foot' ? 'feet' : id
  )
  const uniq: BodyPartId[] = []
  for (const id of mapped) {
    if (!uniq.includes(id)) uniq.push(id)
  }
  return uniq.slice(0, limit).map((id, i) => ({
    id,
    tone: i === 0 ? 'high' : 'adjust',
  }))
}

/**
 * Top Priority Fixes for Overview (and Action Plan), from contact-joint deltas
 * plus coach error lines — not a fixed elbow/knee/foot set.
 */
export function overviewPriorityFixes(
  contact: ContactJoints | null,
  errors: string[],
  limit = 3
): PriorityFix[] {
  const cleanErrors = errors.map((e) => e.trim()).filter(Boolean)
  const ranked: Ranked[] = []

  for (const id of PART_ORDER) {
    const joint = JOINT_FOR_PART[id]
    const reading = joint && contact ? contact.joints[joint] : undefined
    const fromError = errorSeverity(id, cleanErrors)
    const fromJoint = readingSeverity(reading)

    // Racket shares the wrist reading — only surface it when the coach names the racket.
    if (id === 'racket' && !fromError) continue
    // Prefer the racket pill when the coach names the racket; skip a duplicate wrist pill.
    if (
      id === 'wrist' &&
      cleanErrors.some((e) => ERROR_WORDS.racket.some((w) => e.toLowerCase().includes(w)))
    ) {
      continue
    }

    const tone: 'high' | 'adjust' | null =
      fromJoint === 'high' || fromError === 'high'
        ? 'high'
        : fromJoint === 'adjust'
          ? 'adjust'
          : null
    if (!tone) continue
    ranked.push({ id, tone, weight: weightOf(reading, tone) })
  }

  if (ranked.length) return sortRanked(ranked).slice(0, limit).map(({ id, tone }) => ({ id, tone }))

  // No flagged severity yet — rank by largest absolute delta so the row still reflects this shot.
  if (contact) {
    const byDelta: Ranked[] = []
    const seen = new Set<BodyPartId>()
    for (const id of PART_ORDER) {
      if (id === 'racket' || id === 'head' || id === 'feet') continue
      const joint = JOINT_FOR_PART[id]
      if (!joint || seen.has(id)) continue
      const reading = contact.joints[joint]
      const delta = reading?.deltaDeg
      if (delta == null || !Number.isFinite(delta)) continue
      seen.add(id)
      const a = Math.abs(delta)
      byDelta.push({
        id,
        tone: a >= 15 ? 'high' : a > 5 ? 'adjust' : 'adjust',
        weight: a,
      })
    }
    if (byDelta.length) {
      return sortRanked(byDelta)
        .slice(0, limit)
        .map(({ id, tone }, i) => ({ id, tone: i === 0 && tone === 'adjust' && byDelta[0]!.weight < 6 ? 'adjust' : tone }))
    }
  }

  if (cleanErrors.length) return fromMistakeOrder(cleanErrors, limit)

  // Cold start before joints/errors land — stable placeholder, still not the old fixed trio logic path once data arrives.
  return fromMistakeOrder([], limit)
}

/** Map a body-part priority into Action Plan mistake cards. */
export function bodyPartToMistakeId(id: BodyPartId): MistakeId {
  if (id === 'feet' || id === 'knee') return 'foot'
  if (id === 'shoulder') return 'elbow'
  if (id === 'wrist' || id === 'racket') return 'racket'
  if (id === 'head') return 'torso'
  if (id === 'elbow' || id === 'torso') return id
  return 'elbow'
}

export function actionPlanFocusIds(
  contact: ContactJoints | null,
  errors: string[],
  limit = 3
): { id: MistakeId; tone: 'high' | 'adjust' }[] {
  const parts = overviewPriorityFixes(contact, errors, limit + 2)
  const out: { id: MistakeId; tone: 'high' | 'adjust' }[] = []
  for (const p of parts) {
    const id = bodyPartToMistakeId(p.id)
    if (out.some((row) => row.id === id)) continue
    out.push({ id, tone: p.tone })
    if (out.length >= limit) break
  }
  if (out.length) return out
  return mistakeFocusOrder(errors)
    .slice(0, limit)
    .map((id, i) => ({ id, tone: i === 0 ? 'high' : 'adjust' }))
}
