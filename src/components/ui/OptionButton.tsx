import React, { useContext } from 'react'
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { ThemeContext } from '../../context'
import { UI, SELECTED_GLOW } from './tokens'

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
      {selected ? (
        <>
          <LinearGradient
            colors={UI.gradient}
            locations={UI.gradientLocations}
            start={UI.gradientStart}
            end={UI.gradientEnd}
            style={[StyleSheet.absoluteFill, styles.fill]}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.fill, SELECTED_GLOW]} />
        </>
      ) : null}
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.label, { fontFamily: theme.mediumFont }, selected ? styles.labelSelected : styles.labelIdle]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  option: {
    minHeight: 40,
    borderRadius: UI.radius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  optionIdle: {
    borderColor: UI.trackBorder,
    backgroundColor: UI.cardBg,
  },
  optionSelected: {
    borderColor: 'rgba(53, 199, 255, 0.55)',
    boxShadow: '0px 0px 10px 0px #00B8FF',
  },
  fill: {
    borderRadius: UI.radius - 1,
  },
  label: {
    fontSize: 16,
  },
  labelSelected: {
    color: UI.text,
  },
  labelIdle: {
    color: UI.textMuted,
  },
})
