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

/**
 * Flat Strength / Focus highlights — same section styling as coach feedback text
 * (no filled card boxes), with left icon chips for scanning.
 */
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
        <View style={[styles.section, styles.sectionFirst]}>
          <View style={styles.titleRow}>
            <View style={styles.iconChip}>
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
        <View style={[styles.section, !hasStrength ? styles.sectionFirst : null]}>
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
      gap: 4,
    },
    section: {
      width: '100%',
      paddingTop: 16,
      paddingBottom: 2,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255,255,255,0.1)',
    },
    sectionFirst: {
      borderTopWidth: 0,
      paddingTop: 0,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    iconChip: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(0, 110, 255, 0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleTextCol: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      color: '#FFFFFF',
    },
    headline: {
      fontFamily: theme.boldFont ?? theme.semiBoldFont,
      fontSize: 16,
      lineHeight: 22,
      color: '#00B8FF',
      marginTop: 4,
    },
    bodyWrap: {
      marginTop: 10,
      marginLeft: 0,
      width: '100%',
    },
    bodyContainer: {
      width: '100%',
      alignSelf: 'stretch',
    },
    body: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      lineHeight: 22,
      color: '#FFFFFF',
    },
  })
}
