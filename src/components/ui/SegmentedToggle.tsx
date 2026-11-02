import React, { useContext } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { ThemeContext } from '../../context'
import { UI, SELECTED_GLOW } from './tokens'

export type SegmentOption<T extends string> = {
  value: T
  label: string
  testID?: string
  /** Small count bubble after the label; hidden when 0 or unset. */
  badge?: number
}

/** Two-or-more option pill track; the selected segment gets the primary gradient + glow. */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: SegmentOption<T>[]
  value: T | null | undefined
  onChange: (value: T) => void
  accessibilityLabel?: string
}) {
  const { theme } = useContext(ThemeContext)
  return (
    <View style={styles.track} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.85}
            testID={opt.testID}
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
                  style={[StyleSheet.absoluteFill, styles.segmentFill]}
                />
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.segmentFill, SELECTED_GLOW]} />
              </>
            ) : null}
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.label,
                { fontFamily: theme.mediumFont },
                selected ? styles.labelSelected : styles.labelIdle,
              ]}
            >
              {opt.label}
            </Text>
            {opt.badge ? (
              <View style={styles.badge} testID={opt.testID ? `${opt.testID}-badge` : undefined}>
                <Text allowFontScaling={false} style={[styles.badgeText, { fontFamily: theme.semiBoldFont }]}>
                  {opt.badge > 99 ? '99+' : opt.badge}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    height: 52,
    borderRadius: UI.radius,
    backgroundColor: UI.track,
    borderWidth: 1,
    borderColor: UI.trackBorder,
  },
  segment: {
    flex: 1,
    borderRadius: UI.radius - 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#3D6BFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    color: '#FFFFFF',
  },
  segmentSelected: {
    boxShadow: '0px 0px 10px 0px #00B8FF',
  },
  segmentFill: {
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
