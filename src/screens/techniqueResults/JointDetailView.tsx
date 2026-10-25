import { useContext, useEffect, useState } from 'react'
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg'
import { ThemeContext } from '../../context'
import { ResultSectionPill } from '../../components/ResultSectionPill'
import type { HologramKeypoint, HologramKeypoints } from '../../lib/hologramJob'
import type { ContactJoint, JointReading } from '../../lib/jointsApi'

type Pt = { x: number; y: number }

type Props = {
  joint: ContactJoint
  reading: JointReading | null
  shotLabel: string | null
  side: 'LEFT' | 'RIGHT'
  hologramImage: string | null
  keypoints: HologramKeypoints | null
  /** Back to the full-body Smart 3D stage. */
  onClose: () => void
}

const YOU = '#FF6B5B'
const PRO = '#5CE1FF'
const GOOD = '#34E89E'

const JOINT_ICON: Record<ContactJoint, keyof typeof Ionicons.glyphMap> = {
  shoulder: 'body-outline',
  elbow: 'fitness-outline',
  wrist: 'hand-left-outline',
  torso: 'shirt-outline',
  knee: 'walk-outline',
}

/**
 * The three points the angle is measured on, in hologram-image space: `a` and `c` are the segment
 * ends and `b` the vertex. Torso lean is measured against straight up, so `c` is synthetic.
 */
function jointGeometry(joint: ContactJoint, k: HologramKeypoints, side: 'left' | 'right') {
  const p = (name: string): HologramKeypoint | undefined => k[`${side}_${name}`]
  switch (joint) {
    case 'elbow':
      return { a: p('shoulder'), b: p('elbow'), c: p('wrist') }
    case 'shoulder':
      return { a: p('elbow'), b: p('shoulder'), c: p('hip') }
    case 'knee':
      return { a: p('hip'), b: p('knee'), c: p('ankle') }
    case 'wrist':
      return { a: p('elbow'), b: p('wrist'), c: undefined }
    case 'torso': {
      const l = k.left_hip
      const r = k.right_hip
      const hips = l && r ? { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 } : undefined
      return { a: k.neck, b: hips, c: hips ? { x: hips.x, y: hips.y - 0.25 } : undefined }
    }
  }
}

/** Unit vector from b toward `from`, rotated by `deg` toward the side `toward` lies on. */
function rotateToward(b: Pt, from: Pt, toward: Pt, deg: number, length: number): Pt {
  const ux = from.x - b.x
  const uy = from.y - b.y
  const n = Math.hypot(ux, uy) || 1
  const cross = ux * (toward.y - b.y) - uy * (toward.x - b.x)
  const r = ((cross >= 0 ? 1 : -1) * deg * Math.PI) / 180
  const vx = (ux / n) * Math.cos(r) - (uy / n) * Math.sin(r)
  const vy = (ux / n) * Math.sin(r) + (uy / n) * Math.cos(r)
  return { x: b.x + vx * length, y: b.y + vy * length }
}

function arcPath(b: Pt, a: Pt, c: Pt, radius: number): string {
  const a0 = Math.atan2(a.y - b.y, a.x - b.x)
  const a1 = Math.atan2(c.y - b.y, c.x - b.x)
  let sweep = a1 - a0
  while (sweep > Math.PI) sweep -= 2 * Math.PI
  while (sweep < -Math.PI) sweep += 2 * Math.PI
  const s = { x: b.x + radius * Math.cos(a0), y: b.y + radius * Math.sin(a0) }
  const e = { x: b.x + radius * Math.cos(a1), y: b.y + radius * Math.sin(a1) }
  return `M ${s.x} ${s.y} A ${radius} ${radius} 0 0 ${sweep > 0 ? 1 : 0} ${e.x} ${e.y}`
}

