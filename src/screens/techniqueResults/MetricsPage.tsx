import { useContext, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import Svg, { Circle, Defs, G, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg'
import { ThemeContext } from '../../context'
import {
  PHYSICAL_METRIC_KEYS,
  type PhysicalMetricKey,
  type PhysicalMetricsValues,
} from '../../lib/physicalMetrics'
import type { PoseFrameRow } from '../../lib/techniquePose'
import { MovementTimelineChart } from './MovementTimelineChart'
import { impactSampleIndex, sampleMovementTimeline, seriesHasPoints } from './movementTimeline'

type Props = {
  visible: boolean
  score: number | null
  rating: string | null
  summary: string | null
  shotLabel: string | null
  metrics: PhysicalMetricsValues | null
  poseFrames: PoseFrameRow[]
  impactFrame: number | null
}

const RING = 112
const RING_STROKE = 10
const RING_R = (RING - RING_STROKE) / 2
const RING_C = 2 * Math.PI * RING_R

const METRIC_ICON: Record<
  PhysicalMetricKey,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  stability: { icon: 'cube-outline', color: '#3D7CFF' },
  power: { icon: 'flash', color: '#FFD400' },
  agility: { icon: 'flame', color: '#FF8A00' },
  reactions: { icon: 'aperture', color: '#7B61FF' },
  acceleration: { icon: 'walk', color: '#FF4D6A' },
}

const LEGEND: { id: 'shoulder' | 'elbow' | 'racket' | 'hip'; color: string; key: string }[] = [
  { id: 'shoulder', color: '#2F80FF', key: 'technique.metrics.shoulder' },
  { id: 'elbow', color: '#FF3B30', key: 'technique.metrics.elbow' },
  { id: 'racket', color: '#FF9F0A', key: 'technique.metrics.racketFace' },
  { id: 'hip', color: '#C44DFF', key: 'technique.metrics.hip' },
]

function ratingTone(rating: string | null, score: number | null): 'excellent' | 'good' | 'needs_improvement' | 'poor' | null {
  if (rating === 'excellent' || rating === 'good' || rating === 'needs_improvement' || rating === 'poor') {
    return rating
  }
  if (score == null) return null
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 30) return 'needs_improvement'
  return 'poor'
}

