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
import { Image as FrameImage } from 'expo-image'
import { captureRef } from 'react-native-view-shot'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, Line } from 'react-native-svg'
import { ThemeContext } from '../../context'
import { ResultSectionPill } from '../../components/ResultSectionPill'
import { LocalSvgAsset } from '../../components/LocalSvgAsset'
import { GlowButton, SELECTED_GLOW, UI } from '../../components/ui'
import { useHologram, type HologramKeypoints, type HologramOrbitFrame } from '../../lib/hologramJob'
import { cacheOrbitVideo } from '../../lib/orbitCache'
import {
  finishOrbitFrameSet,
  nearestOrbitFrame,
  orbitFrameKey,
  orbitFrameSet,
  saveOrbitFrame,
  type OrbitFrameSet,
} from '../../lib/orbitFrameCache'
import { orbitKeypointsAt } from '../../lib/orbitKeypoints'
import { useContactJoints, type ContactJoint, type DetailJoint, type JointReading } from '../../lib/jointsApi'
import { kineticChainTiming } from '../../lib/kineticChain'
import { poseAngle } from '../../lib/poseJointAngles'
import { nearestPoseByFrame, type PoseFrameRow } from '../../lib/techniquePose'
import { JointDetailView } from './JointDetailView'
import { KineticChainTimingView } from './KineticChainTiming'
import { PlayableClip } from './PlayableClip'
import { BodyPartIcon, BodyPartRail, BODY_RAIL_GAP, BODY_RAIL_W, type BodyPartId } from './BodyPartRail'
import { dominantSide } from './movementTimeline'
import { orbitFraction, type OrbitPreset } from './orbitPresets'

const ICON_YOUR_SHOT = require('../../../assets/aicoach/analysis/shot-vs-ideal/your-shot.svg')
const ICON_IDEAL = require('../../../assets/aicoach/analysis/shot-vs-ideal/ideal-form.svg')

/** Which orbit video drives the stage. */
type Layer = 'player' | 'pro' | 'overlay'
/** What the layer pills show; `compare` is the side-by-side view and has no video source of its own. */
type UiLayer = Layer | 'compare'
type Mode = '3d' | 'kinetic'
type BodyPart = BodyPartId

/** Ideal Form — white to match the hologram figure (was mint green). */
const IDEAL_GREEN = '#FFFFFF'
const RAIL_W = BODY_RAIL_W
const RAIL_GAP = BODY_RAIL_GAP
const HIGH = '#E5482B'
const MEDIUM = '#FF8000'
/** Longest wait for a scrub seek to draw before the next one may start. */
const SEEK_SETTLE_TIMEOUT_MS = 1000
/** Longest wait for a saved frame picture to appear. */
const SHOT_SETTLE_TIMEOUT_MS = 400
/**
 * ExoPlayer hands a frame to the screen this long before its timestamp, so the frame on screen
 * at a playback position is the one due this much later. Measured: the picture flips 49-50 ms
 * ahead of each frame time.
 */
const FRAME_EARLY_MS = 50
/** A frame is only captured this far clear of the flip on either side of it. */
const FRAME_EDGE_MS = 8
/** How far past that edge a step aims to stop. */
const FRAME_AIM_MS = 6
/** Playback that slips by between asking the player to start and to stop. */
const FRAME_STEP_MS = 6
/** How far short of its target a timed step is cut, to absorb a late timer. */
const FRAME_SHORT_MS = 60
/** Play-throughs allowed for saving the frames; the later ones fill in what was stepped across. */
const FRAME_PASS_LIMIT = 4
/** The play-throughs give up after this long and keep what they have. */
const FRAME_PASS_TIMEOUT_MS = 45000
/** Fewer saved frames than this share of the clip is not worth scrubbing over. */
const FRAME_PASS_MIN_SHARE = 0.5
/** A set is kept for later visits from this share of the clip up. */
const FRAME_PASS_KEEP_SHARE = 0.6

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
type PartSeverity = 'high' | 'medium' | null

type Props = {
  /** Saved analysis whose ball-contact hologram replaces the stock figure once it is built. */
  analysisId?: string | null
  /** The player's pose, contact frame and fps, for the kinetic chain timing. */
  poseFrames?: PoseFrameRow[]
  impactFrame?: number | null
  fps?: number | null
  /** Camera the shot was filmed from, so Front and Side seek the matching side of the orbit. */
  viewId?: string | null
  /** Coach technical-error lines — same issue coloring as View Angles. */
  errors?: string[]
  /** Compare → Drill exercises CTA. */
  onDrills?: () => void
  /**
   * Open directly on this body part (Priority Fixes / Action Plan).
   * When it maps to a contact joint, Joint Detail shows immediately; back leaves Smart 3D.
   */
  initialPart?: BodyPart | null
  /** Player / Ideal Form / Overlay tab to land on (Action Plan fixes use Ideal Form). */
  initialLayer?: Layer
  onClose: () => void
}

const COMPARE_YOU = 'rgba(0, 72, 255, 0.5)'
const COMPARE_IDEAL = 'rgba(255, 255, 255, 0.55)'
const GOOD = '#11DF97'

const FIX_TITLE: Partial<Record<BodyPart, string>> = {
  elbow: 'analysis.mistakeElbow',
  wrist: 'analysis.mistakeWrist',
  shoulder: 'analysis.viewAnglesPage.reading.shoulder',
  torso: 'analysis.mistakeTorso',
  knee: 'analysis.mistakeKnee',
  racket: 'analysis.mistakeRacket',
  feet: 'analysis.mistakeFoot',
  head: 'analysis.viewAnglesPage.reading.head',
}

/** Body parts that open a joint close-up, and the joint they measure. */
const DETAIL_JOINT: Partial<Record<BodyPart, DetailJoint>> = {
  shoulder: 'shoulder',
  elbow: 'elbow',
  wrist: 'wrist',
  torso: 'torso',
  knee: 'knee',
  feet: 'feet',
  racket: 'wrist',
}

/** Same order as View Angles (Figma 6266:55786). */
const PART_LIST: BodyPart[] = ['head', 'shoulder', 'elbow', 'wrist', 'torso', 'knee', 'feet', 'racket']
const SERVED: readonly ContactJoint[] = ['shoulder', 'elbow', 'wrist', 'torso', 'knee']
const PART_ERROR_WORDS: Record<BodyPart, string[]> = {
  head: ['head', 'cabeza'],
  shoulder: ['shoulder', 'hombro'],
  elbow: ['elbow', 'codo'],
  wrist: ['wrist', 'muñeca'],
  torso: ['torso', 'rotation', 'rotación', 'hip', 'cadera'],
  knee: ['knee', 'rodilla'],
  feet: ['foot', 'feet', 'pie', 'base'],
  racket: ['racket', 'raqueta', 'pala', 'face'],
}

