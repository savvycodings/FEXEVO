import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { PG } from '../../progress/progressTheme'

type Props = {
  theme: any
  onFilterPress: () => void
  /** Dot on the button while a category filter or non-default sort is on. */
  filterActive: boolean
}

export function ShotsTitleRow({ theme, onFilterPress, filterActive }: Props) {
  const { t } = useTranslation()
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.semiBoldFont }]}>
          {t('activities.shots')}
        </Text>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={onFilterPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          testID="shots-filter-button"
        >
          <Ionicons name="options-outline" size={16} color={PG.labelBlue} />
          <Text allowFontScaling={false} style={[styles.filterTxt, { fontFamily: theme.mediumFont }]}>
            {t('activities.filter')}
          </Text>
          {filterActive ? <View style={styles.dot} testID="shots-filter-active-dot" /> : null}
        </TouchableOpacity>
      </View>
      <Text allowFontScaling={false} style={[styles.subtitle, { fontFamily: theme.regularFont }]}>
        {t('activities.shotsSubtitle')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 30, color: '#FFFFFF' },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: PG.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterTxt: { fontSize: 14, color: '#FFFFFF' },
  dot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: PG.accent,
  },
  subtitle: { fontSize: 14, color: PG.muted, marginTop: 4 },
})
