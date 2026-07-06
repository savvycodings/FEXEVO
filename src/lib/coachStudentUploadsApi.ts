import { authClient } from './auth-client'

export type StudentUploadKind = 'student_upload' | 'coach_sent'

export type StudentUploadRow = {
  id: string
  kind: StudentUploadKind
  reviewId: string | null
  sentVideoId: string | null
  techniqueVideoId: string
  techniqueAnalysisId: string | null
  videoPath: string
  title: string
  subtitle: string | null
  score: number | null
  lastScore: number | null
  commentCount: number
  rating: string | null
  coachReviewStatus: string | null
  createdAt: string
}

export async function fetchStudentUploadsForCoach(
  studentUserId: string
): Promise<StudentUploadRow[]> {
  const trimmed = studentUserId.trim()
  if (!trimmed) return []

  const res = await authClient
    .$fetch(`/coach/students/${encodeURIComponent(trimmed)}/uploads`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    .catch(() => null)

  const body = ((res as { data?: unknown })?.data ?? res) as {
    uploads?: StudentUploadRow[]
    error?: string
  }

  if (!Array.isArray(body?.uploads)) return []
  return body.uploads.map((row) => ({
    id: row.id,
    kind: row.kind === 'coach_sent' ? 'coach_sent' : 'student_upload',
    reviewId: row.reviewId ?? null,
    sentVideoId: row.sentVideoId ?? null,
    techniqueVideoId: row.techniqueVideoId,
    techniqueAnalysisId: row.techniqueAnalysisId ?? null,
    videoPath: row.videoPath,
    title: typeof row.title === 'string' && row.title.trim() ? row.title.trim() : 'Technique',
    subtitle: row.subtitle ?? null,
    score: typeof row.score === 'number' ? row.score : null,
    lastScore: typeof row.lastScore === 'number' ? row.lastScore : null,
    commentCount: typeof row.commentCount === 'number' ? row.commentCount : 0,
    rating: typeof row.rating === 'string' ? row.rating : null,
    coachReviewStatus: row.coachReviewStatus ?? null,
    createdAt: row.createdAt ?? new Date(0).toISOString(),
  }))
}
