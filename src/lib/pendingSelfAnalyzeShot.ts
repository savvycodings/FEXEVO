import type { UserShotDeclaration } from '../navigation/types'

export type SelfAnalyzeCapture = 'record' | 'gallery'

type Pending = {
  action: SelfAnalyzeCapture
  shot: UserShotDeclaration | null
}

let pending: Pending | null = null

/** Remember record vs gallery while the shot stepper is open. */
export function beginSelfAnalyzeCapture(action: SelfAnalyzeCapture) {
  pending = { action, shot: null }
}

export function completeSelfAnalyzeShot(shot: UserShotDeclaration) {
  if (!pending) pending = { action: 'gallery', shot }
  pending = { ...pending, shot }
}

/** Read once when AI Coach regains focus. */
export function takeSelfAnalyzeShot(): { action: SelfAnalyzeCapture; shot: UserShotDeclaration } | null {
  if (!pending?.shot) return null
  const ready = { action: pending.action, shot: pending.shot }
  pending = null
  return ready
}
