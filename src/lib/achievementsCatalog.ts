/** Locked hexagon — achievement detail popup only. */
export const LOCKED_BADGE_DETAIL = require('../../assets/achivemnets/locked.png')
/** Locked card with label area — View All grid only. */
export const LOCKED_BADGE_GRID = require('../../assets/achivemnets/lockedachivment.png')

export const ACHIEVEMENTS_GRID_PREVIEW_COUNT = 9

const IMG = {
  streak30: require('../../assets/achevmentbadges/30daysstreak.png'),
  streak3: require('../../assets/achevmentbadges/3daystreak.png'),
  streak7: require('../../assets/achevmentbadges/7daysstreak.png'),
  above50: require('../../assets/achevmentbadges/above50score.png'),
  above60Defence: require('../../assets/achevmentbadges/above60defence.png'),
  above80: require('../../assets/achevmentbadges/above80score.png'),
  above90: require('../../assets/achevmentbadges/above90score.png'),
  addFriend: require('../../assets/achevmentbadges/addafriend.png'),
  threeTechniques90: require('../../assets/achevmentbadges/atleast90for3techniques.png'),
  coachRate100: require('../../assets/achevmentbadges/coachrateshot100.png'),
  firstAi: require('../../assets/achevmentbadges/firstAIanalisis.png'),
  firstCoachReview: require('../../assets/achevmentbadges/firstcoachreview.png'),
  firstUpload: require('../../assets/achevmentbadges/firstuploud.png'),
  improveShot: require('../../assets/achevmentbadges/improveonashot.png'),
  netPlay60: require('../../assets/achevmentbadges/obove60fornetplay.png'),
  smash60: require('../../assets/achevmentbadges/obove60smash.png'),
  secret: require('../../assets/achevmentbadges/secrete.png'),
  theGoat: require('../../assets/achevmentbadges/thegoat.png'),
  monthlyYear: require('../../assets/achevmentbadges/uploadavideoonceamonthforayear.png'),
  upload10: require('../../assets/achevmentbadges/uplod10vids.png'),
  upload20: require('../../assets/achevmentbadges/uploud20vids.png'),
  upload40: require('../../assets/achevmentbadges/uploud40vids.png'),
  uploadFullWeek: require('../../assets/achevmentbadges/uploudforafullweek.png'),
} as const

export type AchievementKind = 'unlocked' | 'claimable' | 'locked'

