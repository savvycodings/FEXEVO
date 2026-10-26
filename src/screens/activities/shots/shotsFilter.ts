import type { ActivitySession } from '../../../lib/activitySession'
import type { TrainCategory } from '../../../lib/train-taxonomy'

export type ShotsSort = 'newest' | 'highest' | 'lowest'
/** `null` = All categories. */
export type ShotsCategoryFilter = TrainCategory | null

export const SHOT_CATEGORIES: TrainCategory[] = [
  'ground_strokes',
  'net_play',
  'defence_glass',
  'save_return',
  'overhead',
  'tactical_specials',
]

const CATEGORY_LABEL_KEYS: Record<TrainCategory, string> = {
  ground_strokes: 'studentProfile.categories.groundstrokes',
  net_play: 'studentProfile.categories.netPlay',
  defence_glass: 'studentProfile.categories.defenseWalls',
  save_return: 'studentProfile.categories.serveReturn',
  overhead: 'studentProfile.categories.overheads',
  tactical_specials: 'studentProfile.categories.tacticalSpecials',
}

export function shotCategoryLabelKey(category: string | null | undefined): string | null {
  return category && category in CATEGORY_LABEL_KEYS
    ? CATEGORY_LABEL_KEYS[category as TrainCategory]
    : null
}

function inCategory(s: ActivitySession, category: ShotsCategoryFilter): boolean {
  return category == null || s.category === category
}

function scoreOf(s: ActivitySession): number | null {
  return typeof s.score === 'number' && Number.isFinite(s.score) ? s.score : null
}

function newestFirst(a: ActivitySession, b: ActivitySession): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

/** Visible Shots list: category filter, then All / Favorites, then sort. Unscored shots go last on score sorts; ties are newest first. */
export function filterAndSortShots(
  sessions: ActivitySession[],
  opts: {
    category: ShotsCategoryFilter
    sort: ShotsSort
    favoritesOnly: boolean
    favoriteIds: Set<string>
  }
): ActivitySession[] {
  const list = sessions.filter(
    (s) => inCategory(s, opts.category) && (!opts.favoritesOnly || opts.favoriteIds.has(s.analysisId))
  )
  if (opts.sort === 'newest') return list.sort(newestFirst)
  const dir = opts.sort === 'highest' ? -1 : 1
  return list.sort((a, b) => {
    const sa = scoreOf(a)
    const sb = scoreOf(b)
    if (sa == null || sb == null) {
      if (sa == null && sb == null) return newestFirst(a, b)
      return sa == null ? 1 : -1
    }
    return sa === sb ? newestFirst(a, b) : (sa - sb) * dir
  })
}

/** Count badges for the All Shots / Favorites switch, both within the category filter. */
export function shotCounts(
  sessions: ActivitySession[],
  category: ShotsCategoryFilter,
  favoriteIds: Set<string>
): { all: number; favorites: number } {
  let all = 0
  let favorites = 0
  for (const s of sessions) {
    if (!inCategory(s, category)) continue
    all++
    if (favoriteIds.has(s.analysisId)) favorites++
  }
  return { all, favorites }
}

/** `m:ss`, or null when the duration is unknown. */
export function formatDuration(ms: number | null | undefined): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return null
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
