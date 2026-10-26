import React, { useCallback, useContext, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useActionSheet } from '@expo/react-native-action-sheet'
import { ThemeContext } from '../context'
import { useSessionData } from '../context/SessionDataContext'
import { StaggerChildren, usePageFocusKey } from '../components/PageEntrance'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ProgressTabStackParamList } from '../navigation/types'
import {
  activityDaysThisWeek,
  carryForward,
  completedSessions,
  pillarAveragesWindow,
  previousWindowDelta,
  resolveNumWeeks,
  sessionsThisCalendarWeek,
  weeklySeries,
  windowStart,
  type ChartMetric,
  type PeriodKey,
} from './progress/progressMetrics'
import { PG, glow } from './progress/progressTheme'
import { SegmentedPills } from './progress/SegmentedPills'
import { ScoreRing } from './progress/ScoreRing'
import { ProgressLineChart } from './progress/ProgressLineChart'
import { CategoryBreakdownCard } from './progress/CategoryBreakdownCard'
import { TrainingConsistencyCard } from './progress/TrainingConsistencyCard'
import { AchievementsHeroCard } from './progress/achievements/AchievementsHeroCard'
import { DailyQuestCard } from './progress/achievements/DailyQuestCard'
import { CategoryChips } from './progress/achievements/CategoryChips'
import { AchievementCard } from './progress/achievements/AchievementCard'
import { buildAchievementCards, type AchievementFilter } from '../lib/achievementsCatalog'

const GUTTER = 20
const CARD_PAD = 18
/** Below this inner card width the ring stacks above the chart. */
const STACK_BELOW = 280

type ProgressView = 'score' | 'achievements'

const VIEW_OPTION_KEYS: { key: ProgressView; labelKey: string }[] = [
  { key: 'score', labelKey: 'progress.tabScore' },
  { key: 'achievements', labelKey: 'progress.tabAchievements' },
]

const PERIOD_OPTION_KEYS: { key: PeriodKey; labelKey: string }[] = [
  { key: 4, labelKey: 'progress.weeks4' },
  { key: 8, labelKey: 'progress.weeks8' },
  { key: 12, labelKey: 'progress.weeks12' },
  { key: 'all', labelKey: 'progress.allTime' },
]

const METRIC_OPTION_KEYS: { key: ChartMetric; labelKey: string }[] = [
  { key: 'overall', labelKey: 'progress.metricOverall' },
  { key: 'technique', labelKey: 'progress.metricTechnique' },
  { key: 'outcome', labelKey: 'progress.metricOutcome' },
  { key: 'tactics', labelKey: 'progress.metricTactics' },
]