function JointCloseUp({
  joint,
  reading,
  side,
  hologramImage,
  keypoints,
}: Pick<Props, 'joint' | 'reading' | 'side' | 'hologramImage' | 'keypoints'>) {
  const [box, setBox] = useState({ w: 0, h: 0 })
  const geo = keypoints ? jointGeometry(joint, keypoints, side === 'LEFT' ? 'left' : 'right') : null
  const b = geo?.b
  const span = b
    ? Math.max(
        0.08,
        ...[geo?.a, geo?.c].filter((p): p is Pt => !!p).map((p) => Math.hypot(p.x - b.x, p.y - b.y))
      )
    : 0
  // Zoom so the measured segments fill about 40% of the card around the joint.
  const D = b && box.w ? Math.min(box.w * 4, Math.max(box.w, (0.4 * box.h) / span)) : box.w
  const left = b ? box.w / 2 - b.x * D : 0
  const top = b ? box.h / 2 - b.y * D : (box.h - D) / 2
  const at = (p: Pt) => ({ x: left + p.x * D, y: top + p.y * D })

  const B = b ? at(b) : null
  const A = geo?.a ? at(geo.a) : null
  const C = geo?.c ? at(geo.c) : null
  const proEnd =
    B && A && C && reading?.pro != null
      ? rotateToward(B, A, C, reading.pro, Math.hypot(C.x - B.x, C.y - B.y))
      : null
  const tag = reading?.you != null ? `${reading.you}°` : null

  return (
    <View style={styles.closeUp} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {hologramImage && box.w ? (
        <Image source={{ uri: hologramImage }} style={{ position: 'absolute', left, top, width: D, height: D }} />
      ) : null}
      {B && box.w ? (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          {A && C ? (
            <Path
              d={arcPath(B, A, C, Math.min(box.h * 0.32, Math.hypot(C.x - B.x, C.y - B.y) * 0.8))}
              stroke={YOU}
              strokeWidth={2}
              strokeDasharray="5 5"
              fill="none"
            />
          ) : null}
          {proEnd ? (
            <>
              <Line x1={B.x} y1={B.y} x2={proEnd.x} y2={proEnd.y} stroke={PRO} strokeWidth={2.5} strokeDasharray="7 6" />
              <Circle cx={proEnd.x} cy={proEnd.y} r={6} fill={PRO} stroke="#FFFFFF" strokeWidth={2} />
            </>
          ) : null}
          {A ? <Line x1={B.x} y1={B.y} x2={A.x} y2={A.y} stroke={YOU} strokeWidth={4} strokeOpacity={0.85} /> : null}
          {C ? <Line x1={B.x} y1={B.y} x2={C.x} y2={C.y} stroke={YOU} strokeWidth={4} strokeOpacity={0.85} /> : null}
          <Circle cx={B.x} cy={B.y} r={26} fill="#FF8A3D" fillOpacity={0.25} />
          <Circle cx={B.x} cy={B.y} r={13} fill="#FFB020" stroke="#FFF4D6" strokeWidth={3} />
          {tag ? (
            <>
              <Rect
                x={box.w - 84}
                y={18}
                width={64}
                height={36}
                rx={8}
                fill="rgba(40, 6, 10, 0.85)"
                stroke={YOU}
                strokeWidth={1.5}
              />
              <SvgText x={box.w - 52} y={43} fill={YOU} fontSize={20} fontWeight="700" textAnchor="middle">
                {tag}
              </SvgText>
            </>
          ) : null}
        </Svg>
      ) : null}
    </View>
  )
}

