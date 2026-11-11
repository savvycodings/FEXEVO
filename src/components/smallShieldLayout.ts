import type { ShieldLayoutSpec } from './shieldLayouts'

const LAYER_W = '99.1%' as const

/**
 * **My Coach (compact) shield only** — `variant="small"` on `ShieldCoachCard`.
 *
 * Progress uses **`shieldLayout`** in `shieldLayouts.ts`. All positions here are **% of the
 * card** so the composition scales with shield width/height on any device.
 */
export const smallShieldLayout = {
  photo: {
    bottom: '22%',
    height: '78%',
  },
  /**
   * Kept fully below the card. The shadow art is ~84% of the card's height here, so at `-75%`
   * only its top strip showed — a grey wedge with a hard edge across the shield tip.
   */
  fotoShadow: {
    width: '102%',
    left: '-1%',
    bottom: '-100%',
  },
  backEllipse: {
    width: LAYER_W,
    left: '0.45%',
    bottom: '-50%',
  },
  bottomGradient: {
    width: LAYER_W,
    left: '0.45%',
    bottom: '-49%',
  },
  topBlueLine: {
    width: LAYER_W,
    left: '0.45%',
    bottom: '-10%',
  },
  backLines: {
    width: LAYER_W,
    left: '0.45%',
    bottom: '-35%',
  },
  shieldTopName: {
    left: '10%',
    right: '10%',
    bottom: '22%',
  },
  crest: {
    width: '12%',
    left: '44%',
    bottom: '8%',
  },
  flag: {
    width: '13.5%',
    left: '43.5%',
    bottom: '9.2%',
  },
  brandLogoBelowFlag: {
    width: '28%',
    left: '36%',
    bottom: '0.9%',
    aspectRatio: 3.6,
  },
  score: {
    right: '6%',
    top: '12%',
  },
  name: {
    left: '12%',
    right: '12%',
    bottom: '27.5%',
  },
  outline: {
    scale: 1,
  },
} as const as unknown as ShieldLayoutSpec
