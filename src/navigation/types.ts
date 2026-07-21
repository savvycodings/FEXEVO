import type { NavigatorScreenParams } from "@react-navigation/native";
import type { TrainCategory, TrainStrokePreset } from "../lib/train-taxonomy";

export type ClubId = "i95" | "reserve";

export type CoachId = "steve" | "carlos" | "slama";

export type ProgressTabStackParamList = {
  ProgressMain: undefined;
  DailyQuest: undefined;
  AllAchievements: undefined;
  AchievementDetail: { achievementKey: string };
  Ranking: undefined;
  LeaderboardPlayer: {
    userId: string;
    name: string;
    image: string | null;
    areaLocation: string | null;
    totalXp: number;
    rank: number;
    overallScore: number | null;
  };
};

export type YouTabStackParamList = {
  YouMain: undefined;
  CoachProfileSectionEdit: undefined;
};

/** My Coach tab: list + per-student chat (keeps bottom tab bar visible on chat). */
export type CoachStudentChatParams = {
  peerUserId: string;
  peerName: string;
  peerLocation: string;
  actualScore: number;
  lastScore: number;
  peerImageUri?: string | null;
  pendingCoachReviewId?: string | null;
  /** When true, show the “New video” strip under the name (matches My Coach row noti). */
  showNewVideoBadge?: boolean;
  /**
   * Who the peer is relative to the viewer. `student` (default) = coach viewing a
   * student. `coach` = student viewing their coach (opened from the coach page).
   */
  peerRole?: "coach" | "student";
};

export type StudentShotSelectParams = CoachStudentChatParams & {
  category: TrainCategory;
};

export type StudentReviewTagParams = StudentShotSelectParams & {
  labelKey: string;
  labelLine2Key?: string;
  strokePreset: TrainStrokePreset;
};

export type MyCoachTabStackParamList = {
  MyCoachMain: undefined;
  StudentProfile: CoachStudentChatParams;
  StudentShotCategory: CoachStudentChatParams;
  StudentShotSelect: StudentShotSelectParams;
  StudentReviewTag: StudentReviewTagParams;
  CoachStudentChat: CoachStudentChatParams;
};

export type MainTabParamList = {
  AICoach: undefined;
  Playlist: undefined;
  MyCoach: NavigatorScreenParams<MyCoachTabStackParamList>;
  Activities: { openAnalysisId?: string } | undefined;
  Progress: NavigatorScreenParams<ProgressTabStackParamList>;
  You: NavigatorScreenParams<YouTabStackParamList>;
};

export type MainStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  /** Full-screen modal (friends / coaches / clubs search) from header on You, Progress, Activities. */
  InviteSearch: undefined;
  ClubDetail: { clubId: ClubId };
  CoachDetail: { coachId: CoachId | string; coachName?: string; coachImageUri?: string | null };
  /** Student ↔ coach private chat (opened from the coach page's Message badge). */
  CoachStudentChat: CoachStudentChatParams;
  AdminHub: undefined;
  AdminTrain: undefined;
  AdminFalLora: undefined;
  AdminAccuracy: undefined;
  AdminRetrievalBench: undefined;
  ProfileSettings: undefined;
  ProSubscription: undefined;
  Notifications: undefined;
  /** Coach: search users, add coach_student or club_member (see server schema). */
  CoachAddPeople: undefined;
  /** Coach: pause video, add feedback + marks, submit review. */
  CoachReviewEditor: { reviewId: string };
  /** Student: view coach-reviewed video + marks (read-only). */
  StudentCoachReview: { reviewId: string; notificationId?: string };
  /** Student: play a video a coach sent directly. */
  StudentSentVideo: { sentVideoId: string; notificationId?: string };
  /** Admin hub: browse members by coach/student role (same card style as hub). */
  AdminMembers: { filter: "all" | "coach" | "student" };
};
