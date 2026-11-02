import React, { useContext, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { UI } from '../components/ui'
import {
  COACH_SPECIALTY_KEYS,
  MAX_COACH_SPECIALTIES,
  saveCoachSpecialties,
  sortSpecialties,
  specialtyI18nKey,
  type CoachSpecialtyKey,
} from '../lib/coachSpecialties'
import type { YouTabStackParamList } from '../navigation/types'
import { TEST_IDS } from '../lib/testIds'
import { showAlert } from '../lib/showAlert'

type Nav = NativeStackNavigationProp<YouTabStackParamList, 'CoachSpecialtiesEdit'>
type Route = RouteProp<YouTabStackParamList, 'CoachSpecialtiesEdit'>

/** Coach You tab: toggle up to 5 of the 8 specialties and save. Opens with the current list. */
export function CoachSpecialtiesEditScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const insets = useSafeAreaInsets()
  const { theme } = useContext(ThemeContext)
  const { t } = useTranslation()
  const styles = useMemo(() => getStyles(theme), [theme])

  const [selected, setSelected] = useState<CoachSpecialtyKey[]>(() =>
    sortSpecialties(route.params?.specialties ?? []),
  )
  const [saving, setSaving] = useState(false)
  const full = selected.length >= MAX_COACH_SPECIALTIES

  function toggle(key: CoachSpecialtyKey) {
    setSelected((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length >= MAX_COACH_SPECIALTIES
          ? prev
          : sortSpecialties([...prev, key]),
    )
  }

  async function onSave() {
    if (saving) return
    setSaving(true)
    try {
      await saveCoachSpecialties(selected)
      navigation.goBack()
    } catch {
      showAlert(t('coachSpecialties.saveErrorTitle'), t('coachSpecialties.saveErrorBody'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(12, insets.top) }]}>
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.goBack')}
        >
          <Ionicons name="chevron-back" size={28} color="#86A7D2" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {t('coachSpecialties.editTitle')}
        </Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={() => void onSave()}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={t('coachSpecialties.save')}
          testID={TEST_IDS.specialtiesSave}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>{t('coachSpecialties.save')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollInner, { paddingBottom: insets.bottom + 24 }]}
      >
        <Text style={styles.hint}>
          {t('coachSpecialties.pickHint')} ({selected.length}/{MAX_COACH_SPECIALTIES})
        </Text>
        <View style={styles.chips}>
          {COACH_SPECIALTY_KEYS.map((key) => {
            const on = selected.includes(key)
            const disabled = !on && full
            return (
              <TouchableOpacity
                key={key}
                style={[styles.chip, on && styles.chipOn, disabled && styles.chipDisabled]}
                onPress={() => toggle(key)}
                disabled={disabled}
                activeOpacity={0.85}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled }}
                testID={TEST_IDS.specialtyChip(key)}
              >
                {on ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(specialtyI18nKey(key))}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}

function getStyles(theme: { backgroundColor?: string; mediumFont?: string; regularFont?: string; semiBoldFont?: string }) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.backgroundColor ?? '#030A17' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    backRow: { flexDirection: 'row', alignItems: 'center' },
    title: {
      flex: 1,
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont ?? 'System',
      fontSize: 18,
    },
    saveBtn: {
      minWidth: 72,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#00B8FF',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    saveBtnDisabled: { opacity: 0.7 },
    saveBtnText: { color: '#FFFFFF', fontFamily: theme.semiBoldFont ?? theme.mediumFont ?? 'System', fontSize: 15 },
    scroll: { flex: 1 },
    scrollInner: { paddingHorizontal: 20, paddingTop: 8 },
    hint: { color: UI.textMuted, fontFamily: theme.regularFont ?? 'System', fontSize: 14, marginBottom: 16 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 40,
      paddingHorizontal: 16,
      borderRadius: UI.radiusPill,
      borderWidth: 1,
      borderColor: UI.chipBorder,
      backgroundColor: UI.chipBg,
    },
    chipOn: { backgroundColor: UI.accentStrong, borderColor: UI.accentStrong },
    chipDisabled: { opacity: 0.4 },
    chipText: { color: UI.textMuted, fontFamily: theme.mediumFont ?? 'System', fontSize: 15 },
    chipTextOn: { color: '#FFFFFF' },
  })
}
