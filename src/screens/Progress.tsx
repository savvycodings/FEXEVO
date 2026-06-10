import React, { useCallback, useContext, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop, Circle } from 'react-native-svg'
import { useActionSheet } from '@expo/react-native-action-sheet'
import { ThemeContext } from '../context'
import { useSessionData } from '../context/SessionDataContext'
import { ProLibraryGradientProgressBar } from '../components'
import { AchievementsHeroBlock } from '../components/AchievementsHeroBlock'
import { AchievementsDailyQuestBanner } from '../components/AchievementsDailyQuestBanner'
import { AchievementsBadgesSection } from '../components/AchievementsBadgesSection'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import type { ActivitySession } from '../lib/activitySession'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ProgressTabStackParamList } from '../navigation/types'

const ACTIVITIES_TICK_SVG = require('../../assets/actiities/tick.svg')

const PG = {
  bg: '#050A18',
  /** Content panels / period track — product spec. */
  card: '#001435',
  /** Training consistency — empty day ring (no border). */
  dayCircleEmpty: '#07256D',
  accent: '#00B8FF',
  track: '#061428',
  muted: 'rgba(255,255,255,0.55)',
  text: 'rgba(255,255,255,0.92)',
  labelBlue: '#5EB4FF',
  /** Period segment selected pill (connected control). */
  segmentActive: '#0048CD',
  /** Progress chart line and point fill. */
  chartLine: '#0059FF',
  chartGrid: 'rgba(134, 167, 210, 0.28)',
}

const GUTTER = 20
const CHART_H = 168
/** Vertex dots on the progress line chart — keep small vs stroke weight. */
const CHART_POINT_RADIUS = 2.25
const MAX_ALL_TIME_WEEKS = 52

const TRAINING_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

type PeriodKey = 4 | 8 | 12 | 'all'
type ChartMetric = 'overall' | 'technique' | 'outcome' | 'tactics'
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

