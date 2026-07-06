import { authClient } from './auth-client'

/** Pending student video the coach has not opened yet (drives “New video” badge). */
export async function fetchPendingCoachReviewIdForStudent(
  studentUserId: string
): Promise<string | null> {
  const res = await authClient
    .$fetch('/profile/coach-students', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    .catch(() => null)
  const body = ((res as { data?: unknown })?.data ?? res) as {
    students?: { id: string; pendingCoachReviewId?: string | null }[]
  }
  const student = body.students?.find((s) => s.id === studentUserId)
  const id = student?.pendingCoachReviewId
  return typeof id === 'string' && id.trim().length > 0 ? id.trim() : null
}
