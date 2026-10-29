import { useContext, useEffect, useRef, useState } from 'react'
import { BackHandler, Image, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
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
import { JOINT_ICON } from './jointIcons'
import { ChainLegend, KineticChainTimingView, TimingCard } from './KineticChainTiming'

type Layer = 'player' | 'pro' | 'overlay'
type ViewPreset = 'view' | 'front' | 'side' | 'top'

type Props = {
  joint: ContactJoint
  reading: JointReading | null
  shotLabel: string | null
  hologramImage: string | null
  /** Pro hologram, shown beside the player's on the Pro Reference tab. */
  proHologramImage?: string | null
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
  top: 'account-supervisor-circle-outline',
}
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
 * Joint close-up. Player shows the picture with the angle tag; Overlay adds zoom, move and view
 * controls. The picture is a placeholder for now.
 */
function JointStage({ tag, controls, onFullscreen }: { tag: string | null; controls: boolean; onFullscreen: () => void }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [moving, setMoving] = useState(false)
  const [preset, setPreset] = useState<ViewPreset>('view')
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
          source={PLACEHOLDER}
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
          <View style={styles.presetColumnRight}>
            <ViewPresets value={preset} onChange={setPreset} />
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

/** Pro Reference tab: both holograms side by side with the view presets. */
function ChainStage({
  hologramImage,
  proHologramImage,
  onFullscreen,
}: {
  hologramImage: string | null
  proHologramImage: string | null
  onFullscreen: () => void
}) {
  const { t } = useTranslation()
  const [preset, setPreset] = useState<ViewPreset>('view')
  return (
    <View testID="chain-stage" style={[styles.stage, styles.stageTall]}>
      <View style={styles.pair}>
        <View style={styles.pairHalf}>
          <Image source={hologramImage ? { uri: hologramImage } : BODY} resizeMode="contain" style={styles.fill} />
        </View>
        <View style={styles.pairHalf}>
          <Image source={proHologramImage ? { uri: proHologramImage } : BODY} resizeMode="contain" style={styles.fill} />
        </View>
      </View>
      <View style={styles.presetColumnLeft}>
        <ViewPresets value={preset} onChange={setPreset} />
      </View>
      <Pressable
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

export function JointDetailView({
  joint,
  reading,
  shotLabel,
  hologramImage,
  proHologramImage = null,
  timing = null,
  onClose,
}: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const [layer, setLayer] = useState<Layer>('player')
  const [fullscreen, setFullscreen] = useState(false)
  const [chainOpen, setChainOpen] = useState(false)

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (chainOpen) setChainOpen(false)
      else onClose()
      return true
    })
    return () => sub.remove()
  }, [onClose, chainOpen])

  if (chainOpen) return <KineticChainTimingView timing={timing} onClose={() => setChainOpen(false)} />

  const jointName = t(`analysis.jointName.${joint}`)
  const title = layer === 'pro' ? t('analysis.kineticChain') : t('analysis.jointAngleTitle', { joint: jointName })
  const good = reading?.status === 'good'
  /** No pro to compare against: say so plainly, not as a warning. */
  const tone: 'good' | 'bad' | 'info' = good ? 'good' : reading?.messageKey ? 'bad' : 'info'
  const deg = reading?.deltaDeg != null ? Math.abs(Math.round(reading.deltaDeg)) : null
  const message =
    reading?.messageKey != null
      ? t(`analysis.${reading.messageKey}`, { deg: deg ?? 0 })
      : reading?.you != null
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
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.subtitle, { fontFamily: theme.regularFont }]}>
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
            hologramImage={hologramImage}
            proHologramImage={proHologramImage}
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

          <JointStage tag={you} controls={layer === 'overlay'} onFullscreen={() => setFullscreen(true)} />

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

      <Modal visible={fullscreen} animationType="fade" onRequestClose={() => setFullscreen(false)} supportedOrientations={['portrait', 'landscape']}>
        <View style={[styles.fullscreen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
          <Pressable
            testID="joint-fullscreen-close"
            accessibilityRole="button"
            accessibilityLabel={t('analysis.back')}
            onPress={() => setFullscreen(false)}
            hitSlop={10}
            style={styles.fullscreenClose}
          >
            <Ionicons name="close" size={24} color={UI.text} />
          </Pressable>
          {layer === 'pro' ? (
            <View style={[styles.pair, styles.pairFull]}>
              <View style={styles.pairHalf}>
                <Image source={hologramImage ? { uri: hologramImage } : BODY} resizeMode="contain" style={styles.fill} />
              </View>
              <View style={styles.pairHalf}>
                <Image source={proHologramImage ? { uri: proHologramImage } : BODY} resizeMode="contain" style={styles.fill} />
              </View>
            </View>
          ) : (
            <Image source={PLACEHOLDER} resizeMode="contain" style={styles.fullscreenImage} />
          )}
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
  fullscreen: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  fullscreenClose: { position: 'absolute', top: 16, right: 16, zIndex: 2, padding: 6 },
  fullscreenImage: { width: '100%', flex: 1 },
})
