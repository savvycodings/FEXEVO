import { useContext, useEffect, useRef, useState } from 'react'
import { BackHandler, Image, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ResizeMode, Video } from 'expo-av'
import Svg, { Circle, Line } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { ThemeContext } from '../../context'
import { ResultSectionPill } from '../../components/ResultSectionPill'
import { CARD_GLOW, SELECTED_GLOW, UI } from '../../components/ui'
import type { ContactJoint, JointReading } from '../../lib/jointsApi'
import type { SegmentTiming } from '../../lib/kineticChain'
import type { HologramKeypoints, HologramOrbitFrame } from '../../lib/hologramJob'
import { orbitKeypointsAtFraction } from '../../lib/orbitKeypoints'
import { JOINT_ICON } from './jointIcons'
import { ChainLegend, KineticChainTimingView, TimingCard } from './KineticChainTiming'
import { alignKeypoints, orbitFraction, type OrbitPreset } from './orbitPresets'

type Layer = 'player' | 'pro' | 'overlay'
type ViewPreset = OrbitPreset

export type OrbitClip = {
  image: string | null
  video: string | null
  durationMs: number | null
  frameCount: number | null
  frames: HologramOrbitFrame[] | null
  keypoints: HologramKeypoints | null
}

type Props = {
  joint: ContactJoint
  reading: JointReading | null
  shotLabel: string | null
  hologramImage: string | null
  /**
   * Holographic close-up for this body part (from the 3×3 Nano Banana board).
   * Falls back to the placeholder when the grid cell is not ready yet.
   */
  partImage?: string | null
  /** Pro hologram, shown beside the player's on the Pro Reference tab. */
  proHologramImage?: string | null
  /** Pro close-up for this body part when the orange board was sliced. */
  proPartImage?: string | null
  /** Orbit clips, so View 1 / 2 / 3 seek the turn instead of doing nothing. */
  playerOrbit?: OrbitClip | null
  proOrbit?: OrbitClip | null
  /** Camera the shot was filmed from, so View 2 / 3 land on those sides of the turn. */
  viewId?: string | null
  /** Open on the same Smart 3D layer the person was looking at (Player / Pro / Overlay). */
  initialLayer?: Layer
  /** Kinetic chain timing from the player's pose, for the Pro Reference tab. */
  timing?: SegmentTiming[] | null
  /** Back to the full-body stage ("3D View" goes there too). */
  onClose: () => void
}

const YOU = '#FF6B5B'
const PRO = '#5CE1FF'
const GOOD = '#7BE495'
const DIFF = '#F2B33D'
/** Stand-in close-up until the joint renders exist. */
const PLACEHOLDER = require('../../../assets/smart3d/joint-placeholder.jpg')
const BODY = require('../../../assets/smart3d/body.webp')
const VIEW_ICONS: Record<ViewPreset, keyof typeof MaterialCommunityIcons.glyphMap> = {
  view: 'cube-outline',
  front: 'account-outline',
  side: 'head-outline',
}
const FIGURE_LIMBS: [string, string][] = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['right_hip', 'right_knee'],
  ['left_knee', 'left_ankle'],
  ['right_knee', 'right_ankle'],
]
const MAX_ZOOM = 3
const MESSAGE = {
  good: { colors: ['#06291E', '#0B3A2A'], border: '#1E9E6A', icon: 'checkmark', iconColor: '#34C759' },
  bad: { colors: ['#2A0B10', '#4A1408'], border: '#7A2A1A', icon: 'warning', iconColor: '#E5482B' },
  info: { colors: ['#071A3F', '#0A1550'], border: '#1F3FC0', icon: 'information-circle-outline', iconColor: UI.accent },
} as const

/** Message with the degrees picked out in red, as in the design. */
function Highlighted({ text, mark, style }: { text: string; mark: string | null; style: object }) {
  const at = mark ? text.indexOf(mark) : -1
  if (!mark || at < 0) return <Text style={style}>{text}</Text>
  return (
    <Text style={style}>
      {text.slice(0, at)}
      <Text style={{ color: YOU }}>{mark}</Text>
      {text.slice(at + mark.length)}
    </Text>
  )
}

