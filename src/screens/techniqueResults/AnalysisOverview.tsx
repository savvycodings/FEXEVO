import { useContext, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av'
import Svg, { Circle, Defs, G, Line, Rect, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg'
import { ThemeContext } from '../../context'
import { TEST_IDS } from '../../lib/testIds'
import {
  PHYSICAL_METRIC_KEYS,
  type PhysicalMetricKey,
  type PhysicalMetricsValues,
} from '../../lib/physicalMetrics'
import {
  MEDIAPIPE_POSE_CONNECTIONS,
  nearestPoseByFrame,
  poseSegmentColor,
  type PoseFrameRow,
} from '../../lib/techniquePose'

type Detail = 'overview' | 'mistakes' | 'pose'

type Props = {
  videoUri: string | null
  videoKey: string
  poseFrames?: PoseFrameRow[]
  totalFrames?: number | null
  score: number | null
  rating: string | null
  summary: string | null
  metrics: PhysicalMetricsValues | null
  detail: Detail
  onBiggestMistakes: () => void
  onSmart3d: () => void
  onScrubbingChange?: (scrubbing: boolean) => void
}

const RING = 120
const RING_STROKE = 8
const GLOW = 8
/** Radius stays inside the svg once the glow stroke is added, so the dial is not clipped. */
const RING_R = RING / 2 - RING_STROKE / 2 - GLOW - 2
const RING_C = 2 * Math.PI * RING_R

const JOINT_DOTS = [
  'LEFT_SHOULDER',
  'RIGHT_SHOULDER',
  'LEFT_ELBOW',
  'RIGHT_ELBOW',
  'LEFT_WRIST',
  'RIGHT_WRIST',
  'LEFT_HIP',
  'RIGHT_HIP',
  'LEFT_KNEE',
  'RIGHT_KNEE',
  'LEFT_ANKLE',
  'RIGHT_ANKLE',
]

function coverPx(nx: number, ny: number, boxW: number, boxH: number, natW: number, natH: number) {
  const videoAR = natW / natH
  const boxAR = boxW / boxH
  const scale = videoAR > boxAR ? boxH / natH : boxW / natW
  const ox = videoAR > boxAR ? (boxW - natW * scale) / 2 : 0
  const oy = videoAR > boxAR ? 0 : (boxH - natH * scale) / 2
  return { x: nx * natW * scale + ox, y: ny * natH * scale + oy }
}

function normBox(b: number[] | null | undefined): [number, number, number, number] | null {
  if (!b || b.length !== 4) return null
  const max = Math.max(b[0] ?? 0, b[1] ?? 0, b[2] ?? 0, b[3] ?? 0)
  const scale = max > 1.5 ? 10000 : 1
  const x1 = (b[0] ?? 0) / scale
  const y1 = (b[1] ?? 0) / scale
  const x2 = (b[2] ?? 0) / scale
  const y2 = (b[3] ?? 0) / scale
  if (![x1, y1, x2, y2].every((n) => Number.isFinite(n)) || x2 <= x1 || y2 <= y1) return null
  return [x1, y1, x2, y2]
}

const METRIC_ICON: Record<PhysicalMetricKey, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  stability: { icon: 'cube-outline', color: '#3D7CFF' },
  power: { icon: 'flash', color: '#FFD400' },
  agility: { icon: 'flame', color: '#FF8A00' },
  reactions: { icon: 'aperture', color: '#7B61FF' },
  acceleration: { icon: 'walk', color: '#FF4D6A' },
}

function ratingTone(rating: string | null, score: number | null) {
  if (rating === 'excellent' || rating === 'good' || rating === 'needs_improvement' || rating === 'poor') {
    return rating
  }
  if (score == null) return null
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 30) return 'needs_improvement'
  return 'poor'
}

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function AnalysisOverview({
  videoUri,
  videoKey,
  poseFrames,
  totalFrames,
  score,
  rating,
  summary,
  metrics,
  detail,
  onBiggestMistakes,
  onSmart3d,
  onScrubbingChange,
}: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const videoRef = useRef<Video>(null)
  const [frameW, setFrameW] = useState(0)
  const [trackW, setTrackW] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
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
  const progress = score == null ? 0 : Math.max(0, Math.min(1, score / 100))
  const playProgress = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0
  const frameH = frameW > 0 ? Math.round(frameW * (9 / 16)) : 180
  const pose = useMemo(() => {
    if (!poseFrames?.length || duration <= 0) return null
    const last = poseFrames.reduce((max, row) => Math.max(max, row.frame), 0)
    const total = totalFrames && totalFrames > 1 ? totalFrames : last + 1
    const idx = Math.round((position / duration) * Math.max(0, total - 1))
    return nearestPoseByFrame(poseFrames, idx)
  }, [poseFrames, totalFrames, position, duration])

  function onStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return
    setPosition(status.positionMillis)
    setDuration(status.durationMillis ?? 0)
    setPlaying(status.isPlaying)
  }

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (playing) void video.pauseAsync()
    else void video.playAsync()
  }

  function seekAt(locationX: number, width: number) {
    if (duration <= 0 || width <= 0) return
    const next = Math.max(0, Math.min(1, locationX / width)) * duration
    void videoRef.current?.setPositionAsync(next)
  }

  return (
    <View style={styles.page}>
      <View style={styles.frameGlow}>
        <LinearGradient
          colors={['#7AECFF', '#2F6BFF', '#49D6FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.frameBorder}
        >
          <View
            style={styles.frame}
            onLayout={(event) => {
              const next = Math.floor(event.nativeEvent.layout.width)
              setFrameW((prev) => (prev === next ? prev : next))
            }}
          >
            {videoUri && frameW > 0 ? (
              <Video
                key={videoKey}
                ref={videoRef}
                source={{ uri: videoUri }}
                style={{ width: frameW, height: frameH }}
                resizeMode={ResizeMode.COVER}
                onPlaybackStatusUpdate={onStatus}
                onReadyForDisplay={(event) => {
                  const n = event.naturalSize
                  if (n?.width > 0 && n?.height > 0) setNatural({ w: n.width, h: n.height })
                }}
              />
            ) : (
              <View style={{ width: '100%', height: frameH, backgroundColor: '#000' }} />
            )}
            {pose && natural && frameW > 0 ? (
              <Svg pointerEvents="none" width={frameW} height={frameH} style={StyleSheet.absoluteFill}>
                {MEDIAPIPE_POSE_CONNECTIONS.map(([a, b]) => {
                  const pa = pose.landmarks[a]
                  const pb = pose.landmarks[b]
                  if (!pa || !pb) return null
                  if ((pa.visibility ?? 1) < 0.35 || (pb.visibility ?? 1) < 0.35) return null
                  const A = coverPx(pa.x, pa.y, frameW, frameH, natural.w, natural.h)
                  const B = coverPx(pb.x, pb.y, frameW, frameH, natural.w, natural.h)
                  return (
                    <Line
                      key={`${a}-${b}`}
                      x1={A.x}
                      y1={A.y}
                      x2={B.x}
                      y2={B.y}
                      stroke={poseSegmentColor(a, b, '#3DDC97', '#FF4D8D')}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                  )
                })}
                {JOINT_DOTS.map((name) => {
                  const p = pose.landmarks[name]
                  if (!p || (p.visibility ?? 1) < 0.35) return null
                  const pt = coverPx(p.x, p.y, frameW, frameH, natural.w, natural.h)
                  return <Circle key={name} cx={pt.x} cy={pt.y} r={3.5} fill="#7AECFF" />
                })}
                {(() => {
                  const box = normBox(pose.racket_bbox)
                  if (!box) return null
                  const a = coverPx(box[0], box[1], frameW, frameH, natural.w, natural.h)
                  const b = coverPx(box[2], box[3], frameW, frameH, natural.w, natural.h)
                  return (
                    <Rect
                      x={Math.min(a.x, b.x)}
                      y={Math.min(a.y, b.y)}
                      width={Math.abs(b.x - a.x)}
                      height={Math.abs(b.y - a.y)}
                      stroke="#FFE14A"
                      strokeWidth={2}
                      fill="transparent"
                    />
                  )
                })()}
                {(() => {
                  const box = normBox(pose.ball_bbox)
                  if (!box) return null
                  const a = coverPx(box[0], box[1], frameW, frameH, natural.w, natural.h)
                  const b = coverPx(box[2], box[3], frameW, frameH, natural.w, natural.h)
                  return (
                    <Rect
                      x={Math.min(a.x, b.x)}
                      y={Math.min(a.y, b.y)}
                      width={Math.abs(b.x - a.x)}
                      height={Math.abs(b.y - a.y)}
                      stroke="#FF8A00"
                      strokeWidth={2}
                      fill="rgba(255,138,0,0.25)"
                    />
                  )
                })()}
              </Svg>
            ) : null}
            <Pressable
              style={styles.fullscreen}
              onPress={() => void videoRef.current?.presentFullscreenPlayer()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('analysis.fullscreen')}
            >
              <Ionicons name="scan-outline" size={16} color="#FFFFFF" />
            </Pressable>
            <View style={styles.controls}>
              <Pressable style={styles.play} onPress={togglePlay} accessibilityRole="button">
                <Ionicons name={playing ? 'pause' : 'play'} size={16} color="#FFFFFF" style={playing ? undefined : styles.playIcon} />
              </Pressable>
              <Pressable
                style={styles.trackHit}
                onLayout={(event) => setTrackW(event.nativeEvent.layout.width)}
                onPressIn={() => onScrubbingChange?.(true)}
                onPressOut={() => onScrubbingChange?.(false)}
                onPress={(event) => seekAt(event.nativeEvent.locationX, trackW)}
              >
                <View style={styles.track}>
                  <LinearGradient
                    colors={['#7AECFF', '#3D7CFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.trackFill, { width: `${playProgress * 100}%` }]}
                  />
                  <View style={[styles.thumb, { left: `${playProgress * 100}%` }]} />
                </View>
              </Pressable>
              <Text allowFontScaling={false} style={[styles.time, { fontFamily: theme.mediumFont }]}>
                {clock(position)}/{clock(duration)}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.scoreRow}>
        <View style={styles.ringWrap}>
          <Svg width={RING} height={RING}>
            <Defs>
              <SvgLinearGradient id="analysisScore" x1="0" y1="0" x2="1" y2="1">
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
                stroke="url(#analysisScore)"
                strokeWidth={RING_STROKE + 8}
                strokeOpacity={0.28}
                strokeLinecap="round"
                strokeDasharray={`${RING_C} ${RING_C}`}
                strokeDashoffset={RING_C * (1 - progress)}
                fill="transparent"
              />
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={RING_R}
                stroke="url(#analysisScore)"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${RING_C} ${RING_C}`}
                strokeDashoffset={RING_C * (1 - progress)}
                fill="transparent"
              />
            </G>
          </Svg>
          <View style={styles.ringCenter} pointerEvents="none">
            <Text
              allowFontScaling={false}
              testID={TEST_IDS.techniqueScore}
              style={[styles.scoreNum, { fontFamily: theme.semiBoldFont }]}
            >
              {score ?? '—'}
            </Text>
            <Text allowFontScaling={false} style={[styles.scoreDenom, { fontFamily: theme.mediumFont }]}>
              /100
            </Text>
          </View>
        </View>
        <View style={styles.scoreCopy}>
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

      <View style={styles.metricRow}>
        {PHYSICAL_METRIC_KEYS.map((key) => {
          const spec = METRIC_ICON[key]
          const value = metrics?.[key]
          return (
            <LinearGradient
              key={key}
              colors={['rgba(90, 190, 255, 0.85)', 'rgba(18, 70, 160, 0.35)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.metricBorder}
            >
              <View style={styles.metric}>
                <Ionicons name={spec.icon} size={18} color={spec.color} />
                <Text allowFontScaling={false} style={[styles.metricValue, { fontFamily: theme.semiBoldFont }]}>
                  {value ?? '—'}
                </Text>
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.metricLabel, { fontFamily: theme.regularFont }]}>
                  {t(`technique.physicalMetric${key[0]!.toUpperCase()}${key.slice(1)}`)}
                </Text>
              </View>
            </LinearGradient>
          )
        })}
      </View>

      <Pressable
        onPress={onBiggestMistakes}
        accessibilityRole="button"
        style={styles.primaryGlow}
        testID="overview-biggest-mistakes"
      >
        <LinearGradient
          colors={detail === 'mistakes' ? ['#1A8CFF', '#1236C8'] : ['#3EC8FF', '#2454FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.primaryBtn}
        >
          <Text allowFontScaling={false} style={[styles.primaryLabel, { fontFamily: theme.semiBoldFont }]}>
            {t('analysis.viewBiggestMistakes')}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>

      <Pressable onPress={onSmart3d} accessibilityRole="button" style={styles.secondaryGlow}>
        <LinearGradient
          colors={detail === 'pose' ? ['#7AECFF', '#2454FF'] : ['#3EC8FF', '#1A4FA8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.secondaryBorder}
        >
          <View style={[styles.secondaryBtn, detail === 'pose' && styles.secondaryBtnOn]}>
            <Ionicons name="cube-outline" size={18} color="#3EC8FF" />
            <Text allowFontScaling={false} style={[styles.secondaryLabel, { fontFamily: theme.semiBoldFont }]}>
              {t('analysis.smart3d')}
            </Text>
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { alignSelf: 'stretch', gap: 16 },
  frameGlow: {
    alignSelf: 'stretch',
    borderRadius: 22,
    padding: 3,
    backgroundColor: 'rgba(0, 184, 255, 0.22)',
    shadowColor: '#00C2FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 16,
    elevation: 12,
  },
  frameBorder: {
    borderRadius: 19,
    padding: 2,
  },
  frame: {
    alignSelf: 'stretch',
    borderRadius: 17,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  fullscreen: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4, 16, 40, 0.55)',
    borderWidth: 1.5,
    borderColor: '#3EC8FF',
  },
  controls: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6, 16, 40, 0.72)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  playIcon: { marginLeft: 2 },
  trackHit: { flex: 1, justifyContent: 'center', height: 28 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(8, 24, 58, 0.72)',
    justifyContent: 'center',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  time: { color: '#FFFFFF', fontSize: 12, minWidth: 68, textAlign: 'right' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ringWrap: { width: RING, height: RING },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNum: { color: '#FFFFFF', fontSize: 28, lineHeight: 30 },
  scoreDenom: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: -2 },
  scoreCopy: { flex: 1, gap: 4 },
  tone: { fontSize: 18 },
  summary: { color: 'rgba(231,242,255,0.78)', fontSize: 14, lineHeight: 20 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  metricBorder: {
    flex: 1,
    borderRadius: 16,
    padding: 1,
  },
  metric: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 84,
    borderRadius: 15,
    backgroundColor: '#071428',
    paddingHorizontal: 2,
    paddingVertical: 8,
  },
  metricValue: { color: '#FFFFFF', fontSize: 18 },
  metricLabel: { color: '#D5E4FF', fontSize: 9, textAlign: 'center' },
  primaryGlow: {
    borderRadius: 16,
    shadowColor: '#2F7BFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 10,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryLabel: { color: '#FFFFFF', fontSize: 16 },
  secondaryGlow: {
    borderRadius: 16,
    shadowColor: '#00C2FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  secondaryBorder: {
    borderRadius: 16,
    padding: 1.5,
  },
  secondaryBtn: {
    height: 50,
    borderRadius: 14.5,
    backgroundColor: '#04122C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnOn: { backgroundColor: '#0A2458' },
  secondaryLabel: { color: '#FFFFFF', fontSize: 16 },
})
