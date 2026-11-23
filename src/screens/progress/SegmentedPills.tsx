import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'

type IconName = React.ComponentProps<typeof Ionicons>['name']
import { PG, glow } from './progressTheme'

/** `badge`: optional count shown after the label (e.g. All Shots 24). */
type Option<K> = { key: K; label: string; badge?: number | string; testID?: string }

type Props<K> = {
  options: Option<K>[]
  value: K
  onChange: (key: K) => void
  fontFamily?: string
  activeFontFamily?: string
  /** Larger pills for the primary Score / Achievements switch. */
  size?: 'md' | 'lg'
  /** Shorter track / pill padding — same width and type size, less height. */
  dense?: boolean
  /**
   * `flat`: solid #041641 track + #07256D border (Profile hub).
   * Default keeps the progress-card gradient track.
   */
  variant?: 'default' | 'flat'
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  /** `radio` for single-choice form fields (court side, hand); `tab` for view switches. */
  role?: 'tab' | 'radio'
}

export function SegmentedPills<K extends string | number>({
  options,
  value,
  onChange,
  fontFamily,
  activeFontFamily,
  size = 'md',
  dense = false,
  variant = 'default',
  style,
  accessibilityLabel,
  role = 'tab',
}: Props<K>) {
  const lg = size === 'lg'
  const flat = variant === 'flat'
  const segments = options.map((opt) => {
    const active = opt.key === value
    const label = (
      <View style={styles.labelRow}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[
            styles.txt,
            lg && styles.txtLg,
            flat && styles.txtFlat,
            active && (flat ? styles.txtOnFlat : styles.txtOn),
            { fontFamily: active ? activeFontFamily ?? fontFamily : fontFamily },
          ]}
        >
          {opt.label}
        </Text>
        {opt.badge != null ? (
          <View
            style={[styles.badge, active && styles.badgeOn]}
            testID={opt.testID ? `${opt.testID}-badge` : undefined}
          >
            <Text
              allowFontScaling={false}
              style={[styles.badgeTxt, active && styles.badgeTxtOn, { fontFamily: activeFontFamily ?? fontFamily }]}
            >
              {opt.badge}
            </Text>
          </View>
        ) : null}
      </View>
    )
    return (
      <TouchableOpacity
        key={String(opt.key)}
        style={[styles.hit, flat && styles.hitFlat]}
        onPress={() => onChange(opt.key)}
        activeOpacity={0.88}
        accessibilityRole={role}
        accessibilityState={role === 'radio' ? { selected: active, checked: active } : { selected: active }}
        aria-selected={active}
        aria-checked={role === 'radio' ? active : undefined}
        testID={opt.testID}
      >
        {active ? (
          flat ? (
            <LinearGradient
              colors={['#A9D8FF', '#4DA6FF']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[styles.pill, styles.pillFlatFill]}
            >
              {label}
            </LinearGradient>
          ) : (
            <LinearGradient
              colors={[PG.pillTop, PG.pillBottom]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[
                styles.pill,
                lg && styles.pillLg,
                dense && styles.pillDense,
                dense && lg && styles.pillLgDense,
                glow(10, 0.7),
              ]}
            >
              {label}
            </LinearGradient>
          )
        ) : (
          <View
            style={[
              styles.pill,
              lg && styles.pillLg,
              dense && styles.pillDense,
              dense && lg && styles.pillLgDense,
              flat && styles.pillFlatIdle,
            ]}
          >
            {label}
          </View>
        )}
      </TouchableOpacity>
    )
  })

  if (flat) {
    return (
      <View
        style={[styles.track, styles.trackFlat, dense && styles.trackDense, dense && styles.trackFlatDense, style]}
        accessibilityRole={role === 'radio' ? 'radiogroup' : 'tablist'}
        accessibilityLabel={accessibilityLabel}
      >
        {segments}
      </View>
    )
  }

  return (
    <LinearGradient
      colors={[PG.cardTop, PG.cardBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.track, dense && styles.trackDense, glow(14, 0.45), style]}
      accessibilityRole={role === 'radio' ? 'radiogroup' : 'tablist'}
      accessibilityLabel={accessibilityLabel}
    >
      {segments}
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PG.border,
    padding: 5,
  },
  /**
   * Profile hub track — solid shell; selected segment is its own rounded pill
   * (Figma: height 46, radius 20) so edges never clip into a rectangle.
   */
  trackFlat: {
    backgroundColor: '#041641',
    borderColor: '#07256D',
    padding: 2,
    gap: 4,
    minHeight: 50,
    overflow: 'visible',
  },
  trackFlatDense: { padding: 2, minHeight: 44, gap: 4 },
  hit: { flex: 1, minWidth: 0 },
  hitFlat: { alignSelf: 'center', justifyContent: 'center' },
  pill: {
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Selected pill — rounded box, light blue vertical gradient only. */
  pillFlatFill: {
    alignSelf: 'stretch',
    height: 46,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 0,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  pillFlatIdle: {
    alignSelf: 'stretch',
    height: 46,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 0,
    justifyContent: 'center',
  },
  pillLg: { paddingVertical: 11 },
  trackDense: { padding: 3 },
  pillDense: { paddingVertical: 6 },
  pillLgDense: { paddingVertical: 7 },
  txt: {
    fontSize: 12,
    color: PG.pillIdleText,
    textAlign: 'center',
  },
  txtFlat: { color: '#86A7D2', fontSize: 12 },
  txtLg: { fontSize: 15 },
  txtOn: { color: PG.pillText },
  txtOnFlat: { color: '#06204F' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, maxWidth: '100%' },
  badge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(91,140,255,0.18)',
    alignItems: 'center',
  },
  badgeOn: { backgroundColor: 'rgba(6,32,79,0.16)' },
  badgeTxt: { fontSize: 12, color: PG.pillIdleText },
  badgeTxtOn: { color: PG.pillText },
})

