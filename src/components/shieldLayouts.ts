/**
 * **Default / Progress shield** — `ShieldCoachCard` with `variant` omitted or `variant="default"`.
 *
 * My Coach uses **`smallShieldLayout.ts`** instead (not this file). Editing `shieldLayout` here
 * changes Progress (and any other default shield), not My Coach.
 *
 * Layer `bottom` / `left` / `width` values are **% of the card** (same aspect at any pixel size).
 */
const LAYER_W = '99.1%' as const

export const shieldLayout = {
  photo: {
    bottom: '22%',
    height: '78%',
  },
  fotoShadow: {
    width: '102%',
    left: '-1%',
    bottom: '-40%',
  },
  backEllipse: {
    width: LAYER_W,
    left: '0.45%',
    bottom: '-30%',
  },
  bottomGradient: {
    width: LAYER_W,
    left: '0.45%',
    bottom: '-29%',
  },
  topBlueLine: {
    width: LAYER_W,
    left: '0.45%',
    bottom: '28%',
  },
  backLines: {
    width: LAYER_W,
    left: '0.45%',
    bottom: '-20%',
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
    width: '6.5%',
    left: '46.75%',
    bottom: '18%',
  },
  /** Wide brand mark under crest/flag (tip of shield). */
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
} as const

export type ShieldLayoutSpec = typeof shieldLayout

export type ShieldLayoutVariant = 'default' | 'small' | 'profileSettings'
