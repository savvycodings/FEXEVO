import React, { useContext, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { ThemeContext } from '../context'
import { LocalSvgAsset } from './LocalSvgAsset'
import type { CoachInsightCardsContent } from '../lib/coachInsightCards'
import { useTranslation } from 'react-i18next'

const STRENGTH_CARD_ICON = require('../../assets/afteranylize/strength.svg')
const FOCUS_CARD_ICON = require('../../assets/afteranylize/focus.svg')
const INSIGHT_HEADLINE_COLOR = '#00B8FF'
const INSIGHT_ICON_PX = 42

export type CoachStrengthFocusInsightCardsProps = {
  content: CoachInsightCardsContent
}

export function CoachStrengthFocusInsightCards({ content }: CoachStrengthFocusInsightCardsProps) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])

  return (
    <View style={styles.stack}>
      <View style={[styles.card, styles.cardStrength]}>
        <View style={styles.iconWrap}>
          <LocalSvgAsset assetModule={STRENGTH_CARD_ICON} width={INSIGHT_ICON_PX} height={INSIGHT_ICON_PX} />
        </View>
        <View style={styles.textCol}>
          <Text allowFontScaling={false} style={styles.sectionLabel}>
            {t('coachCards.strength')}
          </Text>
          <Text allowFontScaling={false} style={styles.headline} numberOfLines={2}>
            {content.strengthTitle}
          </Text>
          <Text allowFontScaling={false} style={styles.body} numberOfLines={3}>
            {content.strengthBody}
          </Text>
        </View>
      </View>
      <View style={[styles.card, styles.cardFocus]}>
        <View style={styles.iconWrap}>
          <LocalSvgAsset assetModule={FOCUS_CARD_ICON} width={INSIGHT_ICON_PX} height={INSIGHT_ICON_PX} />
        </View>
        <View style={styles.textCol}>
          <Text allowFontScaling={false} style={styles.sectionLabel}>
            {t('coachCards.focus')}
          </Text>
          <Text allowFontScaling={false} style={styles.headline} numberOfLines={2}>
            {content.focusTitle}
          </Text>
          <Text allowFontScaling={false} style={styles.body} numberOfLines={3}>
            {content.focusBody}
          </Text>
        </View>
      </View>
    </View>
  )
}

function getStyles(theme: { regularFont?: string; boldFont?: string; semiBoldFont?: string; textColor?: string }) {
  return StyleSheet.create({
    stack: {
      width: '100%',
      gap: 10,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      width: '100%',
      borderRadius: 18,
      paddingVertical: 16,
      paddingHorizontal: 16,
      gap: 14,
    },
    cardStrength: {
      backgroundColor: 'rgba(0, 34, 255, 0.5)',
    },
    cardFocus: {
      backgroundColor: 'rgba(0, 110, 255, 0.5)',
    },
    iconWrap: {
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textCol: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    sectionLabel: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: theme.textColor ?? '#FFFFFF',
    },
    headline: {
      fontFamily: theme.boldFont ?? theme.semiBoldFont,
      fontSize: 22,
      lineHeight: 28,
      color: INSIGHT_HEADLINE_COLOR,
    },
    body: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      lineHeight: 18,
      color: '#86A7D2',
    },
  })
}
