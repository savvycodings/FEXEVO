import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { ResultSectionPill, type ResultSectionId } from '../../components/ResultSectionPill'
import { MetricsPage } from './MetricsPage'
import { ProReferencePage } from './ProReferencePage'
import { ShotInfoPage } from './ShotInfoPage'
import { SmartFocusPage } from './SmartFocusPage'

type Tab = { id: ResultSectionId; label: string }

type Props = {
  section: ResultSectionId
  onSectionChange: (id: ResultSectionId) => void
  tabs: Tab[]
  /** Current score view. Owned by the technique screen so analysis state stays put. */
  smartFocus: ReactNode
}

/**
 * Results pill and its four pages. Pages stay mounted and only change visibility,
 * so switching tabs does not reload the analysis.
 */
export function TechniqueResults({ section, onSectionChange, tabs, smartFocus }: Props) {
  return (
    <View style={styles.wrap}>
      <ResultSectionPill tabs={tabs} value={section} onChange={onSectionChange} />
      <SmartFocusPage visible={section === 'smartFocus'}>{smartFocus}</SmartFocusPage>
      <ShotInfoPage visible={section === 'shotInfo'} />
      <MetricsPage visible={section === 'metrics'} />
      <ProReferencePage visible={section === 'proReference'} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
})