function partSeverity(
  reading: JointReading | undefined,
  part: BodyPart,
  errors: string[]
): PartSeverity {
  if (reading?.status === 'bad') return 'high'
  if (reading?.status === 'warn') return 'medium'
  const delta = reading?.deltaDeg
  if (delta != null && Number.isFinite(delta)) {
    const a = Math.abs(delta)
    if (a >= 15) return 'high'
    if (a > 5) return 'medium'
  }
  if (PART_ERROR_WORDS[part].some((w) => errors.some((e) => e.toLowerCase().includes(w)))) return 'high'
  return null
}

function severityColor(sev: PartSeverity): string | null {
  if (sev === 'high') return HIGH
  if (sev === 'medium') return MEDIUM
  return null
}

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
 * Cover-fit the orbit frame into the stage (same as ResizeMode.COVER).
 * Joint 0..1 coords map into this rect so MediaPipe dots land on the body
 * when the stage is a tall rectangle instead of a square.
 */
function coverPlacement(stageW: number, stageH: number, videoW: number, videoH: number) {
  if (stageW <= 0 || stageH <= 0 || videoW <= 0 || videoH <= 0) {
    return { x: 0, y: 0, w: Math.max(1, stageW), h: Math.max(1, stageH) }
  }
  const videoAR = videoW / videoH
  const boxAR = stageW / stageH
  const scale = videoAR > boxAR ? stageH / videoH : stageW / videoW
  return {
    x: (stageW - videoW * scale) / 2,
    y: (stageH - videoH * scale) / 2,
    w: videoW * scale,
    h: videoH * scale,
  }
}

/** Whole picture inside the stage (same as resizeMode "contain"), for the contact still. */
function containPlacement(stageW: number, stageH: number, imageW: number, imageH: number) {
  if (stageW <= 0 || stageH <= 0 || imageW <= 0 || imageH <= 0) {
    return { x: 0, y: 0, w: Math.max(1, stageW), h: Math.max(1, stageH) }
  }
  const scale = Math.min(stageW / imageW, stageH / imageH)
  return {
    x: (stageW - imageW * scale) / 2,
    y: (stageH - imageH * scale) / 2,
    w: imageW * scale,
    h: imageH * scale,
  }
}

/** Joint markers. 0..1 is the orbit video frame; must use the same cover rect as the AV player. */
function JointMarkers({
  keypoints,
  w,
  h,
  lit,
  video,
  color = IDEAL_GREEN,
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
    if (!video) return null
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
}: {
  uri: string
  fraction: number
  durationMs: number | null
}) {
  const ref = useRef<Video>(null)
  const measured = useRef<number | null>(null)
  const seek = () => {
    const length =
      (measured.current && measured.current > 0 ? measured.current : null) ??
      (durationMs && durationMs > 0 ? durationMs : null) ??
      4000
    const ms = Math.round(length * Math.max(0, Math.min(1, fraction)))
    void ref.current
      ?.setStatusAsync({
        shouldPlay: true,
        positionMillis: ms,
        seekMillisToleranceBefore: 0,
        seekMillisToleranceAfter: 0,
      })
      .then(() =>
        ref.current?.setStatusAsync({
          shouldPlay: false,
          positionMillis: ms,
          seekMillisToleranceBefore: 0,
          seekMillisToleranceAfter: 0,
        })
      )
      .catch(() => {})
  }
  useEffect(() => {
    seek()
  }, [fraction, durationMs, uri])
  return (
    <Video
      // Remount on View 1/2/3 so Android paints the new orbit angle (paused seek alone is flaky).
      key={`overlay-pro-${Math.round(fraction * 1000)}`}
      ref={ref}
      source={{ uri }}
      pointerEvents="none"
      resizeMode={ResizeMode.COVER}
      isMuted
      shouldPlay={false}
      onLoad={(status) => {
        if (status.isLoaded && typeof status.durationMillis === 'number' && status.durationMillis > 0) {
          measured.current = status.durationMillis
        }
        seek()
      }}
      onReadyForDisplay={seek}
      style={[StyleSheet.absoluteFillObject, { opacity: 0.42, zIndex: 2 }]}
    />
  )
}

