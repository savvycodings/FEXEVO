import { useContext, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../../context'
import { TechniqueAnalysisVideoPanel } from '../../components/TechniqueAnalysisVideoPanel'
import type { PoseFrameRow } from '../../lib/techniquePose'

type JointId = 'head' | 'shoulders' | 'elbows' | 'wrists' | 'hips' | 'knees' | 'ankles'

const LEFT: { id: JointId; landmarks: string[] }[] = [
  { id: 'head', landmarks: ['NOSE'] },
  { id: 'shoulders', landmarks: ['LEFT_SHOULDER', 'RIGHT_SHOULDER'] },
  { id: 'elbows', landmarks: ['LEFT_ELBOW', 'RIGHT_ELBOW'] },
  { id: 'wrists', landmarks: ['LEFT_WRIST', 'RIGHT_WRIST'] },
]

const RIGHT: { id: JointId; landmarks: string[] }[] = [
  { id: 'hips', landmarks: ['LEFT_HIP', 'RIGHT_HIP'] },
  { id: 'knees', landmarks: ['LEFT_KNEE', 'RIGHT_KNEE'] },
  { id: 'ankles', landmarks: ['LEFT_ANKLE', 'RIGHT_ANKLE'] },
]

type Props = {
  videoUri: string
  videoKey: string
  /** Screen width. The clip bleeds through the results padding. */
  width: number
  /** Horizontal padding of the results scroll, cancelled so the clip hits both edges. */
  bleed: number
  poseFrames: PoseFrameRow[]
  totalVidFrames: number
  qualitySession?: { score?: number | null; rating?: string | null } | null
  /** 0–1 time of the marked contact. The clip opens paused there. */
  contactFraction?: number | null
  /** Milliseconds a full-width sideways drag moves. */
  scrubSpanMs?: number
  onScrubbingChange?: (active: boolean) => void
}

const FOCUS_ZOOM = 1.34

/**
 * Looping copy of the pose clip, with body-point buttons on the sides.
 * Selection is local: it only rings landmarks already drawn on this video.
 */
export function SmartFocusJointVideo({
  videoUri,
  videoKey,
  width,
  bleed,
  poseFrames,
  totalVidFrames,
  qualitySession,
  contactFraction = null,
  scrubSpanMs = 2000,
  onScrubbingChange,
}: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const [selected, setSelected] = useState<JointId | null>(null)
  const highlightedLandmarks = useMemo(() => {
    const group = [...LEFT, ...RIGHT].find((item) => item.id === selected)
    return group?.landmarks ?? []
  }, [selected])

  const renderSide = (items: typeof LEFT) =>
    items.map((item) => {
      const on = item.id === selected
      return (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityState={{ selected: on }}
          onPress={() => setSelected((current) => (current === item.id ? null : item.id))}
          style={[styles.point, on && styles.pointOn]}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.pointText, { fontFamily: on ? theme.semiBoldFont : theme.mediumFont }]}
          >
            {t(`technique.smartFocusJoints.${item.id}`)}
          </Text>
        </Pressable>
      )
    })

  return (
    <View style={[styles.stage, { width, marginHorizontal: -bleed }]}>
      <TechniqueAnalysisVideoPanel
        videoUri={videoUri}
        videoKey={`${videoKey}-focus`}
        width={width}
        poseFrames={poseFrames}
        totalVidFrames={totalVidFrames}
        qualitySession={qualitySession}
        showLegend={false}
        showDetailedPoseOverlay
        detailedChrome="none"
        showPlaybackControls={false}
        showJointAngles={false}
        autoPlay={false}
        isLooping={false}
        coverScale={1.2}
        interactiveScrub
        startFraction={contactFraction}
        scrubSpanMs={scrubSpanMs}
        focusScale={selected ? FOCUS_ZOOM : 1}
        onScrubbingChange={onScrubbingChange}
        highlightedLandmarks={highlightedLandmarks}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0)']}
        locations={[0, 0.42, 1]}
        style={styles.topFade}
      />
      <View pointerEvents="box-none" style={styles.sides}>
        <View style={styles.column}>{renderSide(LEFT)}</View>
        <View style={styles.column}>{renderSide(RIGHT)}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stage: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: 20,
    overflow: 'visible',
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 168,
    zIndex: 1,
  },
  sides: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    zIndex: 2,
  },
  column: {
    gap: 8,
    justifyContent: 'center',
  },
  point: {
    backgroundColor: 'rgba(7, 24, 63, 0.82)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  pointOn: {
    backgroundColor: '#2454FF',
    borderColor: '#2454FF',
  },
  pointText: {
    color: '#FFFFFF',
    fontSize: 11,
  },
})
