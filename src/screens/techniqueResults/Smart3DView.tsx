import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, BackHandler, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import Svg, { Line } from 'react-native-svg'
import { ThemeContext } from '../../context'
import { ResultSectionPill } from '../../components/ResultSectionPill'
import { useHologram } from '../../lib/hologramJob'

type Layer = 'player' | 'pro' | 'overlay'
type Camera = 'front' | 'side' | 'top' | 'rotate' | 'court'
type Joint =
  | 'shoulders'
  | 'elbow'
  | 'wrist'
  | 'torso'
  | 'knee'
  | 'racket'
  | 'leftFoot'
  | 'rightFoot'

type Props = {
  /** Saved analysis whose ball-contact hologram replaces the stock front figure once it is built. */
  analysisId?: string | null
  onClose: () => void
}

const FRONT = require('../../../assets/smart3d/front.png')
const SIDE = require('../../../assets/smart3d/side.png')

const LEFT_CALLOUTS: { id: Joint; icon: keyof typeof Ionicons.glyphMap; key: string }[] = [
  { id: 'shoulders', icon: 'body-outline', key: 'analysis.smart3dShoulders' },
  { id: 'elbow', icon: 'fitness-outline', key: 'analysis.smart3dElbow' },
  { id: 'wrist', icon: 'hand-left-outline', key: 'analysis.smart3dWrist' },
]

const RIGHT_CALLOUTS: { id: Joint; icon: keyof typeof Ionicons.glyphMap; key: string }[] = [
  { id: 'torso', icon: 'shirt-outline', key: 'analysis.smart3dTorso' },
  { id: 'knee', icon: 'walk-outline', key: 'analysis.smart3dKnee' },
  { id: 'racket', icon: 'tennisball-outline', key: 'analysis.smart3dRacket' },
]

const CAMERAS: { id: Camera; icon: keyof typeof Ionicons.glyphMap; key: string }[] = [
  { id: 'front', icon: 'phone-portrait-outline', key: 'analysis.smart3dFront' },
  { id: 'side', icon: 'arrow-forward-outline', key: 'analysis.smart3dSide' },
  { id: 'top', icon: 'arrow-up', key: 'analysis.smart3dTop' },
  { id: 'rotate', icon: 'cube-outline', key: 'analysis.smart3dRotate' },
  { id: 'court', icon: 'grid-outline', key: 'analysis.smart3dCourt' },
]

function HoloBody({
  yaw,
  camera,
  ghost,
}: {
  yaw: number
  camera: Camera
  ghost: boolean
}) {
  const rad = (yaw * Math.PI) / 180
  const showSide = camera === 'side' || (camera === 'rotate' && Math.abs(Math.sin(rad)) > Math.abs(Math.cos(rad)))
  const flipSide = Math.sin(rad) < 0
  const top = camera === 'top'
  return (
    <View
      pointerEvents="none"
      style={[
        styles.figure,
        ghost && styles.figureGhost,
        top && styles.figureTop,
        camera === 'court' && styles.figureCourt,
        ghost && styles.figureShift,
      ]}
    >
      <Image
        source={showSide ? SIDE : FRONT}
        resizeMode="contain"
        style={[styles.figureImg, showSide && flipSide && styles.figureFlip]}
      />
    </View>
  )
}

