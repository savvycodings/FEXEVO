import { useContext, useEffect, useMemo, useState } from 'react'
import { Image, Modal, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, Path } from 'react-native-svg'
import { ThemeContext } from '../../context'
import { TechniqueAnalysisVideoPanel } from '../../components/TechniqueAnalysisVideoPanel'
import { CARD_GLOW, SELECTED_GLOW, UI } from '../../components/ui'
import { useContactJoints, type ContactJoint, type JointReading } from '../../lib/jointsApi'
import { landmarkVisOk, poseAngle, RACKET_ANGLE_ID, TORSO_ANGLE_ID, type PoseAngleJoint } from '../../lib/poseJointAngles'
import { nearestPoseByFrame, type PoseFrameRow } from '../../lib/techniquePose'
import { getThumbnailAsync } from '../../lib/videoThumbnails'
import { dominantSide } from './movementTimeline'

type Mode = 'angles' | 'motion'
type PhaseId = 'preparation' | 'swing' | 'impact' | 'followThrough'
type Phase = { id: PhaseId; from: number; to: number; at: number }

type Props = {
  videoUri: string
  videoKey: string
  analysisId: string | null
  shotLabel: string | null
  poseFrames: PoseFrameRow[]
  totalFrames: number | null
  impactFrame: number | null
  /** From biomechanics timing. Falls back to 30. */
  fps: number | null
  /** Frames from the start of preparation to contact, when the server measured it. */
  framesPrepToImpact: number | null
}

const EMPTY_READING: JointReading = {
  you: null,
  pro: null,
  idealMin: null,
  idealMax: null,
  deltaDeg: null,
  status: null,
  direction: null,
  messageKey: null,
}

/** Joints on the left column. The first five come from the server; head, feet and racket are read from the pose. */
type ViewJoint = PoseAngleJoint
const JOINTS: ViewJoint[] = ['head', 'shoulder', 'elbow', 'wrist', 'torso', 'knee', 'feet', 'racket']
const SERVED: readonly ViewJoint[] = ['shoulder', 'elbow', 'wrist', 'torso', 'knee']
/** Joint column share of the row, from the design. The video takes the rest, as a square. */
const JOINT_COLUMN_SHARE = 0.26
const GAP = 10
const BUTTON_GAP = 5
const GOOD = '#34C759'
const OFF = '#FF7A6B'

const JOINT_ICON: Record<ViewJoint, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  head: 'head-outline',
  shoulder: 'arm-flex-outline',
  elbow: 'arm-flex',
  wrist: 'hand-back-right-outline',
  torso: 'human',
  knee: 'human-handsdown',
  feet: 'shoe-sneaker',
  racket: 'tennis',
}

function JointBadge({ joint, size }: { joint: ViewJoint; size: number }) {
  return (
    <View style={[styles.jointBadge, { width: size, height: size, borderRadius: size / 2 }]}>
      <MaterialCommunityIcons name={JOINT_ICON[joint]} size={Math.round(size * 0.62)} color={UI.text} />
    </View>
  )
}

/** Player mid-swing with a racket, for the shot card. */
function PlayerIcon() {
  const line = { stroke: UI.text, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Circle cx={14.5} cy={4.5} r={2} fill={UI.text} />
      <Path d="M13.5 8l-2.5 5 3.5 2.5-1.5 5.5" {...line} />
      <Path d="M11 13l-4 2.5-1.5 4" {...line} />
      <Path d="M13.5 8l4.5 2.5 1.5-2" {...line} />
      <Path d="M13.5 8L9 7 7 5" {...line} />
      <Circle cx={5.5} cy={3.5} r={2.2} {...line} />
      <Circle cx={21} cy={6.5} r={1} fill="#D9FF3C" />
    </Svg>
  )
}

