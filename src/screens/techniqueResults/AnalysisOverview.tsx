import { Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { BackHandler, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg'
import { ThemeContext } from '../../context'
import { TEST_IDS } from '../../lib/testIds'
import {
  PHYSICAL_METRIC_KEYS,
  type PhysicalMetricKey,
  type PhysicalMetricsValues,
} from '../../lib/physicalMetrics'
import {
  computeOverlayJointAngles,
  emaAngle,
  jointArcSvgPath,
  jointLabelOffset,
  type ComputedJointAngle,
} from '../../lib/poseJointAngles'
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

/** Landmark in the video box. Cover crops like the card; contain shows the whole frame, as in fullscreen. */
function fitPx(
  nx: number,
  ny: number,
  boxW: number,
  boxH: number,
  natW: number,
  natH: number,
  fit: 'cover' | 'contain'
) {
  const videoAR = natW / natH
  const boxAR = boxW / boxH
  const wider = videoAR > boxAR
  const scale =
    fit === 'cover'
      ? wider
        ? boxH / natH
        : boxW / natW
      : wider
        ? boxW / natW
        : boxH / natH
  const ox = (boxW - natW * scale) / 2
  const oy = (boxH - natH * scale) / 2
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

/** How often expo-av reports position; the skeleton fills the gaps with a playback clock. */
const STATUS_INTERVAL_MS = 100
/** Seek at most this often while dragging, so the decoder keeps up. */
const SCRUB_SEEK_MS = 80
/** Exact seeks, so the paused picture matches the slider and the skeleton. */
const EXACT_SEEK = { toleranceMillisBefore: 0, toleranceMillisAfter: 0 }

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** Pose dots, bones and angle labels, fitted the same way as the video under them. */
function PoseSvg({
  pose,
  angles,
  width,
  height,
  natural,
  fit,
}: {
  pose: PoseFrameRow
  angles: ComputedJointAngle[]
  width: number
  height: number
  natural: { w: number; h: number }
  fit: 'cover' | 'contain'
}) {
  const pt = (x: number, y: number) => fitPx(x, y, width, height, natural.w, natural.h, fit)
  return (
    <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
      {MEDIAPIPE_POSE_CONNECTIONS.map(([a, b]) => {
        const pa = pose.landmarks[a]
        const pb = pose.landmarks[b]
        if (!pa || !pb) return null
        if ((pa.visibility ?? 1) < 0.35 || (pb.visibility ?? 1) < 0.35) return null
        const A = pt(pa.x, pa.y)
        const B = pt(pb.x, pb.y)
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
        const at = pt(p.x, p.y)
        return <Circle key={name} cx={at.x} cy={at.y} r={3.5} fill="#7AECFF" />
      })}
      {angles.map((j) => {
        const arcR = Math.max(10, Math.min(20, width * 0.035))
        const arc = jointArcSvgPath(j.b, j.a, j.c, arcR)
        const labelAt = jointLabelOffset(j.b, j.a, j.c, arcR + 10)
        return (
          <Fragment key={`ang-${j.id}`}>
            {arc ? <Path d={arc} fill="none" stroke={j.color} strokeWidth={1.6} strokeOpacity={0.9} /> : null}
            <SvgText
              x={labelAt.x}
              y={labelAt.y + 4}
              fill={j.color}
              fontSize={Math.max(10, Math.min(13, width * 0.032))}
              fontWeight="700"
              textAnchor="middle"
            >
              {`${Math.round(j.deg)}°`}
            </SvgText>
          </Fragment>
        )
      })}
      {(() => {
        const box = normBox(pose.racket_bbox)
        if (!box) return null
        const a = pt(box[0], box[1])
        const b = pt(box[2], box[3])
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
        const a = pt(box[0], box[1])
        const b = pt(box[2], box[3])
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
  )
}

/** In-app fullscreen so the pose stays on the picture and Back always returns. */
function AnalysisFullscreen({
  visible,
  uri,
  videoKey,
  startMs,
  poseFrames,
  totalFrames,
  naturalHint,
  onClose,
}: {
  visible: boolean
  uri: string | null
  videoKey: string
  startMs: number
  poseFrames?: PoseFrameRow[]
  totalFrames: number | null
  naturalHint: { w: number; h: number } | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const ref = useRef<Video>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [natural, setNatural] = useState(naturalHint)
  const [position, setPosition] = useState(startMs)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(true)
  const anchor = useRef({ pos: startMs, at: Date.now(), playing: true })

  useEffect(() => {
    if (!visible) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [visible, onClose])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = -1
    const tick = () => {
      const a = anchor.current
      if (a.playing) {
        const est = a.pos + (Date.now() - a.at)
        const frame = Math.floor(est / 33)
        if (frame !== last) {
          last = frame
          setPosition(est)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const pose = useMemo(() => {
    if (!poseFrames?.length || duration <= 0) return null
    const last = poseFrames.reduce((max, row) => Math.max(max, row.frame), 0)
    const total = totalFrames && totalFrames > 1 ? totalFrames : last + 1
    const idx = Math.round((Math.min(position, duration) / duration) * Math.max(0, total - 1))
    return nearestPoseByFrame(poseFrames, idx)
  }, [poseFrames, totalFrames, position, duration])

  const angles = useMemo(() => {
    if (!pose || !natural || box.w <= 0) return []
    const getPx = (name: string) => {
      const p = pose.landmarks[name]
      if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return null
      return fitPx(p.x, p.y, box.w, box.h, natural.w, natural.h, 'contain')
    }
    return computeOverlayJointAngles(getPx, pose.landmarks)
  }, [pose, natural, box])

  function hold(ms: number, play: boolean) {
    const at = duration > 0 ? Math.min(Math.max(0, ms), Math.max(0, duration - 40)) : Math.max(0, ms)
    const restart = play && duration > 0 && at >= duration - 120
    const next = restart ? 0 : at
    anchor.current = { pos: next, at: Date.now(), playing: play }
    setPlaying(play)
    setPosition(next)
    void ref.current?.setStatusAsync({
      shouldPlay: play,
      positionMillis: next,
      seekMillisToleranceBefore: 0,
      seekMillisToleranceAfter: 80,
    })
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait']}>
      <View style={[styles.fullScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.fullBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('analysis.back')}
            onPress={onClose}
            hitSlop={8}
            style={styles.fullBack}
          >
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
            <Text allowFontScaling={false} style={[styles.fullBackLabel, { fontFamily: theme.semiBoldFont }]}>
              {t('analysis.back')}
            </Text>
          </Pressable>
        </View>
        <View
          style={styles.fullStage}
          onLayout={(e) => setBox({ w: Math.floor(e.nativeEvent.layout.width), h: Math.floor(e.nativeEvent.layout.height) })}
        >
          {uri && box.w > 0 ? (
            <Video
              key={`${videoKey}-full`}
              ref={ref}
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.CONTAIN}
              progressUpdateIntervalMillis={STATUS_INTERVAL_MS}
              onReadyForDisplay={(event) => {
                const n = event.naturalSize
                if (n?.width > 0 && n?.height > 0) setNatural({ w: n.width, h: n.height })
              }}
              onLoad={(status) => {
                const length = status.isLoaded ? status.durationMillis ?? 0 : 0
                if (length > 0) setDuration(length)
                const at = Math.min(startMs, Math.max(0, length - 40))
                anchor.current = { pos: at, at: Date.now(), playing: true }
                setPosition(at)
                void ref.current?.setStatusAsync({
                  shouldPlay: true,
                  positionMillis: at,
                  seekMillisToleranceBefore: 0,
                  seekMillisToleranceAfter: 80,
                })
              }}
              onPlaybackStatusUpdate={(status) => {
                if (!status.isLoaded) return
                anchor.current = { pos: status.positionMillis, at: Date.now(), playing: status.isPlaying }
                setPosition(status.positionMillis)
                setDuration(status.durationMillis ?? 0)
                setPlaying(status.isPlaying)
              }}
            />
          ) : null}
          {pose && natural && box.w > 0 ? (
            <PoseSvg pose={pose} angles={angles} width={box.w} height={box.h} natural={natural} fit="contain" />
          ) : null}
        </View>
        <View style={styles.fullControls}>
          <Pressable
            accessibilityRole="button"
            onPress={() => hold(position, !playing)}
            style={styles.play}
          >
            <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#FFFFFF" style={playing ? undefined : styles.playIcon} />
          </Pressable>
          <Text allowFontScaling={false} style={[styles.time, { fontFamily: theme.mediumFont }]}>
            {clock(position)}/{clock(duration)}
          </Text>
        </View>
      </View>
    </Modal>
  )
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
  /** Playback position: the last reported one, advanced by a frame clock while playing. */
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  /** Slider position while the finger is on it; overrides playback. */
  const [scrubMs, setScrubMs] = useState<number | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const anchor = useRef({ pos: 0, at: 0, rate: 1, playing: false })
  const scrub = useRef({ wasPlaying: false, lastSeek: 0 })
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
  const shownMs = scrubMs ?? position
  const playProgress = duration > 0 ? Math.max(0, Math.min(1, shownMs / duration)) : 0
  const frameH = frameW > 0 ? Math.round(frameW * (9 / 16)) : 180
  const pose = useMemo(() => {
    if (!poseFrames?.length || duration <= 0) return null
    const last = poseFrames.reduce((max, row) => Math.max(max, row.frame), 0)
    const total = totalFrames && totalFrames > 1 ? totalFrames : last + 1
    const idx = Math.round((shownMs / duration) * Math.max(0, total - 1))
    return nearestPoseByFrame(poseFrames, idx)
  }, [poseFrames, totalFrames, shownMs, duration])
  const angleEmaRef = useRef<Record<string, number>>({})
  const [jointAngles, setJointAngles] = useState<ComputedJointAngle[]>([])

  useEffect(() => {
    if (!pose || !natural || frameW <= 0) {
      setJointAngles([])
      return
    }
    const getPx = (name: string) => {
      const p = pose.landmarks[name]
      if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return null
      return fitPx(p.x, p.y, frameW, frameH, natural.w, natural.h, 'cover')
    }
    const raw = computeOverlayJointAngles(getPx, pose.landmarks)
    setJointAngles(
      raw.map((j) => {
        const smoothed = emaAngle(angleEmaRef.current[j.id], j.deg)
        if (smoothed != null) angleEmaRef.current[j.id] = smoothed
        return { ...j, deg: smoothed ?? j.deg }
      })
    )
  }, [pose, natural, frameW, frameH])

  function onStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return
    anchor.current = {
      pos: status.positionMillis,
      at: Date.now(),
      rate: status.rate ?? 1,
      playing: status.isPlaying,
    }
    setPosition(status.positionMillis)
    setDuration(status.durationMillis ?? 0)
    setPlaying(status.isPlaying)
  }

  // Status only arrives every STATUS_INTERVAL_MS; between reports, advance the position with a
  // clock so the skeleton moves with the picture instead of jumping behind it.
  useEffect(() => {
    if (!playing || scrubMs != null) return
    let raf = 0
    let lastFrame = -1
    const tick = () => {
      const a = anchor.current
      if (a.playing) {
        const est = Math.min(duration || Infinity, a.pos + (Date.now() - a.at) * a.rate)
        // Re-render once per ~30 fps video frame, not every display refresh.
        const frame = Math.floor(est / 33)
        if (frame !== lastFrame) {
          lastFrame = frame
          setPosition(est)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, scrubMs, duration])

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    // The frame clock can run a little past the clip. Seeking there makes the next play do nothing.
    const at = duration > 0 ? Math.min(Math.max(0, position), Math.max(0, duration - 40)) : Math.max(0, position)
    const restart = duration > 0 && at >= duration - 120
    const next = restart ? 0 : at
    anchor.current = { ...anchor.current, playing: !playing, pos: next, at: Date.now() }
    setPlaying(!playing)
    setPosition(next)
    void video.setStatusAsync({
      shouldPlay: !playing,
      positionMillis: next,
      seekMillisToleranceBefore: 0,
      seekMillisToleranceAfter: 80,
    })
  }

  const msAt = useCallback(
    (x: number) => (duration > 0 && trackW > 0 ? Math.max(0, Math.min(1, x / trackW)) * duration : 0),
    [duration, trackW]
  )

  const scrubStart = useCallback(
    (x: number) => {
      scrub.current = { wasPlaying: anchor.current.playing, lastSeek: 0 }
      onScrubbingChange?.(true)
      if (anchor.current.playing) void videoRef.current?.pauseAsync()
      setScrubMs(msAt(x))
    },
    [msAt, onScrubbingChange]
  )

  const scrubMove = useCallback(
    (x: number) => {
      const ms = msAt(x)
      setScrubMs(ms)
      const now = Date.now()
      if (now - scrub.current.lastSeek >= SCRUB_SEEK_MS) {
        scrub.current.lastSeek = now
        void videoRef.current?.setPositionAsync(ms, EXACT_SEEK)
      }
    },
    [msAt]
  )

  const scrubEnd = useCallback(
    (x: number) => {
      const ms = msAt(x)
      const video = videoRef.current
      onScrubbingChange?.(false)
      setPosition(ms)
      anchor.current = { ...anchor.current, pos: ms, at: Date.now() }
      void (async () => {
        try {
          await video?.setPositionAsync(ms, EXACT_SEEK)
          if (scrub.current.wasPlaying) await video?.playAsync()
        } finally {
          setScrubMs(null)
        }
      })()
    },
    [msAt, onScrubbingChange]
  )

  // Tap or drag anywhere on the track. Coordinates are relative to the whole track, not to the
  // fill or thumb under the finger.
  const trackGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-4, 4])
      .failOffsetY([-14, 14])
      .onStart((e) => scrubStart(e.x))
      .onUpdate((e) => scrubMove(e.x))
      .onEnd((e) => scrubEnd(e.x))
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd((e, success) => {
        if (!success) return
        scrubStart(e.x)
        scrubEnd(e.x)
      })
    return Gesture.Exclusive(pan, tap)
  }, [scrubStart, scrubMove, scrubEnd])

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
                progressUpdateIntervalMillis={STATUS_INTERVAL_MS}
                onReadyForDisplay={(event) => {
                  const n = event.naturalSize
                  if (n?.width > 0 && n?.height > 0) setNatural({ w: n.width, h: n.height })
                }}
              />
            ) : (
              <View style={{ width: '100%', height: frameH, backgroundColor: '#000' }} />
            )}
            {pose && natural && frameW > 0 ? (
              <PoseSvg pose={pose} angles={jointAngles} width={frameW} height={frameH} natural={natural} fit="cover" />
            ) : null}
            <Pressable
              style={styles.fullscreen}
              onPress={() => setFullscreen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('analysis.fullscreen')}
            >
              <Ionicons name="scan-outline" size={16} color="#FFFFFF" />
            </Pressable>
            <View style={styles.controls}>
              <Pressable style={styles.play} onPress={togglePlay} accessibilityRole="button" testID="analysis-video-play">
                <Ionicons name={playing ? 'pause' : 'play'} size={16} color="#FFFFFF" style={playing ? undefined : styles.playIcon} />
              </Pressable>
              <GestureDetector gesture={trackGesture}>
              <View
                style={styles.trackHit}
                onLayout={(event) => setTrackW(event.nativeEvent.layout.width)}
                accessibilityRole="adjustable"
                testID="analysis-video-track"
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
              </View>
              </GestureDetector>
              <Text allowFontScaling={false} style={[styles.time, { fontFamily: theme.mediumFont }]}>
                {clock(shownMs)}/{clock(duration)}
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
    <AnalysisFullscreen
      visible={fullscreen}
      uri={videoUri}
      videoKey={videoKey}
      startMs={shownMs}
      poseFrames={poseFrames}
      totalFrames={totalFrames ?? null}
      naturalHint={natural}
      onClose={() => setFullscreen(false)}
    />
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
    zIndex: 6,
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
    zIndex: 5,
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
  fullScreen: { flex: 1, backgroundColor: '#000' },
  fullBar: { height: 52, justifyContent: 'center', paddingHorizontal: 8 },
  fullBack: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 16 },
  fullBackLabel: { color: '#FFFFFF', fontSize: 17 },
  fullStage: { flex: 1, backgroundColor: '#000' },
  fullControls: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
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
