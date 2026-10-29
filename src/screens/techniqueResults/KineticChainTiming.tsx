import { useContext, useEffect, useState } from 'react'
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg'
import { ThemeContext } from '../../context'
import { CARD_GLOW, UI } from '../../components/ui'
import type { ChainSegment, ChainStatus, SegmentTiming } from '../../lib/kineticChain'

export const CHAIN_YOU = '#5B6CFF'
export const CHAIN_PRO = '#F2B33D'

const SEGMENT: Record<ChainSegment, { color: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  legs: { color: '#E5482B', icon: 'run-fast' },
  hips: { color: '#4CC93F', icon: 'rotate-orbit' },
  torso: { color: '#4BAEF5', icon: 'human' },
  arm: { color: '#F27A2E', icon: 'arm-flex' },
  racket: { color: '#E8C23A', icon: 'tennis' },
}

const STATUS: Record<ChainStatus, { border: string; bg: string; text: string }> = {
  onTime: { border: '#34C759', bg: 'rgba(52, 199, 89, 0.18)', text: '#8EF0AE' },
  early: { border: '#E5482B', bg: 'rgba(229, 72, 43, 0.22)', text: '#FF9C86' },
  late: { border: '#E8C23A', bg: 'rgba(232, 194, 58, 0.2)', text: '#F6DC7A' },
}

function secs(v: number | null) {
  if (v == null) return '—'
  const s = v.toFixed(2)
  return `${v > 0 ? '+' : ''}${s}s`
}