/** Mid-body point (hips and shoulders) at contact, 0–1 in the frame. Falls back to the middle. */
function bodyCenter(row: PoseFrameRow | null): { x: number; y: number } {
  if (!row) return { x: 0.5, y: 0.5 }
  const pts = ['LEFT_HIP', 'RIGHT_HIP', 'LEFT_SHOULDER', 'RIGHT_SHOULDER']
    .map((n) => row.landmarks[n])
    .filter((p) => landmarkVisOk(p))
  if (!pts.length) return { x: 0.5, y: 0.5 }
  return {
    x: pts.reduce((a, p) => a + p!.x, 0) / pts.length,
    y: pts.reduce((a, p) => a + p!.y, 0) / pts.length,
  }
}

/** Landmark the joint is measured at; the torso reading sits on the hips. */
function jointLandmarks(joint: ViewJoint, side: 'LEFT' | 'RIGHT'): string[] {
  if (joint === 'torso') return ['LEFT_HIP', 'RIGHT_HIP']
  if (joint === 'head') return ['NOSE', `${side}_EAR`]
  if (joint === 'feet') return [`${side}_ANKLE`, `${side}_FOOT_INDEX`]
  if (joint === 'racket') return [`${side}_WRIST`, `${side}_INDEX`]
  return [`${side}_${joint.toUpperCase()}`]
}

function angleId(joint: ViewJoint, side: 'LEFT' | 'RIGHT'): string {
  if (joint === 'torso') return TORSO_ANGLE_ID
  if (joint === 'head') return `${side}_HEAD`
  if (joint === 'feet') return `${side}_ANKLE`
  if (joint === 'racket') return `${RACKET_ANGLE_ID}_${side}`
  return `${side}_${joint.toUpperCase()}`
}

function pathLandmark(joint: ViewJoint, side: 'LEFT' | 'RIGHT'): string {
  if (joint === 'torso') return `${side}_HIP`
  if (joint === 'head') return 'NOSE'
  if (joint === 'feet') return `${side}_ANKLE`
  if (joint === 'racket') return `${side}_INDEX`
  return `${side}_${joint.toUpperCase()}`
}

/** Target is the pro's angle when matched, else the middle of the ideal range. */
function targetOf(r: JointReading | undefined): number | null {
  if (!r) return null
  if (r.pro != null) return r.pro
  if (r.idealMin != null && r.idealMax != null) return Math.round((r.idealMin + r.idealMax) / 2)
  return null
}

function signed(deg: number): string {
  const v = Math.round(deg)
  return `${v > 0 ? '+' : ''}${v}°`
}

/**
 * Four phases around contact. Preparation runs from the clip start, the swing is the
 * second half of the prep window, impact is a short window on contact.
 */
function buildPhases(
  frames: PoseFrameRow[],
  impactFrame: number | null,
  fps: number,
  framesPrepToImpact: number | null
): Phase[] {
  if (frames.length < 2) return []
  const first = frames[0]!.frame
  const last = frames[frames.length - 1]!.frame
  const impact = impactFrame != null && impactFrame > first && impactFrame < last
    ? impactFrame
    : Math.round(first + (last - first) * 0.6)
  const prepStart =
    framesPrepToImpact != null && framesPrepToImpact > 0 ? Math.max(first, impact - framesPrepToImpact) : first
  const w = Math.max(1, Math.round(fps * 0.05))
  // Swing is the second half of the prep window, but never shorter than ~0.3s.
  const swingLen = Math.max((impact - prepStart) / 2, fps * 0.3)
  const swingStart = Math.max(first + 1, Math.round(impact - w - swingLen))
  const impactFrom = Math.max(swingStart + 1, impact - w)
  const impactTo = Math.min(last, impact + w)
  return [
    { id: 'preparation', from: first, to: swingStart, at: Math.round((first + swingStart) / 2) },
    { id: 'swing', from: swingStart, to: impactFrom, at: Math.round((swingStart + impactFrom) / 2) },
    { id: 'impact', from: impactFrom, to: impactTo, at: impact },
    { id: 'followThrough', from: impactTo, to: last, at: Math.round((impactTo + last) / 2) },
  ]
}

