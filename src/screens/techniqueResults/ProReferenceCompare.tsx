import { useContext, useMemo, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { Video, ResizeMode } from 'expo-av'
import { ThemeContext } from '../../context'
import { useHologram } from '../../lib/hologramJob'
import { type CompareMetric, buildCompareMetrics, useShotHistory } from './shotHistory'

type Segment = 'before' | 'after' | 'progress'

type Props = {
  videoUri: string
  /** Shows the red pro hologram for this shot when it has been rendered. */
  analysisId?: string | null
  referenceImageUri: string | null
  /** This analysis's angles (see `buildCompareMetrics`). */
  metrics: CompareMetric[]
  score: number | null
  onSave: () => void
}

/** Most bars the Progreso chart shows (the latest ones). */
const MAX_BARS = 8

const fmtDeg = (n: number) => `${Math.round(n)}°`
const fmtDelta = (n: number, unit = '') => {
  const r = Math.round(n)
  return `${r > 0 ? '+' : ''}${r}${unit}`
}

/**
 * Over time for this shot type: Antes is the previous analysis of the same shot, Después is this
 * one, Progreso is the score trend. The pro reference sits next to whichever video is shown.
 */
export function ProReferenceCompare({ videoUri, analysisId, referenceImageUri, metrics, score, onSave }: Props) {
  const { t, i18n } = useTranslation()
  const hologram = useHologram(analysisId)
  const proImage = hologram.proImage ?? referenceImageUri
  const { theme } = useContext(ThemeContext)
  const history = useShotHistory(analysisId)
  const [segment, setSegment] = useState<Segment>('after')
  const segments: { id: Segment; label: string }[] = [
    { id: 'before', label: t('analysis.before') },
    { id: 'after', label: t('analysis.after') },
    { id: 'progress', label: t('analysis.progress') },
  ]

  const previous = history.previous
  const prevMetrics = useMemo(() => buildCompareMetrics(previous?.metrics, t), [previous?.metrics, t])
  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })
  }

  // Both columns list every angle either analysis measured.
  const rows = useMemo(() => {
    const keys = [...new Set([...prevMetrics, ...metrics].map((m) => m.key))]
    return keys.map((key) => {
      const before = prevMetrics.find((m) => m.key === key)
      const after = metrics.find((m) => m.key === key)
      return { key, label: (after ?? before)!.label, before: before?.deg ?? null, after: after?.deg ?? null }
    })
  }, [prevMetrics, metrics])

  const isBefore = segment === 'before'
  const shownVideo = isBefore ? previous?.videoUri ?? null : videoUri
  const shownScore = isBefore ? previous?.score ?? null : score
  const scoreDelta = !isBefore && score != null && previous?.score != null ? score - previous.score : null
  const currentPoint = history.points.find((p) => p.analysisId === analysisId)
  const mediaLabel = isBefore
    ? `${t('analysis.before')} · ${previous ? fmtDate(previous.createdAt) : ''}`
    : currentPoint
      ? `${t('analysis.yourShot')} · ${fmtDate(currentPoint.createdAt)}`
      : t('analysis.yourShot')
  const shotName = history.shotLabel

  const bars = useMemo(() => {
    const pts = history.points.map((p) => (p.analysisId === analysisId && score != null ? { ...p, score } : p))
    return pts.slice(-MAX_BARS)
  }, [history.points, analysisId, score])
  const scored = bars.filter((b) => b.score != null)

  const renderMetricRows = () =>
    rows.length === 0 ? (
      <Text allowFontScaling={false} style={[styles.empty, { fontFamily: theme.regularFont }]}>
        {t('analysis.compareEmpty')}
      </Text>
    ) : (
      <>
        <View style={styles.row}>
          <Text style={styles.rowLabel} />
          <Text
            allowFontScaling={false}
            style={[styles.colHead, isBefore && styles.colHeadOn, { fontFamily: theme.mediumFont }]}
          >
            {t('analysis.before')}
          </Text>
          <View style={styles.arrowGap} />
          <Text
            allowFontScaling={false}
            style={[styles.colHead, !isBefore && styles.colHeadOn, { fontFamily: theme.mediumFont }]}
          >
            {t('analysis.after')}
          </Text>
        </View>
        {rows.map((row) => (
          <View key={row.key} style={styles.row} testID={`pro-compare-row-${row.key}`}>
            <Text allowFontScaling={false} style={[styles.rowLabel, { fontFamily: theme.regularFont }]}>
              {row.label}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.rowVal, isBefore && styles.rowValOn, { fontFamily: theme.semiBoldFont }]}
            >
              {row.before != null ? fmtDeg(row.before) : '—'}
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#86A7D2" style={styles.arrowGap} />
            <Text
              allowFontScaling={false}
              style={[styles.rowVal, !isBefore && styles.rowValOn, { fontFamily: theme.semiBoldFont }]}
            >
              {row.after != null ? fmtDeg(row.after) : '—'}
            </Text>
          </View>
        ))}
      </>
    )

  return (
    <View style={styles.page} testID="pro-compare">
      <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}>
        {t('analysis.saveTrack')}
      </Text>
      <Text allowFontScaling={false} style={[styles.subtitle, { fontFamily: theme.mediumFont }]}>
        {shotName ? `${t('analysis.compareOverTime')} · ${shotName}` : t('analysis.compareOverTime')}
      </Text>

      <View style={styles.segment}>
        {segments.map((item) => {
          const selected = item.id === segment
          return (
            <TouchableOpacity
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              activeOpacity={0.85}
              onPress={() => setSegment(item.id)}
              style={[styles.segmentBtn, selected && styles.segmentBtnOn]}
              testID={`pro-compare-tab-${item.id}`}
            >
              <Text
                allowFontScaling={false}
                style={[
                  styles.segmentLabel,
                  { fontFamily: selected ? theme.semiBoldFont : theme.mediumFont },
                  selected && styles.segmentLabelOn,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {history.loading && segment !== 'after' ? (
        <View style={[styles.compareCard, styles.centered]}>
          <ActivityIndicator color="#3D9DFF" />
        </View>
      ) : segment === 'progress' ? (
        <View style={styles.compareCard} testID="pro-compare-progress">
          {scored.length < 2 ? (
            <Text allowFontScaling={false} style={[styles.empty, { fontFamily: theme.regularFont }]}>
              {shotName
                ? t('analysis.progressEmpty', { shot: shotName })
                : t('analysis.progressEmptyAny')}
            </Text>
          ) : (
            <>
              <Text allowFontScaling={false} style={[styles.chartTitle, { fontFamily: theme.semiBoldFont }]}>
                {t('analysis.progressTitle', { shot: shotName })}
              </Text>
              <View style={styles.chart}>
                {bars.map((b) => {
                  const on = b.analysisId === analysisId
                  return (
                    <View key={b.analysisId} style={styles.barCol}>
                      <Text
                        allowFontScaling={false}
                        style={[styles.barValue, on && styles.barValueOn, { fontFamily: theme.semiBoldFont }]}
                      >
                        {b.score != null ? String(b.score) : '—'}
                      </Text>
                      <View style={styles.barTrack}>
                        <LinearGradient
                          colors={on ? ['#00C2FF', '#2454FF'] : ['#2A5BA8', '#173A78']}
                          style={[styles.bar, { height: `${Math.max(4, b.score ?? 0)}%` }]}
                        />
                      </View>
                      <Text allowFontScaling={false} style={[styles.barDate, { fontFamily: theme.regularFont }]}>
                        {fmtDate(b.createdAt)}
                      </Text>
                    </View>
                  )
                })}
              </View>
              <Text allowFontScaling={false} style={[styles.empty, { fontFamily: theme.mediumFont }]}>
                {t('analysis.progressSummary', {
                  first: history.points.find((p) => p.score != null)?.score ?? scored[0].score,
                  last: scored[scored.length - 1].score,
                  n: history.points.length,
                })}
              </Text>
            </>
          )}
        </View>
      ) : isBefore && !previous ? (
        <View style={styles.compareCard} testID="pro-compare-before-empty">
          <Ionicons name="time-outline" size={28} color="#3D9DFF" style={styles.emptyIcon} />
          <Text allowFontScaling={false} style={[styles.emptyCentered, { fontFamily: theme.regularFont }]}>
            {shotName ? t('analysis.beforeEmpty', { shot: shotName }) : t('analysis.beforeEmptyAny')}
          </Text>
        </View>
      ) : (
        <View style={styles.compareCard} testID={`pro-compare-${segment}`}>
          <View style={styles.mediaRow}>
            <View style={styles.mediaCol}>
              <Text allowFontScaling={false} style={[styles.mediaLabel, { fontFamily: theme.mediumFont }]}>
                {mediaLabel}
              </Text>
              <View style={styles.mediaFrame}>
                {shownVideo ? (
                  <Video
                    key={shownVideo}
                    source={{ uri: shownVideo }}
                    style={styles.media}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={false}
                    isMuted
                    testID="pro-compare-video"
                  />
                ) : (
                  <View style={styles.proEmpty}>
                    <Ionicons name="videocam-off-outline" size={28} color="#3D9DFF" />
                  </View>
                )}
              </View>
            </View>
            <View style={styles.mediaCol}>
              <Text allowFontScaling={false} style={[styles.mediaLabel, { fontFamily: theme.mediumFont }]}>
                {t('analysis.proReference')}
              </Text>
              <View style={[styles.mediaFrame, styles.mediaFramePro]}>
                {proImage ? (
                  <Image source={{ uri: proImage }} style={styles.media} resizeMode="cover" />
                ) : (
                  <View style={styles.proEmpty}>
                    <Ionicons name="body" size={36} color="#3D9DFF" />
                  </View>
                )}
              </View>
            </View>
          </View>
          {renderMetricRows()}
        </View>
      )}

      {segment !== 'progress' && !(isBefore && !previous) ? (
        <View style={styles.scoreCard}>
          <Text allowFontScaling={false} style={[styles.scoreTitle, { fontFamily: theme.semiBoldFont }]}>
            {t('analysis.overallScore')}
          </Text>
          <View style={styles.scoreRight}>
            {scoreDelta != null ? (
              <Text
                allowFontScaling={false}
                style={[
                  styles.scoreDelta,
                  { color: scoreDelta >= 0 ? '#3DDC97' : '#FF6B6B', fontFamily: theme.mediumFont },
                ]}
              >
                {Math.round(scoreDelta) === 0
                  ? t('analysis.sameAsBefore')
                  : `${fmtDelta(scoreDelta)} ${t('analysis.vsBefore')}`}
              </Text>
            ) : null}
            <Text
              allowFontScaling={false}
              style={[styles.scoreValue, { fontFamily: theme.semiBoldFont }]}
              testID="pro-compare-score"
            >
              {shownScore != null ? String(shownScore) : '—'}
            </Text>
          </View>
        </View>
      ) : null}

      <TouchableOpacity accessibilityRole="button" activeOpacity={0.85} onPress={onSave}>
        <LinearGradient
          colors={['#00C2FF', '#2454FF']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.saveBtn}
        >
          <Text allowFontScaling={false} style={[styles.saveText, { fontFamily: theme.semiBoldFont }]}>
            {t('analysis.saveToProgress')}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { alignSelf: 'stretch', paddingHorizontal: 22, gap: 12, paddingBottom: 12 },
  title: { color: '#FFFFFF', fontSize: 22, textAlign: 'center' },
  subtitle: { color: '#3DB7FF', fontSize: 14, textAlign: 'center', marginTop: -8 },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#07183F',
    borderRadius: 999,
    padding: 4,
  },
  segmentBtn: { flex: 1, alignItems: 'center', borderRadius: 999, paddingVertical: 10 },
  segmentBtnOn: { backgroundColor: '#2454FF' },
  segmentLabel: { color: '#C5D4F5', fontSize: 14 },
  segmentLabelOn: { color: '#FFFFFF' },
  compareCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 255, 0.28)',
    backgroundColor: '#071428',
    padding: 12,
    gap: 12,
  },
  mediaRow: { flexDirection: 'row', gap: 10 },
  mediaCol: { flex: 1, gap: 6 },
  mediaLabel: { color: '#C5D4F5', fontSize: 13, textAlign: 'center' },
  mediaFrame: { height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: '#020814' },
  mediaFramePro: { borderWidth: 1.5, borderColor: '#00C8FF' },
  media: { width: '100%', height: '100%' },
  proEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { flex: 1, color: '#C5D4F5', fontSize: 14 },
  colHead: { color: '#5E7BA8', fontSize: 12, minWidth: 52, textAlign: 'right' },
  colHeadOn: { color: '#3DB7FF' },
  rowVal: { color: '#86A7D2', fontSize: 16, minWidth: 52, textAlign: 'right' },
  rowValOn: { color: '#FFFFFF' },
  arrowGap: { width: 16 },
  empty: { color: '#86A7D2', fontSize: 13, lineHeight: 18 },
  emptyCentered: { color: '#C5D4F5', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyIcon: { alignSelf: 'center' },
  centered: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  chartTitle: { color: '#FFFFFF', fontSize: 15 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 170 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barValue: { color: '#86A7D2', fontSize: 12 },
  barValueOn: { color: '#FFFFFF' },
  barTrack: { flex: 1, width: '70%', maxWidth: 28, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6 },
  barDate: { color: '#86A7D2', fontSize: 10 },
  scoreCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 255, 0.28)',
    backgroundColor: '#071428',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreTitle: { color: '#3DDC97', fontSize: 16 },
  scoreRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreDelta: { fontSize: 13 },
  scoreValue: { color: '#FFFFFF', fontSize: 22 },
  saveBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveText: { color: '#FFFFFF', fontSize: 16 },
})
