import type { ImageSourcePropType } from 'react-native'

export type StudentNotiRow = 'pin-msg-noti' | 'noti-only' | 'none'

export type MyCoachStudent = {
  id: string
  name: string
  /** Subtitle under name: `areaLocation` if set, else `@username`, else em dash. */
  location: string
  /** Absolute image URL for chat / deep links (avatar may be a bundled `require`). */
  imageUri?: string | null
  actualScore: number
  lastScore: number
  avatar: ImageSourcePropType
  notiRow: StudentNotiRow
  /** When set, coach has a pending `coach_video_review` for this student. */
  pendingCoachReviewId?: string | null
  /** Target user’s `user_profile.coachStudentRole` (for “Make coach” visibility). */
  coachStudentRole?: 'none' | 'coach' | 'student'
}
