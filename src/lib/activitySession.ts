/** UI / activities list (optional fields from API for richer cards). */
export type ActivitySession = {
  analysisId: string
  techniqueVideoId: string
  status: string
  createdAt: string
  feedbackSnippet: string | null
  videoPath: string
  score?: number | null
  techniqueScore?: number | null
  outcomeScore?: number | null
  tacticsScore?: number | null
  confidenceScore?: number | null
  confidenceBand?: string | null
  uncertaintyPlusMinus?: number | null
  lastScore?: number | null
  shotLabel?: string | null
  rating?: string | null
  coachReviewId?: string | null
  coachReviewStatus?: string | null
  coachFeedbackText?: string | null
  coachMarksJson?: unknown | null
  coachReviewedAt?: string | null
}
