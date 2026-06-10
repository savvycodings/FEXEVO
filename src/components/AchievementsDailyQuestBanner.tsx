import React, { useContext, useMemo } from 'react'
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native'
import { ThemeContext } from '../context'
import { getTodaysDailyQuests, QUEST_XP_BADGE } from '../lib/dailyQuestsCatalog'
import { useTranslation } from 'react-i18next'

const BADGE_SIZE = 56

type Props = {
  onPress?: () => void
}

export function AchievementsDailyQuestBanner({ onPress }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)

  const featured = useMemo(() => getTodaysDailyQuests()[0], [])
  const current = 0
  const goal = featured?.goal ?? 1
  const pct = Math.max(0, Math.min(100, Math.round((current / goal) * 100)))

  if (!featured) return null

  return (
    <TouchableOpacity style={styles.banner} onPress={onPress} activeOpacity={onPress ? 0.9 : 1} disabled={!onPress}>
      <View style={styles.contentCol}>
        <Text
          allowFontScaling={false}
          style={[styles.title, { fontFamily: theme.semiBoldFont }]}
        >
          {t('progress.dailyQuest')}
        </Text>
        <View style={styles.taskRow}>
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[styles.taskText, { fontFamily: theme.regularFont }]}
          >
            {t(featured.titleKey)}
          </Text>
          <View style={styles.progressTextRow}>
            <Text
              allowFontScaling={false}
              style={[styles.progressCurrent, { fontFamily: theme.regularFont }]}
            >
              {current}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.progressGoalSuffix, { fontFamily: theme.regularFont }]}
            >
              {t('progress.dailyQuestProgressSuffix', { goal })}
            </Text>
          </View>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      </View>
      <View style={styles.badgeSlot}>
        <Image source={QUEST_XP_BADGE} style={styles.badgeImg} resizeMode="contain" />
        <Text allowFontScaling={false} style={[styles.badgeXp, { fontFamily: theme.semiBoldFont }]}>
          +{featured.xp}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    backgroundColor: '#041641',
    borderRadius: 20,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 12,
    gap: 10,
    marginTop: 8,
    marginBottom: 20,
  },
  contentCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 18,
    marginBottom: 6,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
    width: '100%',
  },
  taskText: {
    flex: 1,
    fontSize: 11,
    color: '#FFFFFF',
    lineHeight: 15,
    minWidth: 0,
  },
  progressTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  progressCurrent: {
    fontSize: 12,
    color: '#FFFFFF',
    lineHeight: 15,
  },
  progressGoalSuffix: {
    fontSize: 12,
    color: '#86A7D2',
    lineHeight: 15,
  },
  track: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#07256D',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#00B8FF',
  },
  badgeSlot: {
    width: BADGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    alignSelf: 'stretch',
  },
  badgeImg: {
    position: 'absolute',
    width: BADGE_SIZE,
    height: BADGE_SIZE,
  },
  badgeXp: {
    fontSize: 11,
    color: '#FFFFFF',
    lineHeight: 13,
    marginTop: 12,
  },
})
