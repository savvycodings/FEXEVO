/** Auto-generated from app/assets/dailyquests — run: node scripts/generate-daily-quests-catalog.mjs */
import type { ImageSourcePropType } from 'react-native'

export type QuestCadence = 'daily' | 'weekly' | 'season'

export const DAILY_QUESTS_PER_DAY = 4
export const WEEKLY_QUESTS_PER_WEEK = 3
export const SEASON_QUESTS_PER_SEASON = 2

export { QUEST_XP_BADGE } from './dailyQuestXpBadge'

export type DailyQuestDef = {
  key: string
  icon: ImageSourcePropType
  titleKey: string
  xp: number
  goal: number
  cadence: QuestCadence
}

export const ALL_QUESTS: DailyQuestDef[] = [
  {
    key: 'achieve-s-rank-ai',
    icon: require('../../assets/dailyquests/achieve-s-rank-ai.svg'),
    titleKey: 'progress.dailyQuest_achieve_s_rank_ai',
    xp: 900,
    goal: 1,
    cadence: 'season',
  },
  {
    key: 'complete-1-ai-analysis',
    icon: require('../../assets/dailyquests/complete-1-ai-analysis.svg'),
    titleKey: 'progress.dailyQuest_complete_1_ai_analysis',
    xp: 60,
    goal: 1,
    cadence: 'daily',
  },
  {
    key: 'complete-3-before-midday',
    icon: require('../../assets/dailyquests/complete-3-before-midday.svg'),
    titleKey: 'progress.dailyQuest_complete_3_before_midday',
    xp: 25,
    goal: 3,
    cadence: 'daily',
  },
  {
    key: 'complete-3-daily-quests',
    icon: require('../../assets/dailyquests/complete-3-daily-quests.svg'),
    titleKey: 'progress.dailyQuest_complete_3_daily_quests',
    xp: 30,
    goal: 3,
    cadence: 'daily',
  },
  {
    key: 'complete-all-daily-quests',
    icon: require('../../assets/dailyquests/complete-all-daily-quests.svg'),
    titleKey: 'progress.dailyQuest_complete_all_daily_quests',
    xp: 380,
    goal: 1,
    cadence: 'weekly',
  },
  {
    key: 'complete-an-upload',
    icon: require('../../assets/dailyquests/complete-an-upload.svg'),
    titleKey: 'progress.dailyQuest_complete_an_upload',
    xp: 35,
    goal: 1,
    cadence: 'daily',
  },
  {
    key: 'complete-perfect-week',
    icon: require('../../assets/dailyquests/complete-perfect-week.svg'),
    titleKey: 'progress.dailyQuest_complete_perfect_week',
    xp: 1900,
    goal: 7,
    cadence: 'season',
  },
  {
    key: 'first-login-of-day',
    icon: require('../../assets/dailyquests/first-login-of-day.svg'),
    titleKey: 'progress.dailyQuest_first_login_of_day',
    xp: 15,
    goal: 1,
    cadence: 'daily',
  },
  {
    key: 'get-80-above-smashes',
    icon: require('../../assets/dailyquests/get-80-above-smashes.svg'),
    titleKey: 'progress.dailyQuest_get_80_above_smashes',
    xp: 280,
    goal: 1,
    cadence: 'weekly',
  },
  {
    key: 'get-ai-score-above-80',
    icon: require('../../assets/dailyquests/get-ai-score-above-80.svg'),
    titleKey: 'progress.dailyQuest_get_ai_score_above_80',
    xp: 55,
    goal: 1,
    cadence: 'daily',
  },
  {
    key: 'get-over-70-score',
    icon: require('../../assets/dailyquests/get-over-70-score.svg'),
    titleKey: 'progress.dailyQuest_get_over_70_score',
    xp: 40,
    goal: 1,
    cadence: 'daily',
  },
  {
    key: 'get-perfect-volleys',
    icon: require('../../assets/dailyquests/get-perfect-volleys.svg'),
    titleKey: 'progress.dailyQuest_get_perfect_volleys',
    xp: 300,
    goal: 1,
    cadence: 'weekly',
  },
  {
    key: 'get-streak-50-points',
    icon: require('../../assets/dailyquests/get-streak-50-points.svg'),
    titleKey: 'progress.dailyQuest_get_streak_50_points',
    xp: 250,
    goal: 3,
    cadence: 'weekly',
  },
  {
    key: 'hit-perfect-bandejas',
    icon: require('../../assets/dailyquests/hit-perfect-bandejas.svg'),
    titleKey: 'progress.dailyQuest_hit_perfect_bandejas',
    xp: 220,
    goal: 1,
    cadence: 'weekly',
  },
  {
    key: 'improve-ai-score-yesterday',
    icon: require('../../assets/dailyquests/improve-ai-score-yesterday.svg'),
    titleKey: 'progress.dailyQuest_improve_ai_score_yesterday',
    xp: 50,
    goal: 1,
    cadence: 'daily',
  },
  {
    key: 'improve-shot-accuracy-15',
    icon: require('../../assets/dailyquests/improve-shot-accuracy-15.svg'),
    titleKey: 'progress.dailyQuest_improve_shot_accuracy_15',
    xp: 1100,
    goal: 1,
    cadence: 'season',
  },
  {
    key: 'invite-a-friend',
    icon: require('../../assets/dailyquests/invite-a-friend.svg'),
    titleKey: 'progress.dailyQuest_invite_a_friend',
    xp: 280,
    goal: 1,
    cadence: 'weekly',
  },
  {
    key: 'login-to-app',
    icon: require('../../assets/dailyquests/login-to-app.svg'),
    titleKey: 'progress.dailyQuest_login_to_app',
    xp: 20,
    goal: 1,
    cadence: 'daily',
  },
  {
    key: 'maintain-5-day-streak',
    icon: require('../../assets/dailyquests/maintain-5-day-streak.svg'),
    titleKey: 'progress.dailyQuest_maintain_5_day_streak',
    xp: 1300,
    goal: 5,
    cadence: 'season',
  },
  {
    key: 'maintain-7-day-streak',
    icon: require('../../assets/dailyquests/maintain-7-day-streak.svg'),
    titleKey: 'progress.dailyQuest_maintain_7_day_streak',
    xp: 1600,
    goal: 7,
    cadence: 'season',
  },
  {
    key: 'reach-new-division',
    icon: require('../../assets/dailyquests/reach-new-division.svg'),
    titleKey: 'progress.dailyQuest_reach_new_division',
    xp: 2400,
    goal: 1,
    cadence: 'season',
  },
  {
    key: 'score-above-60-serves',
    icon: require('../../assets/dailyquests/score-above-60-serves.svg'),
    titleKey: 'progress.dailyQuest_score_above_60_serves',
    xp: 55,
    goal: 1,
    cadence: 'daily',
  },
  {
    key: 'share-result',
    icon: require('../../assets/dailyquests/share-result.svg'),
    titleKey: 'progress.dailyQuest_share_result',
    xp: 45,
    goal: 1,
    cadence: 'daily',
  },
  {
    key: 'share-your-profile',
    icon: require('../../assets/dailyquests/share-your-profile.svg'),
    titleKey: 'progress.dailyQuest_share_your_profile',
    xp: 20,
    goal: 1,
    cadence: 'daily',
  },
  {
    key: 'upload-1-backhand',
    icon: require('../../assets/dailyquests/upload-1-backhand.svg'),
    titleKey: 'progress.dailyQuest_upload_1_backhand',
    xp: 50,
    goal: 1,
    cadence: 'daily',
  },
  {
    key: 'upload-3-consecutive-days',
    icon: require('../../assets/dailyquests/upload-3-consecutive-days.svg'),
    titleKey: 'progress.dailyQuest_upload_3_consecutive_days',
    xp: 350,
    goal: 3,
    cadence: 'weekly',
  },
  {
    key: 'upload-3-volley-shots',
    icon: require('../../assets/dailyquests/upload-3-volley-shots.svg'),
    titleKey: 'progress.dailyQuest_upload_3_volley_shots',
    xp: 180,
    goal: 3,
    cadence: 'weekly',
  },
  {
    key: 'upload-a-full-video',
    icon: require('../../assets/dailyquests/upload-a-full-video.svg'),
    titleKey: 'progress.dailyQuest_upload_a_full_video',
    xp: 200,
    goal: 1,
    cadence: 'weekly',
  },
  {
    key: 'upload-analyze-full-video',
    icon: require('../../assets/dailyquests/upload-analyze-full-video.svg'),
    titleKey: 'progress.dailyQuest_upload_analyze_full_video',
    xp: 320,
    goal: 1,
    cadence: 'weekly',
  },
  {
    key: 'watch-ai-replay',
    icon: require('../../assets/dailyquests/watch-ai-replay.svg'),
    titleKey: 'progress.dailyQuest_watch_ai_replay',
    xp: 35,
    goal: 1,
    cadence: 'daily',
  },
]

