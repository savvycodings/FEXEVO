import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { BackHandler, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg'
import { ThemeContext } from '../../context'
import { ResultSectionPill } from '../../components/ResultSectionPill'

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
  onClose: () => void
}

const JOINTS: { id: Joint; cx: number; cy: number }[] = [
  { id: 'shoulders', cx: 78, cy: 118 },
  { id: 'shoulders', cx: 162, cy: 118 },
  { id: 'elbow', cx: 48, cy: 196 },
  { id: 'elbow', cx: 192, cy: 196 },
  { id: 'wrist', cx: 36, cy: 268 },
  { id: 'wrist', cx: 204, cy: 268 },
  { id: 'torso', cx: 120, cy: 168 },
  { id: 'knee', cx: 92, cy: 352 },
  { id: 'knee', cx: 148, cy: 352 },
  { id: 'leftFoot', cx: 74, cy: 458 },
  { id: 'rightFoot', cx: 166, cy: 458 },
  { id: 'racket', cx: 228, cy: 246 },
]

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

function BodyFigure({
  yaw,
  top,
  court,
  ghost,
  highlight,
}: {
  yaw: number
  top: boolean
  court: boolean
  ghost: boolean
  highlight: Joint | null
}) {
  const turn = (yaw * Math.PI) / 180
  const scaleX = top ? 1 : Math.max(0.28, Math.abs(Math.cos(turn)))
  const scaleY = top ? 0.42 : court ? 0.82 : 1
  const lift = court ? 36 : 0
  const fill = ghost ? 'url(#bodyGhost)' : 'url(#bodyFill)'
  const stroke = ghost ? 'rgba(120, 220, 255, 0.45)' : 'rgba(170, 235, 255, 0.9)'
  return (
    <G transform={`translate(120 ${250 + lift}) scale(${scaleX} ${scaleY}) translate(-120 -250)`} opacity={ghost ? 0.45 : 1}>
      {top ? (
        <>
          <Ellipse cx="120" cy="250" rx="70" ry="28" fill={fill} stroke={stroke} strokeWidth="2" />
          <Circle cx="120" cy="232" r="16" fill={fill} stroke={stroke} strokeWidth="2" />
          <Circle cx="78" cy="250" r="8" fill="#FF9A1A" />
          <Circle cx="162" cy="250" r="8" fill="#FF9A1A" />
        </>
      ) : (
        <>
          <Ellipse cx="120" cy="52" rx="22" ry="26" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <Path d="M108 74 h24 v14 h-24 z" fill={fill} />
          <Path
            d="M76 96 C68 150 74 210 86 236 C98 258 142 258 154 236 C166 210 172 150 164 96 C146 112 94 112 76 96 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          <Path
            d="M80 108 C52 150 40 210 34 268"
            stroke={fill}
            strokeWidth="18"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M160 108 C190 146 206 200 214 246"
            stroke={fill}
            strokeWidth="18"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M102 236 C92 300 84 370 74 452"
            stroke={fill}
            strokeWidth="20"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M138 236 C150 300 158 370 168 452"
            stroke={fill}
            strokeWidth="20"
            strokeLinecap="round"
            fill="none"
          />
          <Ellipse cx="228" cy="236" rx="16" ry="22" fill="none" stroke={stroke} strokeWidth="2" />
          {JOINTS.map((joint) => {
            const on = highlight === joint.id
            return (
              <G key={`${joint.id}-${joint.cx}`}>
                {on ? <Circle cx={joint.cx} cy={joint.cy} r="16" fill="rgba(255, 154, 26, 0.35)" /> : null}
                <Circle cx={joint.cx} cy={joint.cy} r={on ? 8 : 6} fill="#FF9A1A" />
                <Circle cx={joint.cx} cy={joint.cy} r={on ? 3.5 : 2.5} fill="#FFE2A8" />
              </G>
            )
          })}
        </>
      )}
    </G>
  )
}

export function Smart3DView({ onClose }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const [layer, setLayer] = useState<Layer>('player')
  const [camera, setCamera] = useState<Camera>('rotate')
  const [highlight, setHighlight] = useState<Joint | null>(null)
  const [yaw, setYaw] = useState(18)
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('analysis.back')}
        hitSlop={12}
        onPress={onClose}
        style={styles.back}
      >
        <Ionicons name="chevron-back" size={24} color="#86A7D2" />
      </Pressable>
      <ResultSectionPill tabs={tabs} value={layer} onChange={setLayer} />
      <View style={styles.stage} {...pan.panHandlers}>
        <Svg width="100%" height="100%" viewBox="0 0 240 520">
          <Defs>
            <LinearGradient id="bodyFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#8DEBFF" />
              <Stop offset="55%" stopColor="#2F7BFF" />
              <Stop offset="100%" stopColor="#1236C8" />
            </LinearGradient>
            <LinearGradient id="bodyGhost" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#D8F7FF" />
              <Stop offset="100%" stopColor="#6EC8FF" />
            </LinearGradient>
          </Defs>
          {Array.from({ length: 7 }, (_, index) => (
            <Line
              key={`g-${index}`}
              x1={20 + index * 34}
              y1="500"
              x2="120"
              y2="430"
              stroke="rgba(40, 120, 220, 0.35)"
              strokeWidth="1"
            />
          ))}
          {[450, 470, 490].map((y) => (
            <Line key={`h-${y}`} x1="24" y1={y} x2="216" y2={y} stroke="rgba(40, 120, 220, 0.28)" strokeWidth="1" />
          ))}
          {layer !== 'player' ? (
            <BodyFigure yaw={yaw + 12} top={camera === 'top'} court={camera === 'court'} ghost highlight={highlight} />
          ) : null}
          {layer !== 'pro' ? (
            <BodyFigure yaw={yaw} top={camera === 'top'} court={camera === 'court'} ghost={false} highlight={highlight} />
          ) : null}
        </Svg>
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
  back: { alignSelf: 'flex-start', paddingVertical: 4, paddingRight: 12, marginBottom: 4 },
  stage: { flex: 1, minHeight: 280, marginTop: 4 },
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
    backgroundColor: '#0A2458',
    shadowColor: '#1C8FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
  },
  cameraLabel: { color: '#FFFFFF', fontSize: 10 },
})
