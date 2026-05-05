import React from 'react'
import {
  View,
  TouchableOpacity,
  type AccessibilityProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { ProLibraryGradientFrame } from './ProLibraryGradientFrame'
import { proLibraryChrome } from '../theme/proLibraryChrome'

/** Admin hub / member directory card inner fill (matches Progress category card). */
export const ADMIN_CARD_PANEL_FILL = '#041641'

/** Thicker than default pro library stroke (1.5) for admin cards. */
export const ADMIN_CARD_GRADIENT_STROKE = 3.5

type A11y = Pick<
  AccessibilityProps,
  'accessibilityRole' | 'accessibilityLabel' | 'accessibilityHint' | 'accessibilityState'
>

type Props = {
  children: React.ReactNode
  onPress?: () => void
  /** Outer wrapper (e.g. margins). */
  style?: StyleProp<ViewStyle>
  /** Merged into inner panel after fill color. */
  innerStyle?: StyleProp<ViewStyle>
} & A11y

/**
 * Gradient-bordered panel with solid `#041641` fill — use for admin hub tiles and
 * directory rows so hub → detail screens stay visually consistent.
 */
export function AdminGradientCard({
  children,
  onPress,
  style,
  innerStyle,
  accessibilityRole,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
}: Props) {
  const outerR = proLibraryChrome.radii.frameOuter
  const stroke = ADMIN_CARD_GRADIENT_STROKE
  const innerR = Math.max(10, outerR - stroke)

  const frame = (
    <ProLibraryGradientFrame
      borderRadius={outerR}
      innerBorderRadius={innerR}
      strokeWidth={stroke}
      innerStyle={[{ backgroundColor: ADMIN_CARD_PANEL_FILL }, innerStyle]}
    >
      {children}
    </ProLibraryGradientFrame>
  )

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.88}
        style={style}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={accessibilityState}
      >
        {frame}
      </TouchableOpacity>
    )
  }
  return (
    <View
      style={style}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
    >
      {frame}
    </View>
  )
}
