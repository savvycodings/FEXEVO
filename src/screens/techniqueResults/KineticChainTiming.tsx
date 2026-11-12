import { Fragment, useContext, useEffect, useMemo, useState } from 'react'
import {
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
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { ThemeContext } from '../../context'
import { LocalSvgAsset } from '../../components/LocalSvgAsset'
import { CARD_GLOW, GlowButton, UI } from '../../components/ui'
import {
  CHAIN_ORDER,
  IDEAL_PEAK_S,
  idealChainTiming,
  type ChainSegment,
  type ChainStatus,
  type SegmentTiming,
} from '../../lib/kineticChain'

export const CHAIN_YOU = '#5B6CFF'
export const CHAIN_PRO = '#3DDC97'

const SEQ_STRIP = require('../../../assets/aicoach/analysis/kinetic/sequence-strip.png')
const ICON_POWER = require('../../../assets/aicoach/analysis/kinetic/icon-power-flow.svg')
const ICON_SEGMENT = require('../../../assets/aicoach/analysis/kinetic/icon-segment-timing.svg')
const ICON_CHEVRON = require('../../../assets/aicoach/analysis/kinetic/icon-chevron.svg')
const ICON_BULB = require('../../../assets/aicoach/analysis/kinetic/icon-lightbulb.svg')
const CHAIN_GLOW = require('../../../assets/aicoach/analysis/kinetic/chain-glow.svg')

const CHAIN_ICON: Record<ChainSegment, number> = {
  legs: require('../../../assets/aicoach/analysis/kinetic/icon-legs.svg'),
  hips: require('../../../assets/aicoach/analysis/kinetic/icon-hips.svg'),
  torso: require('../../../assets/aicoach/analysis/kinetic/icon-torso.svg'),
  arm: require('../../../assets/aicoach/analysis/kinetic/icon-arm.svg'),
  racket: require('../../../assets/aicoach/analysis/kinetic/icon-racket.svg'),
}

const ROW_ICON: Record<ChainSegment, number> = {
  legs: require('../../../assets/aicoach/analysis/kinetic/row-legs.svg'),
  hips: require('../../../assets/aicoach/analysis/kinetic/row-hips.svg'),
  torso: require('../../../assets/aicoach/analysis/kinetic/row-torso.svg'),
  arm: require('../../../assets/aicoach/analysis/kinetic/row-arm.svg'),
  racket: require('../../../assets/aicoach/analysis/kinetic/row-racket.svg'),
}

const SEGMENT_COLOR: Record<ChainSegment, string> = {
  legs: '#FF4242',
  hips: '#00FFA6',
  torso: '#00B8FF',
  arm: '#FF5601',
  racket: '#FFBB01',
}

const SEGMENT_BORDER: Record<ChainSegment, string> = {
  legs: '#00B8FF',
  hips: '#00FFA6',
  torso: '#0048FF',
  arm: '#FF8000',
  racket: '#FFBB00',
}

const SEGMENT_BG: Record<ChainSegment, string> = {
  legs: '#00131A',
  hips: '#002216',
  torso: '#00123F',
  arm: '#241200',
  racket: '#2B1F00',
}

const SEGMENT_GLOW: Record<ChainSegment, string> = {
  legs: '#00B8FF',
  hips: '#00FFA6',
  torso: '#0048FF',
  arm: '#FF8000',
  racket: '#FFBB00',
}

const STEP_LINES: Record<ChainSegment, [string, string]> = {
  legs: ['Legs', 'Drive'],
  hips: ['Hips', 'Rotate'],
  torso: ['Torso', 'Rotate'],
  arm: ['Arm', 'Extend'],
  racket: ['Racket Accelerate', ''],
}

function secs(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return '—'
  const s = Math.abs(v) < 0.005 ? 0 : v
  const fixed = s.toFixed(2)
  return `${s > 0 ? '+' : ''}${fixed}s`
}

function statusCopy(
  s: SegmentTiming,
  t: (k: string, opts?: Record<string, string>) => string
): { delta: string; label: string } | null {
  if (s.status == null || s.deltaS == null) return null
  if (s.status === 'onTime') return { delta: '', label: t('analysis.chain.status.onTime') }
  return {
    delta: secs(s.deltaS),
    label: t(`analysis.chain.status.${s.status}`),
  }
}

export function ChainLegend({ align = 'flex-end' }: { align?: 'flex-end' | 'center' }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  return (
    <View style={[styles.legendRow, { justifyContent: align }]}>
      {[
        { color: CHAIN_YOU, label: t('analysis.yourShot') },
        { color: CHAIN_PRO, label: t('analysis.idealForm') },
      ].map((item) => (
        <View key={item.label} style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text allowFontScaling={false} style={[styles.legendLabel, { fontFamily: theme.regularFont }]}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

/** Start → peak bar per segment against time from contact. */
export function TimingChart({ timing }: { timing: SegmentTiming[] }) {
  const { t } = useTranslation()
  const [w, setW] = useState(0)
  const rowH = 26
  const labelW = 52
  const top = 6
  const axisH = 24
  const h = top + rowH * timing.length + axisH
  const times = timing.flatMap((s) => [s.startS, s.peakS, s.idealPeakS]).filter((v): v is number => v != null)
  const min = Math.min(-0.6, Math.floor((Math.min(...times, 0) - 0.05) * 5) / 5)
  const max = Math.max(0.4, Math.ceil((Math.max(...times, 0) + 0.05) * 5) / 5)
  const plotW = Math.max(1, w - labelW - 26)
  const x = (v: number) => labelW + ((v - min) / (max - min)) * plotW
  const ticks: number[] = []
  for (let v = min; v <= max + 1e-6; v += 0.2) ticks.push(Math.round(v * 10) / 10)
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: h }}>
      {w > 0 ? (
        <Svg width={w} height={h}>
          {timing.map((s, i) => {
            const y = top + rowH * i + rowH / 2
            return (
              <Line key={`g-${s.id}`} x1={labelW} y1={y} x2={w - 12} y2={y} stroke="rgba(140, 176, 226, 0.15)" strokeWidth={1} />
            )
          })}
          <Line
            x1={x(0)}
            y1={top - 2}
            x2={x(0)}
            y2={top + rowH * timing.length}
            stroke={UI.text}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          {timing.map((s, i) => {
            const y = top + rowH * i + rowH / 2
            return (
              <SvgText key={`l-${s.id}`} x={0} y={y + 4} fill={UI.text} fontSize={11}>
                {t(`analysis.chain.segments.${s.id}`)}
              </SvgText>
            )
          })}
          {timing.map((s, i) => {
            if (s.startS == null || s.peakS == null) return null
            const y = top + rowH * i + rowH / 2
            return (
              <Line
                key={`b-${s.id}`}
                x1={x(s.startS)}
                y1={y}
                x2={x(s.peakS)}
                y2={y}
                stroke={CHAIN_YOU}
                strokeWidth={4}
                strokeLinecap="round"
              />
            )
          })}
          {timing.map((s, i) => {
            if (s.peakS == null) return null
            const y = top + rowH * i + rowH / 2
            return (
              <Circle key={`p-${s.id}`} cx={x(s.peakS)} cy={y} r={5.5} fill="#8FD3FF" stroke={CHAIN_YOU} strokeWidth={2} />
            )
          })}
          {timing.map((s, i) => {
            const y = top + rowH * i + rowH / 2
            return (
              <Circle
                key={`ideal-${s.id}`}
                cx={x(s.idealPeakS)}
                cy={y}
                r={4}
                fill={CHAIN_PRO}
                fillOpacity={0.85}
              />
            )
          })}
          {ticks.map((v) => (
            <SvgText
              key={`t-${v}`}
              x={x(v)}
              y={h - 6}
              fill={v === 0 ? UI.accent : UI.text}
              fontSize={11}
              textAnchor="middle"
            >
              {v === 0 ? t('analysis.chain.contact') : `${v > 0 ? '+' : ''}${v.toFixed(1)}s`}
            </SvgText>
          ))}
        </Svg>
      ) : null}
    </View>
  )
}

/** Compact timing card used from Joint Detail. */
export function TimingCard({ timing, onPress }: { timing: SegmentTiming[] | null; onPress?: () => void }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const rows = timing ?? idealChainTiming()
  const body = (
    <>
      <View style={styles.cardTitleBlock}>
        <Text allowFontScaling={false} style={[styles.cardTitle, { fontFamily: theme.regularFont }]}>
          {t('analysis.timingVsIdeal')}
        </Text>
      </View>
      <ChainLegend />
      <TimingChart timing={rows} />
      {onPress ? (
        <View style={styles.openRow}>
          <Text allowFontScaling={false} style={[styles.openText, { fontFamily: theme.regularFont }]}>
            {t('analysis.chain.open')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={UI.accent} />
        </View>
      ) : null}
    </>
  )
  return onPress ? (
    <Pressable testID="chain-timing-card" accessibilityRole="button" onPress={onPress} style={[styles.legacyCard, CARD_GLOW]}>
      {body}
    </Pressable>
  ) : (
    <View testID="chain-timing-card" style={[styles.legacyCard, CARD_GLOW]}>
      {body}
    </View>
  )
}

type Props = {
  timing: SegmentTiming[] | null
  onClose: () => void
  /** When true, hide the standalone page header (Smart 3D already shows Full Body Analysis). */
  embedded?: boolean
  onDrills?: () => void
}

/**
 * Kinetic Analysis (Figma 6196:105627).
 * Sequence strip, glowing Power Flow chain, You vs Ideal timing, Key Insight, drills CTA.
 */
export function KineticChainTimingView({ timing, onClose, embedded = false, onDrills }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const [info, setInfo] = useState(false)

  useEffect(() => {
    if (embedded) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [onClose, embedded])

  const rows = useMemo(() => {
    if (timing?.length) return timing
    return idealChainTiming()
  }, [timing])

  const insight = useMemo(() => {
    const ranked = [...rows]
      .filter((s) => s.status && s.status !== 'onTime' && s.deltaS != null)
      .sort((a, b) => Math.abs(b.deltaS!) - Math.abs(a.deltaS!))
    const worst = ranked[0]
    if (!worst || worst.deltaS == null) return t('analysis.chain.insightOk')
    const seg = t(`analysis.chain.segments.${worst.id}`).toLowerCase()
    const abs = Math.abs(worst.deltaS).toFixed(2)
    if (worst.status === 'early') {
      return t('analysis.chain.insightEarly', { segment: seg, seconds: abs })
    }
    return t('analysis.chain.insightLate', { segment: seg, seconds: abs })
  }, [rows, t])

  return (
    <ScrollView
      testID="chain-timing"
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      {!embedded ? (
        <View style={styles.titleRow}>
          <Pressable
            testID="chain-timing-back"
            accessibilityRole="button"
            accessibilityLabel={t('analysis.back')}
            hitSlop={12}
            onPress={onClose}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={28} color="#86A7D2" />
          </Pressable>
          <View style={styles.titleCopy}>
            <View style={styles.titleLine}>
              <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.mediumFont }]}>
                {t('analysis.kineticAnalysis')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: info }}
                hitSlop={8}
                onPress={() => setInfo((v) => !v)}
              >
                <Ionicons name="alert-circle-outline" size={22} color={UI.text} />
              </Pressable>
            </View>
            <Text allowFontScaling={false} style={[styles.subtitle, { fontFamily: theme.mediumFont }]}>
              {t('analysis.timingVsIdeal')}
            </Text>
          </View>
        </View>
      ) : null}
      {info ? (
        <Text allowFontScaling={false} style={[styles.info, { fontFamily: theme.regularFont }]}>
          {t('analysis.chain.info')}
        </Text>
      ) : null}

      {/* Kinetic Sequence */}
      <View style={styles.card}>
        <Text allowFontScaling={false} style={[styles.sectionTitle, { fontFamily: theme.mediumFont }]}>
          {t('analysis.kineticSequence')}
        </Text>
        <Text allowFontScaling={false} style={[styles.sectionSub, { fontFamily: theme.mediumFont }]}>
          {t('analysis.kineticSequenceBody')}
        </Text>
        <View style={[styles.seqStripWrap, { mixBlendMode: 'screen' } as object]}>
          <Image source={SEQ_STRIP} style={styles.seqStrip} resizeMode="cover" />
        </View>
        <View style={styles.seqSteps}>
          <LinearGradient
            colors={['#FF4242', '#00FFA6', '#00B8FF', '#FF5601', '#FFBB01']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.seqLine}
          />
          {CHAIN_ORDER.map((id, i) => {
            const [a, b] = STEP_LINES[id]
            return (
              <View key={id} style={styles.seqStep}>
                <View style={[styles.seqBadge, { backgroundColor: SEGMENT_COLOR[id] }]}>
                  <Text allowFontScaling={false} style={[styles.seqBadgeText, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}>
                    {i + 1}
                  </Text>
                </View>
                <Text allowFontScaling={false} style={[styles.seqLabel, { fontFamily: theme.mediumFont }]}>
                  {a}
                  {b ? `\n${b}` : ''}
                </Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* Kinetic Chain / Power Flow */}
      <View style={styles.card}>
        <View style={styles.cardHeadRow}>
          <View style={styles.cardHeadCopy}>
            <Text allowFontScaling={false} style={[styles.sectionTitle, { fontFamily: theme.mediumFont }]}>
              {t('analysis.kineticChain')}
            </Text>
            <Text allowFontScaling={false} style={[styles.sectionSub, { fontFamily: theme.mediumFont }]}>
              {t('analysis.kineticChainBody')}
            </Text>
          </View>
          <View style={styles.chip}>
            <LocalSvgAsset assetModule={ICON_POWER} width={12} height={12} />
            <Text allowFontScaling={false} style={[styles.chipText, { fontFamily: theme.regularFont }]}>
              {t('analysis.powerFlow')}
            </Text>
          </View>
        </View>
        <View style={styles.flowRow}>
          <View style={styles.flowGlow} pointerEvents="none">
            <LocalSvgAsset assetModule={CHAIN_GLOW} width={274} height={37} />
          </View>
          {CHAIN_ORDER.map((id, i) => (
            <Fragment key={id}>
              <View style={styles.flowItem}>
                <View
                  style={[
                    styles.flowOrb,
                    {
                      borderColor: SEGMENT_BORDER[id],
                      backgroundColor: SEGMENT_BG[id],
                      boxShadow: `0px 0px 10px 0px ${SEGMENT_GLOW[id]}, inset 0px 0px 20px 0px ${SEGMENT_GLOW[id]}`,
                    },
                  ]}
                >
                  <LocalSvgAsset assetModule={CHAIN_ICON[id]} width={24} height={24} />
                </View>
                <Text allowFontScaling={false} style={[styles.flowLabel, { fontFamily: theme.mediumFont }]}>
                  {STEP_LINES[id][0]}
                  {STEP_LINES[id][1] ? `\n${STEP_LINES[id][1]}` : ''}
                </Text>
              </View>
              {i < CHAIN_ORDER.length - 1 ? (
                <View style={styles.flowChevron} pointerEvents="none">
                  <LocalSvgAsset assetModule={ICON_CHEVRON} width={6} height={50} />
                </View>
              ) : null}
            </Fragment>
          ))}
        </View>
      </View>

      {/* Your Timing vs Ideal Form */}
      <View style={[styles.card, styles.timingCard]}>
        <View style={styles.cardHeadRow}>
          <Text allowFontScaling={false} style={[styles.sectionTitle, { fontFamily: theme.mediumFont }]}>
            {t('analysis.timingVsIdeal')}
          </Text>
          <View style={styles.chip}>
            <LocalSvgAsset assetModule={ICON_SEGMENT} width={12} height={12} />
            <Text allowFontScaling={false} style={[styles.chipText, { fontFamily: theme.regularFont }]}>
              {t('analysis.segmentTiming')}
            </Text>
          </View>
        </View>

        <View style={styles.tableHead}>
          <View style={styles.colSeg} />
          <Text allowFontScaling={false} style={[styles.colYou, styles.th, { fontFamily: theme.mediumFont }]}>
            {t('analysis.chain.you')}
          </Text>
          <Text allowFontScaling={false} style={[styles.colPro, styles.thPro, { fontFamily: theme.mediumFont }]}>
            {t('analysis.chain.pro')}
          </Text>
          <View style={styles.colStatus} />
        </View>

        {rows.map((s) => {
          const st = statusCopy(s, t)
          return (
            <View key={s.id} style={styles.tableRow} testID={`chain-row-${s.id}`}>
              <View style={[styles.colSeg, styles.segCell]}>
                <View
                  style={[
                    styles.rowOrb,
                    { borderColor: SEGMENT_BORDER[s.id], backgroundColor: SEGMENT_BG[s.id] },
                  ]}
                >
                  <LocalSvgAsset assetModule={ROW_ICON[s.id]} width={14} height={14} />
                </View>
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.segName, { fontFamily: theme.mediumFont }]}>
                  {t(`analysis.chain.segments.${s.id}`)}
                </Text>
              </View>
              <Text allowFontScaling={false} style={[styles.colYou, styles.td, { fontFamily: theme.mediumFont }]}>
                {secs(s.peakS)}
              </Text>
              <Text allowFontScaling={false} style={[styles.colPro, styles.td, { fontFamily: theme.mediumFont }]}>
                {secs(s.idealPeakS ?? IDEAL_PEAK_S[s.id])}
              </Text>
              <View style={styles.colStatus}>
                {st ? (
                  <View
                    style={[
                      styles.statusPill,
                      s.status === 'late' && styles.statusLate,
                      s.status === 'early' && styles.statusEarly,
                      s.status === 'onTime' && styles.statusOnTime,
                    ]}
                  >
                    <Text allowFontScaling={false} numberOfLines={1} style={[styles.statusText, { fontFamily: theme.mediumFont }]}>
                      {st.delta ? (
                        <Text>
                          <Text style={styles.statusDelta}>{st.delta} </Text>
                          <Text
                            style={
                              s.status === 'late'
                                ? styles.statusLateLabel
                                : s.status === 'early'
                                  ? styles.statusEarlyLabel
                                  : styles.statusOnTimeLabel
                            }
                          >
                            {st.label}
                          </Text>
                        </Text>
                      ) : (
                        <Text style={styles.statusOnTimeLabel}>{st.label}</Text>
                      )}
                    </Text>
                  </View>
                ) : (
                  <Text allowFontScaling={false} style={[styles.tdMuted, { fontFamily: theme.mediumFont }]}>
                    —
                  </Text>
                )}
              </View>
            </View>
          )
        })}
      </View>

      {/* Key Insight */}
      <Pressable style={styles.insight} accessibilityRole="button">
        <View style={styles.insightIconWrap}>
          <LocalSvgAsset assetModule={ICON_BULB} width={42} height={42} />
        </View>
        <View style={styles.insightCopy}>
          <Text allowFontScaling={false} style={[styles.insightTitle, { fontFamily: theme.mediumFont }]}>
            {t('analysis.keyInsight')}
          </Text>
          <Text allowFontScaling={false} style={[styles.insightBody, { fontFamily: theme.mediumFont }]}>
            {insight}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#FFBB00" />
      </Pressable>

      {onDrills ? (
        <GlowButton label={t('analysis.drillExercises')} onPress={onDrills} testID="kinetic-drills" arrow />
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 0, paddingTop: 0, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  back: { paddingTop: 4, width: 28 },
  titleCopy: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: UI.text, fontSize: 22, flexShrink: 1 },
  subtitle: { color: '#00B8FF', fontSize: 13, lineHeight: 18 },
  info: {
    color: '#86A7D2',
    fontSize: 13,
    lineHeight: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#032C91',
    padding: 12,
    backgroundColor: '#030A17',
  },
  legendRow: { flexDirection: 'row', gap: 16 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 4 },
  legendLabel: { color: UI.text, fontSize: 13 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#032C91',
    backgroundColor: '#030A17',
    padding: 15,
    gap: 10,
    overflow: 'hidden',
    boxShadow: 'inset 0px 0px 40px 0px rgba(0, 72, 255, 0.5)',
  },
  timingCard: { borderRadius: 10, gap: 5, paddingBottom: 10 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16 },
  sectionSub: { color: '#86A7D2', fontSize: 11, lineHeight: 15 },
  cardHeadRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardHeadCopy: { flex: 1, minWidth: 0, gap: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#07256D',
    boxShadow: 'inset 0px 0px 6px 0px #00B8FF',
  },
  chipText: { color: '#CFECFF', fontSize: 9 },
  seqStripWrap: {
    width: '100%',
    aspectRatio: 370 / 83,
    overflow: 'hidden',
    borderRadius: 8,
  },
  seqStrip: {
    position: 'absolute',
    left: 0,
    width: '100%',
    height: '148.59%',
    top: '-26.51%',
  },
  seqSteps: { flexDirection: 'row', alignItems: 'flex-start', gap: 2, position: 'relative' },
  seqLine: {
    position: 'absolute',
    left: 48,
    right: 48,
    top: 9,
    height: 2,
    borderRadius: 1,
  },
  seqStep: { flex: 1, alignItems: 'center', gap: 5 },
  seqBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  seqBadgeText: { color: '#030A17', fontSize: 11 },
  seqLabel: { color: '#FFFFFF', fontSize: 11, textAlign: 'center', lineHeight: 14 },
  flowRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 2, position: 'relative' },
  flowGlow: {
    position: 'absolute',
    left: 47,
    width: 274,
    top: 6,
    height: 37,
    alignItems: 'center',
    opacity: 0.95,
  },
  flowItem: { flex: 1, alignItems: 'center', gap: 5, minWidth: 0 },
  flowOrb: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowLabel: { color: '#FFFFFF', fontSize: 11, textAlign: 'center', lineHeight: 14 },
  flowChevron: { width: 6, height: 50, justifyContent: 'center' },
  tableHead: { flexDirection: 'row', alignItems: 'center', height: 20 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 30,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(134,167,210,0.25)',
  },
  colSeg: { width: 120 },
  colYou: { flex: 1 },
  colPro: { flex: 1 },
  colStatus: { width: 87, alignItems: 'flex-start' },
  th: { color: '#86A7D2', fontSize: 11 },
  thPro: { color: '#FFFFFF', fontSize: 11 },
  td: { color: '#FFFFFF', fontSize: 11 },
  tdMuted: { color: '#86A7D2', fontSize: 11 },
  segCell: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 5 },
  rowOrb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segName: { color: '#FFFFFF', fontSize: 11, width: 65 },
  statusPill: {
    minHeight: 21,
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  statusLate: {
    borderColor: 'rgba(255, 0, 4, 0.5)',
    backgroundColor: 'rgba(25, 0, 0, 0.9)',
    boxShadow: 'inset 0px 0px 21px 0px rgba(255, 0, 4, 0.5)',
  },
  statusEarly: {
    borderColor: 'rgba(0, 255, 166, 0.5)',
    backgroundColor: 'rgba(0, 12, 8, 0.9)',
    boxShadow: 'inset 0px 0px 21px 0px rgba(0, 255, 166, 0.5)',
  },
  statusOnTime: {
    borderColor: 'rgba(0, 184, 255, 0.5)',
    backgroundColor: 'rgba(0, 72, 255, 0.2)',
    boxShadow: 'inset 0px 0px 21px 0px #00B8FF',
  },
  statusText: { fontSize: 10, textAlign: 'center' },
  statusDelta: { color: '#FFFFFF' },
  statusLateLabel: { color: '#F23B45' },
  statusEarlyLabel: { color: '#00FFA6' },
  statusOnTimeLabel: { color: '#FFFFFF' },
  insight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 187, 0, 0.5)',
    backgroundColor: 'rgba(255, 187, 0, 0.05)',
    padding: 15,
  },
  insightIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 187, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightCopy: { flex: 1, minWidth: 0, gap: 2 },
  insightTitle: { color: '#FFBB00', fontSize: 16 },
  insightBody: { color: '#FFFFFF', fontSize: 11, lineHeight: 15 },
  legacyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#032C91',
    backgroundColor: '#030A17',
    padding: 14,
    gap: 10,
  },
  cardTitleBlock: { gap: 2 },
  cardTitle: { color: UI.text, fontSize: 16 },
  openRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  openText: { color: UI.accent, fontSize: 13 },
})