export function MetricsPage({
  visible,
  score,
  rating,
  summary,
  shotLabel,
  metrics,
  poseFrames,
  impactFrame,
}: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const tone = ratingTone(rating, score)
  const toneColor = tone === 'needs_improvement' ? '#FFB020' : tone === 'poor' ? '#FF5A6A' : '#3DDC97'
  const toneLabel =
    tone === 'excellent'
      ? t('technique.metrics.excellent')
      : tone === 'needs_improvement'
        ? t('technique.metrics.needsWork')
        : tone === 'poor'
          ? t('technique.metrics.keepWorking')
          : tone === 'good'
            ? t('technique.metrics.good')
            : null
  const series = useMemo(() => sampleMovementTimeline(poseFrames), [poseFrames])
  const impactIndex = useMemo(
    () => impactSampleIndex(poseFrames, impactFrame),
    [poseFrames, impactFrame]
  )
  const showChart = LEGEND.some((item) => seriesHasPoints(series[item.id]))
  const progress = score == null ? 0 : Math.max(0, Math.min(1, score / 100))

  return (
    <View style={visible ? styles.page : styles.hidden}>
      <View style={styles.shotRow}>
        <View style={styles.shotIcon}>
          <Ionicons name="body" size={16} color="#7EB6FF" />
        </View>
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.shotText, { fontFamily: theme.semiBoldFont }]}>
          {shotLabel || t('technique.metrics.shotFallback')}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text allowFontScaling={false} style={[styles.cardTitle, { fontFamily: theme.semiBoldFont }]}>
            {t('technique.metrics.overall')}
          </Text>
          <View style={styles.chartBadge}>
            <Ionicons name="stats-chart" size={16} color="#7EB6FF" />
          </View>
        </View>
        <View style={styles.overallRow}>
          <View style={styles.ringWrap}>
            <Svg width={RING} height={RING}>
              <Defs>
                <SvgLinearGradient id="metricsScore" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#00E0FF" />
                  <Stop offset="100%" stopColor="#2454FF" />
                </SvgLinearGradient>
              </Defs>
              <G transform={`rotate(-90 ${RING / 2} ${RING / 2})`}>
                <Circle
                  cx={RING / 2}
                  cy={RING / 2}
                  r={RING_R}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={RING_STROKE}
                  fill="transparent"
                />
                <Circle
                  cx={RING / 2}
                  cy={RING / 2}
                  r={RING_R}
                  stroke="url(#metricsScore)"
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${RING_C} ${RING_C}`}
                  strokeDashoffset={RING_C * (1 - progress)}
                  fill="transparent"
                />
              </G>
            </Svg>
            <View style={styles.ringCenter} pointerEvents="none">
              <Text allowFontScaling={false} style={[styles.scoreNum, { fontFamily: theme.semiBoldFont }]}>
                {score ?? '—'}
              </Text>
              <Text allowFontScaling={false} style={[styles.scoreDenom, { fontFamily: theme.mediumFont }]}>
                /100
              </Text>
            </View>
          </View>
          <View style={styles.overallCopy}>
            {toneLabel ? (
              <Text allowFontScaling={false} style={[styles.tone, { color: toneColor, fontFamily: theme.semiBoldFont }]}>
                {toneLabel}
              </Text>
            ) : null}
            {summary ? (
              <Text allowFontScaling={false} style={[styles.summary, { fontFamily: theme.regularFont }]}>
                {summary}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text allowFontScaling={false} style={[styles.cardTitle, { fontFamily: theme.semiBoldFont }]}>
            {t('technique.metrics.keyMetrics')}
          </Text>
          <View style={styles.compare}>
            <Text allowFontScaling={false} style={[styles.compareLabel, { fontFamily: theme.mediumFont }]}>
              {t('technique.metrics.compare')}
            </Text>
            <View style={[styles.dot, { backgroundColor: '#2F80FF' }]} />
            <Text allowFontScaling={false} style={[styles.compareLabel, { fontFamily: theme.mediumFont }]}>
              {t('technique.metrics.you')}
            </Text>
            <View style={[styles.dot, { backgroundColor: '#FF9F0A' }]} />
            <Text allowFontScaling={false} style={[styles.compareLabel, { fontFamily: theme.mediumFont }]}>
              {t('technique.metrics.reference')}
            </Text>
          </View>
        </View>
        <View style={styles.metricRow}>
          {PHYSICAL_METRIC_KEYS.map((key) => {
            const spec = METRIC_ICON[key]
            const value = metrics?.[key]
            return (
              <View key={key} style={styles.metric}>
                <Ionicons name={spec.icon} size={22} color={spec.color} />
                <Text allowFontScaling={false} style={[styles.metricValue, { fontFamily: theme.semiBoldFont }]}>
                  {value ?? '—'}
                </Text>
                <Text
                  allowFontScaling={false}
                  numberOfLines={2}
                  style={[styles.metricLabel, { fontFamily: theme.regularFont }]}
                >
                  {t(`technique.physicalMetric${key[0]!.toUpperCase()}${key.slice(1)}`)}
                </Text>
              </View>
            )
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text allowFontScaling={false} style={[styles.cardTitle, { fontFamily: theme.semiBoldFont }]}>
          {t('technique.metrics.timeline')}
        </Text>
        <View style={styles.legend}>
          {LEGEND.map((item) => (
            <View key={item.id} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <Text allowFontScaling={false} style={[styles.legendText, { fontFamily: theme.mediumFont }]}>
                {t(item.key)}
              </Text>
            </View>
          ))}
        </View>
        {showChart ? (
          <MovementTimelineChart
            series={series}
            impactIndex={impactIndex}
            phases={[
              t('technique.metrics.preparation'),
              t('technique.metrics.swing'),
              t('technique.metrics.impact'),
              t('technique.metrics.followThrough'),
            ]}
            font={theme.mediumFont}
          />
        ) : (
          <Text allowFontScaling={false} style={[styles.emptyChart, { fontFamily: theme.regularFont }]}>
            {t('technique.metrics.timelineEmpty')}
          </Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { alignSelf: 'stretch', gap: 12 },
  hidden: { display: 'none' },
  shotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 255, 0.35)',
    backgroundColor: '#071428',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  shotIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 120, 255, 0.25)',
  },
  shotText: { color: '#FFFFFF', fontSize: 16, flexShrink: 1 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 255, 0.28)',
    backgroundColor: '#071428',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { color: '#FFFFFF', fontSize: 16, flexShrink: 1 },
  chartBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 120, 255, 0.22)',
  },
  overallRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ringWrap: { width: RING, height: RING },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { color: '#FFFFFF', fontSize: 32, lineHeight: 36 },
  scoreDenom: { color: '#86A7D2', fontSize: 12, marginTop: -2 },
  overallCopy: { flex: 1, minWidth: 0, gap: 4 },
  tone: { fontSize: 16 },
  summary: { color: '#86A7D2', fontSize: 13, lineHeight: 18 },
  compare: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  compareLabel: { color: '#86A7D2', fontSize: 10 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  metricRow: { flexDirection: 'row', alignItems: 'flex-start' },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  metricValue: { color: '#FFFFFF', fontSize: 18 },
  metricLabel: { color: '#FFFFFF', fontSize: 10, lineHeight: 12, textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { color: '#C5D4F5', fontSize: 11 },
  emptyChart: { color: '#86A7D2', fontSize: 13, lineHeight: 18 },
})
