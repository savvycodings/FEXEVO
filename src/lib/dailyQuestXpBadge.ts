import type { ImageSourcePropType } from 'react-native'

export const XP_BADGE_BLUE = require('../../assets/dailyquests/blueXP.png') as number
export const XP_BADGE_PURPLE = require('../../assets/dailyquests/purpleXP.png') as number
export const XP_BADGE_GOLD = require('../../assets/dailyquests/goldXP.png') as number
export const XP_BADGE_SILVER = require('../../assets/dailyquests/silverXP.png') as number
export const XP_BADGE_COMPLETE = require('../../assets/dailyquests/completeXP.png') as number

/** XP text on the green completed badge. */
export const XP_COMPLETE_TEXT_COLOR = '#05DF78'

/** @deprecated Use `getDailyQuestXpBadgeImage` — blue is the lowest tier only. */
export const QUEST_XP_BADGE = XP_BADGE_BLUE

/** blue (lowest) → purple → gold → silver (highest). */
export function getDailyQuestXpBadgeImage(xp: number): ImageSourcePropType {
  if (xp >= 700) return XP_BADGE_SILVER
  if (xp >= 200) return XP_BADGE_GOLD
  if (xp >= 80) return XP_BADGE_PURPLE
  return XP_BADGE_BLUE
}

export function formatDailyQuestXp(xp: number): string {
  return String(Math.max(0, Math.floor(xp)))
}
