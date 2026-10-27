import { Fragment, useContext, useEffect, useState } from 'react'
import { ActivityIndicator, BackHandler, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import Svg, { Circle, Line } from 'react-native-svg'
import { ThemeContext } from '../../context'
import { ResultSectionPill } from '../../components/ResultSectionPill'
import { useHologram, type HologramKeypoints } from '../../lib/hologramJob'
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

/** Joint markers over a square hologram drawn with resizeMode="cover" in a w x h stage. */
function JointMarkers({ keypoints, w, h, lit }: { keypoints: HologramKeypoints; w: number; h: number; lit: string[] }) {
  const d = Math.max(w, h)
  const at = (name: string) => {
    const p = keypoints[name]
    return p ? { x: (w - d) / 2 + p.x * d, y: (h - d) / 2 + p.y * d } : null
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
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })
  /** Player hologram is blue; the pro reference is the red render of the matched library clip. */
  const holoImage = layer === 'pro' ? hologram.proImage : hologram.image
  const holoKeys = layer === 'pro' ? hologram.proKeypoints : hologram.keypoints
  const building =
    layer === 'pro'
      ? hologram.proStatus === 'running'
      : hologram.status === 'running' || (layer === 'overlay' && hologram.proStatus === 'running')
  /** Pro tab with nothing to draw: no matched pro clip, or its render failed or never started. */
  const proMissing = layer === 'pro' && !hologram.proImage && hologram.proStatus !== 'running'
  const lit = selected ? partKeypoints(selected, contactJoints?.side ?? 'RIGHT') : []

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
    <View style={[styles.screen, { paddingBottom: 8 + insets.bottom }]}>
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
        style={styles.stage}
        onLayout={(e) => setStageSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {holoImage ? (
          <Image source={{ uri: holoImage }} resizeMode="cover" style={StyleSheet.absoluteFill} />
        ) : (
          <Image
            source={BODY}
            resizeMode="cover"
            style={[StyleSheet.absoluteFill, layer === 'pro' && styles.bodyGhost]}
          />
        )}
        {layer === 'overlay' && hologram.proImage ? (
          <Image source={{ uri: hologram.proImage }} resizeMode="cover" style={[StyleSheet.absoluteFill, { opacity: 0.72 }]} />
        ) : null}
        {holoImage && holoKeys && stageSize.w ? (
          <JointMarkers keypoints={holoKeys} w={stageSize.w} h={stageSize.h} lit={lit} />
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
              {t('analysis.smart3dHologramBuilding')}
            </Text>
          </View>
        ) : null}
      </View>
      <Text allowFontScaling={false} style={[styles.prompt, { fontFamily: theme.mediumFont }]}>
        {t('analysis.smart3dSelectPart')}
      </Text>
      <View style={styles.parts}>
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
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  back: { paddingVertical: 4, paddingRight: 4 },
  title: { color: '#FFFFFF', fontSize: 24 },
  pill: { marginBottom: 12 },
  stage: {
    flex: 1,
    minHeight: 260,
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
  proMissing: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  proMissingLabel: { color: '#BFE6FF', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  prompt: { color: '#5E8FD0', fontSize: 18, textAlign: 'center', marginTop: 14, marginBottom: 12 },
  parts: { gap: 10 },
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