export function Smart3DView({ analysisId, onClose }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const [layer, setLayer] = useState<Layer>('player')
  const [camera, setCamera] = useState<Camera>('rotate')
  const [highlight, setHighlight] = useState<Joint | null>(null)
  const [yaw, setYaw] = useState(0)
  const hologram = useHologram(analysisId)
  /** The player's ball-contact hologram fills the stage, in place of the stock figure and grid. */
  const holoImage = layer !== 'pro' ? hologram.image : null
  const yawRef = useRef(yaw)
  yawRef.current = yaw

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [onClose])

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => camera === 'rotate',
        onPanResponderMove: (_, gesture) => {
          setYaw(yawRef.current + gesture.dx * 0.4)
        },
        onPanResponderRelease: (_, gesture) => {
          yawRef.current = yawRef.current + gesture.dx * 0.4
        },
      }),
    [camera]
  )

  function selectCamera(next: Camera) {
    setCamera(next)
    if (next === 'front' || next === 'court') setYaw(0)
    if (next === 'side') setYaw(76)
    if (next === 'top') setYaw(0)
  }

  const tabs = [
    { id: 'player' as const, label: t('analysis.smart3dPlayer') },
    { id: 'pro' as const, label: t('analysis.proReference') },
    { id: 'overlay' as const, label: t('analysis.smart3dOverlay') },
  ]

  return (
    <View style={[styles.screen, { paddingBottom: 84 + insets.bottom }]}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('analysis.back')}
          hitSlop={12}
          onPress={onClose}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={24} color="#86A7D2" />
        </Pressable>
        <View style={styles.pillWrap}>
          <ResultSectionPill tabs={tabs} value={layer} onChange={setLayer} trackStyle={styles.pill} />
        </View>
      </View>
      <View style={[styles.stage, holoImage ? styles.stageCard : null]} {...pan.panHandlers}>
        {holoImage ? (
          <Image source={{ uri: holoImage }} resizeMode="cover" style={StyleSheet.absoluteFill} />
        ) : null}
        {holoImage ? null : (
          <Svg width="100%" height="100%" viewBox="0 0 240 520" style={StyleSheet.absoluteFill}>
            {Array.from({ length: 8 }, (_, index) => (
              <Line
                key={`g-${index}`}
                x1={8 + index * 32}
                y1="518"
                x2="120"
                y2={camera === 'court' ? 300 : 390}
                stroke={camera === 'court' ? 'rgba(70, 160, 255, 0.45)' : 'rgba(40, 120, 220, 0.32)'}
                strokeWidth="1"
              />
            ))}
            {(camera === 'court' ? [360, 400, 440, 480, 512] : [430, 460, 490, 514]).map((y) => (
              <Line
                key={`h-${y}`}
                x1="16"
                y1={y}
                x2="224"
                y2={y}
                stroke={camera === 'court' ? 'rgba(70, 160, 255, 0.4)' : 'rgba(40, 120, 220, 0.26)'}
                strokeWidth="1"
              />
            ))}
          </Svg>
        )}
        {layer !== 'player' ? <HoloBody yaw={yaw} camera={camera} ghost /> : null}
        {layer !== 'pro' && !holoImage ? <HoloBody yaw={yaw} camera={camera} ghost={false} /> : null}
        {hologram.status === 'running' ? (
          <View pointerEvents="none" style={styles.building}>
            <ActivityIndicator size="small" color="#7AECFF" />
            <Text allowFontScaling={false} style={[styles.buildingLabel, { fontFamily: theme.mediumFont }]}>
              {t('analysis.smart3dHologramBuilding')}
            </Text>
          </View>
        ) : null}
        <View pointerEvents="box-none" style={styles.callouts}>
          <View style={styles.calloutCol}>
            {LEFT_CALLOUTS.map((item) => (
              <Callout
                key={item.id}
                icon={item.icon}
                label={t(item.key)}
                selected={highlight === item.id}
                font={theme.mediumFont}
                onPress={() => setHighlight(item.id)}
              />
            ))}
          </View>
          <View style={styles.calloutCol}>
            {RIGHT_CALLOUTS.map((item) => (
              <Callout
                key={item.id}
                icon={item.icon}
                label={t(item.key)}
                selected={highlight === item.id}
                font={theme.mediumFont}
                onPress={() => setHighlight(item.id)}
              />
            ))}
          </View>
        </View>
      </View>
      <View style={styles.feetRow}>
        <Callout
          icon="footsteps-outline"
          label={t('analysis.smart3dLeftFoot')}
          selected={highlight === 'leftFoot'}
          font={theme.mediumFont}
          wide
          onPress={() => setHighlight('leftFoot')}
        />
        <Callout
          icon="footsteps-outline"
          label={t('analysis.smart3dRightFoot')}
          selected={highlight === 'rightFoot'}
          font={theme.mediumFont}
          wide
          onPress={() => setHighlight('rightFoot')}
        />
      </View>
      <View style={styles.cameras}>
        {CAMERAS.map((item) => {
          const selected = camera === item.id
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => selectCamera(item.id)}
              style={[styles.camera, selected && styles.cameraOn]}
            >
              <Ionicons name={item.icon} size={22} color={selected ? '#7AECFF' : '#FFFFFF'} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.cameraLabel, { fontFamily: selected ? theme.semiBoldFont : theme.mediumFont }]}
              >
                {t(item.key)}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function Callout({
  icon,
  label,
  selected,
  font,
  wide,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  selected: boolean
  font: string
  wide?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.callout, wide && styles.calloutWide, selected && styles.calloutOn]}
    >
      <Ionicons name={icon} size={16} color="#FFFFFF" />
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.calloutLabel, { fontFamily: font }]}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { paddingVertical: 4, paddingRight: 4 },
  pillWrap: { flex: 1 },
  pill: { marginBottom: 0 },
  stage: { flex: 1, minHeight: 280, marginTop: 8 },
  stageCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(46, 130, 230, 0.75)',
    backgroundColor: '#000814',
    overflow: 'hidden',
    padding: 12,
  },
  figure: {
    position: 'absolute',
    left: '16%',
    right: '16%',
    top: 4,
    bottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  figureGhost: { opacity: 0.42 },
  figureTop: { transform: [{ scaleY: 0.42 }, { translateY: 40 }] },
  figureCourt: { transform: [{ scale: 0.86 }, { translateY: 16 }] },
  figureShift: { marginLeft: 28 },
  figureImg: { width: '100%', height: '100%' },
  figureFlip: { transform: [{ scaleX: -1 }] },
  callouts: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  calloutCol: { width: 118, gap: 10 },
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(46, 130, 230, 0.55)',
    backgroundColor: 'rgba(6, 22, 52, 0.88)',
  },
  calloutWide: { flex: 1, justifyContent: 'center' },
  calloutOn: {
    borderColor: '#3EC8FF',
    shadowColor: '#00C2FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
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
  calloutLabel: { color: '#FFFFFF', fontSize: 13, flexShrink: 1 },
  feetRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cameras: { flexDirection: 'row', gap: 8, marginTop: 12 },
  camera: {
    flex: 1,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(46, 130, 230, 0.45)',
    backgroundColor: '#071428',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  cameraOn: {
    borderColor: '#3EC8FF',
    borderWidth: 2,
    backgroundColor: '#0A2458',
    shadowColor: '#1C8FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
  },
  cameraLabel: { color: '#FFFFFF', fontSize: 10 },
})
