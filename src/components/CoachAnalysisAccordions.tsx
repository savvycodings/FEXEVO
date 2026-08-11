import React, { useContext, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { CoachRichText } from './CoachRichText'
import { LocalSvgAsset } from './LocalSvgAsset'

const THE_GOOD_ICON = require('../../assets/aicoachflow/thegood.svg')
const CYAN = '#00B8FF'
const RATING_CARD_BG = '#0E214F'
const RATING_ICON_BG = '#0022FF'

const ERROR_BORDER = '#FF2D55'
const ERROR_TITLE = '#FF6B81'
const ERROR_SUB = 'rgba(255, 107, 129, 0.78)'
const ERROR_ICON_BG = 'rgba(255, 45, 85, 0.22)'
const ERROR_ACCENT = '#FF2D55'

const CORRECT_BORDER = '#00E5A0'
const CORRECT_TITLE = '#5EEAD4'
const CORRECT_SUB = 'rgba(94, 234, 212, 0.78)'
const CORRECT_ICON_BG = 'rgba(0, 229, 160, 0.18)'
const CORRECT_ACCENT = '#00E5A0'

const THEMED_CARD_BG = 'rgba(6, 10, 20, 0.92)'

export type CoachAnalysisAccordionData = {
  rating: string | null
  score: number | null
  diagnosis: string | null
  shotContext: string | null
  strengths: string[]
  technicalErrors: string[]
  actionableCorrections: string[]
  recommendations: string[]
}

function ratingBadgeColors(rating: string | null): { border: string; text: string } {
  const key = (rating || '').toLowerCase().replace(/\s+/g, '_')
  if (key === 'excellent') return { border: 'rgba(52, 211, 153, 0.85)', text: '#34D399' }
  if (key === 'good') return { border: 'rgba(0, 184, 255, 0.85)', text: CYAN }
  if (key === 'needs_improvement' || key === 'needs improvement') {
    return { border: 'rgba(251, 191, 36, 0.85)', text: '#FBBF24' }
  }
  if (key === 'poor') return { border: 'rgba(255, 45, 85, 0.75)', text: '#FF2D55' }
  return { border: 'rgba(0, 184, 255, 0.85)', text: CYAN }
}

function BulletList({
  items,
  styles,
}: {
  items: string[]
  styles: ReturnType<typeof getStyles>
}) {
  return (
    <View style={styles.bulletList}>
      {items.map((line, idx) => (
        <View key={`${idx}-${line.slice(0, 24)}`} style={styles.bulletRow}>
          <Text allowFontScaling={false} style={styles.bulletDot}>
            •
          </Text>
          <CoachRichText
            text={line}
            style={styles.bulletText}
            containerStyle={styles.bulletTextContainer}
            numberOfLines={12}
          />
        </View>
      ))}
    </View>
  )
}

function FlatSection({
  title,
  subtitle,
  icon,
  children,
  styles,
  isFirst = false,
}: {
  title: string
  subtitle?: string | null
  icon: keyof typeof Feather.glyphMap
  children: React.ReactNode
  styles: ReturnType<typeof getStyles>
  isFirst?: boolean
}) {
  return (
    <View style={[styles.section, isFirst ? styles.sectionFirst : null]}>
      <View style={styles.titleRow}>
        <View style={styles.iconChip}>
          <Feather name={icon} size={14} color="#FFFFFF" />
        </View>
        <View style={styles.titleTextCol}>
          <Text allowFontScaling={false} style={styles.title}>
            {title}
          </Text>
          {subtitle ? (
            <Text allowFontScaling={false} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

function ThemedCoachCard({
  title,
  subtitle,
  icon,
  iconFamily = 'feather',
  borderColor,
  titleColor,
  subtitleColor,
  iconBg,
  iconColor,
  accentColor,
  items,
  styles,
}: {
  title: string
  subtitle: string
  icon: string
  iconFamily?: 'feather' | 'ionicons'
  borderColor: string
  titleColor: string
  subtitleColor: string
  iconBg: string
  iconColor: string
  accentColor: string
  items: string[]
  styles: ReturnType<typeof getStyles>
}) {
  return (
    <View style={[styles.themedCard, { borderColor }]}>
      <View style={styles.themedHeader}>
        <View style={[styles.themedIconChip, { backgroundColor: iconBg }]}>
          {iconFamily === 'ionicons' ? (
            <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={iconColor} />
          ) : (
            <Feather name={icon as keyof typeof Feather.glyphMap} size={16} color={iconColor} />
          )}
        </View>
        <View style={styles.themedTitleCol}>
          <Text allowFontScaling={false} style={[styles.themedTitle, { color: titleColor }]}>
            {title}
          </Text>
          <Text allowFontScaling={false} style={[styles.themedSubtitle, { color: subtitleColor }]}>
            {subtitle}
          </Text>
        </View>
      </View>
      <View style={styles.themedBody}>
        {items.map((line, idx) => (
          <CoachRichText
            key={`${idx}-${line.slice(0, 24)}`}
            text={line}
            style={styles.themedBodyText}
            containerStyle={styles.themedBodyTextWrap}
            accentColor={accentColor}
            numberOfLines={12}
          />
        ))}
      </View>
    </View>
  )
}

function TechniqueRatingCard({
  rating,
  score,
  diagnosis,
  styles,
}: {
  rating: string | null
  score: number | null
  diagnosis: string | null
  styles: ReturnType<typeof getStyles>
}) {
  const { t } = useTranslation()
  const ratingLabel = rating ? rating.replace(/_/g, ' ').toUpperCase() : null
  const badge = ratingBadgeColors(rating)

  return (
    <View style={styles.ratingCard}>
      <View style={styles.ratingHeader}>
        <View style={styles.ratingIconChip}>
          <Ionicons name="speedometer-outline" size={18} color="#FFFFFF" />
        </View>
        <View style={styles.ratingTitleCol}>
          <Text allowFontScaling={false} style={styles.ratingTitle}>
            {t('coachAccordions.techniqueRating')}
          </Text>
          {ratingLabel || score != null ? (
            <View style={styles.ratingMetaRow}>
              {ratingLabel ? (
                <View style={[styles.ratingBadge, { borderColor: badge.border }]}>
                  <Text allowFontScaling={false} style={[styles.ratingBadgeText, { color: badge.text }]}>
                    {ratingLabel}
                  </Text>
                </View>
              ) : null}
              {score != null ? (
                <View style={[styles.ratingBadge, { borderColor: 'rgba(0, 184, 255, 0.85)' }]}>
                  <Text allowFontScaling={false} style={[styles.ratingBadgeText, { color: CYAN }]}>
                    {t('coachAccordions.scoreLine', { score: Math.round(score) })}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
      {diagnosis?.trim() ? (
        <CoachRichText
          text={diagnosis.trim()}
          style={styles.ratingBody}
          containerStyle={styles.ratingBodyContainer}
          accentColor={CYAN}
          numberOfLines={16}
        />
      ) : null}
    </View>
  )
}

/** “The Good” card — strengths with cyan icon + body on solid mobility card blue. */
export function CoachDoneWellSection({ strengths }: { strengths: string[] }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  if (!Array.isArray(strengths) || strengths.length === 0) return null
  return (
    <View style={styles.theGoodCard}>
      <View style={styles.theGoodHeader}>
        <LocalSvgAsset
          assetModule={THE_GOOD_ICON}
          width={28}
          height={28}
          strokeColor={CYAN}
        />
        <Text allowFontScaling={false} style={styles.theGoodTitle}>
          {t('coachAccordions.doneWell')}
        </Text>
      </View>
      <View style={styles.theGoodBody}>
        {strengths.map((line, idx) => (
          <CoachRichText
            key={`${idx}-${line.slice(0, 24)}`}
            text={line}
            style={styles.theGoodText}
            containerStyle={styles.theGoodTextWrap}
            numberOfLines={12}
          />
        ))}
      </View>
    </View>
  )
}

/**
 * Flat coach feedback sections (no bordered / collapsible cards).
 * Export name kept for existing call sites.
 */
export function CoachAnalysisAccordions({
  data,
  omitStrengths = false,
}: {
  data: CoachAnalysisAccordionData
  /** Kept for call-site compatibility; sections are always expanded. */
  defaultExpanded?: boolean
  /** When strengths are rendered earlier on the screen, skip the duplicate section. */
  omitStrengths?: boolean
}) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])

  const actionableList = useMemo(() => {
    if (data.actionableCorrections.length > 0) return data.actionableCorrections
    return data.recommendations
  }, [data.actionableCorrections, data.recommendations])

  const showRecommendations =
    data.recommendations.length > 0 && data.actionableCorrections.length > 0

  const showStrengths = !omitStrengths && data.strengths.length > 0

  const hasRating =
    (data.diagnosis && data.diagnosis.trim().length > 0) ||
    data.score != null ||
    (data.rating && data.rating.trim().length > 0)

  if (
    !hasRating &&
    !showStrengths &&
    data.technicalErrors.length === 0 &&
    actionableList.length === 0 &&
    !showRecommendations
  ) {
    return null
  }

  // First visible section skips the top hairline so the stack sits flush.
  let firstPending = true
  const takeFirst = () => {
    if (!firstPending) return false
    firstPending = false
    return true
  }

  return (
    <View style={styles.stack}>
      {hasRating ? (
        <>
          {void takeFirst()}
          <TechniqueRatingCard
            rating={data.rating}
            score={data.score}
            diagnosis={data.diagnosis}
            styles={styles}
          />
        </>
      ) : null}

      {showStrengths ? (
        <>
          {void takeFirst()}
          <CoachDoneWellSection strengths={data.strengths} />
        </>
      ) : null}

      {data.technicalErrors.length > 0 ? (
        <>
          {void takeFirst()}
          <View style={styles.sectionDividerWrap}>
            <View style={styles.sectionDivider} />
            <ThemedCoachCard
              title={t('coachAccordions.technicalErrors')}
              subtitle={t('coachAccordions.issuesCount', { count: data.technicalErrors.length })}
              icon="alert-triangle"
              borderColor={ERROR_BORDER}
              titleColor={ERROR_TITLE}
              subtitleColor={ERROR_SUB}
              iconBg={ERROR_ICON_BG}
              iconColor={ERROR_ACCENT}
              accentColor={ERROR_ACCENT}
              items={data.technicalErrors}
              styles={styles}
            />
          </View>
        </>
      ) : null}

      {actionableList.length > 0 ? (
        <>
          {void takeFirst()}
          <ThemedCoachCard
            title={t('coachAccordions.actionableCorrections')}
            subtitle={t('coachAccordions.cuesCount', { count: actionableList.length })}
            icon="eye-outline"
            iconFamily="ionicons"
            borderColor={CORRECT_BORDER}
            titleColor={CORRECT_TITLE}
            subtitleColor={CORRECT_SUB}
            iconBg={CORRECT_ICON_BG}
            iconColor={CORRECT_ACCENT}
            accentColor={CORRECT_ACCENT}
            items={actionableList}
            styles={styles}
          />
        </>
      ) : null}

      {showRecommendations ? (
        <>
          {void takeFirst()}
          <View style={styles.sectionDividerWrap}>
            <View style={styles.sectionDivider} />
            <View style={styles.recommendationsCard}>
              <View style={styles.recommendationsHeader}>
                <View style={styles.recommendationsIconChip}>
                  <Ionicons name="bulb-outline" size={18} color="#FFFFFF" />
                </View>
                <View style={styles.recommendationsTitleCol}>
                  <Text allowFontScaling={false} style={styles.recommendationsTitle}>
                    {t('coachAccordions.recommendations')}
                  </Text>
                  <Text allowFontScaling={false} style={styles.recommendationsSubtitle}>
                    {t('coachAccordions.itemsCount', { count: data.recommendations.length })}
                  </Text>
                </View>
              </View>
              <View style={styles.recommendationsBody}>
                {data.recommendations.map((line, idx) => (
                  <CoachRichText
                    key={`${idx}-${line.slice(0, 24)}`}
                    text={line}
                    style={styles.recommendationsBodyText}
                    containerStyle={styles.recommendationsBodyTextWrap}
                    numberOfLines={12}
                  />
                ))}
              </View>
            </View>
          </View>
        </>
      ) : null}
    </View>
  )
}

function getStyles(theme: { semiBoldFont?: string; regularFont?: string; mediumFont?: string }) {
  return StyleSheet.create({
    stack: {
      width: '100%',
      gap: 12,
    },
    ratingCard: {
      width: '100%',
      borderRadius: 22,
      backgroundColor: RATING_CARD_BG,
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 14,
    },
    ratingHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    ratingIconChip: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: RATING_ICON_BG,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    ratingTitleCol: {
      flex: 1,
      minWidth: 0,
      gap: 8,
    },
    ratingTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 18,
      color: '#FFFFFF',
    },
    ratingMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    ratingBadge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: 'transparent',
    },
    ratingBadgeText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 0.4,
    },
    ratingBody: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: '#FFFFFF',
      lineHeight: 22,
    },
    ratingBodyContainer: {
      width: '100%',
      alignSelf: 'stretch',
    },
    themedCard: {
      width: '100%',
      borderRadius: 22,
      borderWidth: 1.5,
      backgroundColor: THEMED_CARD_BG,
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 14,
    },
    themedHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    themedIconChip: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    themedTitleCol: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    themedTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 18,
    },
    themedSubtitle: {
      fontFamily: theme.regularFont,
      fontSize: 13,
    },
    themedBody: {
      width: '100%',
      gap: 12,
    },
    themedBodyText: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: '#FFFFFF',
      lineHeight: 22,
    },
    themedBodyTextWrap: {
      width: '100%',
      alignSelf: 'stretch',
    },
    sectionDividerWrap: {
      width: '100%',
    },
    sectionDivider: {
      width: '100%',
      height: 2,
      backgroundColor: 'rgba(0, 34, 255, 0.7)',
      marginBottom: 14,
    },
    recommendationsCard: {
      width: '100%',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: 'rgba(0, 184, 255, 0.45)',
      backgroundColor: RATING_CARD_BG,
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 14,
    },
    recommendationsHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    recommendationsIconChip: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: RATING_ICON_BG,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    recommendationsTitleCol: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    recommendationsTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 18,
      color: '#FFFFFF',
    },
    recommendationsSubtitle: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: 'rgba(160, 185, 220, 0.75)',
    },
    recommendationsBody: {
      width: '100%',
      gap: 12,
    },
    recommendationsBodyText: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: '#FFFFFF',
      lineHeight: 22,
    },
    recommendationsBodyTextWrap: {
      width: '100%',
      alignSelf: 'stretch',
    },
    section: {
      width: '100%',
      paddingTop: 16,
      paddingBottom: 8,
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
    subtitle: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: 'rgba(255,255,255,0.55)',
      marginTop: 2,
    },
    sectionBody: {
      marginTop: 10,
      marginLeft: 0,
      width: '100%',
    },
    bodyText: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: '#FFFFFF',
      lineHeight: 22,
    },
    bodyTextContainer: {
      width: '100%',
      alignSelf: 'stretch',
    },
    bulletList: {
      gap: 12,
      width: '100%',
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      width: '100%',
    },
    bulletDot: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: '#00B8FF',
      lineHeight: 22,
      width: 12,
      textAlign: 'center',
      marginTop: 0,
    },
    bulletText: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: '#FFFFFF',
      lineHeight: 22,
    },
    bulletTextContainer: {
      flex: 1,
      minWidth: 0,
    },
    theGoodCard: {
      width: '100%',
      alignSelf: 'stretch',
      marginTop: 4,
      marginBottom: 4,
      backgroundColor: 'rgba(0, 75, 255, 0.1)',
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 12,
    },
    theGoodHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    theGoodTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 20,
      color: '#FFFFFF',
      flexShrink: 1,
    },
    theGoodBody: {
      width: '100%',
      gap: 12,
    },
    theGoodText: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      lineHeight: 22,
      color: CYAN,
    },
    theGoodTextWrap: {
      width: '100%',
      alignSelf: 'stretch',
    },
  })
}
