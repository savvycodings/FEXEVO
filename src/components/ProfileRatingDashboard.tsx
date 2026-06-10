import React, { useContext, useMemo } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native'
import Svg, { Circle, G } from 'react-native-svg'
import { ThemeContext } from '../context'
import { useSessionData } from '../context/SessionDataContext'
import { TRAIN_CATEGORIES, type TrainCategory } from '../lib/train-taxonomy'
import { pillarTwoLineLabels } from '../i18n/taxonomyLabels'
import { useTranslation } from 'react-i18next'

/** Outer ring = this week (matches MyCoachScoreRing actual / light). */
const RING_THIS_WEEK = '#40C0FF'
/** Inner ring = last week (matches MyCoachScoreRing last / dark). */
const RING_LAST_WEEK = '#2B7CFF'
const RING_TRACK_OUTER = 'rgba(64, 192, 255, 0.28)'
const RING_TRACK_INNER = 'rgba(43, 124, 255, 0.22)'

/** You → Rating: pillar code at full strength; two-line subheading uses this at 50% via wrapper. */
const RATING_METRIC_LABEL = '#86A7D2'

export type RatingMetricRow = {
  abbr: string
  labelTop: string
  labelBottom: string
  /** 0–100 inclusive */
  thisWeek: number
  /** 0–100 inclusive */
  lastWeek: number
}

/** Five main train pillars (same as reference Rating row; excludes tactical specials). */
const RING_CATEGORY_ORDER: TrainCategory[] = [
  'save_return',
  'ground_strokes',
  'net_play',
  'defence_glass',
  'overhead',
]

const ABBR_BY_ID = Object.fromEntries(TRAIN_CATEGORIES.map((c) => [c.id, c.progressCode])) as Record<
  string,
  string
>

type ApiCategoryRow = {
  id: string
  thisWeek: number
  lastWeek: number
}

export function mapApiToMetrics(categories: ApiCategoryRow[]): RatingMetricRow[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  return RING_CATEGORY_ORDER.map((id) => {
    const row = byId.get(id)
    const labels = pillarTwoLineLabels(id)
    return {
      abbr: ABBR_BY_ID[id] ?? id,
      labelTop: labels.labelTop,
      labelBottom: labels.labelBottom,
      thisWeek: typeof row?.thisWeek === 'number' ? row.thisWeek : 0,
      lastWeek: typeof row?.lastWeek === 'number' ? row.lastWeek : 0,
    }
  })
}

/** Demo row set — kept for fixtures; live profile loads from `/profile/rating-by-category`. */
export const PROFILE_RATING_DEMO: RatingMetricRow[] = mapApiToMetrics([
  { id: 'save_return', thisWeek: 84, lastWeek: 71 },
  { id: 'ground_strokes', thisWeek: 48, lastWeek: 69 },
  { id: 'net_play', thisWeek: 96, lastWeek: 87 },
  { id: 'defence_glass', thisWeek: 24, lastWeek: 16 },
  { id: 'overhead', thisWeek: 68, lastWeek: 73 },
])

function clamp100(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, v))
}

function formatScore(v: number): string {
  const c = clamp100(v)
  return Number.isInteger(c) ? String(c) : c.toFixed(1)
}

/** Upper cap when there is plenty of width; actual size is computed from screen so five columns fit. */
const GAUGE_SIZE_MAX = 84