function mondayLocal(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

function pickMetric(s: ActivitySession, m: ChartMetric): number | null {
  switch (m) {
    case 'overall':
      return typeof s.score === 'number' && Number.isFinite(s.score) ? s.score : null
    case 'technique':
      return typeof s.techniqueScore === 'number' ? s.techniqueScore : null
    case 'outcome':
      return typeof s.outcomeScore === 'number' ? s.outcomeScore : null
    case 'tactics':
      return typeof s.tacticsScore === 'number' ? s.tacticsScore : null
    default:
      return null
  }
}

function completedSessions(sessions: ActivitySession[]): ActivitySession[] {
  return sessions.filter((s) => s.status === 'completed')
}

/** Average numeric field over sessions in [start, end). */
function avgInRange(
  sessions: ActivitySession[],
  start: Date,
  end: Date,
  getter: (s: ActivitySession) => number | null
): number | null {
  const vals: number[] = []
  const t0 = start.getTime()
  const t1 = end.getTime()
  for (const s of sessions) {
    const t = new Date(s.createdAt).getTime()
    if (t < t0 || t >= t1) continue
    const v = getter(s)
    if (v != null && Number.isFinite(v)) vals.push(Math.max(0, Math.min(100, v)))
  }
  if (!vals.length) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

function resolveNumWeeks(period: PeriodKey, sessions: ActivitySession[]): number {
  if (period !== 'all') return period
  const done = completedSessions(sessions)
  if (!done.length) return 8
  let oldest = new Date(done[0].createdAt)
  for (const s of done) {
    const d = new Date(s.createdAt)
    if (d < oldest) oldest = d
  }
  const curMon = mondayLocal(new Date())
  const firstMon = mondayLocal(oldest)
  const diffMs = curMon.getTime() - firstMon.getTime()
  const weeks = Math.max(1, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1)
  return Math.min(MAX_ALL_TIME_WEEKS, Math.max(4, weeks))
}

function weeklySeries(
  sessions: ActivitySession[],
  numWeeks: number,
  metric: ChartMetric
): (number | null)[] {
  const done = completedSessions(sessions)
  const currentMonday = mondayLocal(new Date())
  const oldestMonday = new Date(currentMonday)
  oldestMonday.setDate(currentMonday.getDate() - (numWeeks - 1) * 7)

  const out: (number | null)[] = []
  for (let w = 0; w < numWeeks; w++) {
    const ws = new Date(oldestMonday)
    ws.setDate(oldestMonday.getDate() + w * 7)
    const we = new Date(ws)
    we.setDate(ws.getDate() + 7)
    const avg = avgInRange(done, ws, we, (s) => pickMetric(s, metric))
    out.push(avg)
  }
  return out
}

function carryForward(series: (number | null)[]): number[] {
  let last: number | null = null
  return series.map((v) => {
    if (v != null) {
      last = v
      return v
    }
    return last ?? 0
  })
}

function pillarAveragesWindow(
  sessions: ActivitySession[],
  start: Date,
  end: Date
): { technique: number | null; outcome: number | null; tactics: number | null } {
  return {
    technique: avgInRange(sessions, start, end, (s) =>
      typeof s.techniqueScore === 'number' ? s.techniqueScore : null
    ),
    outcome: avgInRange(sessions, start, end, (s) =>
      typeof s.outcomeScore === 'number' ? s.outcomeScore : null
    ),
    tactics: avgInRange(sessions, start, end, (s) =>
      typeof s.tacticsScore === 'number' ? s.tacticsScore : null
    ),
  }
}

function sessionsThisCalendarWeek(sessions: ActivitySession[]): number {
  const mon = mondayLocal(new Date())
  const next = new Date(mon)
  next.setDate(mon.getDate() + 7)
  let n = 0
  for (const s of sessions) {
    if (s.status !== 'completed') continue
    const t = new Date(s.createdAt).getTime()
    if (t >= mon.getTime() && t < next.getTime()) n += 1
  }
  return n
}

/** Mon=0 … Sun=6 for current calendar week */
function activityDaysThisWeek(sessions: ActivitySession[]): boolean[] {
  const days = [false, false, false, false, false, false, false]
  const mon = mondayLocal(new Date())
  const next = new Date(mon)
  next.setDate(mon.getDate() + 7)
  for (const s of sessions) {
    if (s.status !== 'completed') continue
    const d = new Date(s.createdAt)
    const t = d.getTime()
    if (t < mon.getTime() || t >= next.getTime()) continue
    const idx = (d.getDay() + 6) % 7
    days[idx] = true
  }
  return days
}

type ProgressChartProps = {
  /** Width available inside the card for the chart (after horizontal padding). */
  contentWidth: number
  series: number[]
  labels: string[]
}

const CHART_Y_AXIS_W = 28

function ProgressLineChart({ contentWidth, series, labels }: ProgressChartProps) {
  const plotH = CHART_H - 24
  const padT = 8
  const n = series.length
  const bottomY = padT + plotH

  const { svgW, padL, plotInnerW, gridStartX, gridEndX } = useMemo(() => {
    const rowW = Math.max(120, contentWidth)
    const svgWidth = Math.max(64, rowW - CHART_Y_AXIS_W)
    const padLeft = Math.min(30, Math.max(18, Math.round(svgWidth * 0.1)))
    const padRight = 6
    const inner = Math.max(36, svgWidth - padLeft - padRight)
    return {
      svgW: svgWidth,
      padL: padLeft,
      plotInnerW: inner,
      gridStartX: padLeft,
      gridEndX: padLeft + inner,
    }
  }, [contentWidth])

  const pts = useMemo(() => {
    if (n < 1) return []
    if (n === 1) {
      const v = series[0]
      const x = padL + plotInnerW / 2
      const y = padT + (1 - Math.max(0, Math.min(100, v)) / 100) * (plotH - 8)
      return [{ x, y, v }]
    }
    return series.map((v, i) => {
      const x = padL + (i / (n - 1)) * plotInnerW
      const y = padT + (1 - Math.max(0, Math.min(100, v)) / 100) * (plotH - 8)
      return { x, y, v }
    })
  }, [series, n, plotInnerW, padL, plotH])

  const linePath = useMemo(() => {
    if (pts.length < 2) return ''
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  }, [pts])

  const areaPath = useMemo(() => {
    if (pts.length < 2) return ''
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
    const lx = pts[pts.length - 1].x
    const fx = pts[0].x
    return `${line} L ${lx.toFixed(2)} ${bottomY.toFixed(2)} L ${fx.toFixed(2)} ${bottomY.toFixed(2)} Z`
  }, [pts, bottomY])

  const gridTicks = [100, 75, 50, 25, 0] as const

  return (
    <View style={chartStyles.chartRoot}>
      <View style={chartStyles.chartRow}>
        <View style={chartStyles.yAxisCol}>
          {gridTicks.map((tick) => {
            const y = padT + (1 - tick / 100) * (plotH - 8)
            return (
              <Text
                key={tick}
                allowFontScaling={false}
                style={[chartStyles.yTick, { position: 'absolute', top: y - 8, right: 0 }]}
              >
                {tick}
              </Text>
            )
          })}
        </View>
        <Svg width={svgW} height={CHART_H}>
          <Defs>
            <SvgLinearGradient id="progressAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={PG.segmentActive} stopOpacity="0.4" />
              <Stop offset="1" stopColor={PG.segmentActive} stopOpacity="0.04" />
            </SvgLinearGradient>
          </Defs>
          {gridTicks.map((tick) => {
            const y = padT + (1 - tick / 100) * (plotH - 8)
            return (
              <Path
                key={`grid-${tick}`}
                d={`M ${gridStartX.toFixed(2)} ${y.toFixed(2)} L ${Math.min(gridEndX, svgW - 1).toFixed(2)} ${y.toFixed(2)}`}
                stroke={PG.chartGrid}
                strokeWidth={1}
                fill="none"
              />
            )
          })}
          {areaPath ? <Path d={areaPath} fill="url(#progressAreaGrad)" /> : null}
          {linePath ? (
            <Path d={linePath} stroke={PG.chartLine} strokeWidth={2.5} fill="none" strokeLinecap="round" />
          ) : null}
          {pts.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={CHART_POINT_RADIUS} fill={PG.chartLine} />
          ))}
        </Svg>
      </View>
      <View style={[chartStyles.xAxisRow, { paddingLeft: CHART_Y_AXIS_W }]}>
        {labels.map((lb) => (
          <Text key={lb} allowFontScaling={false} style={chartStyles.xTick} numberOfLines={1}>
            {lb}
          </Text>
        ))}
      </View>
    </View>
  )
}