/** Side-by-side Compare card — header + playable orbit (Figma 6196:105249). */
function CompareCard({
  video,
  image,
  label,
  accent,
  headerBg,
  icon,
  testID,
  emptyText,
  fontFamily,
}: {
  video: string | null
  image: string | null
  label: string
  accent: string
  headerBg: string
  icon: number
  testID: string
  emptyText: string
  fontFamily?: string
}) {
  return (
    <View style={[styles.compareCard, { borderColor: accent }]} testID={testID}>
      <View style={[styles.compareCardHead, { backgroundColor: headerBg, borderBottomColor: accent }]}>
        <LocalSvgAsset assetModule={icon} width={24} height={24} />
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.compareCardTitle, { fontFamily }]}>
          {label}
        </Text>
      </View>
      <View style={styles.compareCardBody}>
        {video || image ? (
          video ? (
            <PlayableClip uri={video} testID={`${testID}-clip`} accent="transparent" />
          ) : (
            <Image source={{ uri: image! }} resizeMode="cover" style={StyleSheet.absoluteFill} />
          )
        ) : (
          <View style={styles.compareEmpty}>
            <Text allowFontScaling={false} style={[styles.compareEmptyText, { fontFamily }]}>
              {emptyText}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

export function Smart3DView({
  analysisId,
  poseFrames,
  impactFrame = null,
  fps = null,
  viewId = null,
  errors = [],
  onDrills,
  initialPart = null,
  initialLayer = 'player',
  onClose,
}: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const [uiLayer, setUiLayer] = useState<UiLayer>(initialLayer)
  const [mode, setMode] = useState<Mode>('3d')
  // Compare has no clip of its own; the stage keeps the player orbit loaded behind it.
  const layer: Layer = uiLayer === 'compare' ? 'player' : uiLayer
  const isCompare = uiLayer === 'compare'
  const [selected, setSelected] = useState<BodyPart | null>(initialPart)
  const hologram = useHologram(analysisId)
  const [jointsReload, setJointsReload] = useState(0)
  const contactJoints = useContactJoints(analysisId, jointsReload)
  const entryJoint = initialPart ? DETAIL_JOINT[initialPart] ?? null : null
  /** Priority / Action Plan deep-link: back from joint detail leaves Smart 3D entirely. */
  const [detailFromEntry] = useState(Boolean(entryJoint))
  const [detail, setDetail] = useState<DetailJoint | null>(entryJoint)
  const timing = useMemo(
    () => (poseFrames?.length ? kineticChainTiming(poseFrames, impactFrame, fps, dominantSide(poseFrames)) : null),
    [poseFrames, impactFrame, fps]
  )
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })
  const videoRef = useRef<Video>(null)
  /** Orbit frame that is on screen. The joint markers follow this, not the finger. */
  const [orbitIndex, setOrbitIndex] = useState(0)
  /** Saved clip, the frame-painted flag and any error each remember which remote clip they are for. */
  const [savedClip, setSavedClip] = useState<{ remote: string; uri: string } | null>(null)
  const [paintedUri, setPaintedUri] = useState<string | null>(null)
  const [clipError, setClipError] = useState<{ remote: string | null; message: string } | null>(null)
  const [orbitUrlHttp, setOrbitUrlHttp] = useState<number | null>(null)
  const [viewPreset, setViewPreset] = useState<OrbitPreset>('view')
  /** Contact still that stands in when a layer has no orbit at all. */
  const [stillSize, setStillSize] = useState<{ uri: string; w: number; h: number } | null>(null)
  const [stillFailedUri, setStillFailedUri] = useState<string | null>(null)
  /** Wraps only the orbit video, so a capture holds the model and nothing drawn over it. */
  const clipShotRef = useRef<View>(null)
  /** Saved frame picture shown over the video while the model is turned (Android). */
  const [frameShot, setFrameShot] = useState<{ clip: string; uri: string } | null>(null)
  /** Share of the clip's frames saved so far, while they are still being saved. */
  const [framePass, setFramePass] = useState<number | null>(null)
  /** Where the finger is on the orbit, in frames. Fractional so a drag picks up where it left off. */
  const orbitIndexRef = useRef(0)
  const grantIndex = useRef(0)
  const stageWRef = useRef(1)
  const stageHRef = useRef(1)
  const frameCountRef = useRef(2)
  const durationRef = useRef(4000)
  const clipWidthRef = useRef(0)
  /**
   * One paint at a time. `shown` is the frame on screen (-1 before the first paint), `target`
   * the frame under the finger, and `settle` resolves once the pending frame has been drawn.
   * `frames` holds the saved pictures of the clip; while `pass` is set the clip is being
   * stepped through underneath to save them.
   */
  const scrub = useRef<{
    target: number
    shown: number
    running: boolean
    gen: number
    settle: { sawBuffering: boolean; shot: boolean; done: () => void } | null
    frames: OrbitFrameSet | null
    shotUri: string | null
    /** Picture that has actually been drawn. */
    shotUp: string | null
    clip: string | null
    pass: boolean
    mount: number
    startedMount: number
  }>({
    target: 0,
    shown: -1,
    running: false,
    gen: 0,
    settle: null,
    frames: null,
    shotUri: null,
    shotUp: null,
    clip: null,
    pass: false,
    mount: 0,
    startedMount: 0,
  }).current
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
  const metaWidth = layer === 'pro' ? hologram.proOrbitWidth : hologram.orbitWidth
  const metaHeight = layer === 'pro' ? hologram.proOrbitHeight : hologram.orbitHeight
  const [naturalClip, setNaturalClip] = useState<{ w: number; h: number } | null>(null)
  /** Prefer server probe size — Android naturalSize orientation is often wrong and throws COVER mapping off. */
  const clipWidth = metaWidth || naturalClip?.w || null
  const clipHeight = metaHeight || naturalClip?.h || null
  const [playDurationMs, setPlayDurationMs] = useState<number | null>(null)
  const overlayFraction = orbitFraction(viewPreset, viewId)
  // Derived from the remote clip, so switching Player / Ideal Form can never show the other
  // layer's model for a frame while the effects below catch up.
  const playbackUri = savedClip && savedClip.remote === remoteClip ? savedClip.uri : null
  const orbitReady = Boolean(playbackUri) && paintedUri === playbackUri
  const orbitVideoError = clipError && clipError.remote === (remoteClip ?? null) ? clipError.message : null
  /** Orbit is shown only after its file is on the phone and the player has painted a frame. */
  const reveal = Boolean(playbackUri) && orbitReady && !orbitVideoError
  durationRef.current =
    (playDurationMs && playDurationMs > 0 ? playDurationMs : null) ??
    (clipDurationMs && clipDurationMs > 0 ? clipDurationMs : 4000)
  // Clips are 24 fps. Without a server frame count, step at that rate instead of two coarse stops.
  frameCountRef.current = Math.max(2, clipFrameCount ?? Math.round((durationRef.current / 1000) * 24))
  clipWidthRef.current = clipWidth ?? 0
  scrub.clip = playbackUri
  // Tall stage right of the body-part rail (Figma 6266:55785) — flex fills leftover height.
  const stageWidth = Math.max(1, windowWidth - 40 - RAIL_W - RAIL_GAP)
  const fallbackStageH = Math.max(360, windowHeight - (300 + insets.bottom))

  const severityByPart = useMemo(() => {
    const map = {} as Record<BodyPart, PartSeverity>
    for (const id of PART_LIST) {
      const served = (SERVED as readonly string[]).includes(id)
        ? contactJoints?.joints[id as ContactJoint]
        : undefined
      map[id] = partSeverity(served, id, errors)
    }
    return map
  }, [contactJoints, errors])

  /** Compare tab priority rows — high first, then adjust (Figma 6196:105280 / 105308). */
  const compareFixes = useMemo(() => {
    type Fix = {
      id: BodyPart
      sev: NonNullable<PartSeverity>
      you: number | null
      target: number | null
      diff: number | null
    }
    const rows: Fix[] = []
    for (const id of PART_LIST) {
      const sev = severityByPart[id]
      if (!sev) continue
      const joint = DETAIL_JOINT[id]
      const reading = joint ? contactJoints?.joints[joint] : undefined
      const you = reading?.you ?? null
      const target =
        reading?.pro ??
        (reading?.idealMax != null && reading?.idealMin != null
          ? (reading.idealMin + reading.idealMax) / 2
          : reading?.idealMax ?? reading?.idealMin ?? null)
      const diff =
        reading?.deltaDeg ?? (you != null && target != null ? you - target : null)
      rows.push({ id, sev, you, target, diff })
    }
    rows.sort((a, b) => {
      if (a.sev !== b.sev) return a.sev === 'high' ? -1 : 1
      return Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0)
    })
    const top = rows.find((r) => r.sev === 'high') ?? rows[0] ?? null
    const secondary = rows.filter((r) => r !== top).slice(0, 2)
    return { top, secondary }
  }, [severityByPart, contactJoints])

  useEffect(() => {
    setOrbitIndex(0)
    orbitIndexRef.current = 0
    holdMs.current = 0
    // Drop any paint or play-through still running on the previous clip.
    scrub.gen += 1
    scrub.running = false
    scrub.target = 0
    scrub.shown = -1
    scrub.settle?.done()
    scrub.frames = null
    scrub.shotUri = null
    scrub.shotUp = null
    scrub.pass = false
    setFrameShot(null)
    setFramePass(null)
    setPaintedUri(null)
    setClipError(null)
    setOrbitUrlHttp(null)
    setNaturalClip(null)
    setPlayDurationMs(null)
    if (layer === 'overlay') setViewPreset('view')
  }, [remoteClip, layer])

  // Leaving Smart 3D stops any paint or frame play-through still running.
  useEffect(
    () => () => {
      scrub.gen += 1
    },
    [scrub]
  )

  // Overlay: snap the player orbit to the same View 1/2/3 fraction as Ideal Form.
  useEffect(() => {
    if (layer !== 'overlay' || !reveal || !playbackUri) return
    const length =
      (playDurationMs && playDurationMs > 0 ? playDurationMs : null) ??
      (clipDurationMs && clipDurationMs > 0 ? clipDurationMs : null) ??
      durationRef.current
    durationRef.current = length
    const ms = Math.round(Math.max(0, Math.min(1, overlayFraction)) * length)
    holdMs.current = ms
    orbitIndexRef.current = Math.round(overlayFraction * Math.max(0, frameCountRef.current - 1))
    setOrbitIndex(orbitIndexRef.current)
    const player = videoRef.current
    if (!player) return
    void player
      .setStatusAsync({
        shouldPlay: true,
        positionMillis: ms,
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
  }, [layer, reveal, overlayFraction, viewPreset, playbackUri, orbitReady, playDurationMs, clipDurationMs])

  // Save the cloud video on the phone first. Scrubbing a stream is what made a fresh shot look broken.
  // cacheOrbitVideo keeps the download alive if the user leaves Smart 3D mid-save.
  useEffect(() => {
    const remote = remoteClip
    setOrbitUrlHttp(null)
    setClipError(null)
    if (!remote) return
    let cancelled = false
    if (__DEV__) console.log('[smart3d] orbit save', { remote: remote.slice(0, 160) })
    void (async () => {
      try {
        const uri = await cacheOrbitVideo(remote)
        if (cancelled) return
        if (__DEV__) {
          console.log('[smart3d] orbit on phone', uri)
          // HEAD after download only — parallel HEAD + download often aborts on Android/ngrok.
          void fetch(remote, { method: 'HEAD' })
            .then((head) => {
              if (!cancelled) setOrbitUrlHttp(head.status || null)
            })
            .catch(() => {})
        }
        setSavedClip({ remote, uri })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (__DEV__) console.warn('[smart3d] orbit save failed; streaming remote', msg)
        // Emulator/ngrok can abort File.downloadFileAsync (SocketException). Play the remote
        // URL instead of a hard error — TestFlight rarely hits this path.
        if (!cancelled) setSavedClip({ remote, uri: remote })
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

  // The functions from here to the pan responder are reached from handlers created on the
  // first render, so they read refs only.

  /** Time to seek to so that exactly this frame is the one drawn. */
  function frameMillis(frame: number) {
    const per = durationRef.current / Math.max(frameCountRef.current, 1)
    // ExoPlayer draws the first frame at or after the seek time; AVPlayer the frame containing it.
    const ms = Platform.OS === 'android' ? frame * per - per / 2 : frame * per + per / 2
    return Math.round(Math.max(0, Math.min(durationRef.current - 1, ms)))
  }

  /** Waits for the pending paint: resolved when it is drawn, or after `timeoutMs`. */
  function awaitPaint(shot: boolean, timeoutMs: number) {
    return new Promise<void>((resolve) => {
      const entry = {
        sawBuffering: false,
        shot,
        done: () => {
          clearTimeout(timer)
          if (scrub.settle === entry) scrub.settle = null
          resolve()
        },
      }
      const timer = setTimeout(entry.done, timeoutMs)
      scrub.settle = entry
    })
  }

  /** Shows a saved frame picture over the video. Resolves once it is on screen. */
  function paintShot(frame: number, uri: string) {
    // Same render as the picture, so the markers and the model move as one.
    setOrbitIndex(frame)
    if (scrub.shotUri === uri) return Promise.resolve()
    const drawn = awaitPaint(true, SHOT_SETTLE_TIMEOUT_MS)
    scrub.shotUri = uri
    setFrameShot({ clip: scrub.clip ?? '', uri })
    return drawn
  }

  /** Seeks the video to a frame. Resolves once that frame is on screen. */
  async function paintSeek(frame: number) {
    const player = videoRef.current
    if (!player) return
    const ms = frameMillis(frame)
    holdMs.current = ms
    if (Platform.OS !== 'android') {
      // iOS only paints a new frame if playback is asked to start at that time. Pause on the
      // same timestamp so the clip steps with the finger. Both calls resolve when the seek is done.
      const at = { positionMillis: ms, seekMillisToleranceBefore: 0, seekMillisToleranceAfter: 0 }
      await player.setStatusAsync({ shouldPlay: true, ...at })
      await player.setStatusAsync({ shouldPlay: false, ...at })
      return
    }
    // On Android the call resolves as soon as the player accepts the seek, well before the
    // frame is decoded. The frame is drawn once playback status goes buffering and back.
    const drawn = awaitPaint(false, SEEK_SETTLE_TIMEOUT_MS)
    try {
      await player.setStatusAsync({ shouldPlay: false, positionMillis: ms })
    } catch (e) {
      scrub.settle?.done()
      throw e
    }
    await drawn
  }

  /** Puts a frame on screen, or the closest one there is a picture for. Returns the frame shown. */
  async function paintFrame(frame: number) {
    const set = scrub.frames
    if (set) {
      const near = nearestOrbitFrame(set, frame)
      const uri = near >= 0 ? set.uris[near] : null
      if (!uri) return scrub.shown
      await paintShot(near, uri)
      return near
    }
    await paintSeek(frame)
    if (scrub.shotUri) {
      scrub.shotUri = null
      setFrameShot(null)
    }
    return frame
  }

  /**
   * Moves the orbit to a frame. Paints are never stacked: the next starts when the current one
   * is on screen, and always goes to wherever the finger is by then. That matters most for
   * seeks, where a new seek cancels the decode of the one before it and nothing would be drawn
   * until the finger stopped. The markers move to each frame as it lands.
   */
  function showOrbitFrame(index: number) {
    const last = frameCountRef.current - 1
    const clamped = Math.min(last, Math.max(0, index))
    orbitIndexRef.current = clamped
    scrub.target = Math.round(clamped)
    if (scrub.running) return
    scrub.running = true
    const gen = scrub.gen
    void (async () => {
      while (scrub.gen === gen && scrub.shown !== scrub.target) {
        const want = scrub.target
        let got: number
        try {
          got = await paintFrame(want)
        } catch {
          // The player went away mid-seek. The next drag starts a fresh run.
          break
        }
        if (scrub.gen !== gen) return
        scrub.shown = got
        setOrbitIndex(got)
        // The closest saved frame is up. The play-through asks again as more are saved.
        if (got !== want && scrub.target === want) break
      }
      if (scrub.gen === gen) scrub.running = false
    })()
  }

  /**
   * Android: saves the orbit frames as pictures, so that turning the model swaps pictures
   * instead of seeking. The clip is stepped through once, hidden under the picture of the frame
   * being shown: play a frame's worth, pause, capture. Capturing a playing clip is several
   * times slower and holds whichever frame came up meanwhile, so each one is taken at rest.
   * A clip that was stepped through on an earlier visit already has its pictures.
   */
  async function prepareFrames(gen: number) {
    const player = videoRef.current
    const wrap = clipShotRef.current
    const clip = scrub.clip
    if (!player || !wrap || !clip) return
    const count = frameCountRef.current
    // Pictures are the shape of the stage and about the resolution of the clip.
    const width = Math.round(clipWidthRef.current || 496)
    const height = Math.round((width * stageHRef.current) / Math.max(stageWRef.current, 1))
    const set = orbitFrameSet(orbitFrameKey(clip, width, height), count)
    scrub.frames = set
    try {
      if (!set.complete) {
        const shoot = () => captureRef(wrap, { format: 'jpg', quality: 0.85, result: 'tmpfile', width, height })
        const saved = () => set.uris.reduce((n, uri) => (uri ? n + 1 : n), 0)
        // The clip is paused on its first frame, so this picture is exact.
        if (!set.uris[0]) saveOrbitFrame(set, 0, await shoot())
        if (scrub.gen !== gen) return
        // Cover the video before it starts to move. The video already shows this frame, so
        // without forgetting that, nothing is painted and the model is seen turning by itself.
        scrub.shown = -1
        showOrbitFrame(orbitIndexRef.current)
        while (scrub.running && scrub.gen === gen) await sleep(8)
        if (scrub.gen !== gen) return
        // Never start the clip moving unless its picture is really up.
        if (!scrub.shotUri || scrub.shotUp !== scrub.shotUri) throw new Error('frame picture did not appear')
        const per = durationRef.current / count
        const deadline = Date.now() + FRAME_PASS_TIMEOUT_MS
        scrub.pass = true
        setFramePass(saved() / count)
        for (let pass = 0; pass < FRAME_PASS_LIMIT && saved() < count && Date.now() < deadline; pass++) {
          // Later passes start over to pick up frames the one before stepped across.
          let status = await player.setStatusAsync(
            pass === 0 ? { shouldPlay: false } : { shouldPlay: false, positionMillis: 0 }
          )
          for (let i = 0; i < 50 && status.isLoaded && status.isBuffering; i++) {
            await sleep(20)
            status = await player.getStatusAsync()
          }
          let before = -1
          let stalled = 0
          while (Date.now() < deadline) {
            if (scrub.gen !== gen) return
            if (!status.isLoaded) throw new Error('orbit clip unloaded')
            const ms = status.positionMillis
            // Ended, or not moving: nothing more to get from this pass.
            stalled = ms > before ? 0 : stalled + 1
            if (stalled > 10) break
            before = ms
            // Frame on screen at this position, and how far into its time on screen.
            const onScreen = ms + FRAME_EARLY_MS
            const frame = Math.min(count - 1, Math.floor(onScreen / per))
            const into = onScreen - frame * per
            const early = into < FRAME_EDGE_MS
            const late = frame < count - 1 && into > per - FRAME_EDGE_MS
            if (!early && !late && !set.uris[frame]) {
              saveOrbitFrame(set, frame, await shoot())
              if (scrub.gen !== gen) return
              const n = saved()
              if (n % 4 === 0 || n === count) setFramePass(n / count)
              // The finger may be waiting on a frame that has just been saved.
              if (scrub.shown !== scrub.target) showOrbitFrame(orbitIndexRef.current)
            }
            let next = early && !set.uris[frame] ? frame : frame + 1
            while (next < count && set.uris[next]) next += 1
            if (next >= count) break
            // Play up to just inside the next missing frame's time on screen, then stop there.
            const aim = next * per - FRAME_EARLY_MS + FRAME_EDGE_MS + FRAME_AIM_MS
            // Timers run late, so stop short and let the bare steps (a few ms each) close in.
            const dwell = aim - ms - FRAME_STEP_MS - FRAME_SHORT_MS
            await player.setStatusAsync({ shouldPlay: true })
            if (dwell > 1) await sleep(dwell)
            status = await player.setStatusAsync({ shouldPlay: false })
          }
          if (__DEV__) console.log('[smart3d] orbit frame pass', pass, 'saved', saved(), 'of', count)
        }
        if (scrub.gen !== gen) return
        scrub.pass = false
        setFramePass(null)
        await player.setStatusAsync({ shouldPlay: false })
        if (__DEV__) console.log('[smart3d] orbit frames saved', saved(), 'of', count)
        if (saved() < count * FRAME_PASS_MIN_SHARE) throw new Error('too few orbit frames saved')
        // Kept for later visits only when nearly whole; otherwise the next visit fills it in.
        if (saved() >= count * FRAME_PASS_KEEP_SHARE) finishOrbitFrameSet(set)
      }
      if (scrub.gen === gen) showOrbitFrame(orbitIndexRef.current)
    } catch (e) {
      if (scrub.gen !== gen) return
      if (__DEV__) console.warn('[smart3d] orbit frames unavailable, seeking instead', e)
      // No pictures: turn the model by seeking the video.
      scrub.pass = false
      scrub.frames = null
      scrub.shown = -1
      setFramePass(null)
      showOrbitFrame(orbitIndexRef.current)
    }
  }

  function onOrbitStatus(status: AVPlaybackStatus) {
    // Ready as soon as the player has loaded — do not wait for iOS play≥80ms (that left the still stuck).
    if (!status.isLoaded) {
      if ('error' in status && status.error) {
        if (__DEV__) console.warn('[smart3d] orbit status error', status.error)
        setClipError({ remote: remoteClip ?? null, message: String(status.error) })
      }
      return
    }
    // iOS is ready once the player has loaded (waiting for its display event left the stage
    // stuck). Android waits for the first drawn frame, so the stage never opens empty.
    if (Platform.OS !== 'android' && playbackUri && paintedUri !== playbackUri) setPaintedUri(playbackUri)
    // The frame play-through starts and stops the clip itself.
    if (scrub.pass) return
    const settle = scrub.settle
    if (settle && !settle.shot) {
      if (status.isBuffering) settle.sawBuffering = true
      else if (settle.sawBuffering) settle.done()
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
        showOrbitFrame(grantIndex.current + delta)
      },
    })
  ).current
  const solo = layer === 'player' || layer === 'pro'
  const proFailed = hologram.proStatus === 'failed' || hologram.proStatus === 'unavailable'
  const playerFailed = hologram.ready && hologram.orbitStatus === 'failed' && !hologram.orbitVideo
  const proMissing = layer === 'pro' && hologram.ready && proFailed && !hologram.proOrbitVideo
  const clipBroken = Boolean(orbitVideoError) || (layer === 'player' && playerFailed)
  // The contact still is framed differently from the orbit, so it is never shown on the way to
  // one: the model would change size when the clip took over. It stands in only when this layer
  // has no orbit to show at all, and then it is the one picture for the whole visit.
  const stillUri = layer === 'pro' ? hologram.proImage : layer === 'player' ? hologram.image : null
  const showStill =
    solo && !reveal && (clipBroken || proMissing) && Boolean(stillUri) && stillFailedUri !== stillUri
  const stillLoaded = showStill && stillSize?.uri === stillUri ? stillSize : null
  /** Frame picture over the video, only for the clip it was taken from. */
  const shot = solo && reveal && frameShot?.clip === playbackUri ? frameShot : null
  const preparing = solo && !reveal && !proMissing && !clipBroken
  const lit = selected ? partKeypoints(selected, contactJoints?.side ?? 'RIGHT') : []
  // Prefer per-frame orbit pose. Do not fall back to the contact still while the orbit plays —
  // that pinned dots to impact pose while the camera turned.
  const stillKeys = layer === 'pro' ? hologram.proKeypoints : hologram.keypoints
  // Overlay is holographics only — no MediaPipe joint dots.
  const markerKeys =
    layer === 'overlay'
      ? null
      : reveal
        ? orbitKeypointsAt(clipFrames, orbitIndex, frameCountRef.current) ??
          (clipFrames?.length ? null : stillKeys)
        : stillLoaded
          ? stillKeys
          : null
  const stageW = stageSize.w || stageWidth
  const stageH = stageSize.h || fallbackStageH
  // Prefer real orbit/natural size so dots track the COVER-fitted video in a tall stage.
  // Fall back to square hologram stills only before video metadata arrives.
  const placed =
    stageW && stageH
      ? stillLoaded
        ? containPlacement(stageW, stageH, stillLoaded.w, stillLoaded.h)
        : coverPlacement(
            stageW,
            stageH,
            clipWidth && clipHeight ? clipWidth : 1024,
            clipWidth && clipHeight ? clipHeight : 1024
          )
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
    { id: 'pro' as const, label: t('analysis.idealForm') },
    { id: 'compare' as const, label: t('analysis.smart3dCompare') },
    { id: 'overlay' as const, label: t('analysis.smart3dOverlay') },
  ]
  const modeTabs = [
    { id: '3d' as const, label: t('analysis.threeDMovement') },
    { id: 'kinetic' as const, label: t('analysis.kineticAnalysis') },
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
    // Feet is client-only — no /joints payload. Elbow/knee/etc. use the API when present.
    const served =
      detail === 'feet' ? null : (contactJoints?.joints[detail as ContactJoint] ?? null)
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
        onClose={() => {
          if (detailFromEntry) onClose()
          else setDetail(null)
        }}
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
          <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.mediumFont }]}>
            {t('analysis.smart3dTitle')}
          </Text>
          <Text allowFontScaling={false} style={[styles.subtitle, { fontFamily: theme.mediumFont }]}>
            {t('analysis.smart3dSubtitle')}
          </Text>
        </View>
        <View style={styles.back} />
        <Pressable accessibilityRole="button" testID="smart3d-view-chip" style={styles.viewChip}>
          <Ionicons name="scan-outline" size={14} color="#FFFFFF" />
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.viewChipText, { fontFamily: theme.mediumFont }]}>
            {t('analysis.view3d')}
          </Text>
        </Pressable>
      </View>
      <ResultSectionPill tabs={modeTabs} value={mode} onChange={setMode} trackStyle={styles.modePill} />
      {mode === 'kinetic' ? (
        <View style={styles.kineticWrap}>
          <KineticChainTimingView
            timing={timing}
            embedded
            onClose={() => setMode('3d')}
            onDrills={onDrills}
          />
        </View>
      ) : (
      <View style={styles.main3d}>
      <ResultSectionPill tabs={tabs} value={uiLayer} onChange={setUiLayer} trackStyle={styles.layerPill} />
      {isCompare ? (
        <ScrollView
          style={styles.compareScroll}
          contentContainerStyle={[styles.compareContent, { paddingBottom: 16 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          testID="smart3d-compare"
        >
          <View style={styles.compareVideos}>
            <CompareCard
              video={hologram.orbitVideo}
              image={hologram.image}
              label={t('analysis.yourShot')}
              accent={COMPARE_YOU}
              headerBg="rgba(0, 72, 255, 0.25)"
              icon={ICON_YOUR_SHOT}
              testID="smart3d-compare-you"
              emptyText={t('analysis.smart3dViewBuilding')}
              fontFamily={theme.mediumFont}
            />
            <CompareCard
              video={hologram.proOrbitVideo}
              image={hologram.proImage}
              label={t('analysis.idealForm')}
              accent={COMPARE_IDEAL}
              headerBg="rgba(255, 255, 255, 0.1)"
              icon={ICON_IDEAL}
              testID="smart3d-compare-ideal"
              emptyText={proFailed ? t('analysis.smart3dProMissing') : t('analysis.smart3dViewBuilding')}
              fontFamily={theme.mediumFont}
            />
          </View>

          {compareFixes.top ? (
            <View style={styles.fixSection}>
              <View style={styles.fixSectionHead}>
                <View style={[styles.fixSectionIcon, styles.fixSectionIconHigh]}>
                  <MaterialCommunityIcons name="target" size={18} color="#FF4D4D" />
                </View>
                <Text allowFontScaling={false} style={[styles.fixSectionTitle, { fontFamily: theme.mediumFont }]}>
                  {t('analysis.topPriority')}
                </Text>
                <Text allowFontScaling={false} style={[styles.fixSectionSub, { fontFamily: theme.mediumFont }]}>
                  {t('analysis.fixFirst')}
                </Text>
              </View>
              <CompareFixRow
                part={compareFixes.top.id}
                you={compareFixes.top.you}
                target={compareFixes.top.target}
                diff={compareFixes.top.diff}
                sev="high"
                badge={3}
                thumbUri={hologram.image}
                onPress={() => pressPart(compareFixes.top!.id)}
              />
            </View>
          ) : null}

          {compareFixes.secondary.length ? (
            <View style={styles.fixSection}>
              <View style={styles.fixSectionHead}>
                <View style={[styles.fixSectionIcon, styles.fixSectionIconMed]}>
                  <MaterialCommunityIcons name="target" size={18} color={MEDIUM} />
                </View>
                <Text allowFontScaling={false} style={[styles.fixSectionTitle, { fontFamily: theme.mediumFont }]}>
                  {t('analysis.secondaryFixes')}
                </Text>
                <Text allowFontScaling={false} style={[styles.fixSectionSub, { fontFamily: theme.mediumFont }]}>
                  {t('analysis.improveNext')}
                </Text>
              </View>
              {compareFixes.secondary.map((fix, i) => (
                <CompareFixRow
                  key={fix.id}
                  part={fix.id}
                  you={fix.you}
                  target={fix.target}
                  diff={fix.diff}
                  sev="medium"
                  badge={4 + i}
                  thumbUri={hologram.image}
                  onPress={() => pressPart(fix.id)}
                  divider={i > 0}
                />
              ))}
            </View>
          ) : null}

          {onDrills ? (
            <GlowButton
              label={t('analysis.drillExercises')}
              onPress={onDrills}
              testID="smart3d-compare-drills"
              arrow
            />
          ) : null}
        </ScrollView>
      ) : (
      <View style={styles.stageRow}>
      <BodyPartRail
        selected={selected}
        severityByPart={severityByPart}
        onSelect={pressPart}
        testIDPrefix="smart3d-part"
      />
      <View
        collapsable={false}
        style={styles.stage}
        onLayout={(e) => {
          stageWRef.current = e.nativeEvent.layout.width
          stageHRef.current = e.nativeEvent.layout.height
          setStageSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }}
      >
        {/* Clip oversized 9:16 AVPlayerLayer so it cannot float over the part buttons. */}
        <View collapsable={false} style={styles.stageClip} pointerEvents="box-none">
          {pictureUri ? (
            // Its own view, so a capture of it holds the model and nothing drawn over it.
            <View ref={clipShotRef} collapsable={false} pointerEvents="none" style={styles.clipShot}>
            <Video
              // Overlay View 1/2/3 remount so the paused frame actually changes on Android.
              key={layer === 'overlay' ? `overlay-player-${viewPreset}-${pictureUri}` : `orbit-${pictureUri}`}
              ref={videoRef}
              source={{ uri: pictureUri }}
              pointerEvents="none"
              // Full-bleed COVER into the rectangular stage; JointMarkers use the same cover math.
              resizeMode={ResizeMode.COVER}
              isMuted
              shouldPlay={false}
              progressUpdateIntervalMillis={100}
              onLoad={(status) => {
                if (status.isLoaded) {
                  if (typeof status.durationMillis === 'number' && status.durationMillis > 0) {
                    setPlayDurationMs(status.durationMillis)
                    durationRef.current = status.durationMillis
                  }
                  if (status.naturalSize?.width && status.naturalSize?.height) {
                    const { width: nw, height: nh, orientation } = status.naturalSize
                    // Only swap when orientation contradicts the pixel aspect (Android often lies).
                    const pixelsPortrait = nh >= nw
                    const orientPortrait = orientation === 'portrait'
                    const swapped = orientPortrait !== pixelsPortrait
                    setNaturalClip({ w: swapped ? nh : nw, h: swapped ? nw : nh })
                  }
                }
                const player = videoRef.current
                if (!player) return
                if (__DEV__) {
                  console.log('[smart3d] orbit onLoad', {
                    uri: pictureUri.slice(0, 80),
                    platform: Platform.OS,
                    frame: orbitIndexRef.current,
                    naturalSize: status.isLoaded ? status.naturalSize : null,
                    stage: { w: stageWRef.current, h: stageSize.h },
                  })
                }
                if (layer !== 'overlay') {
                  // A freshly mounted clip: nothing that was running on the last one applies.
                  scrub.gen += 1
                  scrub.running = false
                  scrub.pass = false
                  scrub.settle?.done()
                  holdMs.current = 0
                  if (Platform.OS !== 'android') {
                    // Back from a joint close-up the orbit returns to the frame it was left on.
                    scrub.shown = -1
                    showOrbitFrame(orbitIndexRef.current)
                    return
                  }
                  // Android draws the first frame of a paused clip by itself. Playing it for a
                  // moment to force a paint made the model twitch as the view opened.
                  scrub.shown = 0
                  const mount = (scrub.mount += 1)
                  // onReadyForDisplay normally reveals the stage and starts the frame pictures.
                  // If it never comes, reveal anyway and turn the model by seeking.
                  setTimeout(() => {
                    if (scrub.mount !== mount || scrub.startedMount === mount) return
                    scrub.startedMount = mount
                    setPaintedUri((uri) => uri ?? pictureUri)
                    showOrbitFrame(orbitIndexRef.current)
                  }, 800)
                  return
                }
                const at = Math.round(
                  Math.max(0, Math.min(1, overlayFraction)) *
                    ((status.isLoaded && status.durationMillis) || durationRef.current)
                )
                holdMs.current = at
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
                setPaintedUri(pictureUri)
                if (__DEV__) console.log('[smart3d] orbit frame on screen')
                // First frame of this mount is drawn: it can be captured, so start the pictures.
                if (Platform.OS === 'android' && layer !== 'overlay' && scrub.startedMount !== scrub.mount) {
                  scrub.startedMount = scrub.mount
                  void prepareFrames(scrub.gen)
                }
              }}
              onPlaybackStatusUpdate={onOrbitStatus}
              onError={(e) => {
                const msg = typeof e === 'string' ? e : JSON.stringify(e)
                if (__DEV__) console.warn('[smart3d] orbit video error', msg)
                setClipError({ remote: remoteClip ?? null, message: msg })
              }}
              style={StyleSheet.absoluteFillObject}
            />
            </View>
          ) : null}
          {/* Saved picture of the frame being shown. Swapping these is what turns the model. */}
          {shot ? (
            <FrameImage
              source={{ uri: shot.uri }}
              contentFit="fill"
              transition={0}
              cachePolicy="memory"
              style={styles.frameShot}
              testID="smart3d-frame"
              onLoad={() => {
                scrub.shotUp = shot.uri
                if (scrub.settle?.shot) scrub.settle.done()
              }}
            />
          ) : null}
          {/* Frames still being saved: the model turns as far as they reach. */}
          {shot && framePass != null ? (
            <View pointerEvents="none" style={styles.framePass} testID="smart3d-frame-pass">
              <View style={[styles.framePassFill, { width: `${Math.round(framePass * 100)}%` }]} />
            </View>
          ) : null}
          {/* Player / Ideal Form with no orbit to show: the contact still, whole and unscaled. */}
          {showStill && stillUri ? (
            <Image
              source={{ uri: stillUri }}
              resizeMode="contain"
              style={StyleSheet.absoluteFillObject}
              testID="smart3d-still"
              onLoad={(e) => {
                const { width, height } = e.nativeEvent.source
                if (width > 0 && height > 0) setStillSize({ uri: stillUri, w: width, h: height })
              }}
              onError={() => {
                if (__DEV__) console.warn('[smart3d] still image failed', stillUri.slice(0, 120))
                setStillFailedUri(stillUri)
              }}
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
            />
          ) : layer === 'overlay' && hologram.proImage ? (
            <Image
              source={{ uri: hologram.proImage }}
              resizeMode="cover"
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { opacity: 0.4, zIndex: 2 }]}
            />
          ) : null}
          {markerKeys && stageSize.w ? (
            <JointMarkers
              keypoints={markerKeys}
              w={stageSize.w}
              h={stageSize.h}
              lit={lit}
              video={placed}
              color={
                selected
                  ? severityColor(severityByPart[selected]) ?? '#7AECFF'
                  : '#7AECFF'
              }
            />
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
          {proMissing && !showStill ? (
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
            <SmartViewPresets value={viewPreset} onChange={setViewPreset} />
          </View>
        ) : null}
      </View>
      </View>
      )}
      </View>
      )}
    </View>
  )
}

function CompareFixRow({
  part,
  you,
  target,
  diff,
  sev,
  badge,
  thumbUri,
  onPress,
  divider = false,
}: {
  part: BodyPart
  you: number | null
  target: number | null
  diff: number | null
  sev: 'high' | 'medium'
  badge: number
  thumbUri: string | null
  onPress: () => void
  divider?: boolean
}) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const tone = sev === 'high' ? '#E53C3C' : MEDIUM
  const pillLabel = sev === 'high' ? t('analysis.mistakeHighPriority') : t('analysis.adjustPriority')
  const titleKey = FIX_TITLE[part] ?? `analysis.viewAnglesPage.joints.${part}`
  const fmt = (n: number) => `${Math.round(n)}°`
  const fmtDiff = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)}°`

  return (
    <>
      {divider ? <View style={styles.fixDivider} /> : null}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={styles.fixRow}
        testID={`smart3d-compare-fix-${part}`}
      >
        <View style={styles.fixThumb}>
          {thumbUri ? (
            <Image source={{ uri: thumbUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#041641' }]} />
          )}
          <View style={[styles.fixBadge, { backgroundColor: tone }]}>
            <Text allowFontScaling={false} style={[styles.fixBadgeText, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}>
              {badge}
            </Text>
          </View>
        </View>
        <View style={styles.fixCopy}>
          <View style={styles.fixTitleRow}>
            <BodyPartIcon id={part} size={20} severity={sev} />
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.fixTitle, { fontFamily: theme.mediumFont }]}>
              {t(titleKey)}
            </Text>
          </View>
          <View style={styles.fixMetrics}>
            <Text allowFontScaling={false} style={[styles.fixYou, { color: tone, fontFamily: theme.mediumFont }]}>
              {you != null ? fmt(you) : '—'}
            </Text>
            <View style={styles.fixMeta}>
              <Text allowFontScaling={false} style={[styles.fixMetaLine, { fontFamily: theme.mediumFont }]}>
                {t('analysis.viewAnglesPage.target')}
                <Text style={{ color: GOOD }}>{target != null ? fmt(target) : '—'}</Text>
              </Text>
              <Text allowFontScaling={false} style={[styles.fixMetaLine, { fontFamily: theme.mediumFont }]}>
                {t('analysis.viewAnglesPage.difference')}
                <Text style={{ color: tone }}>{diff != null ? fmtDiff(diff) : '—'}</Text>
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.fixPill, { borderColor: tone, backgroundColor: sev === 'high' ? 'rgba(255,0,4,0.2)' : 'rgba(255,128,0,0.15)' }]}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.fixPillText, { color: sev === 'high' ? '#FF7676' : MEDIUM, fontFamily: theme.mediumFont }]}>
            {pillLabel}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#86A7D2" />
      </Pressable>
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, position: 'relative' },
  back: { width: 20, alignItems: 'center', justifyContent: 'center' },
  titleCopy: { flex: 1, alignItems: 'center', paddingHorizontal: 56 },
  title: { color: UI.text, fontSize: 22, textAlign: 'center' },
  subtitle: { color: '#00B8FF', fontSize: 13, textAlign: 'center' },
  modePill: { marginBottom: 16 },
  layerPill: { marginBottom: 0 },
  main3d: { flex: 1, minHeight: 0, gap: 10, alignSelf: 'stretch' },
  stage: {
    flex: 1,
    alignSelf: 'stretch',
    minWidth: 0,
    minHeight: 0,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#0066FF',
    backgroundColor: '#020A1C',
    // Must clip: the COVER video fills this rectangular stage edge-to-edge.
    overflow: 'hidden',
    boxShadow: 'inset 0px 0px 50px 0px rgba(0, 102, 255, 0.5)',
  },
  stageClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  clipShot: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  // Above the video and the Overlay tab's second orbit, below the joint markers.
  frameShot: { ...StyleSheet.absoluteFillObject, zIndex: 3 },
  framePass: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(122,236,255,0.18)',
    zIndex: 6,
  },
  framePassFill: { height: 2, borderRadius: 1, backgroundColor: '#7AECFF' },
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
  stageRow: {
    flex: 1,
    flexDirection: 'row',
    gap: RAIL_GAP,
    alignItems: 'stretch',
    alignSelf: 'stretch',
    minHeight: 0,
    minWidth: 0,
  },
  kineticWrap: { flex: 1 },
  viewChip: {
    position: 'absolute',
    right: 0,
    top: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: '#0048FF',
    boxShadow: 'inset 0px 0px 16px 0px rgba(0, 72, 255, 0.25)',
  },
  viewChipText: { color: '#FFFFFF', fontSize: 9 },
  compareScroll: { flex: 1, minHeight: 0 },
  compareContent: { gap: 10 },
  compareVideos: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  compareCard: {
    flex: 1,
    minWidth: 0,
    height: 290,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#030A17',
  },
  compareCardHead: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 2,
  },
  compareCardTitle: { color: '#FFFFFF', fontSize: 13 },
  compareCardBody: { flex: 1, minHeight: 0, backgroundColor: '#030A17' },
  compareEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  compareEmptyText: { color: '#BFE6FF', fontSize: 12, lineHeight: 16, textAlign: 'center' },
  fixSection: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#001950',
    backgroundColor: '#030A17',
    overflow: 'hidden',
    boxShadow: 'inset 0px 0px 20px 0px #0048FF',
  },
  fixSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: 'rgba(7, 37, 109, 0.5)',
  },
  fixSectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  fixSectionIconHigh: {
    backgroundColor: 'rgba(255, 0, 0, 0.25)',
    borderColor: '#FF0000',
  },
  fixSectionIconMed: {
    backgroundColor: 'rgba(255, 128, 0, 0.25)',
    borderColor: MEDIUM,
  },
  fixSectionTitle: { color: '#FFFFFF', fontSize: 16 },
  fixSectionSub: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 9 },
  fixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 15,
    paddingRight: 10,
    paddingVertical: 10,
  },
  fixDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(134,167,210,0.25)',
    marginLeft: 15,
  },
  fixThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#00B8FF',
    overflow: 'hidden',
    backgroundColor: '#030A17',
  },
  fixBadge: {
    position: 'absolute',
    left: 5,
    top: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixBadgeText: { color: '#FFFFFF', fontSize: 9 },
  fixCopy: { flex: 1, minWidth: 0, gap: 5 },
  fixTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  fixTitle: { color: '#FFFFFF', fontSize: 16, flexShrink: 1 },
  fixMetrics: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  fixYou: { fontSize: 32, lineHeight: 36 },
  fixMeta: { flex: 1, gap: 2 },
  fixMetaLine: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  fixPill: {
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 88,
  },
  fixPillText: { fontSize: 11 },
})
