import { useContext } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { ThemeContext } from '../context'
import { SegmentedPills } from '../screens/progress/SegmentedPills'

/** Which results section is on screen. Local UI state only — not a route. */
export type ResultSectionId = 'smartFocus' | 'shotInfo' | 'metrics' | 'viewAngles'

type Tab<T extends string> = { id: T; label: string; testID?: string }

type PillProps<T extends string> = {
  tabs: Tab<T>[]
  value: T
  onChange: (id: T) => void
  trackStyle?: StyleProp<ViewStyle>
}

/**
 * Segmented control for the analysis screens. Renders the shared `SegmentedPills`
 * (same look as Activities / Progress) so every tab row in the app matches.
 */
export function ResultSectionPill<T extends string>({ tabs, value, onChange, trackStyle }: PillProps<T>) {
  const { theme } = useContext(ThemeContext)
  return (
    <SegmentedPills
      options={tabs.map((tab) => ({ key: tab.id, label: tab.label, testID: tab.testID }))}
      value={value}
      onChange={onChange}
      size={tabs.length > 3 ? 'md' : 'lg'}
      fontFamily={theme.mediumFont}
      activeFontFamily={theme.semiBoldFont}
      style={[styles.track, trackStyle]}
    />
  )
}

const styles = StyleSheet.create({
  track: { marginBottom: 18 },
})
