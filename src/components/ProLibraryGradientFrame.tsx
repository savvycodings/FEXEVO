import React from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import {
  proLibraryChrome,
  proLibraryInnerPanelShadow,
} from '../theme/proLibraryChrome'

export type ProLibraryGradientFrameProps = {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  innerStyle?: StyleProp<ViewStyle>
  borderRadius?: number
  innerBorderRadius?: number
  strokeWidth?: number
  /** `accent` uses `#00B8FF` corners (see `proLibraryChrome.gradientFrameAccent`). */
  gradientVariant?: 'default' | 'accent'
  /** When false, skips inner glow/shadow so the gradient stroke reads the same on every edge (e.g. My Coach cards). */
  innerShadow?: boolean
  /**
   * When true, inner panel grows to fill the frame so gradient “padding” isn’t visible as a thick band
   * (pair with same `minHeight` on siblings in a row).
   */
  stretchInner?: boolean
}

/**
 * Gradient border + dark inner panel (pro library / View Results look).
 */
export function ProLibraryGradientFrame({
  children,
  style,
  innerStyle,
  borderRadius = proLibraryChrome.radii.frameOuter,
  innerBorderRadius = proLibraryChrome.radii.frameInner,
  strokeWidth = proLibraryChrome.frameStrokeWidth,
  gradientVariant = 'default',
  innerShadow = true,
  stretchInner = false,
}: ProLibraryGradientFrameProps) {
  const g =
    gradientVariant === 'accent'
      ? proLibraryChrome.gradientFrameAccent
      : proLibraryChrome.gradientFrame
  return (
    <LinearGradient
      colors={[...g.colors]}
      locations={[...g.locations]}
      start={g.start}
      end={g.end}
      style={[
        {
          borderRadius,
          padding: strokeWidth,
          overflow: 'hidden',
          ...(stretchInner ? { alignItems: 'stretch' as const } : {}),
        },
        style,
      ]}
    >
      <View
        style={[
          {
            borderRadius: innerBorderRadius,
            backgroundColor: proLibraryChrome.innerPanelBackground,
            overflow: 'hidden',
            ...(stretchInner ? { flex: 1, alignSelf: 'stretch', minHeight: 0 } : {}),
          },
          innerShadow ? proLibraryInnerPanelShadow() : null,
          innerStyle,
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  )
}
