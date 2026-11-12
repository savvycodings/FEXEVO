import { useContext, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg'
import { ThemeContext } from '../../context'
import { LocalSvgAsset } from '../../components/LocalSvgAsset'
import { GlowButton } from '../../components/ui'
import { useContactJoints } from '../../lib/jointsApi'
import {
  type CompareMetric,
  buildCompareMetrics,
  mergeCompareMetrics,
  useShotHistory,
} from './shotHistory'
import { JOINT_ICON, type BodyPartId } from './jointIcons'
import { PlayableClip } from './PlayableClip'

type Segment = 'before' | 'after'

type Props = {
  videoUri: string | null
  idealVideoUri: string | null
  analysisId: string | null
  metrics: CompareMetric[]
  score: number | null
  onClose: () => void
  /** Compare Another Session — usually opens the Progress tab. */
  onCompareAnother: () => void
}

const ICON_JOINT = require('../../../assets/aicoach/analysis/track-progress/joint-compare.svg')
const ICON_OVER_TIME = require('../../../assets/aicoach/analysis/track-progress/over-time-icon.svg')
const SCORE_RING_TRACK = require('../../../assets/aicoach/analysis/track-progress/score-ring-track.svg')
const SCORE_RING_GLOW = require('../../../assets/aicoach/analysis/track-progress/score-ring-glow.png')

const MINT = '#00FFA6'
const CYAN = '#1AE1F4'
const RING = 83
/** Figma glow PNG sits ~13.7% outside the 83px dial. */
const RING_GLOW = Math.round(RING * 1.274)
const CHART_PLOT_H = 49
const CHART_PAD_TOP = 8
const CHART_TOTAL_H = 85

const fmtDeg = (n: number) => `${Math.round(n)}°`
const fmtDelta = (n: number) => {
  const r = Math.round(n)
  return `${r > 0 ? '+' : ''}${r}°`
}

function jointIcon(key: string): BodyPartId {
  if (key === 'shoulder' || key === 'elbow' || key === 'wrist' || key === 'torso' || key === 'knee') {
    return key
  }
  return 'elbow'
}

function shortLabel(key: string, label: string, t: (k: string) => string): string {
  if (key === 'torso') return t('analysis.torsoRotShort')
  if (key === 'shoulder') return t('analysis.jointName.shoulder')
  if (key === 'elbow') return t('analysis.jointName.elbow')
  if (key === 'knee') return t('analysis.jointName.knee')
  if (key === 'wrist') return t('analysis.jointName.wrist')
  return label
}

/** Glowing chart node — cyan mid-series, mint on the latest point (Figma 6283:52114 / 52118). */
function ChartDot({ x, y, fill }: { x: number; y: number; fill: string }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={10} fill={fill} fillOpacity={0.3} />
      <Circle cx={x} cy={y} r={4.5} fill={fill} stroke="#FFFFFF" strokeWidth={1.25} />
    </G>
  )
}

/**
 * Track Progress (Figma 6274:30407).
 * Opened from Overview Progress CTA — Before / After / Progress over this shot type.
 */
