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

export type AchievementCategory = 'technique' | 'play' | 'consistency' | 'special'

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = ['technique', 'play', 'consistency', 'special']

export type AchievementDef = {
  key: string
  kind: AchievementKind
  unlockedImage: number
  category: AchievementCategory
  /** Ionicons glyph drawn inside the hexagon on Progress → Achievements cards. */
  icon: string
  /** Short label (≤3 words) — grid / list. */
  labelKey: string
  /** Full requirement — achievement detail screen. */
  descriptionKey: string
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // Progress → Achievements opens on these (mockup order).
  {
    key: 'first-match',
    category: 'play',
    icon: 'trophy-outline',
    kind: 'locked',
    unlockedImage: IMG.firstUpload,
    labelKey: 'progress.badgeFirstMatch',
    descriptionKey: 'progress.badgeFirstMatchDesc',
  },
  {
    key: 'matches-10',
    category: 'play',
    icon: 'stats-chart-outline',
    kind: 'locked',
    unlockedImage: IMG.upload10,
    labelKey: 'progress.badgeMatches10',
    descriptionKey: 'progress.badgeMatches10Desc',
  },
  {
    key: 'win-streak-3',
    category: 'play',
    icon: 'flame-outline',
    kind: 'locked',
    unlockedImage: IMG.improveShot,
    labelKey: 'progress.badgeWinStreak3',
    descriptionKey: 'progress.badgeWinStreak3Desc',
  },
  {
    key: 'shot-analyzer',
    category: 'technique',
    icon: 'checkmark-done-outline',
    kind: 'locked',
    unlockedImage: IMG.firstAi,
    labelKey: 'progress.badgeShotAnalyzer',
    descriptionKey: 'progress.badgeShotAnalyzerDesc',
  },
  {
    key: 'weekly-consistency',
    category: 'consistency',
    icon: 'calendar-outline',
    kind: 'locked',
    unlockedImage: IMG.uploadFullWeek,
    labelKey: 'progress.badgeWeeklyConsistency',
    descriptionKey: 'progress.badgeWeeklyConsistencyDesc',
  },
  {
    key: 'technique-improver',
    category: 'technique',
    icon: 'trending-up-outline',
    kind: 'locked',
    unlockedImage: IMG.threeTechniques90,
    labelKey: 'progress.badgeTechniqueImprover',
    descriptionKey: 'progress.badgeTechniqueImproverDesc',
  },
  {
    key: 'streak-3',
    category: 'consistency',
    icon: 'calendar-number-outline',
    kind: 'locked',
    unlockedImage: IMG.streak3,
    labelKey: 'progress.badge3DayStreak',
    descriptionKey: 'progress.badge3DayStreakDesc',
  },
  {
    key: 'first-upload',
    category: 'play',
    icon: 'cloud-upload-outline',
    kind: 'locked',
    unlockedImage: IMG.firstUpload,
    labelKey: 'progress.badgeFirstUpload',
    descriptionKey: 'progress.badgeFirstUploadDesc',
  },
  {
    key: 'streak-7',
    category: 'consistency',
    icon: 'today-outline',
    kind: 'locked',
    unlockedImage: IMG.streak7,
    labelKey: 'progress.badge7DayStreak',
    descriptionKey: 'progress.badge7DayStreakDesc',
  },
  {
    key: 'streak-30',
    category: 'consistency',
    icon: 'calendar-clear-outline',
    kind: 'locked',
    unlockedImage: IMG.streak30,
    labelKey: 'progress.badge30DayStreak',
    descriptionKey: 'progress.badge30DayStreakDesc',
  },
  {
    key: 'above-50',
    category: 'technique',
    icon: 'speedometer-outline',
    kind: 'locked',
    unlockedImage: IMG.above50,
    labelKey: 'progress.badgeAbove50',
    descriptionKey: 'progress.badgeAbove50Desc',
  },
  {
    key: 'above-60-defence',
    category: 'technique',
    icon: 'shield-outline',
    kind: 'locked',
    unlockedImage: IMG.above60Defence,
    labelKey: 'progress.badgeAbove60Defence',
    descriptionKey: 'progress.badgeAbove60DefenceDesc',
  },
  {
    key: 'above-80',
    category: 'technique',
    icon: 'ribbon-outline',
    kind: 'locked',
    unlockedImage: IMG.above80,
    labelKey: 'progress.badgeAbove80',
    descriptionKey: 'progress.badgeAbove80Desc',
  },
  {
    key: 'above-90',
    category: 'technique',
    icon: 'medal-outline',
    kind: 'locked',
    unlockedImage: IMG.above90,
    labelKey: 'progress.badgeAbove90',
    descriptionKey: 'progress.badgeAbove90Desc',
  },
  {
    key: 'net-play-60',
    category: 'technique',
    icon: 'git-network-outline',
    kind: 'locked',
    unlockedImage: IMG.netPlay60,
    labelKey: 'progress.badgeNetPlay60',
    descriptionKey: 'progress.badgeNetPlay60Desc',
  },
  {
    key: 'smash-60',
    category: 'technique',
    icon: 'flash-outline',
    kind: 'locked',
    unlockedImage: IMG.smash60,
    labelKey: 'progress.badgeSmash60',
    descriptionKey: 'progress.badgeSmash60Desc',
  },
  {
    key: 'three-techniques-90',
    category: 'technique',
    icon: 'star-outline',
    kind: 'locked',
    unlockedImage: IMG.threeTechniques90,
    labelKey: 'progress.badgeThreeTechniques90',
    descriptionKey: 'progress.badgeThreeTechniques90Desc',
  },
  {
    key: 'the-goat',
    category: 'special',
    icon: 'diamond-outline',
    kind: 'locked',
    unlockedImage: IMG.theGoat,
    labelKey: 'progress.badgeTheGoat',
    descriptionKey: 'progress.badgeTheGoatDesc',
  },
  {
    key: 'coach-rate-100',
    category: 'special',
    icon: 'thumbs-up-outline',
    kind: 'locked',
    unlockedImage: IMG.coachRate100,
    labelKey: 'progress.badgeCoachRate100',
    descriptionKey: 'progress.badgeCoachRate100Desc',
  },
  {
    key: 'first-ai',
    category: 'technique',
    icon: 'sparkles-outline',
    kind: 'locked',
    unlockedImage: IMG.firstAi,
    labelKey: 'progress.badgeFirstAi',
    descriptionKey: 'progress.badgeFirstAiDesc',
  },
  {
    key: 'first-coach-review',
    category: 'special',
    icon: 'school-outline',
    kind: 'locked',
    unlockedImage: IMG.firstCoachReview,
    labelKey: 'progress.badgeFirstCoachReview',
    descriptionKey: 'progress.badgeFirstCoachReviewDesc',
  },
  {
    key: 'improve-shot',
    category: 'technique',
    icon: 'arrow-up-circle-outline',
    kind: 'locked',
    unlockedImage: IMG.improveShot,
    labelKey: 'progress.badgeImproveShot',
    descriptionKey: 'progress.badgeImproveShotDesc',
  },
  {
    key: 'add-friend',
    category: 'special',
    icon: 'person-add-outline',
    kind: 'locked',
    unlockedImage: IMG.addFriend,
    labelKey: 'progress.badgeAddFriend',
    descriptionKey: 'progress.badgeAddFriendDesc',
  },
  {
    key: 'upload-10',
    category: 'play',
    icon: 'albums-outline',
    kind: 'locked',
    unlockedImage: IMG.upload10,
    labelKey: 'progress.badgeUpload10',
    descriptionKey: 'progress.badgeUpload10Desc',
  },
  {
    key: 'upload-20',
    category: 'play',
    icon: 'layers-outline',
    kind: 'locked',
    unlockedImage: IMG.upload20,
    labelKey: 'progress.badgeUpload20',
    descriptionKey: 'progress.badgeUpload20Desc',
  },
  {
    key: 'upload-40',
    category: 'play',
    icon: 'library-outline',
    kind: 'locked',
    unlockedImage: IMG.upload40,
    labelKey: 'progress.badgeUpload40',
    descriptionKey: 'progress.badgeUpload40Desc',
  },
  {
    key: 'upload-full-week',
    category: 'consistency',
    icon: 'time-outline',
    kind: 'locked',
    unlockedImage: IMG.uploadFullWeek,
    labelKey: 'progress.badgeUploadFullWeek',
    descriptionKey: 'progress.badgeUploadFullWeekDesc',
  },
  {
    key: 'monthly-year',
    category: 'consistency',
    icon: 'hourglass-outline',
    kind: 'locked',
    unlockedImage: IMG.monthlyYear,
    labelKey: 'progress.badgeMonthlyYear',
    descriptionKey: 'progress.badgeMonthlyYearDesc',
  },
  {
    key: 'secret',
    category: 'special',
    icon: 'lock-closed-outline',
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

export function countUnlockedAchievements(unlockedKeys?: ReadonlySet<string> | string[]): number {
  if (unlockedKeys) return countUnlockedFromKeys(unlockedKeys)
  return ACHIEVEMENTS.filter((a) => a.kind === 'unlocked').length
}

/**
 * Goals used only when the backend sends no `achievementProgress` (older server).
 * Mirrors `progressFor` in BEXevo `src/gamification/achievements.ts`.
 */
const FALLBACK_GOALS: Record<string, number> = {
  'streak-3': 3,
  'streak-7': 7,
  'streak-30': 30,
  'upload-10': 10,
  'upload-20': 20,
  'upload-40': 40,
  'upload-full-week': 7,
  'monthly-year': 12,
  'above-50': 50,
  'above-80': 80,
  'above-90': 90,
  'the-goat': 95,
  'above-60-defence': 60,
  'net-play-60': 60,
  'smash-60': 60,
  'three-techniques-90': 3,
  secret: 5,
  'matches-10': 10,
  'win-streak-3': 3,
  'shot-analyzer': 10,
  'weekly-consistency': 3,
  'technique-improver': 10,
}

export type AchievementCard = AchievementDef & { current: number; goal: number }

export type AchievementFilter = 'all' | AchievementCategory

const KIND_ORDER: Record<AchievementKind, number> = { claimable: 0, unlocked: 1, locked: 2 }

/**
 * Cards for Progress → Achievements: catalog + server state + progress, filtered by category.
 * Claimable first, then claimed, then locked; catalog order within each group.
 */
export function buildAchievementCards(
  progress: ReadonlyMap<string, { current: number; goal: number }>,
  claimedKeys: ReadonlySet<string> | string[],
  claimableKeys: ReadonlySet<string> | string[],
  filter: AchievementFilter = 'all'
): AchievementCard[] {
  return withAchievementState(claimedKeys, claimableKeys)
    .map((a, index) => {
      const p = progress.get(a.key)
      const goal = Math.max(1, p?.goal ?? FALLBACK_GOALS[a.key] ?? 1)
      const earned = a.kind !== 'locked'
      const current = earned ? goal : Math.max(0, Math.min(goal, p?.current ?? 0))
      return { card: { ...a, current, goal }, index }
    })
    .filter(({ card }) => filter === 'all' || card.category === filter)
    .sort((x, y) => KIND_ORDER[x.card.kind] - KIND_ORDER[y.card.kind] || x.index - y.index)
    .map(({ card }) => card)
}
