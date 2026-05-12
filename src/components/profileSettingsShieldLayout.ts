import type { ShieldLayoutSpec } from './shieldLayouts'
import { shieldLayout } from './shieldLayouts'

/**
 * Profile **settings** shield — extra keys kept for `ShieldLayoutSpec`; the settings badge
 * stacks name / flag / wordmark in `ShieldCoachCard` with flex `space-between` instead.
 */
export const profileSettingsShieldLayout = {
  ...shieldLayout,
  shieldTopName: {
    left: '10%',
    right: '10%',
    bottom: '34%',
  },
  crest: {
    width: '10%',
    left: '45%',
    bottom: '15%',
  },
  flag: {
    ...shieldLayout.flag,
    bottom: '24%',
  },
  brandLogoBelowFlag: {
    width: '18%',
    left: '41%',
    bottom: '5%',
    aspectRatio: 3.6,
  },
  score: {
    right: '5%',
    top: '9%',
  },
} as const as unknown as ShieldLayoutSpec
