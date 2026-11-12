import { useContext, useEffect, useMemo, useState } from 'react'
import { Image, Modal, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { ThemeContext } from '../../context'
import { TechniqueAnalysisVideoPanel } from '../../components/TechniqueAnalysisVideoPanel'
import { LinearGradient } from 'expo-linear-gradient'
import { SELECTED_GLOW, UI } from '../../components/ui'
import { useContactJoints, type ContactJoint, type JointReading } from '../../lib/jointsApi'
import { landmarkVisOk, poseAngle, RACKET_ANGLE_ID, TORSO_ANGLE_ID, type PoseAngleJoint } from '../../lib/poseJointAngles'
import { nearestPoseByFrame, type PoseFrameRow } from '../../lib/techniquePose'
import { getThumbnailAsync } from '../../lib/videoThumbnails'
import { BodyPartIcon, BodyPartRail, BODY_RAIL_W, type BodyPartId } from './BodyPartRail'
import { dominantSide } from './movementTimeline'

type Mode = 'angles' | 'motion'
type PhaseId = 'preparation' | 'swing' | 'impact' | 'followThrough'
type Phase = { id: PhaseId; from: number; to: number; at: number }
export type JointSeverity = 'high' | 'medium' | null

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
  /** Coach technical-error lines — used to flag issue joints red/orange. */
  errors?: string[]
  /** Opens Your Shot VS Ideal Form for this joint (issue joints only). */
  onOpenShotVsIdeal?: (joint: ViewJoint) => void
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
export type ViewJoint = PoseAngleJoint
const JOINTS: ViewJoint[] = ['head', 'shoulder', 'elbow', 'wrist', 'torso', 'knee', 'feet', 'racket']
const SERVED: readonly ViewJoint[] = ['shoulder', 'elbow', 'wrist', 'torso', 'knee']
/** Words in coach errors that map a joint to an issue. */
const JOINT_ERROR_WORDS: Record<ViewJoint, string[]> = {
  head: ['head', 'cabeza'],
  shoulder: ['shoulder', 'hombro'],
  elbow: ['elbow', 'codo'],
  wrist: ['wrist', 'muñeca'],
  torso: ['torso', 'rotation', 'rotación', 'hip', 'cadera'],
  knee: ['knee', 'rodilla'],
  feet: ['foot', 'feet', 'pie', 'base'],
  racket: ['racket', 'raqueta', 'pala', 'face'],
}
const GAP = 10
const GOOD = '#34C759'
const OFF = '#FF7A6B'
const HIGH = '#E5482B'
const MEDIUM = '#FF8000'

function severityOf(reading: JointReading | undefined, joint: ViewJoint, errors: string[]): JointSeverity {
  if (reading?.status === 'bad') return 'high'
  if (reading?.status === 'warn') return 'medium'
  const delta = reading?.deltaDeg
  if (delta != null && Number.isFinite(delta)) {
    const a = Math.abs(delta)
    if (a >= 15) return 'high'
    if (a > 5) return 'medium'
  }
  const words = JOINT_ERROR_WORDS[joint]
  if (words.some((w) => errors.some((e) => e.toLowerCase().includes(w)))) return 'high'
  return null
}

function severityColor(sev: JointSeverity): string | null {
  if (sev === 'high') return HIGH
  if (sev === 'medium') return MEDIUM
  return null
}


function JointBadge({ joint, size }: { joint: ViewJoint; size: number }) {
  return (
    <View style={[styles.jointBadge, { width: size, height: size, borderRadius: size / 2 }]}>
      <BodyPartIcon id={joint as BodyPartId} size={Math.round(size * 0.72)} />
    </View>
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
  poseFrames,
  totalFrames,
  impactFrame,
  fps,
  framesPrepToImpact,
  errors = [],
  onOpenShotVsIdeal,
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
  // Keep server pro/ideal when we only need to fill in the player's angle locally.
  const reading: JointReading | undefined =
    served?.you != null
      ? served
      : fallbackYou != null
        ? {
            ...(served ?? EMPTY_READING),
            you: fallbackYou,
            deltaDeg:
              served?.pro != null
                ? fallbackYou - served.pro
                : served?.deltaDeg ?? null,
            status: served?.status ?? null,
            direction: served?.direction ?? null,
            messageKey: served?.messageKey ?? null,
            idealMin: served?.idealMin ?? null,
            idealMax: served?.idealMax ?? null,
            pro: served?.pro ?? null,
          }
        : served
  const target = targetOf(reading)
  const diff =
    reading?.deltaDeg ?? (reading?.you != null && target != null ? reading.you - target : null)
  const insets = useSafeAreaInsets()
  const [fullscreen, setFullscreen] = useState(false)
  const jointColumn = BODY_RAIL_W
  /** Figma Frame 1107 — navy housing around video + Motion/Angles (290×323, pad 10). */
  const housingW = Math.max(0, width - jointColumn - GAP)
  const housingPad = 10
  const housingGap = 10
  const modeTrackH = 36
  const videoW = Math.max(0, housingW - housingPad * 2)
  const videoH = videoW > 0 ? Math.round(videoW * (257 / 270)) : 0
  const housingH =
    videoH > 0 ? housingPad + videoH + housingGap + modeTrackH + housingPad : 0
  const badge = 24
  const seconds = (frame: number) => `${(frame / frameRate).toFixed(1)}s`

  // Cover the video frame ourselves: size the clip so its short side fills it, then centre on the
  // player at contact. (expo-av's cover mode doesn't fill on web.)
  const aspect = clipSize ? clipSize.h / clipSize.w : 16 / 9
  const coverSide = Math.max(videoW, videoH)
  const panelW = aspect >= 1 ? coverSide : coverSide / aspect
  const panelH = panelW * aspect
  const center = useMemo(() => bodyCenter(contactPose), [contactPose])
  const clamp = (v: number, max: number) => Math.max(-max, Math.min(0, v))
  const offsetX = videoW > 0 ? clamp(videoW / 2 - center.x * panelW, panelW - videoW) : 0
  const offsetY = videoH > 0 ? clamp(videoH / 2 - center.y * panelH, panelH - videoH) : 0

  const pickPhase = (p: Phase) => {
    setPhase(p.id)
    if (total > 0) setSeek((prev) => ({ fraction: p.at / total, key: (prev?.key ?? 0) + 1 }))
  }

  const offTarget = diff != null && Math.abs(diff) > 5
  const severityByJoint = useMemo(() => {
    const map = {} as Record<ViewJoint, JointSeverity>
    for (const id of JOINTS) {
      const served = (SERVED as readonly string[]).includes(id)
        ? contact?.joints[id as ContactJoint]
        : undefined
      map[id] = severityOf(served, id, errors)
    }
    return map
  }, [contact, errors])
  const activeSeverity = severityByJoint[joint]
  const issueColor = severityColor(activeSeverity) ?? (offTarget ? OFF : null)
  const highlightColor = issueColor ?? '#2454FF'
  const canOpenIdeal = activeSeverity != null && onOpenShotVsIdeal != null

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
    highlightColor,
    motionPathColor: issueColor ?? '#00BBFF',
    isLooping: false,
    coverScale: 1,
    naturalSizeHint: clipSize,
  }

  return (
    <View style={styles.page} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.stageRow}>
        <BodyPartRail
          selected={joint}
          severityByPart={severityByJoint}
          onSelect={(id) => setJoint(id)}
          testIDPrefix="viewAnglesJoint"
          style={{ height: housingH || undefined }}
        />

        <View style={[styles.stageHousing, { width: housingW }]}>
          <View testID="viewAnglesStage" style={[styles.stage, { width: videoW, height: videoH || videoW }]}>
            {videoW > 0 && poseFrames.length ? (
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
          </View>

          <View style={styles.modeTrack}>
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
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!canOpenIdeal}
        onPress={() => canOpenIdeal && onOpenShotVsIdeal?.(joint)}
        style={styles.jointCard}
        testID="viewAnglesJointCard"
      >
        <View style={styles.jointCardLeft}>
          <View style={styles.jointCardTitleRow}>
            <JointBadge joint={joint} size={24} />
            <Text allowFontScaling={false} style={[styles.jointCardTitle, { fontFamily: theme.mediumFont }]}>
              {t(`analysis.viewAnglesPage.reading.${joint}`)}
            </Text>
          </View>
          <View style={styles.jointCardStats}>
            {reading?.you != null ? (
              <Text
                allowFontScaling={false}
                style={[
                  styles.jointCardDeg,
                  { fontFamily: theme.mediumFont, color: issueColor ?? UI.text },
                ]}
              >
                {`${Math.round(reading.you)}°`}
              </Text>
            ) : (
              <Text allowFontScaling={false} style={[styles.jointCardDeg, { fontFamily: theme.mediumFont }]}>
                —
              </Text>
            )}
            <View style={styles.jointCardMetaCol}>
              {target != null ? (
                <Text allowFontScaling={false} style={[styles.jointCardMeta, { fontFamily: theme.regularFont }]}>
                  {t('analysis.viewAnglesPage.target')}
                  <Text style={{ color: GOOD }}>{`${Math.round(target)}°`}</Text>
                </Text>
              ) : null}
              {diff != null ? (
                <Text allowFontScaling={false} style={[styles.jointCardMeta, { fontFamily: theme.regularFont }]}>
                  {t('analysis.viewAnglesPage.difference')}
                  <Text style={{ color: issueColor ?? (offTarget ? OFF : GOOD) }}>{signed(diff)}</Text>
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.jointCardRight}>
          {activeSeverity ? (
            <View
              style={[
                styles.sevPill,
                {
                  borderColor: issueColor ?? HIGH,
                  backgroundColor: activeSeverity === 'high' ? 'rgba(255,0,0,0.2)' : 'rgba(255,128,0,0.2)',
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                style={[
                  styles.sevPillLabel,
                  { color: issueColor ?? HIGH, fontFamily: theme.mediumFont },
                ]}
              >
                {activeSeverity === 'high'
                  ? t('analysis.mistakeHighPriority')
                  : t('analysis.mistakeMediumPriority')}
              </Text>
            </View>
          ) : null}
          {canOpenIdeal ? <Ionicons name="chevron-forward" size={18} color="#86A7D2" /> : null}
        </View>
      </Pressable>

      {phases.length ? (
        <View style={styles.timelineCard}>
          <Text allowFontScaling={false} style={[styles.timelineTitle, { fontFamily: theme.regularFont }]}>
            {t('analysis.viewAnglesPage.timeline')}
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
  const labelEl = (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      style={[
        styles.modeText,
        { fontFamily: on ? theme.semiBoldFont : theme.mediumFont },
        on && styles.modeTextOn,
      ]}
    >
      {label}
    </Text>
  )
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={styles.modeBtn}
    >
      {on ? (
        <LinearGradient
          colors={['#A9D8FF', '#4DA6FF']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.modeBtnFill}
        >
          {labelEl}
        </LinearGradient>
      ) : (
        <View style={styles.modeBtnFill}>{labelEl}</View>
      )}
    </Pressable>
  )
}

const STAGE_BORDER = '#0066FF'
const HOUSING_BG = '#041641'

const styles = StyleSheet.create({
  page: { alignSelf: 'stretch', gap: 12 },
  stageRow: { flexDirection: 'row', gap: GAP, alignItems: 'flex-start' },
  jointBadge: {
    backgroundColor: 'rgba(0, 72, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Figma Frame 1107 — contains video + Motion Path / Angles.
  stageHousing: {
    backgroundColor: HOUSING_BG,
    borderRadius: 25,
    padding: 10,
    gap: 10,
    justifyContent: 'center',
  },
  stage: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: STAGE_BORDER,
    overflow: 'hidden',
    backgroundColor: HOUSING_BG,
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
  modeTrack: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    height: 36,
    borderRadius: 999,
    backgroundColor: HOUSING_BG,
    borderWidth: 1,
    borderColor: 'rgba(0, 72, 255, 0.5)',
    padding: 2,
    overflow: 'hidden',
    boxShadow: 'inset 0px 0px 30px 0px rgba(0, 72, 255, 0.5)',
  },
  modeBtn: {
    flex: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  modeBtnFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  modeText: { color: '#86A7D2', fontSize: 11, flexShrink: 1 },
  modeTextOn: { color: '#07256D' },
  jointCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
    borderRadius: 20,
    backgroundColor: '#030A17',
    paddingLeft: 20,
    paddingRight: 10,
    paddingVertical: 10,
    boxShadow: 'inset 0px 0px 30px 0px rgba(0, 72, 255, 0.5)',
  },
  jointCardLeft: { flex: 1, gap: 5, minWidth: 0 },
  jointCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  jointCardTitle: { color: UI.text, fontSize: 16 },
  jointCardStats: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  jointCardDeg: { color: UI.text, fontSize: 32, lineHeight: 32 },
  jointCardMetaCol: { gap: 2, flex: 1 },
  jointCardMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 11, lineHeight: 13 },
  jointCardRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sevPill: {
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sevPillLabel: { fontSize: 13 },
  timelineCard: {
    borderRadius: 20,
    backgroundColor: '#030A17',
    paddingHorizontal: 12,
    paddingTop: 7,
    paddingBottom: 10,
    gap: 5,
    boxShadow: 'inset 0px 0px 30px 0px rgba(0, 72, 255, 0.5)',
  },
  timelineTitle: { color: UI.text, fontSize: 17, paddingHorizontal: 2 },
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
