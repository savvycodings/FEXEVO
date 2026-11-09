import { useContext, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ThemeContext } from '../../context'
import { stripCoachRichMarkers } from '../../lib/coachRichText'
import { type DialCaptionModel, type DialPearlTone, buildDialCaption } from './dialCaption'

type Props = {
  toneLabel: string | null
  toneColor: string
  diagnosis?: string | null
  strengths?: string[] | null
  weaknesses?: string[] | null
  /** Fallback when structured coach fields are empty. */
  summary?: string | null
}

const PEARL: Record<DialPearlTone, { border: string; text: string; fill: string }> = {
  strength: {
    border: 'rgba(61, 220, 151, 0.9)',
    text: '#6EE08F',
    fill: 'rgba(61, 220, 151, 0.12)',
  },
  weakness: {
    border: 'rgba(255, 106, 106, 0.9)',
    text: '#FF8A80',
    fill: 'rgba(255, 106, 106, 0.12)',
  },
  cue: {
    border: 'rgba(61, 183, 255, 0.9)',
    text: '#7AD4FF',
    fill: 'rgba(0, 184, 255, 0.1)',
  },
}

/**
 * Score-dial copy: short natural language + round keyword pearls
 * (green = strength, coral = wrong/weakness, blue = cue).
 */
export function DialCaption({
  toneLabel,
  toneColor,
  diagnosis,
  strengths,
  weaknesses,
  summary,
}: Props) {
  const { theme } = useContext(ThemeContext)
  const model = useMemo<DialCaptionModel>(() => {
    const built = buildDialCaption({ diagnosis, strengths, weaknesses })
    if (built.blurb || built.pearls.length) return built
    return buildDialCaption({ diagnosis: summary })
  }, [diagnosis, strengths, weaknesses, summary])

  if (!toneLabel && !model.blurb && model.pearls.length === 0) return null

  return (
    <View style={styles.wrap} testID="dial-caption">
      {toneLabel ? (
        <View style={[styles.tonePill, { borderColor: toneColor }]}>
          <Text
            allowFontScaling={false}
            style={[styles.toneText, { color: toneColor, fontFamily: theme.boldFont ?? theme.semiBoldFont }]}
          >
            {toneLabel}
          </Text>
        </View>
      ) : null}

      {model.blurb ? (
        <Text
          allowFontScaling={false}
          numberOfLines={3}
          style={[
            styles.blurbText,
            { fontFamily: theme.mediumFont ?? theme.regularFont },
          ]}
        >
          {stripCoachRichMarkers(model.blurb)}
        </Text>
      ) : null}

      {model.pearls.length ? (
        <View style={styles.pearlRow}>
          {model.pearls.map((pearl) => {
            const c = PEARL[pearl.tone]
            return (
              <View
                key={`${pearl.tone}-${pearl.label}`}
                style={[styles.pearl, { borderColor: c.border, backgroundColor: c.fill }]}
                testID={`dial-pearl-${pearl.tone}`}
              >
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={[styles.pearlText, { color: c.text, fontFamily: theme.boldFont ?? theme.semiBoldFont }]}
                >
                  {pearl.label}
                </Text>
              </View>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 8, justifyContent: 'center', minWidth: 0 },
  tonePill: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  toneText: { fontSize: 14, textAlign: 'center' },
  blurbText: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(231,242,255,0.92)',
  },
  pearlRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pearl: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pearlText: { fontSize: 12, lineHeight: 15, textAlign: 'center' },
})
