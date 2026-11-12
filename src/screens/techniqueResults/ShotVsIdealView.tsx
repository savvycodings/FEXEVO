import { useContext, useEffect, useMemo, useState } from 'react'
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { ThemeContext } from '../../context'
import { LocalSvgAsset } from '../../components/LocalSvgAsset'
import { GlowButton } from '../../components/ui'
import { useContactJoints, type ContactJoint } from '../../lib/jointsApi'
import { landmarkVisOk, poseAngle } from '../../lib/poseJointAngles'
import { nearestPoseByFrame, type LandmarkPoint, type PoseFrameRow } from '../../lib/techniquePose'
import { JOINT_ICON } from './jointIcons'
import type { ViewJoint } from './ViewAnglesPage'
import { PlayableClip } from './PlayableClip'
import { dominantSide } from './movementTimeline'

const ICON_YOUR_SHOT = require('../../../assets/aicoach/analysis/shot-vs-ideal/your-shot.svg')
const ICON_IDEAL = require('../../../assets/aicoach/analysis/shot-vs-ideal/ideal-form.svg')
const ICON_PROBLEM = require('../../../assets/aicoach/analysis/shot-vs-ideal/problem.svg')
const ICON_WHY = require('../../../assets/aicoach/analysis/shot-vs-ideal/why-matters.svg')
const ICON_ELBOW = require('../../../assets/aicoach/analysis/shot-vs-ideal/joint-elbow.svg')

type Props = {
  videoUri: string | null
  idealVideoUri: string | null
  analysisId: string | null
  initialJoint: ViewJoint
  errors: string[]
  poseFrames?: PoseFrameRow[]
  impactFrame?: number | null
  onClose: () => void
  onDrills: () => void
}

type Metric = {
  label: string
  value: string
  target: string | null
  diff: string | null
  art?: keyof typeof ART_SPOT
}

const HIGH = '#E5482B'
const YOU_BORDER = 'rgba(0, 72, 255, 0.5)'
const ISSUE_ORDER: ViewJoint[] = ['elbow', 'shoulder', 'wrist', 'torso', 'knee', 'feet', 'racket', 'head']
const SERVED: ContactJoint[] = ['shoulder', 'elbow', 'wrist', 'torso', 'knee']
/** Drillis & Contini / Winter: upper arm ≈ 0.186 × stature; shoulder–hip ≈ 0.288 × stature. */
const UPPER_ARM_FRAC = 0.186
const TORSO_FRAC = 0.288
const REF_STATURE_CM = 175
const DISTANCE_TARGET_CM = 15

const TITLE_KEY: Partial<Record<ViewJoint, string>> = {
  elbow: 'analysis.mistakeElbow',
  shoulder: 'analysis.mistakeShoulder',
  wrist: 'analysis.mistakeWrist',
  torso: 'analysis.mistakeTorso',
  knee: 'analysis.mistakeKnee',
  feet: 'analysis.mistakeFoot',
  racket: 'analysis.mistakeRacket',
  head: 'analysis.viewAnglesPage.reading.head',
}

const BODY_KEY: Partial<Record<ViewJoint, string>> = {
  elbow: 'analysis.mistakeElbowBody',
  shoulder: 'analysis.mistakeShoulderBody',
  wrist: 'analysis.mistakeWristBody',
  torso: 'analysis.mistakeTorsoBody',
  knee: 'analysis.mistakeKneeBody',
  feet: 'analysis.mistakeFootBody',
  racket: 'analysis.mistakeRacketBody',
  head: 'analysis.mistakeHeadBody',
}

const WHY_KEY: Partial<Record<ViewJoint, string>> = {
  elbow: 'analysis.mistakeElbowWhy',
  shoulder: 'analysis.mistakeShoulderWhy',
  wrist: 'analysis.mistakeWristWhy',
  torso: 'analysis.mistakeTorsoWhy',
  knee: 'analysis.mistakeKneeWhy',
  feet: 'analysis.mistakeFootWhy',
  racket: 'analysis.mistakeRacketWhy',
  head: 'analysis.mistakeHeadWhy',
}

const PROBLEM_KEY: Partial<Record<ViewJoint, string>> = {
  elbow: 'analysis.mistakeElbowProblem',
  shoulder: 'analysis.mistakeShoulderProblem',
  wrist: 'analysis.mistakeWristProblem',
  torso: 'analysis.mistakeTorsoProblem',
  knee: 'analysis.mistakeKneeProblem',
  feet: 'analysis.mistakeFootProblem',
  racket: 'analysis.mistakeRacketProblem',
  head: 'analysis.mistakeHeadProblem',
}

