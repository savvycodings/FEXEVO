import { Fragment, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  BackHandler,
  Image,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { Audio, InterruptionModeIOS, ResizeMode, Video, type AVPlaybackStatus } from 'expo-av'
import { File, Paths } from 'expo-file-system'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import Svg, { Circle, Line } from 'react-native-svg'
import { ThemeContext } from '../../context'
import { ResultSectionPill } from '../../components/ResultSectionPill'
import { useHologram, type HologramKeypoints, type HologramOrbitFrame } from '../../lib/hologramJob'
import { useContactJoints, type ContactJoint, type JointReading } from '../../lib/jointsApi'
import { SELECTED_GLOW, UI } from '../../components/ui'
import { kineticChainTiming } from '../../lib/kineticChain'
import { poseAngle } from '../../lib/poseJointAngles'
import { nearestPoseByFrame, type PoseFrameRow } from '../../lib/techniquePose'
import { JointDetailView } from './JointDetailView'
import { JOINT_ICON, type BodyPartId } from './jointIcons'
import { dominantSide } from './movementTimeline'

type Layer = 'player' | 'pro' | 'overlay'
type BodyPart = BodyPartId

type Props = {
  /** Saved analysis whose ball-contact hologram replaces the stock figure once it is built. */
  analysisId?: string | null
  /** The player's pose, contact frame and fps, for the kinetic chain timing. */
  poseFrames?: PoseFrameRow[]
  impactFrame?: number | null
  fps?: number | null
  onClose: () => void
}

/** Body parts that open a joint close-up, and the joint they measure. */
const DETAIL_JOINT: Partial<Record<BodyPart, ContactJoint>> = {
  shoulder: 'shoulder',
  elbow: 'elbow',
  wrist: 'wrist',
  torso: 'torso',
  knee: 'knee',
  racket: 'wrist',
}

/** The "Select a body part" grid, row by row, as in the Smart View 3D design. */
const PART_ROWS: { id: BodyPart; key: string }[][] = [
  [
    { id: 'head', key: 'analysis.smart3dHead' },
    { id: 'shoulder', key: 'analysis.smart3dShoulder' },
    { id: 'elbow', key: 'analysis.smart3dElbow' },
  ],
  [
    { id: 'wrist', key: 'analysis.smart3dWrist' },
    { id: 'torso', key: 'analysis.smart3dTorso' },
    { id: 'knee', key: 'analysis.smart3dKnee' },
  ],
  [
    { id: 'feet', key: 'analysis.smart3dFeet' },
    { id: 'racket', key: 'analysis.smart3dRacket' },
  ],
]

/** Markers always drawn on the hologram, as in the design. */
const BASE_MARKERS = [
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_knee',
  'right_knee',
]
const LIMBS: [string, string][] = [
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
]

/** Keypoints that light up for each body part; the racket follows the hitting wrist. */
function partKeypoints(part: BodyPart, side: 'LEFT' | 'RIGHT'): string[] {
  switch (part) {
    case 'head':
      return ['nose']
    case 'torso':
      return ['neck', 'left_hip', 'right_hip']
    case 'feet':
      return ['left_ankle', 'right_ankle']
    case 'racket':
      return [side === 'LEFT' ? 'left_wrist' : 'right_wrist']
    default:
      return [`left_${part}`, `right_${part}`]
  }
}

/** MediaPipe frame closest to the scrub position (index is 0..frameCount-1). */
function orbitKeypointsAt(
  frames: HologramOrbitFrame[] | null,
  index: number,
  frameCount: number
): HologramKeypoints | null {
  if (!frames?.length) return null
  const last = Math.max(frameCount - 1, 1)
  const target =
    frames.length === 1
      ? frames[0].frame
      : frames[0].frame + (index / last) * (frames[frames.length - 1].frame - frames[0].frame)
  let best = frames[0]
  let dist = Math.abs(best.frame - target)
  for (const row of frames) {
    const d = Math.abs(row.frame - target)
    if (d < dist) {
      best = row
      dist = d
    }
  }
  return best.keypoints
}

/**
 * The orbit file is the square hologram still with black bars above and below.
 * Layout is clipped by the stage — only the square band is visible.
 */
function orbitPlacement(stageW: number, stageH: number, videoW: number, videoH: number) {
  const side = Math.min(videoW, videoH)
  const scale = Math.max(stageW / side, stageH / side)
  const w = videoW * scale
  const h = videoH * scale
  const contentX = ((videoW - side) / 2) * scale
  const contentY = ((videoH - side) / 2) * scale
  return {
    x: (stageW - side * scale) / 2 - contentX,
    y: (stageH - side * scale) / 2 - contentY,
    w,
    h,
  }
}

/** Joint markers. 0..1 follows the orbit frame, including the part that hangs outside the card. */
function JointMarkers({
  keypoints,
  w,
  h,
  lit,
  video,
}: {
  keypoints: HologramKeypoints
  w: number
  h: number
  lit: string[]
  video: { x: number; y: number; w: number; h: number } | null
}) {
  const at = (name: string) => {
    const p = keypoints[name]
    if (!p) return null
    if (!video) {
      // Match Image resizeMode="contain" for the square hologram still.
      const d = Math.min(w, h)
      return { x: (w - d) / 2 + p.x * d, y: (h - d) / 2 + p.y * d }
    }
    return { x: video.x + p.x * video.w, y: video.y + p.y * video.h }
  }
  const names = [...BASE_MARKERS, ...lit.filter((name) => !BASE_MARKERS.includes(name))]
  return (
    <Svg width={w} height={h} style={styles.markersLayer} pointerEvents="none">
      {LIMBS.map(([a, b]) => {
        const A = at(a)
        const B = at(b)
        return A && B ? (
          <Line key={`${a}-${b}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#FFA53D" strokeWidth={3} strokeOpacity={0.8} />
        ) : null
      })}
      {names.map((name) => {
        const P = at(name)
        if (!P) return null
        const on = lit.includes(name)
        return (
          <Fragment key={name}>
            <Circle cx={P.x} cy={P.y} r={on ? 18 : 12} fill="#FF8A3D" fillOpacity={on ? 0.4 : 0.28} />
            <Circle cx={P.x} cy={P.y} r={on ? 9 : 6} fill="#FFC23D" stroke="#FFF4D6" strokeWidth={2} />
          </Fragment>
        )
      })}
    </Svg>
  )
}

/** Stock figure shown until the shot's own hologram is built. */
const BODY = require('../../../assets/smart3d/body.webp')

export function Smart3DView({ analysisId, poseFrames, impactFrame = null, fps = null, onClose }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const [layer, setLayer] = useState<Layer>('player')
  const [selected, setSelected] = useState<BodyPart | null>(null)
  const hologram = useHologram(analysisId)
  const contactJoints = useContactJoints(analysisId)
  const [detail, setDetail] = useState<ContactJoint | null>(null)
  const timing = useMemo(
    () => (poseFrames?.length ? kineticChainTiming(poseFrames, impactFrame, fps, dominantSide(poseFrames)) : null),
    [poseFrames, impactFrame, fps]
  )
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })
  const videoRef = useRef<Video>(null)
  const [orbitIndex, setOrbitIndex] = useState(0)
  const [playbackUri, setPlaybackUri] = useState<string | null>(null)
  const [orbitReady, setOrbitReady] = useState(false)
  const [orbitVideoError, setOrbitVideoError] = useState<string | null>(null)
  const [orbitUrlHttp, setOrbitUrlHttp] = useState<number | null>(null)
  const orbitIndexRef = useRef(0)
  /** One short iOS prime play, then scrub-only (must stay paused). */
  const iosPrimeDone = useRef(false)
  const grantIndex = useRef(0)
  const stageWRef = useRef(1)
  const frameCountRef = useRef(2)
  const durationRef = useRef(4000)
  const seekGen = useRef(0)
  const seekQueue = useRef<{ ms: number | null; running: boolean }>({ ms: null, running: false })
  const showOrbit = layer === 'player' && Boolean(hologram.orbitVideo)
  frameCountRef.current = Math.max(2, hologram.orbitFrameCount ?? 2)
  durationRef.current = hologram.orbitDurationMs && hologram.orbitDurationMs > 0 ? hologram.orbitDurationMs : 4000
  const stageWidth = Math.max(1, windowWidth - 32)
  // The visible picture is the square still. The 9:16 file's black bars are cropped off.
  const naturalHeight = stageWidth
  const maxHeight = Math.max(280, windowHeight - (300 + insets.bottom))
  const stageHeight = Math.min(naturalHeight, maxHeight)

  useEffect(() => {
    setOrbitIndex(0)
    orbitIndexRef.current = 0
    setOrbitReady(false)
    setOrbitVideoError(null)
    setOrbitUrlHttp(null)
    iosPrimeDone.current = false
  }, [hologram.orbitVideo])

  // Play remote immediately (hides still), then prefer a cached file so iOS AVPlayer paints scrub seeks.
  useEffect(() => {
    const remote = hologram.orbitVideo
    setPlaybackUri(null)
    setOrbitReady(false)
    setOrbitVideoError(null)
    setOrbitUrlHttp(null)
    iosPrimeDone.current = false
    if (!remote) return
    let cancelled = false
    const name = remote.split('/').pop()?.split('?')[0] || 'orbit.mp4'
    setPlaybackUri(remote)
    if (__DEV__) console.log('[smart3d] orbit play', { remote: remote.slice(0, 160) })
    void (async () => {
      try {
        const head = await fetch(remote, { method: 'HEAD' }).catch(() => null)
        const status = head?.status ?? (await fetch(remote, { method: 'GET' }).then((r) => r.status).catch(() => 0))
        if (!cancelled) {
          setOrbitUrlHttp(status || null)
          if (__DEV__) console.log('[smart3d] orbit URL HTTP', { status, remote: remote.slice(0, 120) })
        }
      } catch {
        /* download path reports failures */
      }
      try {
        const file = await File.downloadFileAsync(remote, new File(Paths.cache, name), { idempotent: true })
        if (!cancelled) {
          if (__DEV__) console.log('[smart3d] orbit local', file.uri)
          setPlaybackUri(file.uri)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (__DEV__) console.warn('[smart3d] orbit download failed, keeping remote', msg)
        if (!cancelled) setOrbitVideoError(msg)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hologram.orbitVideo])

  useEffect(() => {
    if (!__DEV__) return
    console.log('[smart3d] orbit paint', {
      orbitReady,
      playbackUri: playbackUri ? playbackUri.slice(0, 80) : null,
      orbitVideo: hologram.orbitVideo ? hologram.orbitVideo.slice(0, 120) : null,
      orbitUrlHttp,
      orbitVideoError,
      orbitStatus: hologram.orbitStatus,
      orbitError: hologram.orbitError,
      showStillWouldBe: Boolean(hologram.image) && (!playbackUri || !orbitReady),
    })
  }, [
    orbitReady,
    playbackUri,
    hologram.orbitVideo,
    hologram.orbitStatus,
    hologram.orbitError,
    hologram.image,
    orbitUrlHttp,
    orbitVideoError,
  ])

  function seekOrbit(index: number) {
    const last = frameCountRef.current - 1
    const clamped = Math.min(last, Math.max(0, index))
    orbitIndexRef.current = clamped
    setOrbitIndex(clamped)
    const q = seekQueue.current
    q.ms = (clamped / last) * durationRef.current
    if (q.running) return
    q.running = true
    const pump = async () => {
      while (q.ms != null) {
        const next = q.ms
        q.ms = null
        seekGen.current += 1
        try {
          await videoRef.current?.setPositionAsync(next)
        } catch {
          /* the next drag sends a fresh position */
        }
      }
      q.running = false
    }
    void pump()
  }

  function scrubMillis() {
    const last = Math.max(frameCountRef.current - 1, 1)
    return (orbitIndexRef.current / last) * durationRef.current
  }

  function onOrbitStatus(status: AVPlaybackStatus) {
    // Ready as soon as the player has loaded — do not wait for iOS play≥80ms (that left the still stuck).
    if (!status.isLoaded) {
      if ('error' in status && status.error && __DEV__) {
        console.warn('[smart3d] orbit status error', status.error)
        setOrbitVideoError(String(status.error))
      }
      return
    }
    if (!orbitReady) {
      setOrbitReady(true)
      if (__DEV__) {
        console.log('[smart3d] orbitReady via status', {
          isPlaying: status.isPlaying,
          positionMillis: status.positionMillis,
        })
      }
    }
    // Scrub-only: after the brief iOS prime, never let the clip free-run.
    if (iosPrimeDone.current && status.isPlaying) {
      void videoRef.current?.pauseAsync().catch(() => {})
    }
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        grantIndex.current = orbitIndexRef.current
      },
      onPanResponderMove: (_, g) => {
        const last = frameCountRef.current - 1
        const delta = (g.dx / Math.max(stageWRef.current, 1)) * last
        seekOrbit(grantIndex.current + delta)
      },
    })
  ).current
  /** Player hologram is blue; the pro reference is the red render of the matched library clip. */
  const holoImage = layer === 'pro' ? hologram.proImage : hologram.image
  const holoKeys = layer === 'pro' ? hologram.proKeypoints : hologram.keypoints
  const building =
    hologram.ready &&
    (layer === 'pro'
      ? hologram.proStatus === 'running'
      : hologram.status === 'running' ||
        (layer === 'player' && hologram.status !== 'done' && !hologram.image) ||
        // Still ready, no clip yet — show turn progress for running/idle (kick in flight).
        // Saved orbitVideo hides this; failed stays off so we do not spin forever.
        (layer === 'player' &&
          !hologram.orbitVideo &&
          hologram.status === 'done' &&
          hologram.orbitStatus !== 'failed') ||
        (layer === 'overlay' && hologram.proStatus === 'running'))
  /** Pro tab with nothing to draw: no matched pro clip, or its render failed or never started. */
  const proMissing = layer === 'pro' && !hologram.proImage && hologram.proStatus !== 'running'
  const lit = selected ? partKeypoints(selected, contactJoints?.side ?? 'RIGHT') : []
  const markerKeys = showOrbit
    ? orbitKeypointsAt(hologram.orbitFrames, orbitIndex, frameCountRef.current)
    : holoKeys
  const placed =
    showOrbit && hologram.orbitWidth && hologram.orbitHeight
      ? orbitPlacement(stageSize.w || stageWidth, stageSize.h || stageHeight, hologram.orbitWidth, hologram.orbitHeight)
      : null

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [onClose])

  const tabs = [
    { id: 'player' as const, label: t('analysis.smart3dPlayer') },
    { id: 'pro' as const, label: t('analysis.proReference') },
    { id: 'overlay' as const, label: t('analysis.smart3dOverlay') },
  ]

  function pressPart(part: BodyPart) {
    setSelected(part)
    const contact = DETAIL_JOINT[part]
    if (contact) setDetail(contact)
  }

  if (detail) {
    const served = contactJoints?.joints[detail] ?? null
    // No server reading for this shot: measure the angle from the pose at contact, without a pro.
    let reading: JointReading | null = served
    if (served?.you == null && poseFrames?.length && impactFrame != null) {
      const you = poseAngle(nearestPoseByFrame(poseFrames, impactFrame), detail, dominantSide(poseFrames))
      if (you != null) {
        reading = {
          ...(served ?? { pro: null, idealMin: null, idealMax: null, deltaDeg: null, status: null, direction: null, messageKey: null }),
          you: Math.round(you),
        }
      }
    }
    return (
      <JointDetailView
        joint={detail}
        reading={reading}
        shotLabel={contactJoints?.shotLabel ?? null}
        hologramImage={hologram.image}
        proHologramImage={hologram.proImage}
        timing={timing}
        onClose={() => setDetail(null)}
      />
    )
  }

  const pictureUri = showOrbit ? playbackUri : null
  // Once the orbit URI is set, never cover it with the still (joints were scrubbing under a stuck PNG).
  const showStill = Boolean(holoImage) && !pictureUri
  const orbitFailed =
    layer === 'player' && hologram.ready && hologram.orbitStatus === 'failed' && !hologram.orbitVideo

  return (
    <View style={styles.screen}>
      <View style={styles.titleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('analysis.back')}
          hitSlop={12}
          onPress={onClose}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={28} color="#86A7D2" />
        </Pressable>
        <View style={styles.titleCopy}>
          <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}>
            {t('analysis.smart3dTitle')}
          </Text>
          <Text allowFontScaling={false} style={[styles.subtitle, { fontFamily: theme.regularFont }]}>
            {t('analysis.smart3dSubtitle')}
          </Text>
        </View>
        <View style={styles.back} />
      </View>
      <ResultSectionPill tabs={tabs} value={layer} onChange={setLayer} trackStyle={styles.pill} />
      <View
        collapsable={false}
        style={[styles.stage, { height: stageHeight }]}
        onLayout={(e) => {
          stageWRef.current = e.nativeEvent.layout.width
          setStageSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }}
      >
        {/* Clip oversized 9:16 AVPlayerLayer so it cannot float over the part buttons. */}
        <View collapsable={false} style={styles.stageClip} pointerEvents="box-none">
          {pictureUri ? (
            <Video
              ref={videoRef}
              source={{ uri: pictureUri }}
              pointerEvents="none"
              // 9:16 orbit is laid out so the square hologram band fills the stage (same as the still).
              resizeMode={placed ? ResizeMode.STRETCH : ResizeMode.COVER}
              isMuted
              shouldPlay={false}
              progressUpdateIntervalMillis={100}
              onLoad={() => {
                const player = videoRef.current
                if (!player) return
                setOrbitReady(true)
                if (__DEV__) {
                  console.log('[smart3d] orbit onLoad → orbitReady', {
                    uri: pictureUri.slice(0, 80),
                    platform: Platform.OS,
                  })
                }
                const gen = seekGen.current
                const at = orbitIndexRef.current === 0 ? 0 : scrubMillis()
                const freezeAt = () =>
                  player
                    .setStatusAsync({ shouldPlay: false, positionMillis: at })
                    .then(() => {
                      iosPrimeDone.current = true
                    })
                    .catch(() => {
                      iosPrimeDone.current = true
                    })
                // iOS often needs one tiny play to paint frame 0, then we lock scrub-only.
                if (Platform.OS === 'ios') {
                  iosPrimeDone.current = false
                  void Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: false,
                    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
                  })
                    .then(() => player.playAsync())
                    .then(() => new Promise((r) => setTimeout(r, 50)))
                    .then(() => {
                      if (seekGen.current !== gen) return
                      return freezeAt()
                    })
                    .catch(() => freezeAt())
                  return
                }
                void freezeAt()
              }}
              onPlaybackStatusUpdate={onOrbitStatus}
              onError={(e) => {
                const msg = typeof e === 'string' ? e : JSON.stringify(e)
                if (__DEV__) console.warn('[smart3d] orbit video error', msg)
                setOrbitVideoError(msg)
                if (pictureUri !== hologram.orbitVideo && hologram.orbitVideo) setPlaybackUri(hologram.orbitVideo)
              }}
              style={
                placed
                  ? {
                      position: 'absolute',
                      left: placed.x,
                      top: placed.y,
                      width: placed.w,
                      height: placed.h,
                      zIndex: 1,
                    }
                  : [StyleSheet.absoluteFillObject, { zIndex: 1 }]
              }
            />
          ) : null}
          {showStill ? (
            <Image
              source={{ uri: holoImage! }}
              resizeMode="contain"
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
          ) : !pictureUri ? (
            <Image
              source={BODY}
              resizeMode="contain"
              pointerEvents="none"
              // absoluteFill alone leaves a bundled image at its natural size on web.
              style={[styles.fill, layer === 'pro' && styles.bodyGhost]}
            />
          ) : null}
          {layer === 'overlay' && hologram.proImage ? (
            <Image
              source={{ uri: hologram.proImage }}
              resizeMode="cover"
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { opacity: 0.72, zIndex: 5 }]}
            />
          ) : null}
          {markerKeys && stageSize.w ? (
            <JointMarkers keypoints={markerKeys} w={stageSize.w} h={stageSize.h} lit={lit} video={placed} />
          ) : null}
          {showOrbit && pictureUri ? (
            <View
              style={styles.scrubLayer}
              {...pan.panHandlers}
              accessibilityRole="adjustable"
              accessibilityLabel={t('analysis.smart3dTitle')}
            />
          ) : null}
          {proMissing ? (
            <View pointerEvents="none" style={styles.proMissing} testID="smart3d-pro-missing">
              <Ionicons name="ribbon-outline" size={28} color="#7AECFF" />
              <Text allowFontScaling={false} style={[styles.proMissingLabel, { fontFamily: theme.mediumFont }]}>
                {t('analysis.smart3dProMissing')}
              </Text>
            </View>
          ) : null}
          {building ? (
            <View pointerEvents="none" style={styles.building}>
              <ActivityIndicator size="small" color="#7AECFF" />
              <Text allowFontScaling={false} style={[styles.buildingLabel, { fontFamily: theme.mediumFont }]}>
                {t(hologram.status === 'done' ? 'analysis.smart3dOrbitBuilding' : 'analysis.smart3dHologramBuilding')}
              </Text>
            </View>
          ) : null}
          {orbitFailed ? (
            <View pointerEvents="none" style={styles.orbitFailed} testID="smart3d-orbit-failed">
              <Text allowFontScaling={false} style={[styles.orbitFailedLabel, { fontFamily: theme.mediumFont }]}>
                {hologram.orbitError || t('analysis.smart3dOrbitFailed')}
              </Text>
            </View>
          ) : null}
          {__DEV__ && showOrbit ? (
            <View pointerEvents="none" style={styles.debugBadge}>
              <Text allowFontScaling={false} style={styles.debugText}>
                {`ready=${orbitReady ? 1 : 0} http=${orbitUrlHttp ?? '-'} err=${orbitVideoError ? 1 : 0}`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <ScrollView style={styles.partsScroll} contentContainerStyle={{ paddingBottom: 8 + insets.bottom }}>
      {showOrbit ? null : (
        <Text allowFontScaling={false} style={[styles.prompt, { fontFamily: theme.mediumFont }]}>
          {t('analysis.smart3dSelectPart')}
        </Text>
      )}
      <View style={[styles.parts, showOrbit && styles.partsAfterOrbit]}>
        {PART_ROWS.map((row, index) => (
          <View key={index} style={styles.partRow}>
            {row.map((item) => {
              const on = selected === item.id
              return (
                <Pressable
                  key={item.id}
                  testID={`smart3d-part-${item.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => pressPart(item.id)}
                  style={[styles.part, on && [styles.partOn, SELECTED_GLOW]]}
                >
                  <View style={styles.partBadge}>
                    <MaterialCommunityIcons name={JOINT_ICON[item.id]} size={18} color={UI.text} />
                  </View>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[styles.partLabel, { fontFamily: theme.regularFont }]}
                  >
                    {t(item.key)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  back: { width: 32 },
  titleCopy: { flex: 1, alignItems: 'center' },
  title: { color: UI.text, fontSize: 24, textAlign: 'center' },
  subtitle: { color: UI.accent, fontSize: 14, textAlign: 'center' },
  pill: { marginBottom: 12 },
  stage: {
    width: '100%',
    borderRadius: UI.radiusCard,
    borderWidth: 2,
    borderColor: '#5B6CFF',
    backgroundColor: '#020A1C',
    // Must clip: the 9:16 AVPlayerLayer is taller than the stage. overflow:visible on iOS
    // let it paint over the part buttons and steal horizontal drags.
    overflow: 'hidden',
  },
  stageClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  markersLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
  },
  scrubLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
    backgroundColor: 'transparent',
  },
  partsScroll: { flex: 1 },
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  bodyGhost: { opacity: 0.42 },
  building: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buildingLabel: { color: '#7AECFF', fontSize: 12 },
  orbitFailed: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    zIndex: 30,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(20, 8, 24, 0.88)',
  },
  orbitFailedLabel: { color: '#FFB4C0', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  debugBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 40,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  debugText: { color: '#9FE8FF', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  proMissing: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
    zIndex: 15,
  },
  proMissingLabel: { color: '#BFE6FF', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  prompt: { color: UI.text, fontSize: 20, marginTop: 14, marginBottom: 12 },
  parts: { gap: 10 },
  partsAfterOrbit: { marginTop: 14 },
  partRow: { flexDirection: 'row', gap: 10 },
  part: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(47, 107, 255, 0.45)',
    backgroundColor: '#0A1550',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  partOn: { borderColor: UI.text, borderWidth: 2, backgroundColor: '#1B2AA8' },
  partBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: UI.text,
    backgroundColor: UI.accentStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partLabel: { color: UI.text, fontSize: 13, flexShrink: 1, flexGrow: 1, textAlign: 'center', letterSpacing: -0.2 },
})