export type AchievementDef = {
  key: string
  kind: AchievementKind
  unlockedImage: number
  /** Short label (≤3 words) — grid / list. */
  labelKey: string
  /** Full requirement — achievement detail screen. */
  descriptionKey: string
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: 'streak-3',
    kind: 'locked',
    unlockedImage: IMG.streak3,
    labelKey: 'progress.badge3DayStreak',
    descriptionKey: 'progress.badge3DayStreakDesc',
  },
  {
    key: 'first-upload',
    kind: 'locked',
    unlockedImage: IMG.firstUpload,
    labelKey: 'progress.badgeFirstUpload',
    descriptionKey: 'progress.badgeFirstUploadDesc',
  },
  {
    key: 'streak-7',
    kind: 'locked',
    unlockedImage: IMG.streak7,
    labelKey: 'progress.badge7DayStreak',
    descriptionKey: 'progress.badge7DayStreakDesc',
  },
  {
    key: 'streak-30',
    kind: 'locked',
    unlockedImage: IMG.streak30,
    labelKey: 'progress.badge30DayStreak',
    descriptionKey: 'progress.badge30DayStreakDesc',
  },
  {
    key: 'above-50',
    kind: 'locked',
    unlockedImage: IMG.above50,
    labelKey: 'progress.badgeAbove50',
    descriptionKey: 'progress.badgeAbove50Desc',
  },
  {
    key: 'above-60-defence',
    kind: 'locked',
    unlockedImage: IMG.above60Defence,
    labelKey: 'progress.badgeAbove60Defence',
    descriptionKey: 'progress.badgeAbove60DefenceDesc',
  },
  {
    key: 'above-80',
    kind: 'locked',
    unlockedImage: IMG.above80,
    labelKey: 'progress.badgeAbove80',
    descriptionKey: 'progress.badgeAbove80Desc',
  },
  {
    key: 'above-90',
    kind: 'locked',
    unlockedImage: IMG.above90,
    labelKey: 'progress.badgeAbove90',
    descriptionKey: 'progress.badgeAbove90Desc',
  },
  {
    key: 'net-play-60',
    kind: 'locked',
    unlockedImage: IMG.netPlay60,
    labelKey: 'progress.badgeNetPlay60',
    descriptionKey: 'progress.badgeNetPlay60Desc',
  },
  {
    key: 'smash-60',
    kind: 'locked',
    unlockedImage: IMG.smash60,
    labelKey: 'progress.badgeSmash60',
    descriptionKey: 'progress.badgeSmash60Desc',
  },
  {
    key: 'three-techniques-90',
    kind: 'locked',
    unlockedImage: IMG.threeTechniques90,
    labelKey: 'progress.badgeThreeTechniques90',
    descriptionKey: 'progress.badgeThreeTechniques90Desc',
  },
  {
    key: 'the-goat',
    kind: 'locked',
    unlockedImage: IMG.theGoat,
    labelKey: 'progress.badgeTheGoat',
    descriptionKey: 'progress.badgeTheGoatDesc',
  },
  {
    key: 'coach-rate-100',
    kind: 'locked',
    unlockedImage: IMG.coachRate100,
    labelKey: 'progress.badgeCoachRate100',
    descriptionKey: 'progress.badgeCoachRate100Desc',
  },
  {
    key: 'first-ai',
    kind: 'locked',
    unlockedImage: IMG.firstAi,
    labelKey: 'progress.badgeFirstAi',
    descriptionKey: 'progress.badgeFirstAiDesc',
  },
  {
    key: 'first-coach-review',
    kind: 'locked',
    unlockedImage: IMG.firstCoachReview,
    labelKey: 'progress.badgeFirstCoachReview',
    descriptionKey: 'progress.badgeFirstCoachReviewDesc',
  },
  {
    key: 'improve-shot',
    kind: 'locked',
    unlockedImage: IMG.improveShot,
    labelKey: 'progress.badgeImproveShot',
    descriptionKey: 'progress.badgeImproveShotDesc',
  },
  {
    key: 'add-friend',
    kind: 'locked',
    unlockedImage: IMG.addFriend,
    labelKey: 'progress.badgeAddFriend',
    descriptionKey: 'progress.badgeAddFriendDesc',
  },
  {
    key: 'upload-10',
    kind: 'locked',
    unlockedImage: IMG.upload10,
    labelKey: 'progress.badgeUpload10',
    descriptionKey: 'progress.badgeUpload10Desc',
  },
  {
    key: 'upload-20',
    kind: 'locked',
    unlockedImage: IMG.upload20,
    labelKey: 'progress.badgeUpload20',
    descriptionKey: 'progress.badgeUpload20Desc',
  },
  {
    key: 'upload-40',
    kind: 'locked',
    unlockedImage: IMG.upload40,
    labelKey: 'progress.badgeUpload40',
    descriptionKey: 'progress.badgeUpload40Desc',
  },
  {
    key: 'upload-full-week',
    kind: 'locked',
    unlockedImage: IMG.uploadFullWeek,
    labelKey: 'progress.badgeUploadFullWeek',
    descriptionKey: 'progress.badgeUploadFullWeekDesc',
  },
  {
    key: 'monthly-year',
    kind: 'locked',
    unlockedImage: IMG.monthlyYear,
    labelKey: 'progress.badgeMonthlyYear',
    descriptionKey: 'progress.badgeMonthlyYearDesc',
  },
  {
    key: 'secret',
    kind: 'locked',
    unlockedImage: IMG.secret,
    labelKey: 'progress.badgeSecret',
    descriptionKey: 'progress.badgeSecretDesc',
  },
]

export const TOTAL_ACHIEVEMENTS = ACHIEVEMENTS.length

export function getAchievementByKey(key: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.key === key)
}

/** Merge server claimed / claimable state into the static catalog. */
export function withAchievementState(
  claimedKeys: ReadonlySet<string> | string[],
  claimableKeys: ReadonlySet<string> | string[] = []
): AchievementDef[] {
  const claimed = claimedKeys instanceof Set ? claimedKeys : new Set(claimedKeys)
  const claimable = claimableKeys instanceof Set ? claimableKeys : new Set(claimableKeys)
  return ACHIEVEMENTS.map((a) => {
    let kind: AchievementKind = 'locked'
    if (claimed.has(a.key)) kind = 'unlocked'
    else if (claimable.has(a.key)) kind = 'claimable'
    return { ...a, kind }
  })
}

/** @deprecated Use withAchievementState */
export function withUnlockedState(unlockedKeys: ReadonlySet<string> | string[]): AchievementDef[] {
  return withAchievementState(unlockedKeys)
}

export function countUnlockedFromKeys(unlockedKeys: ReadonlySet<string> | string[]): number {
  const keys = unlockedKeys instanceof Set ? unlockedKeys : new Set(unlockedKeys)
  return ACHIEVEMENTS.filter((a) => keys.has(a.key)).length
}

export function getAchievementDetailImage(achievement: AchievementDef): number {
  return achievement.kind === 'unlocked' ? achievement.unlockedImage : LOCKED_BADGE_DETAIL
}

export function getAchievementGridImage(achievement: AchievementDef): number {
  return achievement.kind === 'unlocked' ? achievement.unlockedImage : LOCKED_BADGE_GRID
}

/** Progress tab preview row — small locked hexagon. */
export function getAchievementDisplayImage(achievement: AchievementDef): number {
  return getAchievementDetailImage(achievement)
}

export function countUnlockedAchievements(unlockedKeys?: ReadonlySet<string> | string[]): number {
  if (unlockedKeys) return countUnlockedFromKeys(unlockedKeys)
  return ACHIEVEMENTS.filter((a) => a.kind === 'unlocked').length
}
