import React, { useContext, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { ThemeContext } from '../context'
import { useSessionData } from '../context/SessionDataContext'
import { DailyQuestXpBadge } from './DailyQuestXpBadge'
import { getTodaysDailyQuests } from '../lib/dailyQuestsCatalog'
import { useTranslation } from 'react-i18next'

type Props = {
  onPress?: () => void
}

export function AchievementsDailyQuestBanner({ onPress }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { dailyQuests } = useSessionData()

  const featured = useMemo(() => getTodaysDailyQuests()[0], [])
  const progress = useMemo(
    () => dailyQuests.find((q) => q.questKey === featured?.key),
    [dailyQuests, featured?.key]
  )

  if (!featured) return null

  const current = progress?.progress ?? 0
  const goal = progress?.goal ?? featured.goal
  const claimed = progress?.claimed ?? false
  const isComplete = claimed || current >= goal
  const pct = Math.max(0, Math.min(100, Math.round((current / Math.max(1, goal)) * 100)))

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
            {claimed ? (
              <Text
                allowFontScaling={false}
                style={[styles.claimedTxt, { fontFamily: theme.semiBoldFont }]}
              >
                {t('progress.questClaimed')}
              </Text>
            ) : (
              <>
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
              </>
            )}
          </View>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${pct}%`, backgroundColor: isComplete ? '#05DF78' : '#00B8FF' },
            ]}
          />
        </View>
      </View>
      <DailyQuestXpBadge
        xp={featured.xp}
        completed={isComplete}
        fontFamily={theme.semiBoldFont}
        size="banner"
      />
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
  claimedTxt: {
    fontSize: 12,
    color: '#05DF78',
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
  },
})
