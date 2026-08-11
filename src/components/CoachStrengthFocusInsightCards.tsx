import React, { useContext, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { ThemeContext } from '../context'
import type { CoachInsightCardsContent } from '../lib/coachInsightCards'
import { useTranslation } from 'react-i18next'
import { CoachRichText } from './CoachRichText'

export type CoachStrengthFocusInsightCardsProps = {
  content: CoachInsightCardsContent
}

const STRENGTH_CARD_BG = '#18259A'
const FOCUS_CARD_BG = '#174A97'

export function CoachStrengthFocusInsightCards({ content }: CoachStrengthFocusInsightCardsProps) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])

  const hasStrength =
    (content.strengthTitle && content.strengthTitle !== '—') ||
    (content.strengthBody && content.strengthBody !== '—')
  const hasFocus =
    (content.focusTitle && content.focusTitle !== '—') ||
    (content.focusBody && content.focusBody !== '—')

  if (!hasStrength && !hasFocus) return null

  return (
    <View style={styles.stack}>
      {hasStrength ? (
        <View style={[styles.card, styles.strengthCard]}>
          <View style={styles.titleRow}>
            <View style={[styles.iconChip, styles.strengthIconChip]}>
              <Feather name="award" size={14} color="#FFFFFF" />
            </View>
            <View style={styles.titleTextCol}>
              <Text allowFontScaling={false} style={styles.title}>
                {t('coachCards.strength')}
              </Text>
              {content.strengthTitle && content.strengthTitle !== '—' ? (
                <Text allowFontScaling={false} style={styles.headline} numberOfLines={2}>
                  {content.strengthTitle}
                </Text>
              ) : null}
            </View>
          </View>
          {content.strengthBody && content.strengthBody !== '—' ? (
            <View style={styles.bodyWrap}>
              <CoachRichText
                text={content.strengthBody}
                style={styles.body}
                containerStyle={styles.bodyContainer}
                numberOfLines={5}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {hasFocus ? (
        <View style={[styles.card, styles.focusCard]}>
          <View style={styles.titleRow}>
            <View style={styles.iconChip}>
              <Feather name="crosshair" size={14} color="#FFFFFF" />
            </View>
            <View style={styles.titleTextCol}>
              <Text allowFontScaling={false} style={styles.title}>
                {t('coachCards.focus')}
              </Text>
              {content.focusTitle && content.focusTitle !== '—' ? (
                <Text allowFontScaling={false} style={styles.headline} numberOfLines={2}>
                  {content.focusTitle}
                </Text>
              ) : null}
            </View>
          </View>
          {content.focusBody && content.focusBody !== '—' ? (
            <View style={styles.bodyWrap}>
              <CoachRichText
                text={content.focusBody}
                style={styles.body}
                containerStyle={styles.bodyContainer}
                numberOfLines={5}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function getStyles(theme: {
  regularFont?: string
  boldFont?: string
  semiBoldFont?: string
}) {
  return StyleSheet.create({
    stack: {
      width: '100%',
      gap: 10,
    },
    card: {
      width: '100%',
      borderRadius: 22,
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    strengthCard: {
      backgroundColor: STRENGTH_CARD_BG,
    },
    focusCard: {
      backgroundColor: FOCUS_CARD_BG,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
    },
    iconChip: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: '#1D6FFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    strengthIconChip: {
      backgroundColor: '#0022FF',
    },
    titleTextCol: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: '#FFFFFF',
    },
    headline: {
      fontFamily: theme.boldFont ?? theme.semiBoldFont,
      fontSize: 18,
      lineHeight: 24,
      color: '#00B8FF',
      marginTop: 6,
    },
    bodyWrap: {
      marginTop: 12,
      marginLeft: 0,
      width: '100%',
      paddingLeft: 48,
    },
    bodyContainer: {
      width: '100%',
      alignSelf: 'stretch',
    },
    body: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      lineHeight: 21,
      color: 'rgba(196, 212, 255, 0.8)',
    },
  })
}
