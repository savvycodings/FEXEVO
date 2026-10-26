import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSessionData } from '../../../context/SessionDataContext'
import { getTodaysDailyQuests } from '../../../lib/dailyQuestsCatalog'
import { HexIcon } from './HexIcon'
import { PG, glow } from '../progressTheme'

type Props = {
  theme: any
  onPress?: () => void
}

/** Today's featured daily quest with a hexagon XP badge. */
export function DailyQuestCard({ theme, onPress }: Props) {
  const { t } = useTranslation()
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
  const complete = claimed || current >= goal
  const pct = Math.max(0, Math.min(100, (current / Math.max(1, goal)) * 100))

  return (
    <TouchableOpacity
      style={[styles.card, glow(10, 0.25)]}
      onPress={onPress}
      activeOpacity={onPress ? 0.9 : 1}
      disabled={!onPress}
      accessibilityRole="button"
    >
      <View style={styles.body}>
        <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.semiBoldFont }]}>
          {t('progress.dailyQuest')}
        </Text>
        <View style={styles.taskRow}>
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[styles.task, { fontFamily: theme.regularFont }]}
          >
            {t(featured.titleKey)}
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.count, complete && styles.countDone, { fontFamily: theme.regularFont }]}
          >
            {claimed ? t('progress.questClaimed') : t('progress.achievementProgress', { current, goal })}
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, complete && styles.fillDone, { width: `${pct}%` }]} />
        </View>
      </View>
      {/* No glow wrapper: a shadow would outline the hexagon's square box on web. */}
      <HexIcon size={60} variant="solid">
        <Text allowFontScaling={false} style={[styles.xpTop, { fontFamily: theme.boldFont }]}>
          XP
        </Text>
        <Text allowFontScaling={false} style={[styles.xpAmt, { fontFamily: theme.mediumFont }]}>
          +{featured.xp}
        </Text>
      </HexIcon>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: PG.cardPlain,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PG.borderSoft,
    paddingVertical: 16,
    paddingLeft: 18,
    paddingRight: 14,
    marginBottom: 16,
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 20, color: '#FFFFFF', marginBottom: 6 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  task: { flex: 1, minWidth: 0, fontSize: 15, color: '#FFFFFF' },
  count: { fontSize: 15, color: '#FFFFFF', flexShrink: 0 },
  countDone: { color: '#05DF78' },
  track: { height: 8, borderRadius: 4, backgroundColor: PG.barTrack, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: PG.barFill },
  fillDone: { backgroundColor: '#05DF78' },
  xpTop: { fontSize: 18, color: '#FFFFFF', lineHeight: 20 },
  xpAmt: { fontSize: 11, color: '#FFFFFF' },
})