function DualRingGauge({
  thisWeek,
  lastWeek,
  theme,
  size,
}: {
  thisWeek: number
  lastWeek: number
  theme: { semiBoldFont: string; mediumFont: string }
  size: number
}) {
  const cx = size / 2
  const cy = size / 2
  const rOuter = size * 0.34
  const rInner = size * 0.282
  const strokeOuter = Math.max(2.6, size * 0.048)
  const strokeInner = Math.max(2.2, size * 0.038)
  const scoreMainSize = size >= 72 ? 12 : size >= 62 ? 11 : 10
  const scoreLastSize = size >= 72 ? 10 : 9

  const cOuter = 2 * Math.PI * rOuter
  const cInner = 2 * Math.PI * rInner
  const pOut = clamp100(thisWeek) / 100
  const pIn = clamp100(lastWeek) / 100

  const dashOuter = `${pOut * cOuter} ${cOuter}`
  const dashInner = `${pIn * cInner} ${cInner}`

  return (
    <View style={[localStyles.gaugeWrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill}>
        <G transform={`rotate(-90 ${cx} ${cy})`}>
          <Circle
            cx={cx}
            cy={cy}
            r={rOuter}
            stroke={RING_TRACK_OUTER}
            strokeWidth={strokeOuter}
            fill="none"
          />
          <Circle
            cx={cx}
            cy={cy}
            r={rInner}
            stroke={RING_TRACK_INNER}
            strokeWidth={strokeInner}
            fill="none"
          />
          <Circle
            cx={cx}
            cy={cy}
            r={rInner}
            stroke={RING_LAST_WEEK}
            strokeWidth={strokeInner}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={dashInner}
          />
          <Circle
            cx={cx}
            cy={cy}
            r={rOuter}
            stroke={RING_THIS_WEEK}
            strokeWidth={strokeOuter}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={dashOuter}
          />
        </G>
      </Svg>
      <View style={localStyles.gaugeLabels} pointerEvents="none">
        <Text
          allowFontScaling={false}
          style={[
            localStyles.scoreThis,
            { fontFamily: theme.semiBoldFont, fontSize: scoreMainSize, lineHeight: scoreMainSize + 2 },
          ]}
        >
          {formatScore(thisWeek)}
        </Text>
        <Text
          allowFontScaling={false}
          style={[
            localStyles.scoreLast,
            { fontFamily: theme.mediumFont, fontSize: scoreLastSize, lineHeight: scoreLastSize + 2 },
          ]}
        >
          {formatScore(lastWeek)}
        </Text>
      </View>
    </View>
  )
}

const localStyles = StyleSheet.create({
  gaugeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeLabels: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  scoreThis: {
    color: '#2D86FF',
  },
  scoreLast: {
    color: '#5260A4',
    marginTop: 0,
  },
})

type Props = {
  /** When set, skips API and shows these rows (tests / story). */
  metrics?: RatingMetricRow[]
}

const EMPTY_METRICS = mapApiToMetrics(
  RING_CATEGORY_ORDER.map((id) => ({ id, thisWeek: 0, lastWeek: 0 }))
)

export function ProfileRatingDashboard({ metrics: controlledMetrics }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { width: winW } = useWindowDimensions()
  const session = useSessionData()

  /** Five rings in one row: tight gaps, size derived from width so nothing scrolls off-screen. */
  const gaugeSize = useMemo(() => {
    const CARD_HORIZONTAL = 8
    const LR_INSET = 28
    const COLUMN_GAP = 2
    const gaps = 4 * COLUMN_GAP
    const usable = Math.max(260, winW - LR_INSET - CARD_HORIZONTAL)
    const slot = (usable - gaps) / 5
    return Math.max(50, Math.min(GAUGE_SIZE_MAX, Math.floor(slot - 1)))
  }, [winW])

  const metrics = useMemo(() => {
    if (controlledMetrics) return controlledMetrics
    if (session.ratingCategories != null) {
      return mapApiToMetrics(session.ratingCategories)
    }
    return EMPTY_METRICS
  }, [controlledMetrics, session.ratingCategories])

  const loading = controlledMetrics ? false : session.ratingLoading
  const error = controlledMetrics ? null : session.ratingError

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          paddingTop: 14,
          paddingBottom: 12,
          paddingHorizontal: 4,
          marginBottom: 12,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          paddingHorizontal: 2,
        },
        title: {
          fontFamily: theme.semiBoldFont,
          fontSize: 20,
          color: '#FFFFFF',
        },
        legend: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        legendItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
        },
        legendDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
        },
        legendText: {
          fontFamily: theme.regularFont,
          fontSize: 10,
          color: RATING_METRIC_LABEL,
        },
        rowMetrics: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          width: '100%',
          paddingBottom: 2,
          gap: 2,
        },
        col: {
          flex: 1,
          minWidth: 0,
          alignItems: 'center',
        },
        abbr: {
          fontFamily: theme.semiBoldFont,
          fontSize: 15,
          color: RATING_METRIC_LABEL,
          marginTop: 6,
        },
        /** Both label lines at #86A7D2; opacity halves the whole subheading together. */
        metricSubheading: {
          alignSelf: 'stretch',
          alignItems: 'center',
          marginTop: 2,
          opacity: 0.5,
        },
        labelTop: {
          fontFamily: theme.regularFont,
          fontSize: 11,
          color: RATING_METRIC_LABEL,
          textAlign: 'center',
          lineHeight: 14,
        },
        labelBottom: {
          fontFamily: theme.regularFont,
          fontSize: 11,
          color: RATING_METRIC_LABEL,
          textAlign: 'center',
          lineHeight: 14,
        },
        loader: {
          minHeight: GAUGE_SIZE_MAX + 48,
          alignItems: 'center',
          justifyContent: 'center',
        },
        errorText: {
          fontFamily: theme.regularFont,
          fontSize: 11,
          color: 'rgba(255,180,180,0.9)',
          textAlign: 'center',
          marginBottom: 8,
          paddingHorizontal: 8,
        },
      }),
    [theme]
  )

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text allowFontScaling={false} style={styles.title}>
          {t('profileRating.title')}
        </Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: RING_THIS_WEEK }]} />
            <Text allowFontScaling={false} style={styles.legendText}>
              {t('profileRating.thisWeek')}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: RING_LAST_WEEK }]} />
            <Text allowFontScaling={false} style={styles.legendText}>
              {t('profileRating.lastWeek')}
            </Text>
          </View>
        </View>
      </View>
      {error ? (
        <Text allowFontScaling={false} style={styles.errorText}>
          {error}
        </Text>
      ) : null}
      {loading && !controlledMetrics ? (
        <View style={styles.loader}>
          <ActivityIndicator color={RING_THIS_WEEK} />
        </View>
      ) : (
        <View style={styles.rowMetrics}>
          {metrics.map((m) => (
            <View key={m.abbr} style={styles.col}>
              <DualRingGauge
                size={gaugeSize}
                thisWeek={m.thisWeek}
                lastWeek={m.lastWeek}
                theme={theme}
              />
              <Text allowFontScaling={false} style={styles.abbr}>
                {m.abbr}
              </Text>
              <View style={styles.metricSubheading}>
                <Text allowFontScaling={false} style={styles.labelTop}>
                  {m.labelTop}
                </Text>
                <Text allowFontScaling={false} style={styles.labelBottom}>
                  {m.labelBottom}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
