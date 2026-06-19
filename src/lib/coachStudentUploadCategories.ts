import type { TrainCategory } from './train-taxonomy'

/** Coach student upload — category picker labels (match product mockup). */
export const COACH_STUDENT_UPLOAD_CATEGORIES: { id: TrainCategory; labelKey: string }[] = [
  { id: 'save_return', labelKey: 'studentProfile.categories.serveReturn' },
  { id: 'ground_strokes', labelKey: 'studentProfile.categories.groundstrokes' },
  { id: 'net_play', labelKey: 'studentProfile.categories.netPlay' },
  { id: 'defence_glass', labelKey: 'studentProfile.categories.defenseWalls' },
  { id: 'overhead', labelKey: 'studentProfile.categories.overheads' },
  { id: 'tactical_specials', labelKey: 'studentProfile.categories.tacticalSpecials' },
]
