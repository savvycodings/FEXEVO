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
import { parseCoachRichText } from '../lib/coachRichText'

const CHIP_BORDER = 'rgba(0, 184, 255, 0.75)'
const CHIP_TEXT = '#00B8FF'
const BODY_COLOR = '#FFFFFF'

export type CoachRichTextProps = {
  text: string
  style?: StyleProp<TextStyle>
  /** Layout-only style for the chip wrap View (e.g. flex:1 in a bullet row). Never put color here. */
  containerStyle?: StyleProp<ViewStyle>
  numberOfLines?: number
  /** Soften chip look for muted body copy (e.g. insight cards). */
  muted?: boolean
}

/**
 * Renders coach narrative with [[key phrase]] / **key phrase** (or auto-enriched
 * coaching terms) as cyan ghost-outline chips.
 * View chips (not nested Text borders) so the stroke actually paints on RN.
 */
export function CoachRichText({
  text,
  style,
  containerStyle,
  numberOfLines,
  muted = false,
}: CoachRichTextProps) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const segments = useMemo(() => parseCoachRichText(text), [text])

  if (!text.trim()) return null

  const flatStyle = StyleSheet.flatten(style) as TextStyle | undefined
  const textColor = (flatStyle?.color as string | undefined) ?? BODY_COLOR
  const fontSize = typeof flatStyle?.fontSize === 'number' ? flatStyle.fontSize : 14
  const lineHeight = typeof flatStyle?.lineHeight === 'number' ? flatStyle.lineHeight : 22
  const fontFamily =
    typeof flatStyle?.fontFamily === 'string' ? flatStyle.fontFamily : theme.regularFont

  const hasChips = segments.some((s) => s.type === 'chip')
  if (!hasChips) {
    return (
      <Text
        allowFontScaling={false}
        style={[styles.body, { color: textColor, fontSize, lineHeight, fontFamily }, style]}
        numberOfLines={numberOfLines}
      >
        {text}
      </Text>
    )
  }

  const wordTextStyle: TextStyle = {
    fontFamily,
    fontSize,
    lineHeight,
    color: textColor,
  }

  // View + flexWrap so chip borders render; split text on whitespace for wrapping.
  // Do NOT cast TextStyle onto the View (color/flex on View breaks contrast/layout).
  return (
    <View style={[styles.wrap, containerStyle]} accessible accessibilityRole="text">
      {segments.map((seg, idx) => {
        if (seg.type === 'chip') {
          return (
            <View key={`c-${idx}-${seg.value}`} style={muted ? styles.chipWrapMuted : styles.chipWrap}>
              <Text allowFontScaling={false} style={muted ? styles.chipTextMuted : styles.chipText}>
                {seg.value}
              </Text>
            </View>
          )
        }
        const parts = seg.value.split(/(\s+)/)
        return parts.map((part, pIdx) => {
          if (!part) return null
          return (
            <Text key={`t-${idx}-${pIdx}`} allowFontScaling={false} style={wordTextStyle}>
              {part}
            </Text>
          )
        })
      })}
    </View>
  )
}

function getStyles(theme: { regularFont?: string; semiBoldFont?: string; mediumFont?: string }) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      alignSelf: 'stretch',
      flexShrink: 1,
      minWidth: 0,
    },
    body: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: BODY_COLOR,
      lineHeight: 22,
    },
    chipWrap: {
      borderWidth: 1,
      borderColor: CHIP_BORDER,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 1,
      backgroundColor: 'transparent',
      marginHorizontal: 2,
      marginVertical: 2,
    },
    chipWrapMuted: {
      borderWidth: 1,
      borderColor: 'rgba(0, 184, 255, 0.55)',
      borderRadius: 6,
      paddingHorizontal: 5,
      paddingVertical: 0,
      backgroundColor: 'transparent',
      marginHorizontal: 2,
      marginVertical: 1,
    },
    chipText: {
      fontFamily: theme.semiBoldFont ?? theme.mediumFont ?? theme.regularFont,
      fontSize: 13,
      lineHeight: 18,
      color: CHIP_TEXT,
    },
    chipTextMuted: {
      fontFamily: theme.semiBoldFont ?? theme.mediumFont ?? theme.regularFont,
      fontSize: 12,
      lineHeight: 16,
      color: CHIP_TEXT,
    },
  })
}