/** @deprecated Use ALL_QUESTS */
export const ALL_DAILY_QUESTS = ALL_QUESTS

const DAILY_POOL = ALL_QUESTS.filter((q) => q.cadence === 'daily')
const WEEKLY_POOL = ALL_QUESTS.filter((q) => q.cadence === 'weekly')
const SEASON_POOL = ALL_QUESTS.filter((q) => q.cadence === 'season')

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** ISO week (Monday start), e.g. W2026-23 */
export function weeklyPeriodKey(d = new Date()): string {
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `W${utc.getUTCFullYear()}-${String(week).padStart(2, '0')}`
}

/** Four-month seasons: Jan–Apr, May–Aug, Sep–Dec */
export function seasonPeriodKey(d = new Date()): string {
  const season = Math.floor(d.getMonth() / 4) + 1
  return `S${d.getFullYear()}-${season}`
}

export function periodKeyForCadence(cadence: QuestCadence, d = new Date()): string {
  if (cadence === 'weekly') return weeklyPeriodKey(d)
  if (cadence === 'season') return seasonPeriodKey(d)
  return localDateKey(d)
}

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pickFromPool(pool: DailyQuestDef[], periodKey: string, count: number): DailyQuestDef[] {
  const copy = [...pool]
  let seed = hashString(periodKey)
  for (let i = copy.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const j = seed % (i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, Math.min(count, copy.length))
}

export function pickDailyQuestsForDate(dateKey: string, count = DAILY_QUESTS_PER_DAY): DailyQuestDef[] {
  return pickFromPool(DAILY_POOL, dateKey, count)
}

export function pickWeeklyQuestsForPeriod(periodKey = weeklyPeriodKey(), count = WEEKLY_QUESTS_PER_WEEK): DailyQuestDef[] {
  return pickFromPool(WEEKLY_POOL, periodKey, count)
}

export function pickSeasonQuestsForPeriod(periodKey = seasonPeriodKey(), count = SEASON_QUESTS_PER_SEASON): DailyQuestDef[] {
  return pickFromPool(SEASON_POOL, periodKey, count)
}

export function getTodaysDailyQuests(now = new Date()): DailyQuestDef[] {
  return pickDailyQuestsForDate(localDateKey(now))
}

export function getThisWeeksQuests(now = new Date()): DailyQuestDef[] {
  return pickWeeklyQuestsForPeriod(weeklyPeriodKey(now))
}

export function getThisSeasonQuests(now = new Date()): DailyQuestDef[] {
  return pickSeasonQuestsForPeriod(seasonPeriodKey(now))
}