function ViewPresets({ value, onChange }: { value: ViewPreset; onChange: (v: ViewPreset) => void }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  return (
    <View style={styles.presets}>
      {(Object.keys(VIEW_ICONS) as ViewPreset[]).map((id) => {
        const on = id === value
        return (
          <Pressable
            key={id}
            testID={`joint-view-${id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(id)}
            style={[styles.preset, on && styles.presetOn]}
          >
            <MaterialCommunityIcons name={VIEW_ICONS[id]} size={22} color={UI.text} />
            <Text allowFontScaling={false} style={[styles.presetLabel, { fontFamily: theme.regularFont }]}>
              {t(`analysis.smart3dViews.${id}`)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function ControlButton({
  icon,
  label,
  on,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  on?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!on }}
      onPress={onPress}
      style={[styles.control, on && styles.presetOn]}
    >
      <Ionicons name={icon} size={22} color={UI.text} />
    </Pressable>
  )
}

/**
 * Joint close-up. Player shows the holographic part cell (or the placeholder until it exists).
 * Overlay adds zoom, move and view controls.
 */
function JointStage({
  tag,
  controls,
  imageUri,
  onFullscreen,
}: {
  tag: string | null
  controls: boolean
  imageUri?: string | null
  onFullscreen: () => void
}) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [moving, setMoving] = useState(false)
  const start = useRef({ x: 0, y: 0 })
  const offsetRef = useRef(offset)
  offsetRef.current = offset
  const movingRef = useRef(moving)
  movingRef.current = moving
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => movingRef.current,
      onMoveShouldSetPanResponder: () => movingRef.current,
      onPanResponderGrant: () => {
        start.current = offsetRef.current
      },
      onPanResponderMove: (_, g) => setOffset({ x: start.current.x + g.dx, y: start.current.y + g.dy }),
    })
  ).current

  useEffect(() => {
    if (controls) return
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setMoving(false)
  }, [controls])

  return (
    <View testID="joint-stage" style={[styles.stage, controls && styles.stageTall]}>
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
        <Image
          source={imageUri ? { uri: imageUri } : PLACEHOLDER}
          // Square cells in a tall stage — cover so the hologram fills the whole card.
          resizeMode="cover"
          style={[
            styles.fill,
            { transform: [{ translateX: offset.x }, { translateY: offset.y }, { scale: zoom }] },
          ]}
        />
      </View>
      {tag && !controls ? (
        <View pointerEvents="none" style={styles.tag}>
          <Text allowFontScaling={false} style={[styles.tagText, { fontFamily: theme.mediumFont }]}>
            {tag}
          </Text>
        </View>
      ) : null}
      {controls ? (
        <>
          <View style={styles.controlColumn}>
            <ControlButton
              icon="refresh"
              label={t('analysis.smart3dControls.reset')}
              onPress={() => {
                setZoom(1)
                setOffset({ x: 0, y: 0 })
              }}
            />
            <ControlButton
              icon="add-circle-outline"
              label={t('analysis.smart3dControls.zoomIn')}
              onPress={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.25))}
            />
            <ControlButton
              icon="remove-circle-outline"
              label={t('analysis.smart3dControls.zoomOut')}
              onPress={() => setZoom((z) => Math.max(1, z - 0.25))}
            />
            <ControlButton
              icon="move"
              label={t('analysis.smart3dControls.move')}
              on={moving}
              onPress={() => setMoving((m) => !m)}
            />
          </View>
        </>
      ) : null}
      <Pressable
        testID="joint-fullscreen"
        accessibilityRole="button"
        accessibilityLabel={t('analysis.fullscreen')}
        hitSlop={8}
        onPress={onFullscreen}
        style={styles.fullscreenBtn}
      >
        <MaterialCommunityIcons name="arrow-expand-all" size={16} color={UI.text} />
      </Pressable>
    </View>
  )
}

function keypointsAt(clip: OrbitClip | null | undefined, fraction: number): HologramKeypoints | null {
  const fromOrbit = orbitKeypointsAtFraction(clip?.frames, fraction, clip?.frameCount)
  if (fromOrbit) return fromOrbit
  // Sparse orbit pose (Modal often skips the back of the turn): keep the contact still pose
  // only at the filmed side of the orbit, not stretched across the whole 360°.
  if (fraction <= 0.02 || fraction >= 0.98) return clip?.keypoints ?? null
  return null
}

/** Paused orbit frame. Seeking is what View 1 / 2 / 3 actually do. */
function HeldOrbit({ uri, fraction, durationMs }: { uri: string; fraction: number; durationMs: number | null }) {
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
      style={styles.fill}
      resizeMode={ResizeMode.COVER}
      isMuted
      onLoad={seek}
      onReadyForDisplay={seek}
    />
  )
}

function Figure({
  keypoints,
  color,
}: {
  keypoints: HologramKeypoints | null
  color: string
}) {
  if (!keypoints) return null
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      {FIGURE_LIMBS.map(([a, b]) => {
        const A = keypoints[a]
        const B = keypoints[b]
        if (!A || !B) return null
        return <Line key={`${a}-${b}`} x1={A.x * 100} y1={A.y * 100} x2={B.x * 100} y2={B.y * 100} stroke={color} strokeWidth={1.4} />
      })}
      {Object.entries(keypoints).map(([name, p]) => (
        <Circle key={name} cx={p.x * 100} cy={p.y * 100} r={1.6} fill={color} />
      ))}
    </Svg>
  )
}

function ClipPicture({ clip, fraction }: { clip: OrbitClip | null | undefined; fraction: number }) {
  // Prefer the holographic orbit video; otherwise the Nano Banana still — never the stock body art.
  if (clip?.video) return <HeldOrbit uri={clip.video} fraction={fraction} durationMs={clip.durationMs} />
  if (clip?.image) return <Image source={{ uri: clip.image }} resizeMode="cover" style={styles.fill} />
  return <Image source={BODY} resizeMode="cover" style={styles.fill} />
}

/** Pro Reference: blue + orange holographics side by side; View 1 / 2 / 3 seek both to the same angle. */
function ChainStage({
  player,
  pro,
  viewId,
  expanded = false,
  onFullscreen,
}: {
  player: OrbitClip | null
  pro: OrbitClip | null
  viewId: string | null
  expanded?: boolean
  onFullscreen: () => void
}) {
  const { t } = useTranslation()
  const [preset, setPreset] = useState<ViewPreset>('view')
  const fraction = orbitFraction(preset, viewId)
  return (
    <View testID="chain-stage" style={[styles.stage, expanded ? styles.stageFill : styles.stageTall]}>
      <View style={styles.pair}>
        <View style={styles.pairHalf}>
          <ClipPicture clip={player} fraction={fraction} />
          <Figure keypoints={keypointsAt(player, fraction)} color={PRO} />
        </View>
        <View style={styles.pairHalf}>
          <ClipPicture clip={pro} fraction={fraction} />
          <Figure keypoints={keypointsAt(pro, fraction)} color="#FF8A3D" />
        </View>
      </View>
      <View style={styles.presetColumnLeft}>
        <ViewPresets value={preset} onChange={setPreset} />
      </View>
      {expanded ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('analysis.fullscreen')}
          hitSlop={8}
          onPress={onFullscreen}
          style={styles.fullscreenBtn}
        >
          <MaterialCommunityIcons name="arrow-expand-all" size={16} color={UI.text} />
        </Pressable>
      )}
    </View>
  )
}

/** Blue + orange holographics at the same orbit angle, with MediaPipe on top when pose exists. */
function OverlayStage({
  player,
  pro,
  viewId,
  expanded = false,
  onFullscreen,
}: {
  player: OrbitClip | null
  pro: OrbitClip | null
  viewId: string | null
  expanded?: boolean
  onFullscreen: () => void
}) {
  const { t } = useTranslation()
  const [preset, setPreset] = useState<ViewPreset>('view')
  const fraction = orbitFraction(preset, viewId)
  const yours = keypointsAt(player, fraction)
  const theirs = keypointsAt(pro, fraction)
  const aligned = yours && theirs ? alignKeypoints(theirs, yours) : theirs
  return (
    <View testID="joint-overlay" style={[styles.stage, expanded ? styles.stageFill : styles.stageTall]}>
      <ClipPicture clip={player} fraction={fraction} />
      {pro?.video || pro?.image ? (
        <View pointerEvents="none" style={[styles.fill, { opacity: 0.48 }]}>
          <ClipPicture clip={pro} fraction={fraction} />
        </View>
      ) : null}
      <Figure keypoints={yours} color={PRO} />
      <Figure keypoints={aligned} color="#FF8A3D" />
      <View style={styles.presetColumnRight}>
        <ViewPresets value={preset} onChange={setPreset} />
      </View>
      {expanded ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('analysis.fullscreen')}
          hitSlop={8}
          onPress={onFullscreen}
          style={styles.fullscreenBtn}
        >
          <MaterialCommunityIcons name="arrow-expand-all" size={16} color={UI.text} />
        </Pressable>
      )}
    </View>
  )
}

export function JointDetailView({
  joint,
  reading,
  shotLabel,
  hologramImage,
  partImage = null,
  proHologramImage = null,
  proPartImage = null,
  playerOrbit = null,
  proOrbit = null,
  viewId = null,
  initialLayer = 'player',
  timing = null,
  onClose,
}: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const [layer, setLayer] = useState<Layer>(initialLayer)
  const [fullscreen, setFullscreen] = useState(false)
  const [chainOpen, setChainOpen] = useState(false)

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (fullscreen) setFullscreen(false)
      else if (chainOpen) setChainOpen(false)
      else onClose()
      return true
    })
    return () => sub.remove()
  }, [onClose, chainOpen, fullscreen])

  if (chainOpen) return <KineticChainTimingView timing={timing} onClose={() => setChainOpen(false)} />

  const jointName = t(`analysis.jointName.${joint}`)
  const title = layer === 'pro' ? t('analysis.kineticChain') : t('analysis.jointAngleTitle', { joint: jointName })
  const good = reading?.status === 'good'
  /** Pro reference exists when the orange library clip is on the phone or the joint has a pro angle. */
  const hasProRef = Boolean(proHologramImage || proOrbit?.image || proOrbit?.video || reading?.pro != null)
  /** No pro to compare against: say so plainly, not as a warning. */
  const tone: 'good' | 'bad' | 'info' = good ? 'good' : reading?.messageKey ? 'bad' : 'info'
  const deg = reading?.deltaDeg != null ? Math.abs(Math.round(reading.deltaDeg)) : null
  const message =
    reading?.messageKey != null
      ? t(`analysis.${reading.messageKey}`, { deg: deg ?? 0 })
      : reading?.you != null && reading?.pro == null && !hasProRef
        ? t('analysis.jointNoPro')
        : null
  const you = reading?.you != null ? `${Math.round(reading.you)}°` : null
  const ideal = reading?.pro != null ? `${Math.round(reading.pro)}°` : null
  const diff =
    reading?.deltaDeg != null
      ? reading.deltaDeg
      : reading?.you != null && reading.pro != null
        ? reading.you - reading.pro
        : null
  const tabs = [
    { id: 'player' as const, label: t('analysis.smart3dPlayer') },
    { id: 'pro' as const, label: t('analysis.proReference') },
    { id: 'overlay' as const, label: t('analysis.smart3dOverlay') },
  ]

  return (
    <ScrollView
      testID="joint-detail"
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.titleRow}>
        <Pressable
          testID="joint-back"
          accessibilityRole="button"
          accessibilityLabel={t('analysis.back')}
          hitSlop={12}
          onPress={onClose}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={28} color="#86A7D2" />
        </Pressable>
        <View style={styles.titleCopy}>
          <Text allowFontScaling={false} style={[styles.screenTitle, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}>
            {t('analysis.smart3dTitle')}
          </Text>
          <Text allowFontScaling={false} style={[styles.screenSubtitle, { fontFamily: theme.regularFont }]}>
            {t('analysis.smart3dSubtitle')}
          </Text>
        </View>
        <View style={styles.back} />
      </View>

      <ResultSectionPill tabs={tabs} value={layer} onChange={setLayer} />

      <View style={styles.header}>
        <View style={[styles.badge, SELECTED_GLOW]}>
          <MaterialCommunityIcons name={layer === 'pro' ? 'link-variant' : JOINT_ICON[joint]} size={30} color={UI.text} />
        </View>
        <View style={styles.headerText}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.title, { fontFamily: theme.regularFont }]}>
            {title}
          </Text>
          <Text allowFontScaling={false} style={[styles.subtitle, { fontFamily: theme.regularFont }]}>
            {shotLabel ? `${shotLabel} | ` : ''}
            {t('analysis.contactPhase')}
          </Text>
        </View>
        <Pressable testID="joint-view3d" accessibilityRole="button" onPress={onClose} style={[styles.view3d, CARD_GLOW]}>
          <MaterialCommunityIcons name="cube-outline" size={22} color={UI.text} />
          <Text allowFontScaling={false} style={[styles.view3dLabel, { fontFamily: theme.regularFont }]}>
            {t('analysis.view3d')}
          </Text>
        </Pressable>
      </View>

      {layer === 'pro' ? (
        <>
          <ChainLegend />
          <ChainStage
            player={playerOrbit ?? { image: hologramImage, video: null, durationMs: null, frameCount: null, frames: null, keypoints: null }}
            pro={proOrbit ?? { image: proHologramImage, video: null, durationMs: null, frameCount: null, frames: null, keypoints: null }}
            viewId={viewId}
            onFullscreen={() => setFullscreen(true)}
          />
          <TimingCard timing={timing} onPress={() => setChainOpen(true)} />
        </>
      ) : (
        <>
          <View style={styles.legendRow}>
            {[
              { color: YOU, label: t('analysis.yourMovement') },
              { color: PRO, label: t('analysis.proReference') },
            ].map((item) => (
              <View key={item.label} style={styles.legend}>
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <Text allowFontScaling={false} style={[styles.legendLabel, { fontFamily: theme.regularFont }]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>

          {layer === 'overlay' ? (
            <OverlayStage
              player={playerOrbit ?? { image: hologramImage, video: null, durationMs: null, frameCount: null, frames: null, keypoints: null }}
              pro={proOrbit ?? { image: proHologramImage, video: null, durationMs: null, frameCount: null, frames: null, keypoints: null }}
              viewId={viewId}
              onFullscreen={() => setFullscreen(true)}
            />
          ) : (
            <JointStage
              tag={you}
              controls={false}
              imageUri={partImage ?? hologramImage}
              onFullscreen={() => setFullscreen(true)}
            />
          )}

          <View testID="joint-metrics" style={[styles.metricCard, CARD_GLOW]}>
            <View style={styles.badgeSmall}>
              <MaterialCommunityIcons name={JOINT_ICON[joint]} size={26} color={UI.text} />
            </View>
            <View style={styles.metricCol}>
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.metricLabel, { fontFamily: theme.regularFont }]}>
                {t('analysis.jointAngleTitle', { joint: jointName })}
              </Text>
              <Text allowFontScaling={false} style={[styles.metricValue, { color: good ? GOOD : YOU, fontFamily: theme.semiBoldFont }]}>
                {you ?? '—'}
              </Text>
              <Text allowFontScaling={false} style={[styles.metricSub, { color: good ? GOOD : YOU, fontFamily: theme.regularFont }]}>
                {t('analysis.yourAngle')}
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricCol}>
              <Text allowFontScaling={false} style={[styles.metricValue, { color: GOOD, fontFamily: theme.semiBoldFont }]}>
                {ideal ?? '—'}
              </Text>
              <Text allowFontScaling={false} style={[styles.metricSub, { color: GOOD, fontFamily: theme.regularFont }]}>
                {t('analysis.idealRange')}
              </Text>
            </View>
            {layer === 'overlay' ? (
              <>
                <View style={styles.metricDivider} />
                <View style={styles.metricCol}>
                  <Text allowFontScaling={false} style={[styles.metricValue, { color: DIFF, fontFamily: theme.semiBoldFont }]}>
                    {diff != null ? `${diff > 0 ? '+' : ''}${Math.round(diff)}°` : '—'}
                  </Text>
                  <Text allowFontScaling={false} style={[styles.metricSub, { color: DIFF, fontFamily: theme.regularFont }]}>
                    {t('analysis.difference')}
                  </Text>
                </View>
              </>
            ) : null}
          </View>

          {message ? (
            <LinearGradient
              testID="joint-message"
              colors={MESSAGE[tone].colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.messageCard, { borderColor: MESSAGE[tone].border }]}
            >
              <View style={styles.messageIcon}>
                <Ionicons name={MESSAGE[tone].icon} size={30} color={MESSAGE[tone].iconColor} />
              </View>
              <Highlighted
                text={message}
                mark={tone === 'bad' && deg != null ? `${deg}°` : null}
                style={[styles.messageText, { fontFamily: theme.regularFont }]}
              />
            </LinearGradient>
          ) : null}
        </>
      )}

      <Modal visible={fullscreen} animationType="fade" onRequestClose={() => setFullscreen(false)} supportedOrientations={['portrait']}>
        <View style={[styles.fullscreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.fullBar}>
            <Pressable
              testID="joint-fullscreen-close"
              accessibilityRole="button"
              accessibilityLabel={t('analysis.back')}
              onPress={() => setFullscreen(false)}
              hitSlop={8}
              style={styles.fullBack}
            >
              <Ionicons name="chevron-back" size={26} color={UI.text} />
              <Text allowFontScaling={false} style={[styles.fullBackLabel, { fontFamily: theme.semiBoldFont }]}>
                {t('analysis.back')}
              </Text>
            </Pressable>
          </View>
          <View style={styles.fullStage}>
            {layer === 'pro' ? (
              <ChainStage
                player={playerOrbit ?? { image: hologramImage, video: null, durationMs: null, frameCount: null, frames: null, keypoints: null }}
                pro={proOrbit ?? { image: proHologramImage, video: null, durationMs: null, frameCount: null, frames: null, keypoints: null }}
                viewId={viewId}
                expanded
                onFullscreen={() => setFullscreen(false)}
              />
            ) : layer === 'overlay' ? (
              <OverlayStage
                player={playerOrbit ?? { image: hologramImage, video: null, durationMs: null, frameCount: null, frames: null, keypoints: null }}
                pro={proOrbit ?? { image: proHologramImage, video: null, durationMs: null, frameCount: null, frames: null, keypoints: null }}
                viewId={viewId}
                expanded
                onFullscreen={() => setFullscreen(false)}
              />
            ) : (
              <Image
                source={
                  (layer === 'player' ? partImage ?? hologramImage : proPartImage ?? proHologramImage)
                    ? { uri: (layer === 'player' ? partImage ?? hologramImage : proPartImage ?? proHologramImage)! }
                    : PLACEHOLDER
                }
                resizeMode="cover"
                style={styles.fullscreenImage}
              />
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const STAGE_BORDER = '#1F4BFF'

const styles = StyleSheet.create({
  /** absoluteFill alone leaves a bundled image at its natural size on web. */
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  back: { width: 32 },
  titleCopy: { flex: 1, alignItems: 'center' },
  screenTitle: { color: UI.text, fontSize: 24, textAlign: 'center' },
  screenSubtitle: { color: UI.accent, fontSize: 14, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#5B6CFF',
    backgroundColor: UI.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { color: UI.text, fontSize: 20 },
  subtitle: { color: UI.accent, fontSize: 13, marginTop: 2 },
  view3d: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#5B6CFF',
    backgroundColor: '#1B2AA8',
  },
  view3dLabel: { color: UI.text, fontSize: 15 },
  legendRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { color: UI.text, fontSize: 13 },
  stage: {
    height: 220,
    borderRadius: UI.radiusCard,
    borderWidth: 2,
    borderColor: STAGE_BORDER,
    backgroundColor: '#000814',
    overflow: 'hidden',
  },
  stageTall: { height: 330 },
  stageFill: { flex: 1, height: '100%' },
  tag: {
    position: 'absolute',
    top: 40,
    right: 70,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: YOU,
    backgroundColor: 'rgba(40, 6, 10, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { color: YOU, fontSize: 20 },
  fullscreenBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: UI.text,
    backgroundColor: 'rgba(0, 20, 53, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlColumn: { position: 'absolute', left: 12, top: 54, gap: 8 },
  control: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#5B6CFF',
    backgroundColor: 'rgba(5, 11, 40, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetColumnRight: { position: 'absolute', right: 10, top: 50 },
  presetColumnLeft: { position: 'absolute', left: 10, top: 10 },
  presets: { gap: 6 },
  preset: {
    width: 62,
    height: 58,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#5B6CFF',
    backgroundColor: 'rgba(5, 11, 40, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  presetOn: { borderColor: UI.text, backgroundColor: 'rgba(47, 107, 255, 0.45)' },
  presetLabel: { color: UI.text, fontSize: 12 },
  pair: { flex: 1, flexDirection: 'row', paddingLeft: 70 },
  pairFull: { paddingLeft: 0 },
  pairHalf: { flex: 1 },
  metricCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: UI.radiusCard,
    borderWidth: 2,
    borderColor: '#1F3FC0',
    backgroundColor: '#0A1550',
  },
  badgeSmall: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#5B6CFF',
    backgroundColor: UI.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCol: { flex: 1, alignItems: 'center' },
  metricLabel: { color: UI.text, fontSize: 13 },
  metricValue: { fontSize: 32, lineHeight: 40 },
  metricSub: { fontSize: 12 },
  metricDivider: { width: 1.5, alignSelf: 'stretch', marginVertical: 8, backgroundColor: '#5B6CFF' },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: UI.radiusCard,
    borderWidth: 1.5,
  },
  messageIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageText: { flex: 1, color: UI.text, fontSize: 15, lineHeight: 21 },
  fullscreen: { flex: 1, backgroundColor: '#000' },
  fullBar: { height: 52, justifyContent: 'center', paddingHorizontal: 8 },
  fullBack: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 16 },
  fullBackLabel: { color: UI.text, fontSize: 17 },
  fullStage: { flex: 1 },
  fullscreenClose: { position: 'absolute', top: 16, right: 16, zIndex: 2, padding: 6 },
  fullscreenImage: { width: '100%', flex: 1 },
})
