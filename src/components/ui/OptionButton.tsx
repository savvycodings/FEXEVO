import React, { useContext } from 'react'
import { StyleSheet, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native'
import { PrimaryFill } from './GlowButton'
import { ThemeContext } from '../../context'
import { UI } from './tokens'

/** One choice in a vertical list (e.g. "Set your Level"): outlined when idle, gradient + glow when selected. */
export function OptionButton({
  label,
  selected,
  onPress,
  testID,
  style,
}: {
  label: string
  selected: boolean
  onPress: () => void
  testID?: string
  style?: StyleProp<ViewStyle>
}) {
  const { theme } = useContext(ThemeContext)
  return (
    <TouchableOpacity
      style={[styles.option, selected ? styles.optionSelected : styles.optionIdle, style]}
      onPress={onPress}
      testID={testID}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      {/* Selected = the shared primary button fill (GlowButton), so the look stays in one place. */}
      {selected ? <PrimaryFill radius={9} /> : null}
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.label, { fontFamily: selected ? theme.semiBoldFont : theme.regularFont }, selected ? styles.labelSelected : styles.labelIdle]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  /** Design (Set your Level): 40pt rows, radius 10, Inter 14. */
  option: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  optionIdle: {
    borderColor: UI.trackBorder,
    backgroundColor: UI.cardBg,
  },
  optionSelected: {
    borderColor: 'transparent',
  },
  label: {
    fontSize: 14,
  },
  labelSelected: {
    color: UI.btnPrimaryText,
  },
  labelIdle: {
    color: UI.textMuted,
  },
})