export function ProgressScreen() {
  const { t } = useTranslation()
  const navigation = useNavigation<NativeStackNavigationProp<ProgressTabStackParamList>>()
  const { theme } = useContext(ThemeContext)
  const { activities, achievementProgress, claimedAchievementKeys, claimableAchievementKeys } =
    useSessionData()
  const { showActionSheetWithOptions } = useActionSheet()
  const insets = useSafeAreaInsets()
  const focusKey = usePageFocusKey()
  const { width: winW } = useWindowDimensions()

  const [progressView, setProgressView] = useState<ProgressView>('score')
  const [period, setPeriod] = useState<PeriodKey>(8)
  const [chartMetric, setChartMetric] = useState<ChartMetric>('overall')
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>('all')

  /** Two-column rows so both cards in a row share a height and their bars line up. */
  const achievementRows = useMemo(() => {
    const cards = buildAchievementCards(
      achievementProgress,
      claimedAchievementKeys,
      claimableAchievementKeys,
      achievementFilter
    )
    const rows: (typeof cards)[] = []
    for (let i = 0; i < cards.length; i += 2) rows.push(cards.slice(i, i + 2))
    return rows
  }, [achievementProgress, claimedAchievementKeys, claimableAchievementKeys, achievementFilter])

  const styles = useMemo(() => getStyles(theme), [theme])
  const horizontalPad = Math.max(GUTTER, insets.left, insets.right)
  const cardContentW = Math.max(0, winW - horizontalPad * 2 - CARD_PAD * 2)
  const stacked = cardContentW < STACK_BELOW
  const ringSize = stacked ? 128 : Math.min(128, Math.round(cardContentW * 0.34))
  /** Wider than the ring so "vs. previous N weeks" fits on one line. */
  const ringColW = ringSize + 40
  const chartW = stacked ? cardContentW : cardContentW - ringColW - 8

  const numWeeks = useMemo(() => resolveNumWeeks(period, activities), [period, activities])

  const rawWeekly = useMemo(
    () => weeklySeries(activities, numWeeks, chartMetric),
    [activities, numWeeks, chartMetric]
  )

  const chartSeries = useMemo(() => carryForward(rawWeekly), [rawWeekly])

  const weekLabels = useMemo(() => Array.from({ length: numWeeks }, (_, i) => `W${i + 1}`), [numWeeks])

  const headlineScore = useMemo(() => {
    const lastRaw = [...rawWeekly].reverse().find((v) => v != null)
    return lastRaw != null ? Math.round(lastRaw) : null
  }, [rawWeekly])

  const delta = useMemo(
    () => previousWindowDelta(activities, period, chartMetric),
    [activities, period, chartMetric]
  )

  const pillarNow = useMemo(
    () => pillarAveragesWindow(completedSessions(activities), windowStart(numWeeks), new Date()),
    [activities, numWeeks]
  )

  const sessionsThisWeek = useMemo(() => sessionsThisCalendarWeek(activities), [activities])
  const weekHits = useMemo(() => activityDaysThisWeek(activities), [activities])

  const onPickMetric = useCallback(() => {
    const labels = METRIC_OPTION_KEYS.map((m) => t(m.labelKey))
    showActionSheetWithOptions(
      {
        options: [...labels, t('common.cancel')],
        cancelButtonIndex: labels.length,
      },
      (idx) => {
        if (idx == null || idx >= METRIC_OPTION_KEYS.length) return
        setChartMetric(METRIC_OPTION_KEYS[idx].key)
      }
    )
  }, [showActionSheetWithOptions, t])

  const ringBlock = (
    <View style={[styles.ringCol, { width: stacked ? undefined : ringColW }]}>
      <ScoreRing
        score={headlineScore}
        size={ringSize}
        numberFont={theme.mediumFont}
        labelFont={theme.regularFont}
        outOfLabel={t('progress.outOf100')}
      />
      {delta != null ? (
        <>
          <View style={[styles.deltaBadge, glow(8, 0.5)]}>
            <Text allowFontScaling={false} style={[styles.deltaArrow, delta < 0 && styles.deltaArrowDown]}>
              {delta < 0 ? '▼' : '▲'}
            </Text>
            <Text allowFontScaling={false} style={styles.deltaTxt}>
              {delta > 0 ? `+${delta}` : String(Math.abs(delta))}
            </Text>
          </View>
          <Text allowFontScaling={false} style={styles.deltaCaption} numberOfLines={2}>
            {t('progress.vsPreviousWeeks', { count: period as number })}
          </Text>
        </>
      ) : null}
    </View>
  )

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          {
            paddingHorizontal: horizontalPad,
            // Sits below the global <Header/> in main.tsx, which already pads insets.top.
            paddingTop: 20,
            // Keep content clear of tab bar without painting an extra bottom block.
            paddingBottom: 32 + insets.bottom + 74,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <StaggerChildren replayKey={focusKey}>
          <Text allowFontScaling={false} style={styles.pageTitle}>
            {t(progressView === 'score' ? 'progress.title' : 'progress.tabAchievements')}
          </Text>

          <SegmentedPills
            size="lg"
            options={VIEW_OPTION_KEYS.map((o) => ({ key: o.key, label: t(o.labelKey) }))}
            value={progressView}
            onChange={setProgressView}
            fontFamily={theme.mediumFont}
            activeFontFamily={theme.semiBoldFont}
            style={styles.viewSegment}
          />

          {progressView === 'score' ? (
            <>
              <SegmentedPills
                options={PERIOD_OPTION_KEYS.map((o) => ({ key: o.key, label: t(o.labelKey) }))}
                value={period}
                onChange={setPeriod}
                fontFamily={theme.mediumFont}
                activeFontFamily={theme.semiBoldFont}
                style={styles.periodSegment}
              />

              <LinearGradient
                colors={[PG.cardTop, PG.cardBottom]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[styles.scoreCard, glow(18, 0.55)]}
              >
                <View style={styles.cardHeadRow}>
                  <Text allowFontScaling={false} style={styles.cardHeadTitle}>
                    {t('progress.overallScore')}
                  </Text>
                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={onPickMetric}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                  >
                    <Text allowFontScaling={false} style={styles.dropdownTxt}>
                      {t(
                        METRIC_OPTION_KEYS.find((m) => m.key === chartMetric)?.labelKey ??
                          'progress.metricOverall'
                      )}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <View style={[styles.scoreBody, stacked && styles.scoreBodyStacked]}>
                  {ringBlock}
                  <ProgressLineChart width={chartW} series={chartSeries} labels={weekLabels} />
                </View>
              </LinearGradient>

              <CategoryBreakdownCard
                technique={pillarNow.technique}
                outcome={pillarNow.outcome}
                tactics={pillarNow.tactics}
                theme={theme}
              />

              <TrainingConsistencyCard sessionsThisWeek={sessionsThisWeek} weekHits={weekHits} theme={theme} />
            </>
          ) : (
            <>
              <AchievementsHeroCard theme={theme} />
              <DailyQuestCard theme={theme} onPress={() => navigation.navigate('DailyQuest')} />
              <CategoryChips value={achievementFilter} onChange={setAchievementFilter} theme={theme} />
              {achievementRows.map((row) => (
                <View key={row.map((c) => c.key).join('|')} style={styles.achievementRow}>
                  {row.map((card) => (
                    <AchievementCard
                      key={card.key}
                      card={card}
                      theme={theme}
                      onPress={() => navigation.navigate('AchievementDetail', { achievementKey: card.key })}
                      compact={winW < 380}
                    />
                  ))}
                  {/* Keep a lone last card at half width. */}
                  {row.length === 1 ? <View style={styles.achievementSpacer} /> : null}
                </View>
              ))}
            </>
          )}
        </StaggerChildren>
      </ScrollView>
    </View>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: PG.bg,
    },
    scroll: { flex: 1 },
    scrollInner: { paddingBottom: 32 },
    pageTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 30,
      color: '#FFFFFF',
      marginBottom: 20,
    },
    viewSegment: { marginBottom: 14 },
    periodSegment: { marginBottom: 18 },
    scoreCard: {
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: PG.border,
      padding: CARD_PAD,
      marginBottom: 16,
    },
    cardHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    cardHeadTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 22,
      color: PG.labelBlue,
    },
    dropdown: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: PG.border,
      backgroundColor: 'rgba(2, 11, 34, 0.6)',
    },
    dropdownTxt: {
      fontFamily: theme.mediumFont,
      fontSize: 13,
      color: '#FFFFFF',
    },
    scoreBody: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    scoreBodyStacked: {
      flexDirection: 'column',
      gap: 16,
    },
    ringCol: {
      alignItems: 'center',
    },
    deltaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: -10,
      paddingVertical: 4,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: '#2F7BFF',
      backgroundColor: '#061A45',
    },
    deltaArrow: {
      fontSize: 11,
      color: '#5BF5B0',
    },
    deltaArrowDown: {
      color: '#FF6B6B',
    },
    deltaTxt: {
      fontFamily: theme.semiBoldFont,
      fontSize: 18,
      color: '#FFFFFF',
    },
    achievementRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 12,
      marginBottom: 12,
    },
    achievementSpacer: { flex: 1 },
    deltaCaption: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: PG.muted,
      marginTop: 8,
      textAlign: 'center',
    },
  })
}
