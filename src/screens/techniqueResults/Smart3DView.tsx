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
import { ResizeMode, Video, type AVPlaybackStatus } from 'expo-av'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import Svg, { Circle, Line } from 'react-native-svg'
import { ThemeContext } from '../../context'
import { ResultSectionPill } from '../../components/ResultSectionPill'
import { useHologram, type HologramKeypoints, type HologramOrbitFrame } from '../../lib/hologramJob'
import { cacheOrbitVideo } from '../../lib/orbitCache'
import { orbitKeypointsAt } from '../../lib/orbitKeypoints'
import { useContactJoints, type ContactJoint, type JointReading } from '../../lib/jointsApi'
import { SELECTED_GLOW, UI } from '../../components/ui'
import { kineticChainTiming } from '../../lib/kineticChain'
import { poseAngle } from '../../lib/poseJointAngles'
import { nearestPoseByFrame, type PoseFrameRow } from '../../lib/techniquePose'
import { JointDetailView } from './JointDetailView'
import { JOINT_ICON, type BodyPartId } from './jointIcons'
import { dominantSide } from './movementTimeline'
import { alignKeypoints, orbitFraction, type OrbitPreset } from './orbitPresets'

type Layer = 'player' | 'pro' | 'overlay'
type BodyPart = BodyPartId

