import React from 'react'
import { Platform, Text, type StyleProp, type TextStyle } from 'react-native'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import { UI } from './tokens'

/**
 * Text filled with the brand gradient (`linear-gradient(102deg, #0BF 9.07%, #02F 90.93%)`, i.e. `UI.gradient`),
 * the native equivalent of CSS `background-clip: text`. The text is the mask; the gradient shows through it.
 * Web falls back to the gradient's start colour, since MaskedView is not reliable there.
 */
export function GradientText({
  children,
  style,
  numberOfLines,
  testID,
}: {
  children: React.ReactNode
  style?: StyleProp<TextStyle>
  numberOfLines?: number
  testID?: string
}) {
  const text = (extra?: StyleProp<TextStyle>) => (
    <Text allowFontScaling={false} numberOfLines={numberOfLines} style={[style, extra]}>
      {children}
    </Text>
  )

  if (Platform.OS === 'web') {
    return (
      <Text testID={testID} allowFontScaling={false} numberOfLines={numberOfLines} style={[style, { color: UI.gradient[0] }]}>
        {children}
      </Text>
    )
  }

  return (
    <MaskedView testID={testID} accessible accessibilityRole="header" maskElement={text({ color: '#000' })}>
      <LinearGradient
        colors={UI.gradient}
        locations={UI.gradientLocations}
        start={UI.gradientStart}
        end={UI.gradientEnd}
      >
        {/* Invisible copy sizes the gradient to the text. */}
        {text({ opacity: 0 })}
      </LinearGradient>
    </MaskedView>
  )
}
