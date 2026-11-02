import React, { useContext } from 'react'
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../../context'
import { UI } from '../ui'

/** Everyone / Friends only, in the same modal style as the coach sort sheet. */
export function RankingFilterSheet({
  visible,
  friendsOnly,
  onPick,
  onClose,
}: {
  visible: boolean
  friendsOnly: boolean
  onPick: (friendsOnly: boolean) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const options = [
    { value: false, label: t('friendsRanking.filterEveryone'), testID: 'ranking-filter-everyone' },
    { value: true, label: t('friendsRanking.filterFriends'), testID: 'ranking-filter-friends' },
  ]
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} testID="ranking-filter-backdrop" />
        <View style={styles.card} testID="ranking-filter-sheet">
          <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.semiBoldFont }]}>
            {t('friendsRanking.filterTitle')}
          </Text>
          {options.map((opt) => {
            const selected = opt.value === friendsOnly
            return (
              <TouchableOpacity
                key={opt.testID}
                style={[styles.row, selected && styles.rowActive]}
                onPress={() => onPick(opt.value)}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                testID={opt.testID}
              >
                <Text style={[styles.rowText, { fontFamily: theme.mediumFont }, selected && styles.rowTextActive]}>
                  {opt.label}
                </Text>
                {selected ? <Ionicons name="checkmark" size={18} color={UI.accent} /> : null}
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: UI.radiusCard,
    borderWidth: 1,
    borderColor: UI.cardBorder,
    backgroundColor: UI.cardBg,
    padding: 16,
    gap: 6,
  },
  title: { fontSize: 17, color: '#FFFFFF', marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  rowActive: { backgroundColor: UI.surface },
  rowText: { fontSize: 15, color: UI.textMuted },
  rowTextActive: { color: '#FFFFFF' },
})
