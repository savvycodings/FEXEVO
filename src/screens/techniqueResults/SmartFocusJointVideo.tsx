import { useContext, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
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
  width: number
  poseFrames: PoseFrameRow[]
  totalVidFrames: number
  qualitySession?: { score?: number | null; rating?: string | null } | null
}

/**
 * Looping copy of the pose clip, with body-point buttons on the sides.
 * Selection is local: it only rings landmarks already drawn on this video.
 */
export function SmartFocusJointVideo({
  videoUri,
  videoKey,
  width,
  poseFrames,
  totalVidFrames,
  qualitySession,
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
    <View style={[styles.stage, { width }]}>
      <TechniqueAnalysisVideoPanel
        videoUri={videoUri}
        videoKey={`${videoKey}-focus`}
        width={width}
        poseFrames={poseFrames}
        totalVidFrames={totalVidFrames}
        qualitySession={qualitySession}
        isLooping
        showLegend={false}
        showDetailedPoseOverlay
        detailedChrome="none"
        showPlaybackControls={false}
        showJointAngles={false}
        autoPlay
        highlightedLandmarks={highlightedLandmarks}
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
    marginBottom: 18,
  },
  sides: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
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
