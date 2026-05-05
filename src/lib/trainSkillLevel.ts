/**
 * Train videos use enum beginner | intermediate | advanced only.
 */

const SKILL_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

export const TRAIN_SKILL_LEVEL_IDS = ['beginner', 'intermediate', 'advanced'] as const
export type TrainSkillLevelId = (typeof TRAIN_SKILL_LEVEL_IDS)[number]

export function formatTrainSkillLevel(raw: string | undefined | null): string {
  if (raw == null || raw === '') return '—'
  const k = raw.toLowerCase().trim()
  return SKILL_LABELS[k] ?? raw.replace(/_/g, ' ')
}
