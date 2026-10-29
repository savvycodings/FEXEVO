import { useContext } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { ThemeContext } from '../context'

/** Which results section is on screen. Local UI state only — not a route. */
export type ResultSectionId = 'smartFocus' | 'shotInfo' | 'metrics' | 'viewAngles'

type Tab<T extends string> = { id: T; label: string }

type PillProps<T extends string> = {
  tabs: Tab<T>[]
  value: T
  onChange: (id: T) => void
  trackStyle?: StyleProp<ViewStyle>
}

/**
 * Segmented control for the AI Coach results step.
 * It only reports the selected id. Callers keep analysis data in the parent.
 */
export function ResultSectionPill<T extends string>({ tabs, value, onChange, trackStyle }: PillProps<T>) {
  const { theme } = useContext(ThemeContext)
  return (
    <View style={[styles.track, trackStyle]}>
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
    borderWidth: 1,
    borderColor: 'rgba(46, 120, 220, 0.45)',
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
    backgroundColor: '#1C8FFF',
    shadowColor: '#1C8FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 8,
    elevation: 6,
  },
  label: {
    color: '#C5D4F5',
    fontSize: 12,
  },
  labelSelected: {
    color: '#FFFFFF',
  },
})