/**
 * Third results tab: pick a joint, read its contact angle against the target, and see it on
 * the clip as an angle arc or a traced path. Phase thumbnails jump the clip.
 */
export function ViewAnglesPage({
  videoUri,
  videoKey,
  analysisId,
  shotLabel,
  poseFrames,
  totalFrames,
  impactFrame,
  fps,
  framesPrepToImpact,
}: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const contact = useContactJoints(analysisId)
  const [joint, setJoint] = useState<ViewJoint>('shoulder')
  const [mode, setMode] = useState<Mode>('angles')
  const [phase, setPhase] = useState<PhaseId>('impact')
  const [seek, setSeek] = useState<{ fraction: number; key: number } | null>(null)
  const [width, setWidth] = useState(0)
  const [thumbs, setThumbs] = useState<Partial<Record<PhaseId, string>>>({})
  const [clipSize, setClipSize] = useState<{ w: number; h: number } | null>(null)

  const side = useMemo(() => contact?.side ?? dominantSide(poseFrames), [contact?.side, poseFrames])
  const frameRate = fps && fps > 0 ? fps : 30
  const total = totalFrames && totalFrames > 0 ? totalFrames : (poseFrames[poseFrames.length - 1]?.frame ?? 0) + 1
  const phases = useMemo(
    () => buildPhases(poseFrames, impactFrame, frameRate, framesPrepToImpact),
    [poseFrames, impactFrame, frameRate, framesPrepToImpact]
  )
  const impactAt = phases.find((p) => p.id === 'impact')?.at ?? null
  const startFraction = impactAt != null && total > 0 ? impactAt / total : null

  const highlighted = useMemo(() => jointLandmarks(joint, side), [joint, side])
  const angleIds = useMemo(() => (mode === 'angles' ? [angleId(joint, side)] : []), [mode, joint, side])

  useEffect(() => {
    setThumbs({})
    if (!videoUri || !phases.length) return
    let cancelled = false
    for (const p of phases) {
      getThumbnailAsync(videoUri, { time: Math.round((p.at / frameRate) * 1000), quality: 0.6 })
        .then(({ uri, width: w, height: h }) => {
          if (cancelled) return
          setThumbs((prev) => ({ ...prev, [p.id]: uri }))
          if (w > 0 && h > 0) setClipSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
        })
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [videoUri, phases, frameRate])

  const contactPose = useMemo(
    () => (impactAt != null ? nearestPoseByFrame(poseFrames, impactAt) : null),
    [poseFrames, impactAt]
  )
  const served = (SERVED as readonly string[]).includes(joint) ? contact?.joints[joint as ContactJoint] : undefined
  const fallbackYou = served?.you == null ? poseAngle(contactPose, joint, side) : null
  const reading: JointReading | undefined =
    served?.you != null
      ? served
      : fallbackYou != null
        ? { ...(served ?? EMPTY_READING), you: fallbackYou }
        : served
  const target = targetOf(reading)
  const diff =
    reading?.deltaDeg ?? (reading?.you != null && target != null ? reading.you - target : null)
  const insets = useSafeAreaInsets()
  const [fullscreen, setFullscreen] = useState(false)
  const jointColumn = Math.round(width * JOINT_COLUMN_SHARE)
  /** Square stage. The joint buttons share its height. */
  const square = Math.max(0, width - jointColumn - GAP)
  const buttonH = square > 0 ? (square - BUTTON_GAP * (JOINTS.length - 1)) / JOINTS.length : 32
  const badge = Math.max(14, Math.min(20, Math.round(buttonH - 12)))
  const jointName = t(`analysis.viewAnglesPage.joints.${joint}`)
  const seconds = (frame: number) => `${(frame / frameRate).toFixed(1)}s`

  // Cover the square ourselves: size the clip so its short side fills it, then centre on the
  // player at contact. (expo-av's cover mode doesn't fill on web.)
  const aspect = clipSize ? clipSize.h / clipSize.w : 16 / 9
  const panelW = aspect >= 1 ? square : square / aspect
  const panelH = panelW * aspect
  const center = useMemo(() => bodyCenter(contactPose), [contactPose])
  const clamp = (v: number, max: number) => Math.max(-max, Math.min(0, v))
  const offsetX = clamp(square / 2 - center.x * panelW, panelW - square)
  const offsetY = clamp(square / 2 - center.y * panelH, panelH - square)

  const pickPhase = (p: Phase) => {
    setPhase(p.id)
    if (total > 0) setSeek((prev) => ({ fraction: p.at / total, key: (prev?.key ?? 0) + 1 }))
  }

  const offTarget = diff != null && Math.abs(diff) > 5
  const panelProps = {
    videoUri,
    poseFrames,
    totalVidFrames: total,
    showLegend: false,
    showDetailedPoseOverlay: true,
    detailedChrome: 'none' as const,
    showJointAngles: mode === 'angles',
    jointAngleIds: angleIds,
    motionPathLandmark: mode === 'motion' ? pathLandmark(joint, side) : null,
    highlightedLandmarks: highlighted,
    isLooping: false,
    coverScale: 1,
    naturalSizeHint: clipSize,
  }

  return (
    <View style={styles.page} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.shotRow}>
        <View style={styles.shotIcon}>
          <PlayerIcon />
        </View>
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.shotText, { fontFamily: theme.regularFont }]}>
          {shotLabel || contact?.shotLabel || t('analysis.viewAnglesPage.shotFallback')}
        </Text>
      </View>

      <View style={styles.stageRow}>
        <View style={[styles.jointColumn, { width: jointColumn }]}>
          {JOINTS.map((id) => {
            const on = id === joint
            const content = (
              <>
                <JointBadge joint={id} size={badge} />
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.jointText, { fontFamily: theme.regularFont }]}
                >
                  {t(`analysis.viewAnglesPage.joints.${id}`)}
                </Text>
              </>
            )
            return (
              <Pressable
                key={id}
                testID={`viewAnglesJoint-${id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setJoint(id)}
                style={[styles.jointBtn, { height: buttonH }, on ? [styles.jointBtnOn, SELECTED_GLOW] : null]}
              >
                {on ? (
                  <LinearGradient
                    colors={['#7CC4FF', '#3D6BFF']}
                    start={UI.gradientStart}
                    end={UI.gradientEnd}
                    style={styles.jointFill}
                  >
                    {content}
                  </LinearGradient>
                ) : (
                  <View style={styles.jointFill}>{content}</View>
                )}
              </Pressable>
            )
          })}
        </View>

        <View testID="viewAnglesStage" style={[styles.stage, { width: square, height: square }]}>
          {square > 0 && poseFrames.length ? (
            <View style={{ position: 'absolute', left: offsetX, top: offsetY, width: panelW, height: panelH }}>
              <TechniqueAnalysisVideoPanel
                {...panelProps}
                videoKey={`${videoKey}-angles`}
                width={panelW}
                showPlaybackControls={false}
                autoPlay={false}
                interactiveScrub
                startFraction={startFraction}
                seekTo={seek}
              />
            </View>
          ) : null}
          <Pressable
            testID="viewAnglesFullscreen"
            accessibilityRole="button"
            accessibilityLabel={t('analysis.viewAnglesPage.fullscreen')}
            onPress={() => setFullscreen(true)}
            hitSlop={8}
            style={styles.fullscreenBtn}
          >
            <MaterialCommunityIcons name="arrow-expand-all" size={16} color={UI.text} />
          </Pressable>
          <View pointerEvents="none" style={styles.readout}>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.readoutTitle, { fontFamily: theme.regularFont }]}>
              {t(`analysis.viewAnglesPage.reading.${joint}`)}
            </Text>
            {reading?.you != null ? (
              <>
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.readoutValue,
                    { fontFamily: theme.mediumFont, color: diff == null ? UI.text : offTarget ? OFF : GOOD },
                  ]}
                >
                  {`${Math.round(reading.you)}°`}
                </Text>
                {target != null ? (
                  <Text allowFontScaling={false} style={[styles.readoutLine, { fontFamily: theme.regularFont }]}>
                    {t('analysis.viewAnglesPage.target')}
                    <Text style={{ color: GOOD }}>{`${Math.round(target)}°`}</Text>
                  </Text>
                ) : null}
                {diff != null ? (
                  <Text allowFontScaling={false} style={[styles.readoutLine, { fontFamily: theme.regularFont }]}>
                    {t('analysis.viewAnglesPage.difference')}
                    <Text style={{ color: offTarget ? OFF : GOOD }}>{signed(diff)}</Text>
                  </Text>
                ) : null}
              </>
            ) : (
              <Text allowFontScaling={false} style={[styles.readoutLine, { fontFamily: theme.regularFont }]}>
                {t('analysis.viewAnglesPage.noReading')}
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.modeRow}>
        <ModeButton
          label={t('analysis.viewAnglesPage.motionPath')}
          on={mode === 'motion'}
          onPress={() => setMode('motion')}
          testID="viewAnglesMotion"
        />
        <ModeButton
          label={t('analysis.viewAnglesPage.angles')}
          on={mode === 'angles'}
          onPress={() => setMode('angles')}
          testID="viewAnglesAngles"
        />
      </View>

      {phases.length ? (
        <View style={styles.timelineCard}>
          <Text allowFontScaling={false} style={[styles.timelineTitle, { fontFamily: theme.regularFont }]}>
            {t('analysis.viewAnglesPage.timeline')}
            <Text style={[styles.timelineJoint, { fontFamily: theme.regularFont }]}>{`  (${jointName})`}</Text>
          </Text>
          <View style={styles.phaseRow}>
            {phases.map((p) => {
              const on = p.id === phase
              const thumb = thumbs[p.id]
              return (
                <Pressable
                  key={p.id}
                  testID={`viewAnglesPhase-${p.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => pickPhase(p)}
                  style={[styles.phase, on && styles.phaseOn]}
                >
                  <View style={[styles.thumb, on && styles.thumbOn, on && SELECTED_GLOW]}>
                    {thumb ? <Image source={{ uri: thumb }} style={styles.thumbImg} resizeMode="cover" /> : null}
                  </View>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={2}
                    style={[styles.phaseLabel, { fontFamily: theme.regularFont }]}
                  >
                    {t(`analysis.viewAnglesPage.phases.${p.id}`)}
                  </Text>
                  <Text allowFontScaling={false} numberOfLines={1} style={[styles.phaseTime, { fontFamily: theme.regularFont }]}>
                    {`${seconds(p.from)} - ${seconds(p.to)}`}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ) : null}

      <Modal visible={fullscreen} animationType="fade" onRequestClose={() => setFullscreen(false)} supportedOrientations={['portrait', 'landscape']}>
        <View style={[styles.fullscreen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
          <Pressable
            testID="viewAnglesFullscreenClose"
            accessibilityRole="button"
            accessibilityLabel={t('analysis.back')}
            onPress={() => setFullscreen(false)}
            hitSlop={10}
            style={styles.fullscreenClose}
          >
            <Ionicons name="close" size={24} color={UI.text} />
          </Pressable>
          {fullscreen && width > 0 ? (
            <FullscreenClip panelProps={panelProps} videoKey={`${videoKey}-angles-full`} startFraction={startFraction} />
          ) : null}
        </View>
      </Modal>
    </View>
  )
}

/** The clip at its own aspect, as large as the screen allows, with play controls. */
function FullscreenClip({
  panelProps,
  videoKey,
  startFraction,
}: {
  panelProps: Omit<React.ComponentProps<typeof TechniqueAnalysisVideoPanel>, 'videoKey' | 'width'>
  videoKey: string
  startFraction: number | null
}) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  const hint = panelProps.naturalSizeHint
  const aspect = hint ? hint.h / hint.w : 16 / 9
  const w = box ? Math.min(box.w, box.h / aspect) : 0
  return (
    <View style={styles.fullscreenBody} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {w > 0 ? (
        <TechniqueAnalysisVideoPanel
          {...panelProps}
          videoKey={videoKey}
          width={w}
          showPlaybackControls
          autoPlay={false}
          startFraction={startFraction}
        />
      ) : null}
    </View>
  )
}

function ModeButton({
  label,
  on,
  onPress,
  testID,
}: {
  label: string
  on: boolean
  onPress: () => void
  testID: string
}) {
  const { theme } = useContext(ThemeContext)
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.modeBtn, on && styles.modeBtnOn]}
    >
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.modeText, { fontFamily: theme.regularFont }, on && styles.modeTextOn]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const STAGE_BORDER = '#1F4BFF'