const chartStyles = StyleSheet.create({
  chartRoot: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  chartRow: {
    flexDirection: 'row',
    height: CHART_H,
    width: '100%',
    maxWidth: '100%',
  },
  yAxisCol: {
    width: CHART_Y_AXIS_W,
    position: 'relative',
    flexShrink: 0,
  },
  yTick: {
    fontSize: 11,
    color: '#86A7D2',
    textAlign: 'right',
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 2,
    marginTop: -4,
    width: '100%',
    maxWidth: '100%',
  },
  xTick: {
    fontSize: 10,
    color: '#86A7D2',
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
  },
})

export function ProgressScreen() {
  const { t } = useTranslation()
  const navigation = useNavigation<NativeStackNavigationProp<ProgressTabStackParamList>>()
  const { theme } = useContext(ThemeContext)
  const { activities } = useSessionData()
  const { showActionSheetWithOptions } = useActionSheet()
  const insets = useSafeAreaInsets()
  const { width: winW } = useWindowDimensions()

  const [progressView, setProgressView] = useState<ProgressView>('score')
  const [period, setPeriod] = useState<PeriodKey>(8)
  const [chartMetric, setChartMetric] = useState<ChartMetric>('overall')

  const styles = useMemo(() => getStyles(theme), [theme])
  const horizontalPad = Math.max(GUTTER, insets.left, insets.right)
  const cardW = winW - horizontalPad * 2
  /** Inner width inside cards (`padding: 16` on each side). */
  const cardContentW = Math.max(0, cardW - 32)
  const [weekGridWidth, setWeekGridWidth] = useState(0)

  /** Original design uses 32px circles; shrink only when the week row is too narrow (avoids overlap). */
  const dayCircleSize = useMemo(() => {
    if (weekGridWidth <= 0) return 32
    const perCol = weekGridWidth / 7
    return Math.min(32, Math.max(20, Math.floor(perCol - 2)))
  }, [weekGridWidth])

  const onWeekGridLayout = useCallback((e: LayoutChangeEvent) => {
    setWeekGridWidth(e.nativeEvent.layout.width)
  }, [])

  const numWeeks = useMemo(() => resolveNumWeeks(period, activities), [period, activities])

  const rawWeekly = useMemo(
    () => weeklySeries(activities, numWeeks, chartMetric),
    [activities, numWeeks, chartMetric]
  )

  const chartSeries = useMemo(() => carryForward(rawWeekly), [rawWeekly])

  const weekLabels = useMemo(() => {
    return Array.from({ length: numWeeks }, (_, i) => `W${i + 1}`)
  }, [numWeeks])

  const headlineScore = useMemo(() => {
    const lastRaw = [...rawWeekly].reverse().find((v) => v != null)
    if (lastRaw != null) return Math.round(lastRaw)
    const first = rawWeekly.find((v) => v != null)
    return first != null ? Math.round(first) : null
  }, [rawWeekly])

  const trendDelta = useMemo(() => {
    const a = rawWeekly[0]
    const b = rawWeekly[rawWeekly.length - 1]
    if (a == null || b == null) return null
    return Math.round(b - a)
  }, [rawWeekly])

  const pillarNow = useMemo(() => {
    const currentMonday = mondayLocal(new Date())
    const periodStart = new Date(currentMonday)
    periodStart.setDate(currentMonday.getDate() - (numWeeks - 1) * 7)
    return pillarAveragesWindow(completedSessions(activities), periodStart, new Date())
  }, [activities, numWeeks])

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

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          {
            paddingHorizontal: horizontalPad,
            // Sits below the global <Header/> in main.tsx, which already pads insets.top.
            // Re-adding insets.top here doubled the gap above the "Progress" title.
            paddingTop: 8,
            // Keep content clear of tab bar without painting an extra bottom block.
            paddingBottom: 32 + insets.bottom + 74,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text allowFontScaling={false} style={styles.pageTitle}>
          {t('progress.title')}
        </Text>

        <View style={[styles.segmentTrack, styles.viewSegmentTrack]}>
          {VIEW_OPTION_KEYS.map((opt) => {
            const active = progressView === opt.key
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.segmentPill, active && styles.segmentPillActive]}
                onPress={() => setProgressView(opt.key)}
                activeOpacity={0.88}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.segmentTxt, active && styles.segmentTxtOn]}
                  numberOfLines={1}
                >
                  {t(opt.labelKey)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {progressView === 'score' ? (
          <>
        <View style={styles.segmentTrack}>
          {PERIOD_OPTION_KEYS.map((opt) => {
            const active = period === opt.key
            return (
              <TouchableOpacity
                key={String(opt.key)}
                style={[styles.segmentPill, active && styles.segmentPillActive]}
                onPress={() => setPeriod(opt.key)}
                activeOpacity={0.88}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.segmentTxt, active && styles.segmentTxtOn]}
                  numberOfLines={1}
                >
                  {t(opt.labelKey)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={[styles.card, styles.cardSized, { width: cardW }]}>
          <View style={styles.cardHeadRow}>
            <Text allowFontScaling={false} style={styles.cardHeadTitle}>
              {t('progress.overallScore')}
            </Text>
            <TouchableOpacity style={styles.dropdownHit} onPress={onPickMetric} activeOpacity={0.8}>
              <Text allowFontScaling={false} style={styles.dropdownTxt}>
                {t(
                  METRIC_OPTION_KEYS.find((m) => m.key === chartMetric)?.labelKey ??
                    'progress.metricOverall'
                )}
              </Text>
              <Text allowFontScaling={false} style={styles.chevron}>
                ▼
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroNumRow}>
            <Text allowFontScaling={false} style={styles.heroNum}>
              {headlineScore != null ? String(headlineScore) : '—'}
            </Text>
          </View>
          {trendDelta != null && trendDelta !== 0 ? (
            <View style={styles.deltaRow}>
              <Text allowFontScaling={false} style={styles.deltaUp}>
                {trendDelta >= 0 ? `↑${trendDelta}` : `↓${Math.abs(trendDelta)}`}
              </Text>
            </View>
          ) : null}

          <ProgressLineChart contentWidth={cardContentW} series={chartSeries} labels={weekLabels} />
        </View>

        <View style={[styles.card, styles.cardSized, { width: cardW }]}>
          <Text allowFontScaling={false} style={styles.categoryBreakdownHeading}>
            {t('progress.categoryBreakdown')}
          </Text>
          {(
            [
              { key: 'technique' as const, labelKey: 'progress.metricTechnique', val: pillarNow.technique },
              { key: 'outcome' as const, labelKey: 'progress.metricOutcome', val: pillarNow.outcome },
              { key: 'tactics' as const, labelKey: 'progress.metricTactics', val: pillarNow.tactics },
            ] as const
          ).map((row) => {
            const v = row.val
            const pct = v != null ? Math.max(0, Math.min(100, Math.round(v))) : 0
            const fillColor = PG.accent
            const scoreColor = '#FFFFFF'
            return (
              <View key={row.key} style={styles.breakRow}>
                <Text allowFontScaling={false} style={styles.breakLabel}>
                  {t(row.labelKey)}
                </Text>
                <View style={styles.breakBarRow}>
                  <ProLibraryGradientProgressBar
                    progress={pct}
                    fillColor={fillColor}
                    trackColor={PG.track}
                    height={10}
                    style={styles.breakGradientBar}
                  />
                  <Text allowFontScaling={false} style={[styles.breakScore, { color: scoreColor }]}>
                    {v != null ? String(Math.round(v)) : '—'}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>

        <View style={[styles.card, styles.cardSized, { width: cardW }]}>
          <Text allowFontScaling={false} style={styles.trainingConsistencyHeading}>
            {t('progress.trainingConsistency')}
          </Text>
          <View style={styles.consistencyMain}>
            <View style={styles.consistencyLeftCol}>
              <View style={styles.consistencyLeftInner}>
                <View>
                  <Text allowFontScaling={false} style={styles.consistencyBig}>
                    {sessionsThisWeek}
                  </Text>
                  <Text allowFontScaling={false} style={styles.consistencySessions}>
                    {t('progress.sessions')}
                  </Text>
                </View>
                <Text allowFontScaling={false} style={styles.consistencySub}>
                  {t('progress.thisWeek')}
                </Text>
              </View>
            </View>
            <View style={styles.consistencyWeekGrid} onLayout={onWeekGridLayout}>
              {TRAINING_DAY_LABELS.map((d, i) => {
                const tickDim =
                  dayCircleSize >= 32 ? 14 : Math.max(10, Math.round(dayCircleSize * 0.45))
                const tickH =
                  dayCircleSize >= 32 ? 13 : Math.max(10, Math.round(tickDim * (13 / 14)))
                return (
                  <View key={`day-${d}-${i}`} style={styles.dayCol}>
                    <Text allowFontScaling={false} style={styles.dayLetter}>
                      {d}
                    </Text>
                    <View
                      style={[
                        styles.dayCircle,
                        {
                          width: dayCircleSize,
                          height: dayCircleSize,
                          borderRadius: dayCircleSize / 2,
                        },
                        weekHits[i] && styles.dayCircleOn,
                      ]}
                    >
                      {weekHits[i] ? (
                        <LocalSvgAsset
                          assetModule={ACTIVITIES_TICK_SVG}
                          width={tickDim}
                          height={tickH}
                        />
                      ) : null}
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        </View>
          </>
        ) : (
          <>
            <AchievementsHeroBlock horizontalPadding={horizontalPad} activities={activities} />
            <AchievementsDailyQuestBanner onPress={() => navigation.navigate('DailyQuest')} />
            <AchievementsBadgesSection
              onViewAllPress={() => navigation.navigate('AllAchievements')}
              onRankingPress={() => navigation.navigate('Ranking')}
            />
          </>
        )}
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
      fontFamily: theme.boldFont ?? theme.semiBoldFont,
      fontSize: 28,
      color: '#FFFFFF',
      marginBottom: 16,
    },
    segmentTrack: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      backgroundColor: PG.card,
      borderRadius: 28,
      padding: 4,
      marginBottom: 18,
      overflow: 'hidden',
    },
    viewSegmentTrack: {
      marginBottom: 12,
    },
    segmentPill: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentPillActive: {
      backgroundColor: PG.segmentActive,
    },
    segmentTxt: {
      fontFamily: theme.mediumFont,
      fontSize: 12,
      color: '#336AB3',
      textAlign: 'center',
    },
    segmentTxtOn: {
      color: '#FFFFFF',
    },
    card: {
      alignSelf: 'center',
      backgroundColor: PG.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
    },
    cardSized: {
      maxWidth: '100%',
      overflow: 'hidden',
    },
    cardHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    cardHeadTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 18,
      color: PG.labelBlue,
    },
    categoryBreakdownHeading: {
      fontFamily: theme.boldFont ?? theme.semiBoldFont,
      fontSize: 20,
      color: PG.accent,
      marginBottom: 4,
    },
    trainingConsistencyHeading: {
      fontFamily: theme.boldFont ?? theme.semiBoldFont,
      fontSize: 22,
      color: PG.accent,
      marginBottom: 18,
    },
    dropdownHit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: PG.segmentActive,
      transform: [{ translateY: 3 }, { scale: 1.08 }],
    },
    dropdownTxt: {
      fontFamily: theme.mediumFont,
      fontSize: 13,
      color: '#FFFFFF',
    },
    chevron: {
      fontSize: 10,
      color: '#FFFFFF',
      marginTop: 1,
    },
    heroNumRow: {
      marginBottom: 4,
    },
    heroNum: {
      fontFamily: theme.boldFont ?? theme.semiBoldFont,
      fontSize: 52,
      color: PG.accent,
      letterSpacing: -1,
    },
    deltaRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginBottom: 12,
    },
    deltaUp: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: PG.accent,
    },
    breakRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 14,
      gap: 8,
    },
    breakLabel: {
      width: 72,
      fontFamily: theme.mediumFont,
      fontSize: 14,
      color: PG.text,
    },
    breakBarRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    },
    breakGradientBar: {
      flex: 1,
      minWidth: 0,
    },
    breakScore: {
      fontFamily: theme.semiBoldFont,
      fontSize: 18,
      color: '#FFFFFF',
      flexShrink: 0,
    },
    consistencyMain: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 14,
      marginTop: 8,
    },
    consistencyLeftCol: {
      flexShrink: 0,
      alignSelf: 'stretch',
    },
    consistencyLeftInner: {
      flex: 1,
      justifyContent: 'space-between',
    },
    /** One column per weekday: letter stacked above circle so labels stay aligned. */
    consistencyWeekGrid: {
      flex: 1,
      flexDirection: 'row',
      minWidth: 0,
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingLeft: 2,
      marginTop: 32,
    },
    dayCol: {
      flex: 1,
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    },
    consistencyBig: {
      fontFamily: theme.boldFont ?? theme.semiBoldFont,
      fontSize: 40,
      color: PG.accent,
      flexShrink: 0,
    },
    consistencySessions: {
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      color: '#FFFFFF',
    },
    consistencySub: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: '#86A7D2',
    },
    dayLetter: {
      fontSize: 12,
      color: PG.muted,
    },
    dayCircle: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: PG.dayCircleEmpty,
      overflow: 'hidden',
    },
    dayCircleOn: {
      backgroundColor: PG.accent,
    },
  })
}