export function JointDetailView({ joint, reading, shotLabel, side, hologramImage, keypoints, onClose }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const [layer, setLayer] = useState<'player' | 'pro' | 'overlay'>('player')

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [onClose])

  const jointName = t(`analysis.jointName.${joint}`)
  const good = reading?.status === 'good'
  const message =
    reading?.messageKey != null
      ? t(`analysis.${reading.messageKey}`, { deg: Math.abs(reading.deltaDeg ?? 0) })
      : reading?.you != null
        ? t('analysis.jointNoPro')
        : null
  const tabs = [
    { id: 'player' as const, label: t('analysis.smart3dPlayer') },
    { id: 'pro' as const, label: t('analysis.proReference') },
    { id: 'overlay' as const, label: t('analysis.smart3dOverlay') },
  ]

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('analysis.back')} hitSlop={12} onPress={onClose}>
          <Ionicons name="chevron-back" size={24} color="#86A7D2" />
        </Pressable>
        <View style={styles.pillWrap}>
          <ResultSectionPill tabs={tabs} value={layer} onChange={setLayer} trackStyle={styles.pill} />
        </View>
      </View>

      <View style={styles.header}>
        <View style={styles.badge}>
          <Ionicons name={JOINT_ICON[joint]} size={30} color="#BFE6FF" />
        </View>
        <View style={styles.headerText}>
          <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.mediumFont }]}>
            {t('analysis.jointAngleTitle', { joint: jointName })}
          </Text>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.subtitle, { fontFamily: theme.mediumFont }]}>
            {shotLabel ? `${shotLabel} | ` : ''}
            {t('analysis.contactPhase')}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.view3d}>
          <Ionicons name="cube-outline" size={20} color="#BFE6FF" />
          <Text allowFontScaling={false} style={[styles.view3dLabel, { fontFamily: theme.mediumFont }]}>
            {t('analysis.view3d')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legend}>
          <View style={[styles.dot, { backgroundColor: YOU }]} />
          <Text allowFontScaling={false} style={[styles.legendLabel, { fontFamily: theme.mediumFont }]}>
            {t('analysis.yourMovement')}
          </Text>
        </View>
        <View style={styles.legend}>
          <View style={[styles.dot, { backgroundColor: PRO }]} />
          <Text allowFontScaling={false} style={[styles.legendLabel, { fontFamily: theme.mediumFont }]}>
            {t('analysis.proReference')}
          </Text>
        </View>
      </View>

      <JointCloseUp joint={joint} reading={reading} side={side} hologramImage={hologramImage} keypoints={keypoints} />

      <View style={styles.metricCard}>
        <View style={styles.badgeSmall}>
          <Ionicons name={JOINT_ICON[joint]} size={26} color="#BFE6FF" />
        </View>
        <View style={styles.metricCol}>
          <Text allowFontScaling={false} style={[styles.metricLabel, { fontFamily: theme.mediumFont }]}>
            {t('analysis.jointAngleTitle', { joint: jointName })}
          </Text>
          <Text allowFontScaling={false} style={[styles.metricValue, { color: good ? GOOD : YOU, fontFamily: theme.semiBoldFont }]}>
            {reading?.you != null ? `${reading.you}°` : '—'}
          </Text>
          <Text allowFontScaling={false} style={[styles.metricSub, { color: good ? GOOD : YOU, fontFamily: theme.mediumFont }]}>
            {t('analysis.yourAngle')}
          </Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricCol}>
          <Text allowFontScaling={false} style={[styles.metricValue, { color: GOOD, fontFamily: theme.semiBoldFont }]}>
            {reading?.pro != null ? `${reading.pro}°` : '—'}
          </Text>
          <Text allowFontScaling={false} style={[styles.metricSub, { color: GOOD, fontFamily: theme.mediumFont }]}>
            {t('analysis.idealRange')}
          </Text>
        </View>
      </View>

      {message ? (
        <View style={[styles.messageCard, good ? styles.messageGood : styles.messageBad]}>
          <View style={[styles.messageIcon, good ? styles.messageIconGood : styles.messageIconBad]}>
            <Ionicons name={good ? 'checkmark' : 'warning'} size={30} color={good ? GOOD : '#FF3B30'} />
          </View>
          <Text style={[styles.messageText, { fontFamily: theme.mediumFont }]}>{message}</Text>
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pillWrap: { flex: 1 },
  pill: { marginBottom: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#2E82E6',
    backgroundColor: '#0A2458',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { color: '#D8E8FF', fontSize: 22 },
  subtitle: { color: '#4FA3FF', fontSize: 13, marginTop: 2 },
  view3d: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#2E82E6',
    backgroundColor: '#071428',
  },
  view3dLabel: { color: '#D8E8FF', fontSize: 14 },
  legendRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  legend: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(46, 130, 230, 0.6)',
    backgroundColor: '#071428',
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { color: '#FFFFFF', fontSize: 14 },
  closeUp: {
    height: 260,
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(46, 130, 230, 0.75)',
    backgroundColor: '#000814',
    overflow: 'hidden',
  },
  metricCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#2E82E6',
    backgroundColor: '#071A3F',
  },
  badgeSmall: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#2E82E6',
    backgroundColor: '#0A2458',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCol: { flex: 1, alignItems: 'center' },
  metricLabel: { color: '#FFFFFF', fontSize: 14 },
  metricValue: { fontSize: 40, lineHeight: 46 },
  metricSub: { fontSize: 13 },
  metricDivider: { width: 1, alignSelf: 'stretch', marginVertical: 8, backgroundColor: '#2E82E6' },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  messageBad: { borderColor: '#C2261F', backgroundColor: '#3A0A0C' },
  messageGood: { borderColor: '#1E9E6A', backgroundColor: '#06291E' },
  messageIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  messageIconBad: { backgroundColor: 'rgba(255, 59, 48, 0.18)' },
  messageIconGood: { backgroundColor: 'rgba(52, 232, 158, 0.15)' },
  messageText: { flex: 1, color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
})
