import React from 'react'
import { ScrollView, Text, StyleSheet, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import type { AchievementFilter } from '../../../lib/achievementsCatalog'
import { PG, glow } from '../progressTheme'

const FILTERS: { key: AchievementFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'progress.categoryAll' },
  { key: 'technique', labelKey: 'progress.categoryTechnique' },
  { key: 'play', labelKey: 'progress.categoryPlay' },
  { key: 'consistency', labelKey: 'progress.categoryConsistency' },
  { key: 'special', labelKey: 'progress.categorySpecial' },
]

type Props = {
  value: AchievementFilter
  onChange: (f: AchievementFilter) => void
  theme: any
}

/** Category filter in a glowing track; scrolls sideways instead of truncating long labels. */
export function CategoryChips({ value, onChange, theme }: Props) {
  const { t } = useTranslation()
  return (
    <LinearGradient
      colors={[PG.cardTop, PG.cardBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.track, glow(14, 0.45)]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {FILTERS.map((f) => {
          const active = f.key === value
          const label = (
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.txt,
                active && styles.txtOn,
                { fontFamily: active ? theme.semiBoldFont : theme.mediumFont },
              ]}
            >
              {t(f.labelKey)}
            </Text>
          )
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => onChange(f.key)}
              activeOpacity={0.88}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              {active ? (
                <LinearGradient
                  colors={[PG.pillTop, PG.pillBottom]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={[styles.chip, glow(10, 0.7)]}
                >
                  {label}
                </LinearGradient>
              ) : (
                <View style={styles.chip}>{label}</View>
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PG.border,
    padding: 5,
    marginBottom: 16,
    overflow: 'hidden',
  },
  row: { alignItems: 'center', gap: 2 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txt: { fontSize: 15, color: PG.pillIdleText },
  txtOn: { color: PG.pillText },
})