const PROBLEM_BODY_KEY: Partial<Record<ViewJoint, string>> = {
  elbow: 'analysis.mistakeElbowProblemBody',
  shoulder: 'analysis.mistakeShoulderProblemBody',
  wrist: 'analysis.mistakeWristProblemBody',
  torso: 'analysis.mistakeTorsoProblemBody',
  knee: 'analysis.mistakeKneeProblemBody',
  feet: 'analysis.mistakeFootProblemBody',
  racket: 'analysis.mistakeRacketProblemBody',
  head: 'analysis.mistakeHeadProblemBody',
}

const BODY_ART = require('../../../assets/smart3d/body.webp')
const BODY_ART_AR = 844 / 1024
const ART_SPOT: Record<'elbow' | 'shoulder' | 'torso' | 'wrist' | 'knee', { x: number; y: number }> = {
  elbow: { x: 0.392, y: 0.386 },
  wrist: { x: 0.346, y: 0.498 },
  knee: { x: 0.402, y: 0.685 },
  shoulder: { x: 0.436, y: 0.279 },
  torso: { x: 0.5, y: 0.42 },
}

function JointArt({ spot, width = 60 }: { spot: keyof typeof ART_SPOT; width?: number }) {
  const w = width * 6.5
  const h = w * BODY_ART_AR
  const p = ART_SPOT[spot]
  return (
    <View style={styles.jointArt}>
      <Image
        source={BODY_ART}
        style={{ position: 'absolute', width: w, height: h, left: width / 2 - p.x * w, top: width / 2 - p.y * h }}
      />
    </View>
  )
}

function pt(row: PoseFrameRow, name: string): { x: number; y: number } | null {
  const p = row.landmarks[name] as LandmarkPoint | undefined
  return landmarkVisOk(p) ? { x: p!.x, y: p!.y } : null
}

/**
 * cm-per-normalized-unit via Drillis & Contini (1966) / Winter proportions:
 * upper arm ≈ 0.186 × stature, shoulder–hip ≈ 0.288 × stature.
 * Prefer the visible upper-arm segment (YOLO/pose), fall back to torso.
 */
function cmPerNorm(row: PoseFrameRow, side: 'LEFT' | 'RIGHT'): number | null {
  const sh = pt(row, `${side}_SHOULDER`)
  const el = pt(row, `${side}_ELBOW`)
  const hip = pt(row, `${side}_HIP`)
  if (sh && el) {
    const upper = Math.hypot(el.x - sh.x, el.y - sh.y)
    if (upper > 1e-4) return (UPPER_ARM_FRAC * REF_STATURE_CM) / upper
  }
  if (sh && hip) {
    const torso = Math.hypot(hip.x - sh.x, hip.y - sh.y)
    if (torso > 1e-4) return (TORSO_FRAC * REF_STATURE_CM) / torso
  }
  return null
}

function distanceLandmark(joint: ViewJoint, side: 'LEFT' | 'RIGHT'): string {
  if (joint === 'wrist' || joint === 'racket') return `${side}_WRIST`
  if (joint === 'shoulder') return `${side}_SHOULDER`
  if (joint === 'knee') return `${side}_KNEE`
  if (joint === 'feet') return `${side}_ANKLE`
  if (joint === 'head') return 'NOSE'
  if (joint === 'torso') return `${side}_HIP`
  return `${side}_ELBOW`
}

/** Perpendicular distance from the joint to the shoulder–hip torso line, in cm. */
function jointToBodyCm(row: PoseFrameRow | null, side: 'LEFT' | 'RIGHT', joint: ViewJoint): number | null {
  if (!row) return null
  const sh = pt(row, `${side}_SHOULDER`)
  const hip = pt(row, `${side}_HIP`)
  const jointPt = pt(row, distanceLandmark(joint, side))
  const scale = cmPerNorm(row, side)
  if (!sh || !hip || !jointPt || scale == null) return null
  const torso = Math.hypot(hip.x - sh.x, hip.y - sh.y)
  if (torso < 1e-4) return null
  const cross = Math.abs((hip.x - sh.x) * (sh.y - jointPt.y) - (hip.y - sh.y) * (sh.x - jointPt.x))
  return (cross / torso) * scale
}

function artFor(joint: ViewJoint): keyof typeof ART_SPOT {
  if (joint === 'shoulder' || joint === 'wrist' || joint === 'knee' || joint === 'torso') return joint
  return 'elbow'
}