export function TrackProgressView({
  videoUri,
  idealVideoUri,
  analysisId,
  metrics,
  score,
  onClose,
  onCompareAnother,
}: Props) {
  const { t, i18n } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const contact = useContactJoints(analysisId)
  const history = useShotHistory(analysisId)
  const [segment, setSegment] = useState<Segment>('after')
  const [chartW, setChartW] = useState(0)

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [onClose])

  const previous = history.previous
  const prevMetrics = useMemo(() => buildCompareMetrics(previous?.metrics, t), [previous?.metrics, t])
  const afterMetrics = useMemo(
    () =>
      mergeCompareMetrics(
        metrics,
        contact
          ? {
              shoulder: contact.joints.shoulder.you,
              elbow: contact.joints.elbow.you,
              wrist: contact.joints.wrist.you,
              torso: contact.joints.torso.you,
              knee: contact.joints.knee.you,
            }
          : null,
        t
      ),
    [metrics, contact, t]
  )

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })
  }

  const rows = useMemo(() => {
    const keys = [...new Set([...prevMetrics, ...afterMetrics].map((m) => m.key))]
    return keys.map((key) => {
      const before = prevMetrics.find((m) => m.key === key)
      const after = afterMetrics.find((m) => m.key === key)
      const prev = before?.deg ?? null
      const curr = after?.deg ?? null
      const change = prev != null && curr != null ? curr - prev : null
      return {
        key,
        label: shortLabel(key, (after ?? before)!.label, t),
        prev,
        curr,
        change,
      }
    })
  }, [prevMetrics, afterMetrics, t])

  const isBefore = segment === 'before'
  const shownVideo = isBefore ? previous?.videoUri ?? null : videoUri
  const currentPoint = history.points.find((p) => p.analysisId === analysisId)
  const shotDate = currentPoint
    ? fmtDate(currentPoint.createdAt)
    : previous && isBefore
      ? fmtDate(previous.createdAt)
      : ''
  const yourShotLabel = shotDate
    ? `${t('analysis.yourShot')} • ${shotDate}`
    : t('analysis.yourShot')

  const scoreDelta =
    score != null && previous?.score != null ? score - previous.score : null

  const improvedBits = rows
    .filter((r) => r.change != null && Math.abs(r.change) >= 3)
    .slice(0, 3)
    .map((r) => r.label.toLowerCase())
  const scoreBlurb =
    improvedBits.length > 0
      ? t('analysis.trackProgressBlurb', { parts: improvedBits.join(', ') })
      : t('analysis.trackProgressBlurbFallback')

  const chartPoints = useMemo(() => {
    const pts = history.points
      .map((p) => (p.analysisId === analysisId && score != null ? { ...p, score } : p))
      .filter((p) => p.score != null)
      .slice(-8)
    return pts as { analysisId: string; createdAt: string; score: number }[]
  }, [history.points, analysisId, score])

  const chartYTicks = useMemo(() => {
    if (chartPoints.length < 1) return [85, 75, 64]
    const scores = chartPoints.map((p) => p.score)
    const min = Math.min(...scores, 64)
    const max = Math.max(...scores, 85)
    return [Math.round(max), Math.round((max + min) / 2), Math.round(min)]
  }, [chartPoints])

  const chartPath = useMemo(() => {
    if (chartW <= 0 || chartPoints.length < 1) return null
    // Leave room for glowing nodes (r≈10) so they aren't clipped.
    const padX = 12
    const padTop = CHART_PAD_TOP
    const h = CHART_PLOT_H
    const plotW = Math.max(1, chartW - padX * 2)
    const scores = chartPoints.map((p) => p.score)
    const min = Math.min(...scores, 64)
    const max = Math.max(...scores, 85)
    const span = Math.max(1, max - min)
    const coords = chartPoints.map((p, i) => {
      const x =
        chartPoints.length === 1
          ? padX + plotW / 2
          : padX + (i / (chartPoints.length - 1)) * plotW
      const y = padTop + (1 - (p.score - min) / span) * h
      return { x, y, score: p.score, date: p.createdAt, id: p.analysisId }
    })
    const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ')
    const area = `${line} L${coords[coords.length - 1]!.x},${padTop + h} L${coords[0]!.x},${padTop + h} Z`
    const vLines: number[] = []
    for (let x = padX; x <= padX + plotW + 0.5; x += 14) vLines.push(x)
    const hLines = [0, 0.25, 0.5, 0.75, 1].map((f) => padTop + f * h)
    return { coords, line, area, padTop, h, padX, plotW, vLines, hLines }
  }, [chartW, chartPoints])

  const segments: { id: Segment; label: string }[] = [
    { id: 'before', label: t('analysis.before') },
    { id: 'after', label: t('analysis.after') },
  ]

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundColor }]} testID="track-progress">
      <View style={styles.nav}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('analysis.back')}
          style={styles.navSide}
        >
          <Ionicons name="chevron-back" size={24} color="#86A7D2" />
        </Pressable>
        <View style={styles.navCenter}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.navTitle, { fontFamily: theme.mediumFont }]}>
            {t('analysis.trackProgress')}
          </Text>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.navSub, { fontFamily: theme.mediumFont }]}>
            {history.shotLabel
              ? `${t('analysis.compareOverTime')} • ${history.shotLabel}`
              : t('analysis.compareOverTime')}
          </Text>
        </View>
        <View style={styles.navSide} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.segTrack}>
          {segments.map((s) => {
            const on = s.id === segment
            return (
              <Pressable
                key={s.id}
                testID={`track-progress-tab-${s.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setSegment(s.id)}
                style={styles.segBtn}
              >
                {on ? (
                  <LinearGradient
                    colors={['#A9D8FF', '#4DA6FF']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.segFill}
                  >
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={[styles.segTextOn, { fontFamily: theme.semiBoldFont }]}
                    >
                      {s.label}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.segFill}>
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={[styles.segText, { fontFamily: theme.mediumFont }]}
                    >
                      {s.label}
                    </Text>
                  </View>
                )}
              </Pressable>
            )
          })}
        </View>

        {history.loading && segment === 'before' ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#3D9DFF" />
          </View>
        ) : null}

        <View style={styles.videoRow}>
          <View style={styles.videoCard}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.videoLabel, { fontFamily: theme.mediumFont }]}
            >
              {isBefore && previous ? `${t('analysis.yourShot')} • ${fmtDate(previous.createdAt)}` : yourShotLabel}
            </Text>
            {isBefore && !previous ? (
              <View style={[styles.clipFrame, styles.emptyClip]}>
                <Text allowFontScaling={false} style={[styles.emptyText, { fontFamily: theme.mediumFont }]}>
                  {history.shotLabel
                    ? t('analysis.beforeEmpty', { shot: history.shotLabel })
                    : t('analysis.beforeEmptyAny')}
                </Text>
              </View>
            ) : (
              <View style={styles.clipFrame}>
                <PlayableClip
                  uri={shownVideo}
                  testID="track-progress-you"
                  accent="#07256D"
                />
              </View>
            )}
          </View>
          <View style={[styles.videoCard, styles.idealCard]}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.videoLabel, { fontFamily: theme.mediumFont }]}
            >
              {t('analysis.idealForm')}
            </Text>
            <View style={styles.clipFrame}>
              <PlayableClip
                uri={idealVideoUri}
                testID="track-progress-ideal"
                accent="rgba(0,72,255,0.5)"
              />
            </View>
          </View>
        </View>

        <View style={styles.jointCard}>
          <View style={styles.sectionHead}>
            <LocalSvgAsset assetModule={ICON_JOINT} width={32} height={32} />
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.sectionTitle, { fontFamily: theme.mediumFont }]}
            >
              {t('analysis.jointComparison')}
            </Text>
          </View>

          <View style={styles.tableHead}>
            <View style={styles.colJoint} />
            <Text
              allowFontScaling={false}
              style={[styles.colHead, styles.colPrev, { fontFamily: theme.mediumFont }]}
            >
              {t('analysis.previous')}
            </Text>
            <View style={styles.colArrow} />
            <Text
              allowFontScaling={false}
              style={[styles.colHead, styles.colCurr, { fontFamily: theme.mediumFont }]}
            >
              {t('analysis.current')}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.colHead, styles.colChange, { fontFamily: theme.mediumFont }]}
            >
              {t('analysis.change')}
            </Text>
          </View>

          {rows.length === 0 ? (
            <Text allowFontScaling={false} style={[styles.emptyText, { fontFamily: theme.regularFont }]}>
              {t('analysis.compareEmpty')}
            </Text>
          ) : (
            rows.map((row) => {
              const up = row.change != null && row.change >= 0
              return (
                <View key={row.key} style={styles.tableRow} testID={`track-progress-row-${row.key}`}>
                  <View style={[styles.colJoint, styles.jointName]}>
                    <MaterialCommunityIcons name={JOINT_ICON[jointIcon(row.key)]} size={16} color="#FFFFFF" />
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={[styles.jointLabel, { fontFamily: theme.mediumFont }]}
                    >
                      {row.label}
                    </Text>
                  </View>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[styles.cell, styles.colPrev, { fontFamily: theme.mediumFont }]}
                  >
                    {row.prev != null ? fmtDeg(row.prev) : '—'}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={[styles.cell, styles.colArrow, { fontFamily: theme.mediumFont }]}
                  >
                    →
                  </Text>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[styles.cell, styles.colCurr, { fontFamily: theme.mediumFont }]}
                  >
                    {row.curr != null ? fmtDeg(row.curr) : '—'}
                  </Text>
                  <View style={styles.colChange}>
                    {row.change != null ? (
                      <View style={[styles.changePill, up ? styles.changePillUp : styles.changePillDown]}>
                        <Text
                          allowFontScaling={false}
                          numberOfLines={1}
                          style={[styles.changeText, { fontFamily: theme.mediumFont }]}
                        >
                          {fmtDelta(row.change)}
                        </Text>
                      </View>
                    ) : (
                      <Text allowFontScaling={false} style={[styles.cell, { fontFamily: theme.mediumFont }]}>
                        —
                      </Text>
                    )}
                  </View>
                </View>
              )
            })
          )}
        </View>

        <View style={styles.scoreCard}>
          <View style={styles.ringWrap}>
            <LocalSvgAsset assetModule={SCORE_RING_TRACK} width={RING} height={RING} />
            <Image
              source={SCORE_RING_GLOW}
              style={styles.ringGlow}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.ringValue, { fontFamily: theme.mediumFont }]}
            >
              {scoreDelta != null
                ? `${scoreDelta >= 0 ? '+' : ''}${Math.round(scoreDelta)}%`
                : score != null
                  ? `${Math.round(score)}`
                  : '—'}
            </Text>
          </View>
          <View style={styles.scoreCopy}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.scoreTitle, { fontFamily: theme.mediumFont }]}
            >
              {t('analysis.overallScore')}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={3}
              style={[styles.scoreBody, { fontFamily: theme.regularFont }]}
            >
              {scoreBlurb}
            </Text>
          </View>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionIcon}>
              <LocalSvgAsset assetModule={ICON_OVER_TIME} width={32} height={32} />
            </View>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.sectionTitle, { fontFamily: theme.mediumFont }]}
            >
              {t('analysis.progressOverTime')}
            </Text>
          </View>

          {chartPoints.length < 2 ? (
            <Text allowFontScaling={false} style={[styles.emptyText, { fontFamily: theme.regularFont }]}>
              {history.shotLabel
                ? t('analysis.progressEmpty', { shot: history.shotLabel })
                : t('analysis.progressEmptyAny')}
            </Text>
          ) : (
            <View style={styles.chartBody}>
              <View style={styles.yAxis}>
                {chartYTicks.map((v, i) => (
                  <Text
                    key={`${v}-${i}`}
                    allowFontScaling={false}
                    style={[styles.yTick, { fontFamily: theme.mediumFont }]}
                  >
                    {v}
                  </Text>
                ))}
              </View>
              <View
                style={styles.chartPlot}
                onLayout={(e) => setChartW(e.nativeEvent.layout.width)}
              >
                {chartPath ? (
                  <>
                    <Svg width={Math.max(1, chartW)} height={chartPath.padTop + chartPath.h + 6}>
                      <Defs>
                        <SvgGradient id="trackProgFill" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0" stopColor={CYAN} stopOpacity={0.35} />
                          <Stop offset="0.55" stopColor={CYAN} stopOpacity={0.12} />
                          <Stop offset="1" stopColor={CYAN} stopOpacity={0} />
                        </SvgGradient>
                        <SvgGradient id="trackProgLine" x1="0" y1="0" x2="1" y2="0">
                          <Stop offset="0" stopColor="#4DA6FF" />
                          <Stop offset="0.55" stopColor={CYAN} />
                          <Stop offset="1" stopColor="#00EED4" />
                        </SvgGradient>
                      </Defs>
                      {chartPath.hLines.map((y) => (
                        <Path
                          key={`h-${y}`}
                          d={`M${chartPath.padX},${y} H${chartPath.padX + chartPath.plotW}`}
                          stroke="rgba(255,255,255,0.1)"
                          strokeWidth={1}
                        />
                      ))}
                      {chartPath.vLines.map((x) => (
                        <Path
                          key={`v-${x}`}
                          d={`M${x},${chartPath.padTop} V${chartPath.padTop + chartPath.h}`}
                          stroke="rgba(255,255,255,0.1)"
                          strokeWidth={1}
                        />
                      ))}
                      <Path d={chartPath.area} fill="url(#trackProgFill)" />
                      <Path
                        d={chartPath.line}
                        stroke={CYAN}
                        strokeWidth={10}
                        strokeOpacity={0.22}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                      <Path
                        d={chartPath.line}
                        stroke={CYAN}
                        strokeWidth={5}
                        strokeOpacity={0.35}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                      <Path
                        d={chartPath.line}
                        stroke="url(#trackProgLine)"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                      {chartPath.coords.map((c, i) => (
                        <ChartDot
                          key={c.id}
                          x={c.x}
                          y={c.y}
                          fill={i === chartPath.coords.length - 1 ? MINT : CYAN}
                        />
                      ))}
                    </Svg>
                    <View style={styles.xAxis}>
                      {chartPath.coords.map((c) => (
                        <View key={c.id} style={styles.xTick}>
                          <Text
                            allowFontScaling={false}
                            numberOfLines={1}
                            style={[styles.xDate, { fontFamily: theme.mediumFont }]}
                          >
                            {fmtDate(c.date)}
                          </Text>
                          <Text
                            allowFontScaling={false}
                            style={[styles.xScore, { fontFamily: theme.mediumFont }]}
                          >
                            {Math.round(c.score)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            </View>
          )}
        </View>

        <GlowButton
          label={t('analysis.compareAnotherSession')}
          onPress={onCompareAnother}
          testID="track-progress-compare-another"
          arrow
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    marginBottom: 4,
  },
  navSide: { width: 20, alignItems: 'center', justifyContent: 'center' },
  navCenter: { flex: 1, alignItems: 'center' },
  navTitle: { color: '#FFFFFF', fontSize: 22, textAlign: 'center' },
  navSub: { color: '#00B8FF', fontSize: 13, textAlign: 'center', marginTop: 2 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 10 },
  segTrack: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0, 72, 255, 0.5)',
    backgroundColor: '#041641',
    padding: 5,
    gap: 4,
    overflow: 'hidden',
    boxShadow: 'inset 0px 0px 30px 0px rgba(0, 72, 255, 0.5)',
  },
  segBtn: { flex: 1, borderRadius: 999, overflow: 'hidden' },
  segFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 8,
  },
  segText: { color: '#86A7D2', fontSize: 13 },
  segTextOn: { color: '#07256D', fontSize: 13 },
  loadingBox: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  videoRow: { flexDirection: 'row', gap: 10 },
  videoCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: '#041641',
    padding: 10,
    gap: 10,
  },
  idealCard: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    boxShadow: '0px 0px 5px #0048FF',
  },
  videoLabel: { color: '#FFFFFF', fontSize: 16, textAlign: 'center' },
  clipFrame: {
    height: 140,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#030A17',
    borderWidth: 2,
    borderColor: '#07256D',
  },
  emptyClip: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  emptyText: { color: '#86A7D2', fontSize: 12, textAlign: 'center', lineHeight: 16 },
  jointCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#032C91',
    backgroundColor: '#030A17',
    paddingTop: 15,
    paddingHorizontal: 15,
    paddingBottom: 10,
    gap: 5,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 20 },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -6,
  },
  sectionTitle: { color: '#FFFFFF', fontSize: 16 },
  tableHead: { flexDirection: 'row', alignItems: 'center', height: 20 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(134,167,210,0.25)',
  },
  colJoint: { width: 110 },
  colPrev: { width: 52, color: '#86A7D2', fontSize: 11 },
  colArrow: { width: 28, color: '#86A7D2', fontSize: 11, textAlign: 'center' },
  colCurr: { width: 52, color: '#FFFFFF', fontSize: 11 },
  colChange: { flex: 1, alignItems: 'flex-end' },
  colHead: { fontSize: 11 },
  jointName: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  jointLabel: { color: '#FFFFFF', fontSize: 11, flex: 1 },
  cell: { fontSize: 11 },
  /** Figma 6283:51864 — dark fill + mint border + inset mint glow (not a solid green fill). */
  changePill: {
    width: 50,
    height: 21,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 1,
    overflow: 'hidden',
  },
  changePillUp: {
    borderColor: 'rgba(0, 255, 166, 0.5)',
    backgroundColor: 'rgba(0, 12, 8, 0.9)',
    boxShadow: 'inset 0px 0px 21px 0px rgba(0, 255, 166, 0.5)',
  },
  changePillDown: {
    borderColor: 'rgba(255, 107, 107, 0.5)',
    backgroundColor: 'rgba(12, 0, 0, 0.9)',
    boxShadow: 'inset 0px 0px 21px 0px rgba(255, 107, 107, 0.45)',
  },
  changeText: { color: '#FFFFFF', fontSize: 10 },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#001950',
    backgroundColor: '#030A17',
    padding: 10,
    boxShadow: 'inset 0px 0px 30px 0px #0048FF',
  },
  ringWrap: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
    // Allow the glow PNG (~13% outside the dial) to paint into card padding.
    overflow: 'visible',
  },
  ringGlow: {
    position: 'absolute',
    width: RING_GLOW,
    height: RING_GLOW,
    left: (RING - RING_GLOW) / 2,
    top: (RING - RING_GLOW) / 2,
  },
  ringValue: {
    position: 'absolute',
    color: MINT,
    fontSize: 24,
    letterSpacing: -1.2,
    textAlign: 'center',
    width: 74,
  },
  scoreCopy: { flex: 1, gap: 5, minWidth: 0 },
  scoreTitle: { color: '#FFFFFF', fontSize: 16 },
  scoreBody: { color: '#FFFFFF', fontSize: 13, lineHeight: 17 },
  chartCard: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#001950',
    backgroundColor: '#030A17',
    padding: 10,
    gap: 20,
    overflow: 'hidden',
    boxShadow: 'inset 0px 0px 30px 0px #0048FF',
  },
  chartBody: { minHeight: CHART_TOTAL_H, flexDirection: 'row', alignItems: 'flex-start' },
  yAxis: {
    width: 22,
    height: CHART_PAD_TOP + CHART_PLOT_H,
    justifyContent: 'space-between',
    marginTop: CHART_PAD_TOP - 8,
  },
  yTick: { color: '#FFFFFF', fontSize: 9, textAlign: 'center' },
  chartPlot: { flex: 1, minWidth: 0 },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  xTick: { alignItems: 'center', minWidth: 36 },
  xDate: { color: '#86A7D2', fontSize: 9 },
  xScore: { color: '#FFFFFF', fontSize: 13 },
})
