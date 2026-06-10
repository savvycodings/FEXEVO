import React, { useContext, useMemo } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  type ImageSourcePropType,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { LocalSvgAsset } from './LocalSvgAsset'
import { DailyQuestXpBadge } from './DailyQuestXpBadge'
import { getQuestDescriptionKey } from '../lib/dailyQuestHelp'
import type { QuestCadence } from '../lib/dailyQuestsCatalog'

export type QuestHelpPayload = {
  key: string
  titleKey: string
  icon: ImageSourcePropType
  xp: number
  goal: number
  cadence: QuestCadence
  current: number
  claimed?: boolean
}

type Props = {
  visible: boolean
  quest: QuestHelpPayload | null
  onClose: () => void
}

const CADENCE_LABEL: Record<QuestCadence, string> = {
  daily: 'progress.questTabDaily',
  weekly: 'progress.questTabWeekly',
  season: 'progress.questTabSeason',
}

export function QuestHelpModal({ visible, quest, onClose }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => getStyles(theme), [theme])

  if (!quest) return null

  const isComplete = quest.claimed || quest.current >= quest.goal
  const descKey = getQuestDescriptionKey(quest.key)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />
        <View style={[styles.card, { marginBottom: insets.bottom }]}>
          <View style={styles.closeRow}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeHit}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <Ionicons name="close" size={22} color="#86A7D2" />
            </TouchableOpacity>
          </View>

          <View style={styles.heroRow}>
            <LocalSvgAsset assetModule={quest.icon as number} width={52} height={52} />
            <DailyQuestXpBadge
              xp={quest.xp}
              completed={isComplete}
              fontFamily={theme.semiBoldFont}
              size="card"
            />
          </View>

          <Text allowFontScaling={false} style={[styles.cadence, { fontFamily: theme.mediumFont }]}>
            {t(CADENCE_LABEL[quest.cadence])}
          </Text>
          <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.semiBoldFont }]}>
            {t(quest.titleKey)}
          </Text>

          <View style={styles.howToBlock}>
            <Text allowFontScaling={false} style={[styles.howToLabel, { fontFamily: theme.semiBoldFont }]}>
              {t('progress.questHowToTitle')}
            </Text>
            <Text allowFontScaling={false} style={[styles.howToBody, { fontFamily: theme.regularFont }]}>
              {t(descKey)}
            </Text>
          </View>

          <View style={styles.progressBlock}>
            <Text allowFontScaling={false} style={[styles.progressLabel, { fontFamily: theme.mediumFont }]}>
              {t('progress.questHowToProgress')}
            </Text>
            <Text allowFontScaling={false} style={[styles.progressValue, { fontFamily: theme.semiBoldFont }]}>
              {quest.claimed
                ? t('progress.questClaimed')
                : `${quest.current}${t('progress.dailyQuestProgressSuffix', { goal: quest.goal })}`}
            </Text>
          </View>

          <TouchableOpacity activeOpacity={0.88} onPress={onClose} style={styles.btnOuter}>
            <LinearGradient
              colors={['#0022FF', '#00BBFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btnInner}
            >
              <Text allowFontScaling={false} style={[styles.btnText, { fontFamily: theme.semiBoldFont }]}>
                {t('progress.achievementGotIt')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

function getStyles(theme: { semiBoldFont?: string; regularFont?: string; mediumFont?: string }) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(5, 10, 24, 0.82)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    card: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: '#041641',
      borderRadius: 22,
      paddingTop: 12,
      paddingBottom: 22,
      paddingHorizontal: 22,
      borderWidth: 1,
      borderColor: 'rgba(0, 89, 255, 0.45)',
    },
    closeRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: 4,
    },
    closeHit: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      marginBottom: 16,
      paddingTop: 4,
    },
    cadence: {
      fontSize: 11,
      color: '#00B8FF',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom: 6,
      textAlign: 'center',
    },
    title: {
      fontSize: 20,
      color: '#FFFFFF',
      lineHeight: 26,
      marginBottom: 18,
      textAlign: 'center',
    },
    howToBlock: {
      padding: 14,
      borderRadius: 14,
      backgroundColor: 'rgba(7, 37, 109, 0.65)',
      borderWidth: 1,
      borderColor: 'rgba(0, 89, 255, 0.25)',
      marginBottom: 12,
    },
    howToLabel: {
      fontSize: 12,
      color: '#004BFF',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    howToBody: {
      fontSize: 14,
      color: '#FFFFFF',
      lineHeight: 21,
    },
    progressBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
      paddingHorizontal: 2,
    },
    progressLabel: {
      fontSize: 13,
      color: '#86A7D2',
    },
    progressValue: {
      fontSize: 13,
      color: '#FFFFFF',
    },
    btnOuter: {
      borderRadius: 14,
      overflow: 'hidden',
    },
    btnInner: {
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: {
      fontSize: 15,
      color: '#FFFFFF',
    },
  })
}
