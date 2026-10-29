import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { ResultSectionPill, type ResultSectionId } from '../../components/ResultSectionPill'
import type { PhysicalMetricsValues } from '../../lib/physicalMetrics'
import type { PoseFrameRow } from '../../lib/techniquePose'
import { MetricsPage } from './MetricsPage'
import { ShotInfoPage } from './ShotInfoPage'
import { SmartFocusPage } from './SmartFocusPage'

type Tab = { id: ResultSectionId; label: string }

type Props = {
  section: ResultSectionId
  onSectionChange: (id: ResultSectionId) => void
  tabs: Tab[]
  /** Current score view. Owned by the technique screen so analysis state stays put. */
  smartFocus: ReactNode
  score: number | null
  rating: string | null
  summary: string | null
  shotLabel: string | null
  physicalMetrics: PhysicalMetricsValues | null
  poseFrames: PoseFrameRow[]
  impactFrame: number | null
  onCompare?: () => void
  /** View Angles: per-joint angles on the clip. Replaced the Pro Reference compare. */
  viewAngles?: ReactNode
  /** Smart Focus only: sit the pill on top of the video instead of above it. */
  floatPill?: boolean
}

/**
 * Results pill and its four pages. Pages stay mounted and only change visibility,
 * so switching tabs does not reload the analysis.
 */
export function TechniqueResults({
  section,
  onSectionChange,
  tabs,
  smartFocus,
  score,
  rating,
  summary,
  shotLabel,
  physicalMetrics,
  poseFrames,
  impactFrame,
  onCompare,
  viewAngles,
  floatPill = false,
}: Props) {
  const overlay = floatPill && section === 'smartFocus'
  const pill = (
    <ResultSectionPill
      tabs={tabs}
      value={section}
      onChange={onSectionChange}
      trackStyle={overlay ? styles.pillOnVideo : undefined}
    />
  )
  return (
    <View style={styles.wrap}>
      {overlay ? null : pill}
      <SmartFocusPage visible={section === 'smartFocus'}>{smartFocus}</SmartFocusPage>
      <ShotInfoPage visible={section === 'shotInfo'} />
      <MetricsPage
        visible={section === 'metrics'}
        score={score}
        rating={rating}
        summary={summary}
        shotLabel={shotLabel}
        metrics={physicalMetrics}
        poseFrames={poseFrames}
        impactFrame={impactFrame}
        onCompare={onCompare}
      />
      {section === 'viewAngles' ? viewAngles ?? null : null}
      {overlay ? (
        <View pointerEvents="box-none" style={styles.pillOverlay}>
          {pill}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', overflow: 'visible' },
  pillOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  pillOnVideo: { marginBottom: 0 },
})
