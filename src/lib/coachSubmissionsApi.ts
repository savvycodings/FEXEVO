import { authClient } from './auth-client'
import { DOMAIN } from '../../constants'

export type CoachSubmissionStatus = 'pending' | 'completed' | string

export type CoachSubmission = {
  reviewId: string
  createdAt: string
  status: CoachSubmissionStatus
  studentUserId: string
  studentName: string
  studentImage: string | null
  techniqueVideoId: string
  techniqueAnalysisId: string | null
  shotLabel: string | null
  score: number | null
}

type RawCoachSubmission = Omit<CoachSubmission, 'createdAt'> & {
  createdAt: string | number | Date | null
}

function toAbsoluteImage(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http')) return trimmed
  const rel = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${DOMAIN.replace(/\/+$/, '')}${rel}`
}

export async function fetchCoachSubmissions(): Promise<CoachSubmission[]> {
  const res = await authClient
    .$fetch('/coach/submissions', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    .catch(() => null)
  const body = ((res as { data?: unknown })?.data ?? res) as {
    submissions?: RawCoachSubmission[]
    error?: string
  }
  if (!Array.isArray(body?.submissions)) return []
  return body.submissions.map((s) => ({
    reviewId: s.reviewId,
    createdAt:
      s.createdAt != null ? new Date(s.createdAt).toISOString() : new Date(0).toISOString(),
    status: s.status,
    studentUserId: s.studentUserId,
    studentName: typeof s.studentName === 'string' && s.studentName.trim() ? s.studentName.trim() : 'Student',
    studentImage: toAbsoluteImage(s.studentImage),
    techniqueVideoId: s.techniqueVideoId,
    techniqueAnalysisId: s.techniqueAnalysisId ?? null,
    shotLabel: typeof s.shotLabel === 'string' && s.shotLabel.trim() ? s.shotLabel.trim() : null,
    score: typeof s.score === 'number' ? s.score : null,
  }))
}
