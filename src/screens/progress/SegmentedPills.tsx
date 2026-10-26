import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { PG, glow } from './progressTheme'

/** `badge`: optional count shown after the label (e.g. All Shots 24). */
type Option<K> = { key: K; label: string; badge?: number | string }

type Props<K> = {
  options: Option<K>[]
  value: K
  onChange: (key: K) => void
  fontFamily?: string
  activeFontFamily?: string
  /** Larger pills for the primary Score / Achievements switch. */
  size?: 'md' | 'lg'
  style?: StyleProp<ViewStyle>
}

export function SegmentedPills<K extends string | number>({
  options,
  value,
  onChange,
  fontFamily,
  activeFontFamily,
  size = 'md',
  style,
}: Props<K>) {
  const lg = size === 'lg'
  return (
    <LinearGradient
      colors={[PG.cardTop, PG.cardBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.track, glow(14, 0.45), style]}
    >
      {options.map((opt) => {
        const active = opt.key === value
        const label = (
          <View style={styles.labelRow}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.txt,
                lg && styles.txtLg,
                active && styles.txtOn,
                { fontFamily: active ? activeFontFamily ?? fontFamily : fontFamily },
              ]}
            >
              {opt.label}
            </Text>
            {opt.badge != null ? (
              <View style={[styles.badge, active && styles.badgeOn]}>
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
            style={styles.hit}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.88}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            {active ? (
              <LinearGradient
                colors={[PG.pillTop, PG.pillBottom]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[styles.pill, lg && styles.pillLg, glow(10, 0.7)]}
              >
                {label}
              </LinearGradient>
            ) : (
              <View style={[styles.pill, lg && styles.pillLg]}>
                {label}
              </View>
            )}
          </TouchableOpacity>
        )
      })}
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
  hit: { flex: 1, minWidth: 0 },
  pill: {
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLg: { paddingVertical: 11 },
  txt: {
    fontSize: 12,
    color: PG.pillIdleText,
    textAlign: 'center',
  },
  txtLg: { fontSize: 15 },
  txtOn: { color: PG.pillText },
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
