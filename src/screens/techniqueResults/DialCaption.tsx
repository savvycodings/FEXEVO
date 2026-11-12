import { useContext, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ThemeContext } from '../../context'
import { stripCoachRichMarkers } from '../../lib/coachRichText'
import { type DialCaptionModel, buildDialCaption } from './dialCaptionModel'

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
 * Score-dial copy (Figma 6283:51484): tone title + short body — no ellipsis.
 */
export function DialCaption({
  toneLabel,
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
  if (!toneLabel && !blurb) return null

  return (
    <View style={styles.wrap} testID="dial-caption">
      {toneLabel ? (
        <Text
          allowFontScaling={false}
          style={[styles.tone, { fontFamily: theme.mediumFont ?? theme.regularFont }]}
        >
          {toneLabel}
        </Text>
      ) : null}
      {blurb ? (
        <Text
          allowFontScaling={false}
          style={[styles.blurbText, { fontFamily: theme.mediumFont ?? theme.regularFont }]}
        >
          {blurb}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', minWidth: 0, gap: 5, paddingVertical: 10 },
  /** Figma: Inter Medium 16 / white */
  tone: { color: '#FFFFFF', fontSize: 16, lineHeight: 20 },
  /** Figma: Inter Medium 11 / rgba(255,255,255,0.75) — wraps fully, never ellipsized */
  blurbText: {
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(255,255,255,0.75)',
  },
})
