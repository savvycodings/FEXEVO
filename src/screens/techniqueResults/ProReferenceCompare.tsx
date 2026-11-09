import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av'
import { ThemeContext } from '../../context'
import { useContactJoints } from '../../lib/jointsApi'
import { type CompareMetric, buildCompareMetrics, mergeCompareMetrics, useShotHistory } from './shotHistory'
import { ResultSectionPill } from '../../components/ResultSectionPill'
import { PrimaryFill, UI } from '../../components/ui'

type Segment = 'before' | 'after' | 'progress'

type Props = {
  videoUri: string
  analysisId?: string | null
  /** Matched pro-library clip (physical video), not the hologram still. */
  proVideoUri: string | null
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
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Compact clip with a reliable play / pause control (pause then play again works). */
function PlayableClip({
  uri,
  testID,
  accent,
}: {
  uri: string | null
  testID: string
  accent: string
}) {
  const { theme } = useContext(ThemeContext)
  const videoRef = useRef<Video>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)
  const playable = uri && !failed ? uri : null

  useEffect(() => {
    setPlaying(false)
    setPosition(0)
    setDuration(0)
    setFailed(false)
  }, [uri])

  function onStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) {
      if (status.error) setFailed(true)
      return
    }
    setPosition(status.positionMillis)
    setDuration(status.durationMillis ?? 0)
    setPlaying(status.isPlaying)
    if (status.didJustFinish) {
      setPlaying(false)
      void videoRef.current?.setPositionAsync(0)
    }
  }

  async function togglePlay() {
    const ref = videoRef.current
    if (!ref || !playable) return
    try {
      const status = await ref.getStatusAsync()
      if (!status.isLoaded) {
        await ref.playAsync()
        return
      }
      if (status.isPlaying) {
        await ref.pauseAsync()
      } else {
        // At end of clip, rewind so play works again.
        if (status.durationMillis && status.positionMillis >= status.durationMillis - 80) {
          await ref.setPositionAsync(0)
        }
        await ref.playAsync()
      }
    } catch {
      // Ignore transient AV race; next tap retries.
    }
  }

  return (
    <View style={[styles.mediaFrame, { borderColor: accent }]} testID={testID}>
      {playable ? (
        <Video
          key={playable}
          ref={videoRef}
          source={{ uri: playable }}
          style={styles.media}
          resizeMode={ResizeMode.COVER}
          isMuted
          shouldPlay={false}
          useNativeControls={false}
          onPlaybackStatusUpdate={onStatus}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.proEmpty}>
          <Ionicons name="videocam-off-outline" size={28} color="#3D9DFF" />
        </View>
      )}
      {playable ? (
        <LinearGradient
          pointerEvents="box-none"
          colors={['rgba(20, 60, 200, 0)', 'rgba(8, 24, 58, 0.92)']}
          locations={[0, 0.55]}
          style={styles.clipControls}
        >
          <Pressable
            style={styles.play}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause' : 'Play'}
            hitSlop={8}
            onPress={() => void togglePlay()}
            testID={`${testID}-play`}
          >
            <Ionicons
              name={playing ? 'pause' : 'play'}
              size={18}
              color={UI.text}
              style={playing ? undefined : styles.playIcon}
            />
          </Pressable>
          <Text allowFontScaling={false} style={[styles.time, { fontFamily: theme.mediumFont }]}>
            {clock(position)}/{clock(duration)}
          </Text>
        </LinearGradient>
      ) : null}
    </View>
  )
}

/**
 * Over time for this shot type: Before is the previous analysis of the same shot, After is this
 * one, Progress is the score trend. The pro column plays the matched library video.
 */
export function ProReferenceCompare({ videoUri, analysisId, proVideoUri, metrics, score, onSave }: Props) {
  const { t, i18n } = useTranslation()
  const contact = useContactJoints(analysisId)
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
      return { key, label: (after ?? before)!.label, before: before?.deg ?? null, after: after?.deg ?? null }
    })
  }, [prevMetrics, afterMetrics])

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

      <ResultSectionPill
        tabs={segments.map((item) => ({ ...item, testID: `pro-compare-tab-${item.id}` }))}
        value={segment}
        onChange={setSegment}
      />

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
          <Ionicons name="sparkles-outline" size={28} color="#3D9DFF" style={styles.emptyIcon} />
          <Text allowFontScaling={false} style={[styles.emptyCentered, { fontFamily: theme.semiBoldFont }]}>
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
              <PlayableClip uri={shownVideo} testID="pro-compare-video" accent="rgba(0, 184, 255, 0.35)" />
            </View>
            <View style={styles.mediaCol}>
              <Text allowFontScaling={false} style={[styles.mediaLabel, { fontFamily: theme.mediumFont }]}>
                {t('analysis.proReference')}
              </Text>
              <PlayableClip uri={proVideoUri} testID="pro-compare-pro-video" accent="#00C8FF" />
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
        <View style={styles.saveBtn}>
          <PrimaryFill radius={UI.btnRadius} />
          <Text allowFontScaling={false} style={[styles.saveText, { fontFamily: theme.semiBoldFont }]}>
            {t('analysis.saveToProgress')}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={UI.btnPrimaryText} />
        </View>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  /** No extra side pad — parent screens already inset; extra pad made Save & Track look cramped. */
  page: { alignSelf: 'stretch', paddingHorizontal: 0, gap: 12, paddingBottom: 12 },
  title: { color: '#FFFFFF', fontSize: 22, textAlign: 'center' },
  subtitle: { color: '#3DB7FF', fontSize: 14, textAlign: 'center', marginTop: -8 },
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
  mediaFrame: {
    height: 168,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#020814',
    borderWidth: 1.5,
  },
  media: { width: '100%', height: '100%' },
  proEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  clipControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingTop: 28,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: UI.text,
  },
  playIcon: { marginLeft: 2 },
  time: { color: UI.text, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { flex: 1, color: '#C5D4F5', fontSize: 14 },
  colHead: { color: '#5E7BA8', fontSize: 12, minWidth: 52, textAlign: 'right' },
  colHeadOn: { color: '#3DB7FF' },
  rowVal: { color: '#86A7D2', fontSize: 16, minWidth: 52, textAlign: 'right' },
  rowValOn: { color: '#FFFFFF' },
  arrowGap: { width: 16 },
  empty: { color: '#86A7D2', fontSize: 13, lineHeight: 18 },
  emptyCentered: { color: '#C5D4F5', fontSize: 15, lineHeight: 22, textAlign: 'center' },
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
    height: UI.buttonHeight,
    borderRadius: UI.btnRadius,
    overflow: 'hidden',
    paddingHorizontal: UI.btnPaddingX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  saveText: { color: UI.btnPrimaryText, fontSize: 18 },
})
