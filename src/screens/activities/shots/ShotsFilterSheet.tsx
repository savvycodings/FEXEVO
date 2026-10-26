import React from 'react'
import { Modal, View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { PG } from '../../progress/progressTheme'
import {
  SHOT_CATEGORIES,
  shotCategoryLabelKey,
  type ShotsCategoryFilter,
  type ShotsSort,
} from './shotsFilter'

type Props = {
  visible: boolean
  onClose: () => void
  category: ShotsCategoryFilter
  onCategoryChange: (c: ShotsCategoryFilter) => void
  sort: ShotsSort
  onSortChange: (s: ShotsSort) => void
  theme: any
}

const SORTS: { key: ShotsSort; labelKey: string }[] = [
  { key: 'newest', labelKey: 'activities.sortNewest' },
  { key: 'highest', labelKey: 'activities.sortHighest' },
  { key: 'lowest', labelKey: 'activities.sortLowest' },
]

/** Bottom sheet for the Shots list: shot category and sort. Choices apply immediately. */
export function ShotsFilterSheet({
  visible,
  onClose,
  category,
  onCategoryChange,
  sort,
  onSortChange,
  theme,
}: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const categories: { key: ShotsCategoryFilter; label: string }[] = [
    { key: null, label: t('activities.filterAll') },
    ...SHOT_CATEGORIES.map((c) => ({ key: c, label: t(shotCategoryLabelKey(c)!) })),
  ]

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} testID="shots-filter-backdrop" />
        <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]} testID="shots-filter-sheet">
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.semiBoldFont }]}>
              {t('activities.filterTitle')}
            </Text>
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={() => {
                  onCategoryChange(null)
                  onSortChange('newest')
                }}
                testID="shots-filter-reset"
              >
                <Text allowFontScaling={false} style={[styles.reset, { fontFamily: theme.mediumFont }]}>
                  {t('activities.filterReset')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button">
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <Text allowFontScaling={false} style={[styles.section, { fontFamily: theme.mediumFont }]}>
            {t('activities.filterShotType')}
          </Text>
          <View style={styles.chips}>
            {categories.map((c) => {
              const on = c.key === category
              return (
                <TouchableOpacity
                  key={c.key ?? 'all'}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => onCategoryChange(c.key)}
                  activeOpacity={0.85}
                  accessibilityState={{ selected: on }}
                  testID={`shots-filter-category-${c.key ?? 'all'}`}
                >
                  <Text
                    allowFontScaling={false}
                    style={[styles.chipTxt, on && styles.chipTxtOn, { fontFamily: on ? theme.semiBoldFont : theme.regularFont }]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text allowFontScaling={false} style={[styles.section, { fontFamily: theme.mediumFont }]}>
            {t('activities.filterSortBy')}
          </Text>
          {SORTS.map((s) => {
            const on = s.key === sort
            return (
              <TouchableOpacity
                key={s.key}
                style={styles.sortRow}
                onPress={() => onSortChange(s.key)}
                activeOpacity={0.85}
                accessibilityState={{ selected: on }}
                testID={`shots-filter-sort-${s.key}`}
              >
                <Text allowFontScaling={false} style={[styles.sortTxt, { fontFamily: theme.regularFont }]}>
                  {t(s.labelKey)}
                </Text>
                <Ionicons
                  name={on ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={on ? PG.labelBlue : PG.muted}
                />
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: PG.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: PG.border,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { fontSize: 20, color: '#FFFFFF' },
  reset: { fontSize: 14, color: PG.labelBlue },
  section: { fontSize: 13, color: PG.muted, marginTop: 14, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PG.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: PG.pillBottom, borderColor: PG.pillBottom },
  chipTxt: { fontSize: 14, color: '#FFFFFF' },
  chipTxtOn: { color: PG.pillText },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PG.borderSoft,
  },
  sortTxt: { fontSize: 15, color: '#FFFFFF' },
})
