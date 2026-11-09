import React, { useContext, useMemo } from 'react'
import {
  Text,
  View,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { ThemeContext } from '../context'
import { stripCoachRichMarkers } from '../lib/coachRichText'

const BODY_COLOR = '#FFFFFF'

export type CoachRichTextProps = {
  text: string
  style?: StyleProp<TextStyle>
  /** Layout-only style for the wrap View (e.g. flex:1 in a bullet row). Never put color here. */
  containerStyle?: StyleProp<ViewStyle>
  numberOfLines?: number
  /** Kept for callers; chip styling is currently unused (pills hidden). */
  muted?: boolean
  /** Kept for callers; chip styling is currently unused (pills hidden). */
  accentColor?: string
}

/**
 * Coach narrative as plain text. Keyword chip pills are hidden for now —
 * [[markers]] / **bold** are stripped so the description wraps normally.
 */
export function CoachRichText({
  text,
  style,
  containerStyle,
  numberOfLines,
}: CoachRichTextProps) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const plain = useMemo(() => stripCoachRichMarkers(text), [text])

  if (!plain.trim()) return null

  const flatStyle = StyleSheet.flatten(style) as TextStyle | undefined
  const textColor = (flatStyle?.color as string | undefined) ?? BODY_COLOR
  const fontSize = typeof flatStyle?.fontSize === 'number' ? flatStyle.fontSize : 14
  const lineHeight = typeof flatStyle?.lineHeight === 'number' ? flatStyle.lineHeight : 22
  const fontFamily =
    typeof flatStyle?.fontFamily === 'string' ? flatStyle.fontFamily : theme.regularFont

  return (
    <View style={containerStyle} accessible accessibilityRole="text">
      <Text
        allowFontScaling={false}
        style={[styles.body, { color: textColor, fontSize, lineHeight, fontFamily }, style]}
        numberOfLines={numberOfLines}
      >
        {plain}
      </Text>
    </View>
  )
}

function getStyles(theme: { regularFont?: string }) {
  return StyleSheet.create({
    body: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      lineHeight: 22,
      color: BODY_COLOR,
    },
  })
}