type Props = {
  /** Saved analysis whose ball-contact hologram replaces the stock figure once it is built. */
  analysisId?: string | null
  /** The player's pose, contact frame and fps, for the kinetic chain timing. */
  poseFrames?: PoseFrameRow[]
  impactFrame?: number | null
  fps?: number | null
  /** Camera the shot was filmed from, so Front and Side seek the matching side of the orbit. */
  viewId?: string | null
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
  color = '#FF8A3D',
  full = false,
}: {
  keypoints: HologramKeypoints
  w: number
  h: number
  lit: string[]
  video: { x: number; y: number; w: number; h: number } | null
  color?: string
  /** Shoulder-to-ankle body, used when two figures share the stage. */
  full?: boolean
}) {
  const at = (name: string) => {
    const p = keypoints[name]
    if (!p) return null
    if (!video) {
      // Match Image resizeMode="cover" for the square hologram still.
      const d = Math.max(w, h)
      return { x: (w - d) / 2 + p.x * d, y: (h - d) / 2 + p.y * d }
    }
    return { x: video.x + p.x * video.w, y: video.y + p.y * video.h }
  }
  const names = [...BASE_MARKERS, ...lit.filter((name) => !BASE_MARKERS.includes(name))]
  return (
    <Svg width={w} height={h} style={styles.markersLayer} pointerEvents="none">
      {(full
        ? [
            ...LIMBS,
            ['left_shoulder', 'right_shoulder'],
            ['left_hip', 'right_hip'],
            ['left_shoulder', 'left_hip'],
            ['right_shoulder', 'right_hip'],
            ['left_hip', 'left_knee'],
            ['right_hip', 'right_knee'],
            ['left_knee', 'left_ankle'],
            ['right_knee', 'right_ankle'],
          ]
        : LIMBS
      ).map(([a, b]) => {
        const A = at(a)
        const B = at(b)
        return A && B ? (
          <Line key={`${a}-${b}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={color} strokeWidth={3} strokeOpacity={0.85} />
        ) : null
      })}
      {names.map((name) => {
        const P = at(name)
        if (!P) return null
        const on = lit.includes(name)
        return (
          <Fragment key={name}>
            <Circle cx={P.x} cy={P.y} r={on ? 18 : 12} fill={color} fillOpacity={on ? 0.4 : 0.28} />
            <Circle cx={P.x} cy={P.y} r={on ? 9 : 6} fill={color} stroke="#FFF4D6" strokeWidth={2} />
          </Fragment>
        )
      })}
    </Svg>
  )
}

/** Stock figure shown until the shot's own hologram is built. */
const BODY = require('../../../assets/smart3d/body.webp')

const VIEW_ICONS: Record<OrbitPreset, keyof typeof MaterialCommunityIcons.glyphMap> = {
  view: 'cube-outline',
  front: 'account-outline',
  side: 'head-outline',
}

function SmartViewPresets({ value, onChange }: { value: OrbitPreset; onChange: (v: OrbitPreset) => void }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  return (
    <View style={styles.presets}>
      {(Object.keys(VIEW_ICONS) as OrbitPreset[]).map((id) => {
        const on = id === value
        return (
          <Pressable
            key={id}
            testID={`smart3d-view-${id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(id)}
            style={[styles.preset, on && styles.presetOn]}
          >
            <MaterialCommunityIcons name={VIEW_ICONS[id]} size={18} color={UI.text} />
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.presetLabel, { fontFamily: theme.regularFont }]}>
              {t(`analysis.smart3dViews.${id}`)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Second orbit for Overlay — same View angle as the player clip, no drag. */
function OverlayProOrbit({
  uri,
  fraction,
  durationMs,
  placed,
}: {
  uri: string
  fraction: number
  durationMs: number | null
  placed: { x: number; y: number; w: number; h: number } | null
}) {
  const ref = useRef<Video>(null)
  const seek = () => {
    const length = durationMs && durationMs > 0 ? durationMs : 4000
    void ref.current?.setStatusAsync({
      shouldPlay: false,
      positionMillis: Math.round(length * fraction),
      seekMillisToleranceBefore: 0,
      seekMillisToleranceAfter: 0,
    })
  }
  useEffect(() => {
    seek()
  }, [fraction, durationMs, uri])
  return (
    <Video
      ref={ref}
      source={{ uri }}
      pointerEvents="none"
      resizeMode={placed ? ResizeMode.STRETCH : ResizeMode.COVER}
      isMuted
      shouldPlay={false}
      onLoad={seek}
      onReadyForDisplay={seek}
      style={
        placed
          ? {
              position: 'absolute',
              left: placed.x,
              top: placed.y,
              width: placed.w,
              height: placed.h,
              opacity: 0.42,
              zIndex: 2,
            }
          : [StyleSheet.absoluteFillObject, { opacity: 0.42, zIndex: 2 }]
      }
    />
  )
}

export function Smart3DView({ analysisId, poseFrames, impactFrame = null, fps = null, viewId = null, onClose }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const [layer, setLayer] = useState<Layer>('player')
  const [selected, setSelected] = useState<BodyPart | null>(null)
  const hologram = useHologram(analysisId)
  const [jointsReload, setJointsReload] = useState(0)
  const contactJoints = useContactJoints(analysisId, jointsReload)
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
  const [viewPreset, setViewPreset] = useState<OrbitPreset>('view')
  const orbitIndexRef = useRef(0)
  const grantIndex = useRef(0)
  const stageWRef = useRef(1)
  const frameCountRef = useRef(2)
  const durationRef = useRef(4000)
  const seekQueue = useRef<{ ms: number | null; running: boolean }>({ ms: null, running: false })
  const stepGen = useRef(0)
  /** Frame the finger is on. A stray play is stopped here, not at the end of the clip. */
  const holdMs = useRef(0)
  /**
   * Player / Pro scrub their own orbit. Overlay drives both from View 1/2/3 (no drag),
   * so it reuses the player orbit clip for seeking and shows the pro on top.
   */
  const remoteClip = layer === 'pro' ? hologram.proOrbitVideo : hologram.orbitVideo
  const clipFrames = layer === 'pro' ? hologram.proOrbitFrames : hologram.orbitFrames
  const clipFrameCount = layer === 'pro' ? hologram.proOrbitFrameCount : hologram.orbitFrameCount
  const clipDurationMs = layer === 'pro' ? hologram.proOrbitDurationMs : hologram.orbitDurationMs
  const clipWidth = layer === 'pro' ? hologram.proOrbitWidth : hologram.orbitWidth
  const clipHeight = layer === 'pro' ? hologram.proOrbitHeight : hologram.orbitHeight
  const overlayFraction = orbitFraction(viewPreset, viewId)
  frameCountRef.current = Math.max(2, clipFrameCount ?? 2)
  durationRef.current = clipDurationMs && clipDurationMs > 0 ? clipDurationMs : 4000
  const stageWidth = Math.max(1, windowWidth - 32)
  // The visible picture is the square still. The 9:16 file's black bars are cropped off.
  const naturalHeight = stageWidth
  const maxHeight = Math.max(280, windowHeight - (300 + insets.bottom))
  const stageHeight = Math.min(naturalHeight, maxHeight)

  useEffect(() => {
    setOrbitIndex(0)
    orbitIndexRef.current = 0
    holdMs.current = 0
    setOrbitReady(false)
    setOrbitVideoError(null)
    setOrbitUrlHttp(null)
    if (layer === 'overlay') setViewPreset('view')
  }, [remoteClip, layer])

  // Overlay: snap both orbits to the active View preset (no free scrub).
  useEffect(() => {
    if (layer !== 'overlay' || !reveal) return
    const last = Math.max(0, frameCountRef.current - 1)
    seekOrbit(overlayFraction * last)
  }, [layer, reveal, overlayFraction, viewPreset])

  // Save the cloud video on the phone first. Scrubbing a stream is what made a fresh shot look broken.
  // cacheOrbitVideo keeps the download alive if the user leaves Smart 3D mid-save.
  useEffect(() => {
    const remote = remoteClip
    setPlaybackUri(null)
    setOrbitReady(false)
    setOrbitVideoError(null)
    setOrbitUrlHttp(null)
    if (!remote) return
    let cancelled = false
    if (__DEV__) console.log('[smart3d] orbit save', { remote: remote.slice(0, 160) })
    void (async () => {
      try {
        const head = await fetch(remote, { method: 'HEAD' }).catch(() => null)
        const status = head?.status ?? 0
        if (!cancelled) setOrbitUrlHttp(status || null)
        const uri = await cacheOrbitVideo(remote)
        if (cancelled) return
        if (__DEV__) console.log('[smart3d] orbit on phone', uri)
        setPlaybackUri(uri)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (__DEV__) console.warn('[smart3d] orbit save failed', msg)
        if (!cancelled) setOrbitVideoError(msg)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [remoteClip])

  useEffect(() => {
    if (!__DEV__) return
    console.log('[smart3d] orbit paint', {
      orbitReady,
      playbackUri: playbackUri ? playbackUri.slice(0, 80) : null,
      orbitVideo: remoteClip ? remoteClip.slice(0, 120) : null,
      orbitUrlHttp,
      orbitVideoError,
      orbitStatus: hologram.orbitStatus,
      orbitError: hologram.orbitError,
      showStillWouldBe: Boolean(hologram.image) && (!playbackUri || !orbitReady),
    })
  }, [
    orbitReady,
    playbackUri,
    remoteClip,
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
    holdMs.current = q.ms
    if (q.running) return
    q.running = true
    const pump = async () => {
      while (q.ms != null) {
        const next = q.ms
        q.ms = null
        holdMs.current = next
        const gen = ++stepGen.current
        const player = videoRef.current
        if (!player) continue
        try {
          // iOS only paints a new frame if playback is asked to start at that time.
          // Pause on the same timestamp so the clip steps with the finger and does not run on.
          await player.setStatusAsync({
            shouldPlay: true,
            positionMillis: next,
            seekMillisToleranceBefore: 0,
            seekMillisToleranceAfter: 0,
          })
          if (stepGen.current !== gen) continue
          await player.setStatusAsync({
            shouldPlay: false,
            positionMillis: holdMs.current,
            seekMillisToleranceBefore: 0,
            seekMillisToleranceAfter: 0,
          })
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
    // A step starts playback at the finger's frame and pauses there. Only pull back a real run-on.
    if (status.isPlaying && status.positionMillis > holdMs.current + 200) {
      void videoRef.current
        ?.setStatusAsync({
          shouldPlay: false,
          positionMillis: holdMs.current,
          seekMillisToleranceBefore: 0,
          seekMillisToleranceAfter: 0,
        })
        .catch(() => {})
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
  /** The orbit is shown only after its file is on the phone and the player has painted a frame. */
  const reveal = Boolean(playbackUri) && orbitReady && !orbitVideoError
  const proFailed = hologram.proStatus === 'failed' || hologram.proStatus === 'unavailable'
  const playerFailed = hologram.ready && hologram.orbitStatus === 'failed' && !hologram.orbitVideo
  const proMissing = layer === 'pro' && hologram.ready && proFailed && !hologram.proOrbitVideo
  const clipBroken = Boolean(orbitVideoError) || (layer === 'player' && playerFailed)
  const preparing = (layer === 'player' || layer === 'pro') && !reveal && !proMissing && !clipBroken
  const lit = selected ? partKeypoints(selected, contactJoints?.side ?? 'RIGHT') : []
  // Prefer per-frame orbit pose; fall back to the contact still when Modal never wrote orbitFrames
  // (that is why the player layer looked bare while the pro library still had lines).
  const stillKeys = layer === 'pro' ? hologram.proKeypoints : hologram.keypoints
  const markerKeys = reveal
    ? orbitKeypointsAt(clipFrames, orbitIndex, frameCountRef.current) ?? stillKeys
    : layer === 'overlay'
      ? hologram.keypoints
      : null
  const placed =
    reveal && clipWidth && clipHeight
      ? orbitPlacement(stageSize.w || stageWidth, stageSize.h || stageHeight, clipWidth, clipHeight)
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
    if (contact) {
      setJointsReload((n) => n + 1)
      setDetail(contact)
    }
  }

  if (detail) {
    const served = contactJoints?.joints[detail] ?? null
    // Fill a missing player angle from pose, but keep any pro/ideal the server already returned.
    let reading: JointReading | null = served
    if (served?.you == null && poseFrames?.length && impactFrame != null) {
      const you = poseAngle(nearestPoseByFrame(poseFrames, impactFrame), detail, dominantSide(poseFrames))
      if (you != null) {
        const rounded = Math.round(you)
        const pro = served?.pro ?? null
        reading = {
          ...(served ?? {
            pro: null,
            idealMin: null,
            idealMax: null,
            deltaDeg: null,
            status: null,
            direction: null,
            messageKey: null,
          }),
          you: rounded,
          deltaDeg: pro != null ? rounded - pro : served?.deltaDeg ?? null,
        }
      }
    }
    const partKey = selected ?? detail
    return (
      <JointDetailView
        joint={detail}
        reading={reading}
        shotLabel={contactJoints?.shotLabel ?? null}
        hologramImage={hologram.image}
        partImage={hologram.parts?.[partKey] ?? hologram.image}
        proHologramImage={hologram.proImage}
        proPartImage={hologram.proParts?.[partKey] ?? hologram.proImage}
        viewId={viewId}
        initialLayer={layer}
        playerOrbit={{
          image: hologram.image,
          video: hologram.orbitVideo,
          durationMs: hologram.orbitDurationMs,
          frameCount: hologram.orbitFrameCount,
          frames: hologram.orbitFrames,
          keypoints: hologram.keypoints,
        }}
        proOrbit={{
          image: hologram.proImage,
          video: hologram.proOrbitVideo,
          durationMs: hologram.proOrbitDurationMs,
          frameCount: hologram.proOrbitFrameCount,
          frames: hologram.proOrbitFrames,
          keypoints: hologram.proKeypoints,
        }}
        timing={timing}
        onClose={() => setDetail(null)}
      />
    )
  }

  /** Overlay only shows orbit when ready; Player/Pro keep scrubbing their own clip. */
  const pictureUri = layer === 'overlay' ? (reveal ? playbackUri : null) : playbackUri
  const canOverlayViews = layer === 'overlay' && Boolean(hologram.orbitVideo || hologram.image)

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
                const at = orbitIndexRef.current === 0 ? 0 : scrubMillis()
                holdMs.current = at
                if (__DEV__) {
                  console.log('[smart3d] orbit onLoad', {
                    uri: pictureUri.slice(0, 80),
                    platform: Platform.OS,
                    at,
                  })
                }
                void player
                  .setStatusAsync({
                    shouldPlay: true,
                    positionMillis: at,
                    seekMillisToleranceBefore: 0,
                    seekMillisToleranceAfter: 0,
                  })
                  .then(() =>
                    player.setStatusAsync({
                      shouldPlay: false,
                      positionMillis: holdMs.current,
                      seekMillisToleranceBefore: 0,
                      seekMillisToleranceAfter: 0,
                    })
                  )
                  .catch(() => {})
              }}
              onReadyForDisplay={() => {
                setOrbitReady(true)
                if (__DEV__) console.log('[smart3d] orbit frame on screen')
              }}
              onPlaybackStatusUpdate={onOrbitStatus}
              onError={(e) => {
                const msg = typeof e === 'string' ? e : JSON.stringify(e)
                if (__DEV__) console.warn('[smart3d] orbit video error', msg)
                setOrbitVideoError(msg)
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
          {layer === 'overlay' && !pictureUri && (hologram.image || hologram.proImage) ? (
            <>
              {hologram.image ? (
                <Image source={{ uri: hologram.image }} resizeMode="cover" pointerEvents="none" style={StyleSheet.absoluteFill} />
              ) : null}
              {hologram.proImage ? (
                <Image source={{ uri: hologram.proImage }} resizeMode="cover" pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: 0.42 }]} />
              ) : null}
            </>
          ) : null}
          {layer === 'overlay' && hologram.proOrbitVideo ? (
            <OverlayProOrbit
              uri={hologram.proOrbitVideo}
              fraction={overlayFraction}
              durationMs={hologram.proOrbitDurationMs}
              placed={placed}
            />
          ) : layer === 'overlay' && hologram.proImage ? (
            <Image
              source={{ uri: hologram.proImage }}
              resizeMode="cover"
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { opacity: 0.4, zIndex: 2 }]}
            />
          ) : null}
          {layer === 'overlay' && stageSize.w ? (
            <>
              {(markerKeys ?? hologram.keypoints) ? (
                <JointMarkers
                  keypoints={(markerKeys ?? hologram.keypoints)!}
                  w={stageSize.w}
                  h={stageSize.h}
                  lit={lit}
                  video={placed}
                  color="#5CE1FF"
                />
              ) : null}
              {hologram.proKeypoints && (markerKeys ?? hologram.keypoints) ? (
                <JointMarkers
                  keypoints={alignKeypoints(hologram.proKeypoints, (markerKeys ?? hologram.keypoints)!)}
                  w={stageSize.w}
                  h={stageSize.h}
                  lit={lit}
                  video={placed}
                  color="#FF8A3D"
                />
              ) : null}
            </>
          ) : null}
          {markerKeys && layer !== 'overlay' && stageSize.w ? (
            <JointMarkers keypoints={markerKeys} w={stageSize.w} h={stageSize.h} lit={lit} video={placed} />
          ) : null}
          {/* Drag-to-orbit only on Player / Pro — Overlay is discrete View 1/2/3. */}
          {reveal && pictureUri && layer !== 'overlay' ? (
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
                {hologram.proError && hologram.proStatus === 'failed'
                  ? hologram.proError
                  : t('analysis.smart3dProMissing')}
              </Text>
            </View>
          ) : null}
          {preparing ? (
            <View pointerEvents="none" style={styles.preparing} testID="smart3d-preparing">
              <ActivityIndicator size="small" color="#7AECFF" />
              <Text allowFontScaling={false} style={[styles.preparingLabel, { fontFamily: theme.mediumFont }]}>
                {t('analysis.smart3dViewBuilding')}
              </Text>
            </View>
          ) : null}
          {clipBroken ? (
            <View pointerEvents="none" style={styles.orbitFailed} testID="smart3d-orbit-failed">
              <Text allowFontScaling={false} style={[styles.orbitFailedLabel, { fontFamily: theme.mediumFont }]}>
                {orbitVideoError || hologram.orbitError || t('analysis.smart3dOrbitFailed')}
              </Text>
            </View>
          ) : null}
          {__DEV__ && reveal ? (
            <View pointerEvents="none" style={styles.debugBadge}>
              <Text allowFontScaling={false} style={styles.debugText}>
                {`ready=${orbitReady ? 1 : 0} http=${orbitUrlHttp ?? '-'} err=${orbitVideoError ? 1 : 0}`}
              </Text>
            </View>
          ) : null}
        </View>
        {/* Sibling of the video clip so AVPlayerLayer / markers cannot sit above the View buttons. */}
        {canOverlayViews ? (
          <View style={styles.presetColumn} pointerEvents="box-none">
            <SmartViewPresets
              value={viewPreset}
              onChange={(next) => {
                setViewPreset(next)
                const frac = orbitFraction(next, viewId)
                const last = Math.max(0, frameCountRef.current - 1)
                seekOrbit(frac * last)
              }}
            />
          </View>
        ) : null}
      </View>
      <ScrollView style={styles.partsScroll} contentContainerStyle={{ paddingBottom: 8 + insets.bottom }}>
      {reveal ? null : (
        <Text allowFontScaling={false} style={[styles.prompt, { fontFamily: theme.mediumFont }]}>
          {t('analysis.smart3dSelectPart')}
        </Text>
      )}
      <View style={[styles.parts, reveal && styles.partsAfterOrbit]}>
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
  presetColumn: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 50,
    elevation: 50,
  },
  presets: { gap: 8 },
  preset: {
    width: 72,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(91, 108, 255, 0.55)',
    backgroundColor: 'rgba(5, 14, 40, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
    zIndex: 51,
    elevation: 51,
  },
  presetOn: { borderColor: '#7AECFF', backgroundColor: 'rgba(20, 60, 160, 0.9)' },
  presetLabel: { color: UI.text, fontSize: 10, textAlign: 'center' },
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
  preparing: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 25,
    backgroundColor: '#020A1C',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 28,
  },
  preparingLabel: { color: '#BFE6FF', fontSize: 15, lineHeight: 21, textAlign: 'center' },
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
