import AsyncStorage from '@react-native-async-storage/async-storage'
import { TRAIN_CATEGORIES, type TrainCategory } from './train-taxonomy'
import type { RatingCategoryRow } from '../context/SessionDataContext'

/** Same five pillars as Rating dashboard / shield (no tactical_specials). */
export const INSIGHT_PILLAR_ORDER: TrainCategory[] = [
  'save_return',
  'ground_strokes',
  'net_play',
  'defence_glass',
  'overhead',
]

const STORAGE_KEY_DISMISS_UNTIL = 'xevo_ai_insight_dismiss_until_ms'
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

export type WeeklyInsight = {
  /** Short label e.g. "Net play" */
  pillarLabel: string
  /** False when we only have this week's analyses (no prior-week baseline for any pillar). */
  hasPriorWeek: boolean
  /** Week-over-week only: gain vs drop */
  improved: boolean
  /** Highlight segment: "+18%", "+12 pts", or "+72 pts" (this-week score as gain when no prior week). */
  highlight: string
  subtitle: string
}

function pillarLabel(id: string): string {
  return TRAIN_CATEGORIES.find((c) => c.id === id)?.label ?? id.replace(/_/g, ' ')
}

/**
 * Week-over-week when any pillar has samples in both weeks; otherwise this week's strongest pillar as "+X pts".
 */
export function computeWeeklyInsightFromRatingRows(
  rows: RatingCategoryRow[] | null | undefined
): WeeklyInsight | null {
  if (!rows?.length) return null
  const byId = new Map(rows.map((r) => [r.id, r]))

  type Row = RatingCategoryRow & { thisWeekCount?: number; lastWeekCount?: number }
  type Cand = {
    id: string
    label: string
    thisWeek: number
    lastWeek: number
    delta: number
  }

  const dualWeek: Cand[] = []
  const thisWeekOnly: Cand[] = []

  for (const id of INSIGHT_PILLAR_ORDER) {
    const r = byId.get(id) as Row | undefined
    if (!r) continue
    const twN = typeof r.thisWeekCount === 'number' ? r.thisWeekCount : 0
    const lwN = typeof r.lastWeekCount === 'number' ? r.lastWeekCount : 0
    if (twN < 1) continue

    const thisWeek = Number(r.thisWeek)
    const lastWeek = Number(r.lastWeek)
    if (!Number.isFinite(thisWeek) || !Number.isFinite(lastWeek)) continue

    const base = {
      id,
      label: pillarLabel(id),
      thisWeek,
      lastWeek,
      delta: thisWeek - lastWeek,
    }
    thisWeekOnly.push(base)
    if (lwN >= 1) {
      dualWeek.push(base)
    }
  }

  if (dualWeek.length > 0) {
    const noise = 0.35
    const positives = dualWeek.filter((c) => c.delta > noise)
    let chosen: Cand | null = null
    if (positives.length) {
      chosen = positives.reduce((a, b) => (b.delta > a.delta ? b : a))
    } else {
      const negatives = dualWeek.filter((c) => c.delta < -noise)
      if (negatives.length) {
        chosen = negatives.reduce((a, b) => (b.delta < a.delta ? b : a))
      } else {
        chosen = dualWeek.reduce((a, b) => (Math.abs(b.delta) > Math.abs(a.delta) ? b : a))
      }
    }

    if (!chosen) return null

    const improved = chosen.delta > 0
    const ptsRounded = Math.round(chosen.delta)
    const absRounded = Math.abs(ptsRounded)

    let highlight: string
    const relPctRaw = (chosen.delta / Math.max(chosen.lastWeek, 1)) * 100
    if (chosen.lastWeek >= 12 && Math.abs(relPctRaw) >= 1) {
      const rel = Math.round(relPctRaw)
      highlight = `${rel >= 0 ? '+' : ''}${rel}%`
    } else if (absRounded >= 1) {
      highlight = `${ptsRounded >= 0 ? '+' : ''}${ptsRounded} pts`
    } else {
      const fine = chosen.delta.toFixed(1)
      highlight = `${chosen.delta >= 0 ? '+' : ''}${fine} pts`
    }

    const sortedWeak = [...dualWeek].sort((a, b) => a.thisWeek - b.thisWeek)
    const weakest = sortedWeak[0]

    let subtitle = ''
    if (
      improved &&
      weakest &&
      weakest.id !== chosen.id &&
      weakest.thisWeek + noise < chosen.thisWeek
    ) {
      subtitle = `${weakest.label} is still your lowest pillar — keep logging clips there too.`
    }

    return {
      pillarLabel: chosen.label,
      hasPriorWeek: true,
      improved,
      highlight,
      subtitle,
    }
  }

  if (!thisWeekOnly.length) return null

  const noise = 0.35
  const chosen = thisWeekOnly.reduce((a, b) => (b.thisWeek > a.thisWeek ? b : a))
  const scoreRounded = Math.round(chosen.thisWeek)
  const nearInt = Math.abs(chosen.thisWeek - scoreRounded) < 0.05
  const scoreStr = nearInt ? String(scoreRounded) : chosen.thisWeek.toFixed(1)
  const highlight = `${chosen.thisWeek >= 0 ? '+' : ''}${scoreStr} pts`

  const sortedWeak = [...thisWeekOnly].sort((a, b) => a.thisWeek - b.thisWeek)
  const weakest = sortedWeak[0]
  let subtitle = ''
  if (
    thisWeekOnly.length >= 2 &&
    weakest &&
    weakest.id !== chosen.id &&
    weakest.thisWeek + noise < chosen.thisWeek
  ) {
    subtitle = `${weakest.label} is still your lowest pillar — keep logging clips there too.`
  }

  return {
    pillarLabel: chosen.label,
    hasPriorWeek: false,
    improved: true,
    highlight,
    subtitle,
  }
}

export async function loadAiInsightDismissedUntilMs(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_DISMISS_UNTIL)
    if (!raw) return 0
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

/** Hide insight banner until one week from now (UTC-independent wall-clock ms). */
export async function dismissAiInsightForOneWeek(): Promise<number> {
  const until = Date.now() + ONE_WEEK_MS
  try {
    await AsyncStorage.setItem(STORAGE_KEY_DISMISS_UNTIL, String(until))
  } catch {
    /* still return until so UI hides */
  }
  return until
}
