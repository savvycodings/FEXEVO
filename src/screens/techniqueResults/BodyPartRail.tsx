import { useContext } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../../context'
import { LocalSvgAsset } from '../../components/LocalSvgAsset'
import { type BodyPartId } from './jointIcons'

export type { BodyPartId }
export type RailSeverity = 'high' | 'medium' | null

export const BODY_PART_ORDER: BodyPartId[] = [
  'head',
  'shoulder',
  'elbow',
  'wrist',
  'torso',
  'knee',
  'feet',
  'racket',
]

/** Figma 6190:102499 / 6266:55786 — 90px rail. */
export const BODY_RAIL_W = 90
export const BODY_RAIL_GAP = 5

const ICON: Record<BodyPartId, number> = {
  head: require('../../../assets/aicoach/analysis/body-rail/head.svg'),
  shoulder: require('../../../assets/aicoach/analysis/body-rail/shoulder.svg'),
  elbow: require('../../../assets/aicoach/analysis/body-rail/elbow.svg'),
  wrist: require('../../../assets/aicoach/analysis/body-rail/wrist.svg'),
  torso: require('../../../assets/aicoach/analysis/body-rail/torso.svg'),
  knee: require('../../../assets/aicoach/analysis/body-rail/knee.svg'),
  feet: require('../../../assets/aicoach/analysis/body-rail/feet.svg'),
  racket: require('../../../assets/aicoach/analysis/body-rail/racket.svg'),
}

type Props = {
  selected: BodyPartId | null
  severityByPart: Partial<Record<BodyPartId, RailSeverity>>
  onSelect: (id: BodyPartId) => void
  /** Prefix for testIDs, e.g. `smart3d-part` → `smart3d-part-elbow`. */
  testIDPrefix?: string
  style?: StyleProp<ViewStyle>
}

/**
 * Left body-part rail (Figma View Angles + Full Body Analysis).
 * Equal-height pills, custom joint SVGs, high/medium/selected red|orange|blue chrome.
 */
export function BodyPartRail({
  selected,
  severityByPart,
  onSelect,
  testIDPrefix = 'body-part',
  style,
}: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)

  return (
    <View style={[styles.rail, style]}>
      {BODY_PART_ORDER.map((id) => {
        const on = selected === id
        const sev = severityByPart[id] ?? null
        return (
          <Pressable
            key={id}
            testID={`${testIDPrefix}-${id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(id)}
            style={[styles.pill, pillStyle(on, sev)]}
          >
            <LocalSvgAsset assetModule={ICON[id]} width={24} height={24} />
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.label, { fontFamily: theme.mediumFont }]}
            >
              {t(`analysis.viewAnglesPage.joints.${id}`)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Standalone 24×24 Figma joint glyph (detail cards, badges). */
export function BodyPartIcon({ id, size = 24 }: { id: BodyPartId; size?: number }) {
  return <LocalSvgAsset assetModule={ICON[id]} width={size} height={size} />
}

function pillStyle(on: boolean, sev: RailSeverity): ViewStyle {
  if (on && sev === 'high') {
    return {
      borderColor: '#FFFFFF',
      backgroundColor: 'rgba(255, 0, 0, 0.2)',
      boxShadow: '0px 0px 10px 0px #FF0004, inset 0px 0px 20px 0px #FF0004',
    }
  }
  if (on && sev === 'medium') {
    return {
      borderColor: '#FFFFFF',
      backgroundColor: 'rgba(255, 128, 0, 0.2)',
      boxShadow: '0px 0px 10px 0px #FF8000, inset 0px 0px 20px 0px #FF8000',
    }
  }
  if (on) {
    return {
      borderColor: '#FFFFFF',
      backgroundColor: 'rgba(0, 72, 255, 0.35)',
      boxShadow: '0px 0px 10px 0px #00B8FF, inset 0px 0px 20px 0px #0048FF',
    }
  }
  if (sev === 'high') {
    return {
      borderColor: 'rgba(255, 0, 4, 0.5)',
      backgroundColor: 'rgba(255, 0, 4, 0.2)',
      boxShadow: undefined,
    }
  }
  if (sev === 'medium') {
    return {
      borderColor: 'rgba(255, 128, 0, 0.5)',
      backgroundColor: 'rgba(255, 128, 0, 0.2)',
      boxShadow: undefined,
    }
  }
  return {
    borderColor: 'rgba(0, 72, 255, 0.5)',
    backgroundColor: '#041641',
    boxShadow: 'inset 0px 0px 30px 0px rgba(0, 72, 255, 0.5)',
  }
}

const styles = StyleSheet.create({
  rail: {
    width: BODY_RAIL_W,
    flexGrow: 0,
    flexShrink: 0,
    gap: BODY_RAIL_GAP,
    alignSelf: 'stretch',
  },
  pill: {
    flex: 1,
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  label: { color: '#FFFFFF', fontSize: 9, flexShrink: 1 },
})
