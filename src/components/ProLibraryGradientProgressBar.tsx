import React from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { proLibraryChrome } from '../theme/proLibraryChrome'

/** Default unfilled track tint used by shot-analysis breakdown bars. */
export const PRO_LIBRARY_PROGRESS_DEFAULT_TRACK = '#061428'

export type ProLibraryGradientProgressBarProps = {
  /** Filled amount, 0–100. */
  progress: number
  fillColor: string
  trackColor?: string
  height?: number
  /** Gradient “border” thickness (padding between frame and track). */
  strokeWidth?: number
  outerBorderRadius?: number
  innerBorderRadius?: number
  fillBorderRadius?: number
  style?: StyleProp<ViewStyle>
}

export function ProLibraryGradientProgressBar({
  progress,
  fillColor,
  trackColor = PRO_LIBRARY_PROGRESS_DEFAULT_TRACK,
  height = 10,
  strokeWidth = proLibraryChrome.frameStrokeWidth,
  outerBorderRadius = 8,
  innerBorderRadius = 6,
  fillBorderRadius = 4,
  style,
}: ProLibraryGradientProgressBarProps) {
  const g = proLibraryChrome.gradientFrame
  const pct = Math.max(0, Math.min(100, progress))
  return (
    <LinearGradient
      colors={[...g.colors]}
      locations={[...g.locations]}
      start={g.start}
      end={g.end}
      style={[
        {
          flex: 1,
          borderRadius: outerBorderRadius,
          padding: strokeWidth,
          minWidth: 0,
        },
        style,
      ]}
    >
      <View
        style={{
          borderRadius: innerBorderRadius,
          backgroundColor: trackColor,
          overflow: 'hidden',
          height,
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${pct}%`,
            backgroundColor: fillColor,
            borderRadius: fillBorderRadius,
          }}
        />
      </View>
    </LinearGradient>
  )
}
