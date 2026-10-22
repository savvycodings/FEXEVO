import { useContext } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ThemeContext } from '../context'

/** Which results section is on screen. Local UI state only — not a route. */
export type ResultSectionId = 'smartFocus' | 'shotInfo' | 'metrics' | 'proReference'

type Tab = { id: ResultSectionId; label: string }

type PillProps = {
  tabs: Tab[]
  value: ResultSectionId
  onChange: (id: ResultSectionId) => void
}

/**
 * Segmented control for the AI Coach results step.
 * It only reports the selected id. Callers keep analysis data in the parent.
 */
export function ResultSectionPill({ tabs, value, onChange }: PillProps) {
  const { theme } = useContext(ThemeContext)
  return (
    <View style={styles.track}>
      {tabs.map((tab) => {
        const selected = tab.id === value
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.id)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.label,
                { fontFamily: selected ? theme.semiBoldFont : theme.mediumFont },
                selected && styles.labelSelected,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#07183F',
    borderRadius: 999,
    padding: 4,
    marginBottom: 18,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 6,
  },
  segmentSelected: {
    backgroundColor: '#2454FF',
  },
  label: {
    color: '#C5D4F5',
    fontSize: 12,
  },
  labelSelected: {
    color: '#FFFFFF',
  },
})