/**
 * A standalone pill (separate-button tab rows like Friends / Coaches / Clubs, filter chips).
 * Same colours as an active / idle `SegmentedPills` segment so every pill in the app matches.
 */
export function PillChip({
  label,
  active,
  onPress,
  style,
  textStyle,
  fontFamily,
  activeFontFamily,
  role = 'button',
  testID,
  leading,
  trailing,
  activeTextColor,
}: {
  label: string
  active: boolean
  onPress: () => void
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  fontFamily?: string
  activeFontFamily?: string
  role?: 'tab' | 'button'
  testID?: string
  /** Optional Ionicons before / after the label (e.g. a dropdown chevron). */
  leading?: IconName
  trailing?: IconName
  /** Label colour on the active (light) pill; defaults to the shared dark navy. */
  activeTextColor?: string
}) {
  const color = active ? activeTextColor ?? PG.pillText : PG.pillIdleText
  return (
    <TouchableOpacity
      style={[chipStyles.base, active ? [chipStyles.active, glow(10, 0.7)] : chipStyles.idle, style]}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole={role}
      accessibilityState={{ selected: active }}
      aria-selected={active}
      testID={testID}
    >
      {active ? (
        <LinearGradient
          pointerEvents="none"
          colors={[PG.pillTop, PG.pillBottom]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, chipStyles.fill]}
        />
      ) : null}
      {leading ? <Ionicons name={leading} size={15} color={color} /> : null}
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[
          textStyle,
          { color },
          { fontFamily: active ? activeFontFamily ?? fontFamily : fontFamily },
        ]}
      >
        {label}
      </Text>
      {trailing ? <Ionicons name={trailing} size={14} color={color} /> : null}
    </TouchableOpacity>
  )
}

const chipStyles = StyleSheet.create({
  base: { borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  active: { borderColor: 'transparent' },
  idle: { backgroundColor: PG.cardTop, borderColor: PG.border },
  fill: { borderRadius: 999 },
})
