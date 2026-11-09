import { useContext, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ThemeContext } from '../../context'
import { stripCoachRichMarkers } from '../../lib/coachRichText'
import { type DialCaptionModel, buildDialCaption } from './dialCaption'

type Props = {
  toneLabel: string | null
  toneColor: string
  diagnosis?: string | null
  strengths?: string[] | null
  weaknesses?: string[] | null
  /** Fallback when structured coach fields are empty. */
  summary?: string | null
}

/**
 * Score-dial copy beside the ring: plain description only.
 * Tone / keyword pills are hidden — they made the copy jumpy.
 */
export function DialCaption({
  diagnosis,
  strengths,
  weaknesses,
  summary,
}: Props) {
  const { theme } = useContext(ThemeContext)
  const model = useMemo<DialCaptionModel>(() => {
    const built = buildDialCaption({ diagnosis, strengths, weaknesses })
    if (built.blurb) return built
    return buildDialCaption({ diagnosis: summary })
  }, [diagnosis, strengths, weaknesses, summary])

  const blurb = model.blurb ? stripCoachRichMarkers(model.blurb) : ''
  if (!blurb) return null

  return (
    <View style={styles.wrap} testID="dial-caption">
      <Text
        allowFontScaling={false}
        numberOfLines={4}
        style={[styles.blurbText, { fontFamily: theme.mediumFont ?? theme.regularFont }]}
      >
        {blurb}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', minWidth: 0 },
  blurbText: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(231,242,255,0.92)',
  },
})