/**
 * Your Shot VS Ideal Form (Figma 6263:1203).
 * Opened from a red/orange joint on View Angles.
 */
export function ShotVsIdealView({
  videoUri,
  idealVideoUri,
  analysisId,
  initialJoint,
  errors,
  poseFrames = [],
  impactFrame = null,
  onClose,
  onDrills,
}: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const contact = useContactJoints(analysisId)
  const [joint, setJoint] = useState<ViewJoint>(initialJoint)

  const issueJoints = useMemo(() => {
    const flagged = ISSUE_ORDER.filter((id) => {
      if ((SERVED as string[]).includes(id)) {
        const r = contact?.joints[id as ContactJoint]
        if (r?.status === 'bad' || r?.status === 'warn') return true
        if (r?.deltaDeg != null && Math.abs(r.deltaDeg) > 5) return true
      }
      const words =
        id === 'feet'
          ? ['foot', 'feet', 'pie']
          : id === 'torso'
            ? ['torso', 'rotation', 'hip']
            : id === 'head'
              ? ['head', 'cabeza']
              : [id]
      return words.some((w) => errors.some((e) => e.toLowerCase().includes(w)))
    })
    return flagged.length ? flagged : [initialJoint]
  }, [contact, errors, initialJoint])

  useEffect(() => {
    if (!issueJoints.includes(joint)) setJoint(issueJoints[0]!)
  }, [issueJoints, joint])

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [onClose])

  const contactPose = useMemo(() => {
    if (!poseFrames.length) return null
    if (impactFrame != null) return nearestPoseByFrame(poseFrames, impactFrame)
    return poseFrames[Math.floor(poseFrames.length / 2)] ?? null
  }, [poseFrames, impactFrame])

  const side = poseFrames.length ? dominantSide(poseFrames) : 'RIGHT'
  const reading = (SERVED as string[]).includes(joint)
    ? contact?.joints[joint as ContactJoint]
    : null
  const poseYou = poseAngle(contactPose, joint, side)
  const you = reading?.you ?? poseYou
  const target =
    reading?.pro ??
    (reading?.idealMin != null && reading?.idealMax != null
      ? Math.round((reading.idealMin + reading.idealMax) / 2)
      : null)
  const diff =
    reading?.deltaDeg ?? (you != null && target != null ? you - target : null)
  const rangeLabel =
    reading?.idealMin != null && reading?.idealMax != null
      ? t('analysis.mistakeTargetRange', {
          low: Math.round(reading.idealMin),
          high: Math.round(reading.idealMax),
        })
      : target != null
        ? `${t('analysis.viewAnglesPage.target')}${Math.round(target)}°`
        : null

  const distanceCm = useMemo(
    () => jointToBodyCm(contactPose, side, joint),
    [contactPose, side, joint]
  )

  const metrics: Metric[] = useMemo(() => {
    const art = artFor(joint)
    const angle: Metric = {
      label: t(`analysis.viewAnglesPage.reading.${joint}`),
      value: you != null ? `${Math.round(you)}°` : '—',
      target: rangeLabel,
      diff: diff != null ? `${diff > 0 ? '+' : ''}${Math.round(diff)}°` : null,
      art,
    }
    const dDiff = distanceCm != null ? distanceCm - DISTANCE_TARGET_CM : null
    const distance: Metric = {
      label: t('analysis.mistakeDistance'),
      value: distanceCm != null ? `${distanceCm.toFixed(1)} cm` : '—',
      target: t('analysis.mistakeDistanceTarget'),
      diff: dDiff != null ? `${dDiff > 0 ? '+' : ''}${dDiff.toFixed(1)} cm` : null,
      art,
    }
    // Figma always shows Angle + Distance side by side.
    return [angle, distance]
  }, [t, joint, you, rangeLabel, diff, distanceCm])

  const idx = Math.max(0, issueJoints.indexOf(joint))
  const goPrev = () => setJoint(issueJoints[(idx - 1 + issueJoints.length) % issueJoints.length]!)
  const goNext = () => setJoint(issueJoints[(idx + 1) % issueJoints.length]!)

  const titleKey = TITLE_KEY[joint] ?? 'analysis.viewAnglesPage.reading.elbow'
  const bodyKey = BODY_KEY[joint]
  const whyKey = WHY_KEY[joint]
  const problemKey = PROBLEM_KEY[joint]
  const problemBodyKey = PROBLEM_BODY_KEY[joint]

  // Host tab scenes already clear the status bar — do not stack insets.top again.
  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.nav}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('analysis.back')}
          style={styles.navSide}
        >
          <Ionicons name="chevron-back" size={24} color="#86A7D2" />
        </Pressable>
        <View style={styles.navCenter}>
          <Text allowFontScaling={false} style={[styles.navTitle, { fontFamily: theme.mediumFont }]}>
            {t('analysis.yourShotVsIdeal')}
          </Text>
          <Text allowFontScaling={false} style={[styles.navSub, { fontFamily: theme.mediumFont }]}>
            {t('analysis.shotVsIdealSubtitle')}
          </Text>
        </View>
        <View style={styles.navSide} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.videoRow}>
          <View style={[styles.videoCard, { borderColor: YOU_BORDER }]}>
            <View style={[styles.videoHead, { backgroundColor: 'rgba(0,72,255,0.25)', borderBottomColor: YOU_BORDER }]}>
              <LocalSvgAsset assetModule={ICON_YOUR_SHOT} width={24} height={24} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.videoHeadLabel, { fontFamily: theme.mediumFont }]}
              >
                {t('analysis.yourShot')}
              </Text>
            </View>
            <PlayableClip uri={videoUri} testID="shot-vs-ideal-you" accent={YOU_BORDER} />
          </View>
          <View style={[styles.videoCard, { borderColor: 'rgba(0,238,212,0.5)' }]}>
            <View
              style={[
                styles.videoHead,
                { backgroundColor: 'rgba(0,238,212,0.1)', borderBottomColor: 'rgba(0,238,212,0.5)' },
              ]}
            >
              <LocalSvgAsset assetModule={ICON_IDEAL} width={24} height={24} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.videoHeadLabel, { fontFamily: theme.mediumFont }]}
              >
                {t('analysis.idealForm')}
              </Text>
            </View>
            <PlayableClip uri={idealVideoUri} testID="shot-vs-ideal-ideal" accent="rgba(0,238,212,0.5)" />
          </View>
        </View>

        <View style={styles.issueCard}>
          <View style={styles.issueHead}>
            <View style={styles.issueNum}>
              <Text
                allowFontScaling={false}
                style={[styles.issueNumText, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}
              >
                {idx + 1}
              </Text>
            </View>
            {joint === 'elbow' ? (
              <LocalSvgAsset assetModule={ICON_ELBOW} width={24} height={24} />
            ) : (
              <MaterialCommunityIcons name={JOINT_ICON[joint]} size={22} color="#FFFFFF" />
            )}
            <View style={styles.issueCopy}>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.issueTitle, { fontFamily: theme.mediumFont }]}
              >
                {t(titleKey)}
              </Text>
              {bodyKey ? (
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.issueBody, { fontFamily: theme.mediumFont }]}
                >
                  {t(bodyKey)}
                </Text>
              ) : null}
            </View>
            <View style={styles.highPill}>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.highPillLabel, { fontFamily: theme.mediumFont }]}
              >
                {t('analysis.mistakeHighPriority')}
              </Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            {metrics.map((m) => (
              <View key={m.label} style={styles.metricCard}>
                <View style={styles.metricCopy}>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[styles.metricLabel, { fontFamily: theme.regularFont }]}
                  >
                    {m.label}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.55}
                    style={[
                      styles.metricValue,
                      { fontFamily: theme.mediumFont },
                      m.value.length > 5 && styles.metricValueLong,
                    ]}
                  >
                    {m.value}
                  </Text>
                  {m.target ? (
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={[styles.metricMeta, { fontFamily: theme.mediumFont }]}
                    >
                      {m.target}
                    </Text>
                  ) : null}
                  {m.diff != null ? (
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={[styles.metricMeta, { fontFamily: theme.mediumFont }]}
                    >
                      {t('analysis.mistakeDiffLabel')}
                      <Text style={{ color: HIGH }}>{m.diff}</Text>
                    </Text>
                  ) : null}
                </View>
                {m.art ? <JointArt spot={m.art} width={60} /> : null}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.navJoints}>
          <Pressable onPress={goPrev} style={styles.navJointBtn} accessibilityRole="button">
            <Ionicons name="chevron-back" size={18} color="#86A7D2" />
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.navJointLabel, { fontFamily: theme.regularFont }]}
            >
              {t('analysis.previousJoint')}
            </Text>
          </Pressable>
          <Pressable onPress={goNext} style={styles.navJointBtn} accessibilityRole="button">
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.navJointLabel, { fontFamily: theme.regularFont }]}
            >
              {t('analysis.nextJoint')}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#86A7D2" />
          </Pressable>
        </View>

        <View style={styles.problemCard}>
          <View style={styles.problemIcon}>
            <LocalSvgAsset assetModule={ICON_PROBLEM} width={24} height={24} />
          </View>
          <View style={styles.problemCopy}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.problemTitle, { fontFamily: theme.mediumFont }]}
            >
              {problemKey ? t(problemKey) : t(titleKey)}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={2}
              style={[styles.problemBody, { fontFamily: theme.mediumFont }]}
            >
              {problemBodyKey ? t(problemBodyKey) : bodyKey ? t(bodyKey) : ''}
            </Text>
          </View>
        </View>

        <View style={styles.whyCard}>
          <View style={styles.whyIcon}>
            <LocalSvgAsset assetModule={ICON_WHY} width={24} height={24} />
          </View>
          <View style={styles.problemCopy}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.whyTitle, { fontFamily: theme.mediumFont }]}
            >
              {t('analysis.mistakeWhy')}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={2}
              style={[styles.whyBody, { fontFamily: theme.mediumFont }]}
            >
              {whyKey ? t(whyKey) : t('analysis.mistakeHeadWhy')}
            </Text>
          </View>
        </View>

        <GlowButton
          label={t('analysis.drillExercises')}
          onPress={onDrills}
          testID="shot-vs-ideal-drills"
          arrow
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    marginBottom: 4,
  },
  navSide: { width: 20, alignItems: 'center', justifyContent: 'center' },
  navCenter: { flex: 1, alignItems: 'center' },
  navTitle: { color: '#FFFFFF', fontSize: 22, textAlign: 'center' },
  navSub: { color: '#00B8FF', fontSize: 13, textAlign: 'center', marginTop: 2 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 10 },
  videoRow: { flexDirection: 'row', gap: 10 },
  videoCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#030A17',
    height: 224,
  },
  videoHead: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderBottomWidth: 2,
  },
  videoHeadLabel: { color: '#FFFFFF', fontSize: 13 },
  issueCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#001950',
    overflow: 'hidden',
    gap: 10,
  },
  issueHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  issueNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF0000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  issueNumText: { color: '#FFFFFF', fontSize: 9 },
  issueCopy: { flex: 1, minWidth: 0, gap: 2 },
  issueTitle: { color: '#FFFFFF', fontSize: 16 },
  issueBody: { color: 'rgba(255,255,255,0.75)', fontSize: 9 },
  highPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FF0000',
    backgroundColor: 'rgba(255,0,4,0.2)',
    paddingHorizontal: 10,
    height: 24,
    justifyContent: 'center',
  },
  highPillLabel: { color: '#FF7676', fontSize: 11 },
  metricRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 0, paddingBottom: 0 },
  metricCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#001950',
    backgroundColor: 'rgba(0,25,80,0.2)',
    padding: 10,
    minHeight: 92,
    overflow: 'hidden',
  },
  metricCopy: { flex: 1, gap: 2, minWidth: 0 },
  metricLabel: { color: '#FFFFFF', fontSize: 11 },
  metricValue: { color: HIGH, fontSize: 24, lineHeight: 28 },
  metricValueLong: { fontSize: 18 },
  metricMeta: { color: '#FFFFFF', fontSize: 11 },
  jointArt: {
    width: 60,
    alignSelf: 'stretch',
    minHeight: 70,
    overflow: 'hidden',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#001950',
  },
  navJoints: { flexDirection: 'row', gap: 5 },
  navJointBtn: {
    flex: 1,
    height: 46,
    borderRadius: 100,
    backgroundColor: '#07256D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  navJointLabel: { color: '#86A7D2', fontSize: 16, flexShrink: 1 },
  problemCard: {
    flexDirection: 'row',
    gap: 15,
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF0000',
    backgroundColor: 'rgba(255,0,0,0.2)',
    padding: 10,
  },
  problemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF0000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  problemCopy: { flex: 1, gap: 5, minWidth: 0 },
  problemTitle: { color: '#FFFFFF', fontSize: 13 },
  problemBody: { color: 'rgba(255,255,255,0.75)', fontSize: 9 },
  whyCard: {
    flexDirection: 'row',
    gap: 15,
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#336AB3',
    backgroundColor: '#030A17',
    padding: 10,
  },
  whyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#001950',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whyTitle: { color: '#86A7D2', fontSize: 16 },
  whyBody: { color: '#86A7D2', fontSize: 11 },
})
