import type { TFunction } from 'i18next'
import { authClient } from './auth-client'

/**
 * Fixed coach specialty catalog, in display order. Keep in sync with
 * BEXevo/src/coach/coachSpecialties.ts (BEXevo's coachSpecialtiesParity.test.ts checks it).
 */
export const COACH_SPECIALTY_KEYS = [
  'technique',
  'tactics',
  'matchplay',
  'fitness',
  'mental',
  'beginners',
  'juniors',
  'competition',
] as const
export type CoachSpecialtyKey = (typeof COACH_SPECIALTY_KEYS)[number]

export const MAX_COACH_SPECIALTIES = 5
/** Chips that fit on a coach card next to the shield and Follow button. */
export const CARD_CHIP_LIMIT = 3

export function isCoachSpecialtyKey(key: unknown): key is CoachSpecialtyKey {
  return typeof key === 'string' && (COACH_SPECIALTY_KEYS as readonly string[]).includes(key)
}

/** Known keys only, deduped, in catalog order. */
export function sortSpecialties(keys: readonly unknown[] | null | undefined): CoachSpecialtyKey[] {
  const set = new Set((keys ?? []).filter(isCoachSpecialtyKey))
  return COACH_SPECIALTY_KEYS.filter((k) => set.has(k))
}

export function specialtyI18nKey(key: CoachSpecialtyKey): string {
  return `coachSpecialties.${key}`
}

/** Every specialty as a translated label (detail screen, Specialties card). */
export function specialtyLabels(keys: readonly unknown[] | null | undefined, t: TFunction): string[] {
  return sortSpecialties(keys).map((k) => t(specialtyI18nKey(k)))
}

/** Labels for a coach card: the first 3, then "+N" for the rest. */
export function chipsForCard(keys: readonly unknown[] | null | undefined, t: TFunction): string[] {
  const labels = specialtyLabels(keys, t)
  if (labels.length <= CARD_CHIP_LIMIT) return labels
  return [...labels.slice(0, CARD_CHIP_LIMIT), `+${labels.length - CARD_CHIP_LIMIT}`]
}

/** Replace the signed-in coach's specialties. Returns the saved list; throws on failure. */
export async function saveCoachSpecialties(keys: readonly CoachSpecialtyKey[]): Promise<CoachSpecialtyKey[]> {
  const res = await authClient
    .$fetch<{ specialties?: string[]; error?: string }>('/coach/specialties', {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      // Stringified here: on the web build the client sent a plain object as "[object Object]".
      body: JSON.stringify({ specialties: [...keys] }),
    })
    .catch(() => null)
  const r = res as { data?: { specialties?: unknown }; error?: { message?: string } } | null
  if (!r || r.error || !Array.isArray(r.data?.specialties)) {
    throw new Error(r?.error?.message || 'Failed to save specialties')
  }
  return sortSpecialties(r.data!.specialties as unknown[])
}
