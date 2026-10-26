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
  /** Still frame of the uploaded video (Cloudinary), when available. */
  thumbnailUrl?: string | null
  durationMs?: number | null
  /** Train category id (e.g. `net_play`), when the analysis resolved one. */
  category?: string | null
  physicalMetrics?: { stability: number; power: number; agility: number } | null
  rating?: string | null
  coachReviewId?: string | null
  coachReviewStatus?: string | null
  coachFeedbackText?: string | null
  coachMarksJson?: unknown | null
  coachReviewedAt?: string | null
}