const styles = StyleSheet.create({
  page: { alignSelf: 'stretch', gap: 12 },
  shotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: UI.radiusCard,
    borderWidth: 1,
    borderColor: UI.trackBorder,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  shotIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.cardBg,
  },
  shotText: { color: UI.text, fontSize: 18, flexShrink: 1 },
  stageRow: { flexDirection: 'row', gap: GAP },
  jointColumn: { gap: BUTTON_GAP },
  jointBtn: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: STAGE_BORDER,
    backgroundColor: UI.cardBg,
    overflow: 'hidden',
  },
  jointBtnOn: { borderColor: UI.text },
  jointFill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  jointBadge: { backgroundColor: UI.accentStrong, alignItems: 'center', justifyContent: 'center' },
  jointText: { color: UI.text, fontSize: 12, flexShrink: 1 },
  stage: {
    borderRadius: UI.radiusCard,
    borderWidth: 2,
    borderColor: STAGE_BORDER,
    overflow: 'hidden',
    backgroundColor: UI.cardBg,
  },
  fullscreenBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: UI.text,
    backgroundColor: 'rgba(0, 20, 53, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readout: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    maxWidth: '62%',
    borderRadius: 18,
    backgroundColor: 'rgba(11, 31, 87, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readoutTitle: { color: UI.text, fontSize: 12 },
  readoutValue: { color: UI.text, fontSize: 28, lineHeight: 34 },
  readoutLine: { color: UI.text, fontSize: 12, lineHeight: 15 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1,
    height: 38,
    borderRadius: UI.radiusPill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: UI.cardBg,
    borderWidth: 1,
    borderColor: UI.surfaceBorder,
  },
  modeBtnOn: { backgroundColor: '#4BAEF5', borderColor: '#4BAEF5' },
  modeText: { color: UI.text, fontSize: 14, flexShrink: 1 },
  modeTextOn: { color: UI.cardBg },
  timelineCard: {
    borderRadius: UI.radiusCard,
    borderWidth: 1,
    borderColor: UI.trackBorder,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  timelineTitle: { color: UI.text, fontSize: 17, paddingHorizontal: 2 },
  timelineJoint: { color: UI.accent, fontSize: 12 },
  phaseRow: { flexDirection: 'row', gap: 4 },
  phase: { flex: 1, alignItems: 'center', gap: 3, borderRadius: 10, paddingBottom: 6 },
  phaseOn: { backgroundColor: UI.surface },
  thumb: {
    alignSelf: 'stretch',
    aspectRatio: 1.2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: UI.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbOn: { borderColor: UI.accent },
  thumbImg: { width: '100%', height: '100%' },
  phaseLabel: { color: UI.text, fontSize: 11, lineHeight: 14, textAlign: 'center', letterSpacing: -0.2 },
  phaseTime: { color: UI.textMuted, fontSize: 10 },
  fullscreen: { flex: 1, backgroundColor: '#000' },
  fullscreenClose: { alignSelf: 'flex-end', padding: 10, marginRight: 6 },
  fullscreenBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