export function ChainLegend({ align = 'flex-end' }: { align?: 'flex-end' | 'center' }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  return (
    <View style={[styles.legendRow, { justifyContent: align }]}>
      {[
        { color: CHAIN_YOU, label: t('analysis.yourMovement') },
        { color: CHAIN_PRO, label: t('analysis.proReference') },
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
  const times = timing.flatMap((s) => [s.startS, s.peakS]).filter((v): v is number => v != null)
  const min = Math.min(-0.6, Math.floor(((Math.min(...times, 0) - 0.05) * 5)) / 5)
  const max = Math.max(0.4, Math.ceil(((Math.max(...times, 0) + 0.05) * 5)) / 5)
  // Room on the right for the last tick label.
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

/** "Timing Visualization" card; the whole card opens the full table when `onPress` is set. */
export function TimingCard({ timing, onPress }: { timing: SegmentTiming[] | null; onPress?: () => void }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const body = (
    <>
      <Text allowFontScaling={false} style={[styles.cardTitle, { fontFamily: theme.regularFont }]}>
        {t('analysis.chain.vizTitle')}
        <Text style={[styles.cardTitleSub, { fontFamily: theme.regularFont }]}>{`  ${t('analysis.chain.vizRel')}`}</Text>
      </Text>
      <ChainLegend />
      {timing ? (
        <TimingChart timing={timing} />
      ) : (
        <Text allowFontScaling={false} style={[styles.note, { fontFamily: theme.regularFont }]}>
          {t('analysis.chain.empty')}
        </Text>
      )}
      {timing ? (
        <Text allowFontScaling={false} style={[styles.note, { fontFamily: theme.regularFont }]}>
          {t('analysis.chain.noPro')}
        </Text>
      ) : null}
      {onPress && timing ? (
        <View style={styles.openRow}>
          <Text allowFontScaling={false} style={[styles.openText, { fontFamily: theme.regularFont }]}>
            {t('analysis.chain.open')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={UI.accent} />
        </View>
      ) : null}
    </>
  )
  return onPress && timing ? (
    <Pressable testID="chain-timing-card" accessibilityRole="button" onPress={onPress} style={[styles.card, CARD_GLOW]}>
      {body}
    </Pressable>
  ) : (
    <View testID="chain-timing-card" style={[styles.card, CARD_GLOW]}>
      {body}
    </View>
  )
}

/** Full timing breakdown: the chain in order, the start / peak table and the chart. */
export function KineticChainTimingView({ timing, onClose }: { timing: SegmentTiming[] | null; onClose: () => void }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const [info, setInfo] = useState(false)

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [onClose])

  const rows = timing ?? []

  return (
    <ScrollView
      testID="chain-timing"
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
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
            <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}>
              {t('analysis.chain.title')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: info }}
              hitSlop={8}
              onPress={() => setInfo((v) => !v)}
            >
              <Ionicons name="alert-circle-outline" size={24} color={UI.text} />
            </Pressable>
          </View>
          <Text allowFontScaling={false} style={[styles.subtitle, { fontFamily: theme.regularFont }]}>
            {t('analysis.chain.subtitle')}
          </Text>
        </View>
      </View>
      {info ? (
        <Text allowFontScaling={false} style={[styles.info, { fontFamily: theme.regularFont }]}>
          {t('analysis.chain.info')}
        </Text>
      ) : null}

      <ChainLegend />

      <View style={styles.steps}>
        {(['legs', 'hips', 'torso', 'arm', 'racket'] as ChainSegment[]).map((id, i) => (
          <View key={id} style={styles.stepWrap}>
            <View style={styles.step}>
              <View style={[styles.stepArt, { borderColor: SEGMENT[id].color }]}>
                <MaterialCommunityIcons name={SEGMENT[id].icon} size={26} color={UI.text} />
              </View>
              <View style={[styles.stepBadge, { backgroundColor: SEGMENT[id].color }]}>
                <Text allowFontScaling={false} style={[styles.stepNum, { fontFamily: theme.mediumFont }]}>
                  {i + 1}
                </Text>
              </View>
              <Text allowFontScaling={false} numberOfLines={2} style={[styles.stepLabel, { fontFamily: theme.regularFont }]}>
                {t(`analysis.chain.steps.${id}`)}
              </Text>
            </View>
            {i < 4 ? <Ionicons name="chevron-forward" size={14} color={UI.textMuted} style={styles.stepArrow} /> : null}
          </View>
        ))}
      </View>

      {rows.length ? (
        <View testID="chain-table" style={styles.table}>
          <View style={[styles.tr, styles.thead]}>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.th, styles.colSeg, { fontFamily: theme.regularFont }]}>
              {t('analysis.chain.segment')}
            </Text>
            {(['start', 'peak'] as const).map((k) => (
              <View key={k} style={[styles.colGroup, styles.groupDivider]}>
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.th, { fontFamily: theme.regularFont }]}>
                  {t(`analysis.chain.${k}`)}
                </Text>
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.thSub, { fontFamily: theme.regularFont }]}>
                  {t('analysis.chain.relContact')}
                </Text>
                <View style={styles.subHead}>
                  {(['you', 'pro', 'diff'] as const).map((c) => (
                    <Text key={c} allowFontScaling={false} style={[styles.thCol, { fontFamily: theme.regularFont }]}>
                      {t(`analysis.chain.${c}`)}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
            <Text allowFontScaling={false} style={[styles.th, styles.colStatus, styles.groupDivider, { fontFamily: theme.regularFont }]}>
              {t('analysis.chain.timing')}
            </Text>
          </View>
          {rows.map((s) => {
            const st = s.status ? STATUS[s.status] : null
            return (
              <View key={s.id} testID={`chain-row-${s.id}`} style={[styles.tr, styles.trBody]}>
                <View style={[styles.colSeg, styles.segCell]}>
                  <View style={[styles.segDotRing, { borderColor: SEGMENT[s.id].color }]}>
                    <View style={[styles.segDot, { backgroundColor: SEGMENT[s.id].color }]} />
                  </View>
                  <Text allowFontScaling={false} numberOfLines={1} style={[styles.td, { fontFamily: theme.regularFont }]}>
                    {t(`analysis.chain.segments.${s.id}`)}
                  </Text>
                </View>
                {[s.startS, s.peakS].map((v, gi) => (
                  <View key={gi} style={[styles.colGroup, styles.groupDivider, styles.subHead]}>
                    <Text allowFontScaling={false} style={[styles.tdNum, { color: '#FF8A70', fontFamily: theme.regularFont }]}>
                      {secs(v)}
                    </Text>
                    <Text allowFontScaling={false} style={[styles.tdNum, { fontFamily: theme.regularFont }]}>
                      —
                    </Text>
                    <Text allowFontScaling={false} style={[styles.tdNum, { fontFamily: theme.regularFont }]}>
                      —
                    </Text>
                  </View>
                ))}
                <View style={[styles.colStatus, styles.groupDivider, styles.statusCell]}>
                  {st && s.status ? (
                    <View style={[styles.statusPill, { borderColor: st.border, backgroundColor: st.bg }]}>
                      <Text allowFontScaling={false} numberOfLines={1} style={[styles.statusText, { color: st.text, fontFamily: theme.regularFont }]}>
                        {t(`analysis.chain.status.${s.status}`)}
                      </Text>
                    </View>
                  ) : (
                    <Text allowFontScaling={false} style={[styles.tdNum, { fontFamily: theme.regularFont }]}>
                      —
                    </Text>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      ) : null}

      <TimingCard timing={timing} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  back: { paddingTop: 4 },
  titleCopy: { flex: 1, gap: 4 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: UI.text, fontSize: 24, flexShrink: 1 },
  subtitle: { color: UI.accent, fontSize: 14, lineHeight: 19 },
  info: {
    color: UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
    borderRadius: UI.radius,
    borderWidth: 1,
    borderColor: UI.trackBorder,
    padding: 12,
  },
  legendRow: { flexDirection: 'row', gap: 16 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 4 },
  legendLabel: { color: UI.text, fontSize: 13 },
  steps: { flexDirection: 'row', alignItems: 'flex-start' },
  stepWrap: { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepArt: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.cardBg,
  },
  stepBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepNum: { color: UI.text, fontSize: 13 },
  stepLabel: { color: UI.text, fontSize: 12, lineHeight: 15, textAlign: 'center' },
  stepArrow: { marginTop: 18 },
  table: {
    borderRadius: UI.radiusCard,
    borderWidth: 2,
    borderColor: '#1F3FC0',
    backgroundColor: '#050B1F',
    overflow: 'hidden',
  },
  tr: { flexDirection: 'row' },
  thead: { borderBottomWidth: 1, borderBottomColor: '#1F3FC0' },
  trBody: { borderTopWidth: 1, borderTopColor: 'rgba(31, 63, 192, 0.5)', minHeight: 40, alignItems: 'stretch' },
  colSeg: { width: 72, paddingHorizontal: 5, paddingVertical: 8 },
  colGroup: { flex: 1, paddingVertical: 6, paddingHorizontal: 4 },
  colStatus: { width: 60, paddingHorizontal: 4, paddingVertical: 8 },
  groupDivider: { borderLeftWidth: 1, borderLeftColor: 'rgba(31, 63, 192, 0.6)' },
  th: { color: UI.accent, fontSize: 12 },
  thSub: { color: UI.textMuted, fontSize: 9 },
  subHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  thCol: { color: UI.textMuted, fontSize: 9, flex: 1, textAlign: 'center' },
  segCell: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  segDotRing: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  segDot: { width: 6, height: 6, borderRadius: 3 },
  td: { color: UI.text, fontSize: 11, flexShrink: 1 },
  tdNum: { color: UI.text, fontSize: 10, flex: 1, textAlign: 'center' },
  statusCell: { justifyContent: 'center', alignItems: 'center' },
  statusPill: { borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 4, paddingVertical: 3, alignSelf: 'stretch' },
  statusText: { fontSize: 11, textAlign: 'center' },
  card: {
    borderRadius: UI.radiusCard,
    borderWidth: 2,
    borderColor: '#1F3FC0',
    backgroundColor: '#050B1F',
    padding: 14,
    gap: 10,
  },
  cardTitle: { color: UI.text, fontSize: 18 },
  cardTitleSub: { color: UI.accent, fontSize: 13 },
  note: { color: UI.textMuted, fontSize: 12, lineHeight: 16 },
  openRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  openText: { color: UI.accent, fontSize: 13 },
})
