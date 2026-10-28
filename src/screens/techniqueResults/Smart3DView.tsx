import { Fragment, useContext, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  BackHandler,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { ResizeMode, Video } from 'expo-av'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import Svg, { Circle, Line } from 'react-native-svg'
import { ThemeContext } from '../../context'
import { ResultSectionPill } from '../../components/ResultSectionPill'
import { useHologram, type HologramKeypoints, type HologramOrbitFrame } from '../../lib/hologramJob'
import { useContactJoints, type ContactJoint } from '../../lib/jointsApi'
import { JointDetailView } from './JointDetailView'

type Layer = 'player' | 'pro' | 'overlay'
type BodyPart = 'head' | 'shoulder' | 'elbow' | 'wrist' | 'torso' | 'knee' | 'feet' | 'racket'

type Props = {
  /** Saved analysis whose ball-contact hologram replaces the stock figure once it is built. */
  analysisId?: string | null
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

/** MediaPipe frame closest to the scrub position. */
function orbitKeypointsAt(frames: HologramOrbitFrame[] | null, index: number): HologramKeypoints | null {
  if (!frames?.length) return null
  let best = frames[0]
  let dist = Math.abs(best.frame - index)
  for (const row of frames) {
    const d = Math.abs(row.frame - index)
    if (d < dist) {
      best = row
      dist = d
    }
  }
  return best.keypoints
}

/**
 * The orbit file is the square hologram still with black bars above and below.
 * Draw the full frame so those bars fall outside the stage and the still fills it.
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
      const d = Math.max(w, h)
      return { x: (w - d) / 2 + p.x * d, y: (h - d) / 2 + p.y * d }
    }
    return { x: video.x + p.x * video.w, y: video.y + p.y * video.h }
  }
  const names = [...BASE_MARKERS, ...lit.filter((name) => !BASE_MARKERS.includes(name))]
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
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

export function Smart3DView({ analysisId, onClose }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const [layer, setLayer] = useState<Layer>('player')
  const [selected, setSelected] = useState<BodyPart | null>(null)
  const hologram = useHologram(analysisId)
  const contactJoints = useContactJoints(analysisId)
  const [detail, setDetail] = useState<ContactJoint | null>(null)
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })
  const videoRef = useRef<Video>(null)
  const [orbitIndex, setOrbitIndex] = useState(0)
  const [videoReady, setVideoReady] = useState(false)
  const orbitIndexRef = useRef(0)
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
    setVideoReady(false)
    setOrbitIndex(0)
    orbitIndexRef.current = 0
  }, [hologram.orbitVideo])

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

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
      onPanResponderGrant: () => {
        grantIndex.current = orbitIndexRef.current
      },
      onPanResponderMove: (_, g) => {
        const last = frameCountRef.current - 1
        const delta = (g.dx / Math.max(stageWRef.current, 1)) * last
        seekOrbit(grantIndex.current + delta)
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current
  /** Player hologram is blue; the pro reference is the red render of the matched library clip. */
  const holoImage = layer === 'pro' ? hologram.proImage : hologram.image
  const holoKeys = layer === 'pro' ? hologram.proKeypoints : hologram.keypoints
  const building =
    layer === 'pro'
      ? hologram.proStatus === 'running'
      : hologram.status === 'running' ||
        (layer === 'player' && hologram.orbitStatus === 'running' && !hologram.orbitVideo) ||
        (layer === 'overlay' && hologram.proStatus === 'running')
  const lit = selected ? partKeypoints(selected, contactJoints?.side ?? 'RIGHT') : []
  const markerKeys = showOrbit ? orbitKeypointsAt(hologram.orbitFrames, orbitIndex) : holoKeys
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
    return (
      <JointDetailView
        joint={detail}
        reading={contactJoints?.joints[detail] ?? null}
        shotLabel={contactJoints?.shotLabel ?? null}
        side={contactJoints?.side ?? 'RIGHT'}
        hologramImage={hologram.image}
        proHologramImage={hologram.proImage}
        keypoints={hologram.keypoints}
        proKeypoints={hologram.proKeypoints}
        onClose={() => setDetail(null)}
      />
    )
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 8 + insets.bottom }}
    >
      <View style={styles.titleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('analysis.back')}
          hitSlop={12}
          onPress={onClose}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={24} color="#86A7D2" />
        </Pressable>
        <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.semiBoldFont }]}>
          {t('analysis.smart3dTitle')}
        </Text>
      </View>
      <ResultSectionPill tabs={tabs} value={layer} onChange={setLayer} trackStyle={styles.pill} />
      <View
        style={[styles.stage, { height: stageHeight }]}
        onLayout={(e) => {
          stageWRef.current = e.nativeEvent.layout.width
          setStageSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }}
      >
        {showOrbit ? (
          <Video
            ref={videoRef}
            pointerEvents="none"
            source={{ uri: hologram.orbitVideo! }}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            isMuted
            onLoad={() => {
              const player = videoRef.current
              const reveal = () => setVideoReady(true)
              const timer = setTimeout(reveal, 1500)
              if (!player) return reveal()
              const gen = seekGen.current
              const at =
                orbitIndexRef.current === 0
                  ? 0
                  : (orbitIndexRef.current / Math.max(frameCountRef.current - 1, 1)) * durationRef.current
              void player
                .playAsync()
                .then(() => player.pauseAsync())
                .then(() => {
                  if (seekGen.current !== gen) return
                  return player.setPositionAsync(at)
                })
                .finally(() => {
                  clearTimeout(timer)
                  reveal()
                })
            }}
            onReadyForDisplay={() => setVideoReady(true)}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {(!showOrbit || !videoReady) && holoImage ? (
          <Image
            source={{ uri: holoImage }}
            resizeMode={showOrbit ? 'contain' : 'cover'}
            style={StyleSheet.absoluteFill}
          />
        ) : !showOrbit ? (
          <Image
            source={BODY}
            resizeMode="cover"
            style={[StyleSheet.absoluteFill, layer === 'pro' && styles.bodyGhost]}
          />
        ) : null}
        {layer === 'overlay' && hologram.proImage ? (
          <Image source={{ uri: hologram.proImage }} resizeMode="cover" style={[StyleSheet.absoluteFill, { opacity: 0.72 }]} />
        ) : null}
        {markerKeys && stageSize.w ? (
          <JointMarkers keypoints={markerKeys} w={stageSize.w} h={stageSize.h} lit={lit} video={placed} />
        ) : null}
        {showOrbit ? <View style={StyleSheet.absoluteFill} {...pan.panHandlers} /> : null}
        {building ? (
          <View pointerEvents="none" style={styles.building}>
            <ActivityIndicator size="small" color="#7AECFF" />
            <Text allowFontScaling={false} style={[styles.buildingLabel, { fontFamily: theme.mediumFont }]}>
              {t(hologram.status === 'done' ? 'analysis.smart3dOrbitBuilding' : 'analysis.smart3dHologramBuilding')}
            </Text>
          </View>
        ) : null}
      </View>
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
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => pressPart(item.id)}
                  style={[styles.part, on && styles.partOn]}
                >
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[styles.partLabel, { fontFamily: on ? theme.semiBoldFont : theme.mediumFont }]}
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
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  back: { paddingVertical: 4, paddingRight: 4 },
  title: { color: '#FFFFFF', fontSize: 24 },
  pill: { marginBottom: 12 },
  stage: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#020A1C',
    overflow: 'hidden',
  },
  bodyGhost: { opacity: 0.42 },
  building: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buildingLabel: { color: '#7AECFF', fontSize: 12 },
  prompt: { color: '#5E8FD0', fontSize: 18, textAlign: 'center', marginTop: 14, marginBottom: 12 },
  parts: { gap: 10 },
  partsAfterOrbit: { marginTop: 14 },
  partRow: { flexDirection: 'row', gap: 10 },
  part: {
    flex: 1,
    height: 60,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(30, 80, 170, 0.55)',
    backgroundColor: '#030B22',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  partOn: {
    borderColor: '#3D9DFF',
    borderWidth: 2,
    backgroundColor: '#0A1C4E',
    shadowColor: '#1C8FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 6,
  },
  partLabel: { color: '#FFFFFF', fontSize: 16 },
})
