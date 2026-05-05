import React, { useMemo, type ComponentProps } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { ShieldCoachCard } from './ShieldCoachCard'

/** Design size for `ShieldCoachCard` art (must match card internals). */
export const SHIELD_DESIGN_W = 444
export const SHIELD_DESIGN_H = 589

type ShieldCardProps = Omit<ComponentProps<typeof ShieldCoachCard>, 'width'>

export type ShieldProportionalFrameProps = ShieldCardProps & {
  /** Upper bound for shield width (px). */
  maxWidth: number
  /** Upper bound for shield height (px). */
  maxHeight: number
  style?: StyleProp<ViewStyle>
}

/**
 * Fits the shield inside a max box while keeping **444∶589** proportions: only the outer
 * width/height change; the card always scales uniformly (no independent width/height tweaks).
 */
export function fitShieldInBox(maxWidth: number, maxHeight: number): { width: number; height: number } {
  const maxW = Math.max(1, Math.floor(maxWidth))
  const maxH = Math.max(1, Math.floor(maxHeight))
  let w = Math.min(maxW, Math.floor(maxH * (SHIELD_DESIGN_W / SHIELD_DESIGN_H)))
  w = Math.max(1, w)
  let h = Math.round((w * SHIELD_DESIGN_H) / SHIELD_DESIGN_W)
  while (h > maxH && w > 1) {
    w -= 1
    h = Math.round((w * SHIELD_DESIGN_H) / SHIELD_DESIGN_W)
  }
  return { width: w, height: h }
}

export function ShieldProportionalFrame({
  maxWidth,
  maxHeight,
  style,
  ...cardProps
}: ShieldProportionalFrameProps) {
  const { width, height } = useMemo(
    () => fitShieldInBox(maxWidth, maxHeight),
    [maxWidth, maxHeight]
  )

  return (
    <View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}>
      <ShieldCoachCard {...cardProps} width={width} />
    </View>
  )
}
