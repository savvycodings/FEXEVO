import type { NavigatorScreenParams } from "@react-navigation/native";

export type ClubId = "i95" | "reserve";

export type CoachId = "steve" | "carlos" | "slama";

export type ProgressTabStackParamList = {
  ProgressMain: undefined;
  DailyQuest: undefined;
  AllAchievements: undefined;
  AchievementDetail: { achievementKey: string };
  Ranking: undefined;
};

export type YouTabStackParamList = {
  YouMain: undefined;
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
};

export type MyCoachTabStackParamList = {
  MyCoachMain: undefined;
  StudentProfile: CoachStudentChatParams;
  CoachStudentChat: CoachStudentChatParams;
};

export type MainTabParamList = {
  AICoach: undefined;
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
  CoachDetail: { coachId: CoachId };
  AdminHub: undefined;
  AdminTrain: undefined;
  AdminFalLora: undefined;
  AdminAccuracy: undefined;
  ProfileSettings: undefined;
  ProSubscription: undefined;
  Notifications: undefined;
  /** Coach: search users, add coach_student or club_member (see server schema). */
  CoachAddPeople: undefined;
  /** Coach: pause video, add feedback + marks, submit review. */
  CoachReviewEditor: { reviewId: string };
  /** Student: view coach-reviewed video + marks (read-only). */
  StudentCoachReview: { reviewId: string; notificationId?: string };
  /** Admin hub: browse members by coach/student role (same card style as hub). */
  AdminMembers: { filter: "all" | "coach" | "student" };
};
