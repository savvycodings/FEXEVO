import React, { useContext, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { CoachRichText } from './CoachRichText'

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

/** Standalone “What is done well” block for placement above the physical metrics graph. */
export function CoachDoneWellSection({ strengths }: { strengths: string[] }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  if (!Array.isArray(strengths) || strengths.length === 0) return null
  return (
    <FlatSection
      title={t('coachAccordions.doneWell')}
      subtitle={t('coachAccordions.strengthsCount', { count: strengths.length })}
      icon="eye"
      styles={styles}
      isFirst
    >
      <BulletList items={strengths} styles={styles} />
    </FlatSection>
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

  const ratingLabel = data.rating
    ? data.rating.replace(/_/g, ' ').toUpperCase()
    : null

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
        <FlatSection
          title={t('coachAccordions.techniqueRating')}
          subtitle={
            ratingLabel && data.score != null
              ? `${ratingLabel} · ${t('coachAccordions.scoreLine', { score: Math.round(data.score) })}`
              : ratingLabel
          }
          icon="activity"
          styles={styles}
          isFirst={takeFirst()}
        >
          {data.diagnosis?.trim() ? (
            <CoachRichText
              text={data.diagnosis.trim()}
              style={styles.bodyText}
              containerStyle={styles.bodyTextContainer}
              numberOfLines={16}
            />
          ) : null}
        </FlatSection>
      ) : null}

      {showStrengths ? (
        <FlatSection
          title={t('coachAccordions.doneWell')}
          subtitle={t('coachAccordions.strengthsCount', { count: data.strengths.length })}
          icon="eye"
          styles={styles}
          isFirst={takeFirst()}
        >
          <BulletList items={data.strengths} styles={styles} />
        </FlatSection>
      ) : null}

      {data.technicalErrors.length > 0 ? (
        <FlatSection
          title={t('coachAccordions.technicalErrors')}
          subtitle={t('coachAccordions.issuesCount', { count: data.technicalErrors.length })}
          icon="alert-triangle"
          styles={styles}
          isFirst={takeFirst()}
        >
          <BulletList items={data.technicalErrors} styles={styles} />
        </FlatSection>
      ) : null}

      {actionableList.length > 0 ? (
        <FlatSection
          title={t('coachAccordions.actionableCorrections')}
          subtitle={t('coachAccordions.cuesCount', { count: actionableList.length })}
          icon="check-circle"
          styles={styles}
          isFirst={takeFirst()}
        >
          <BulletList items={actionableList} styles={styles} />
        </FlatSection>
      ) : null}

      {showRecommendations ? (
        <FlatSection
          title={t('coachAccordions.recommendations')}
          subtitle={t('coachAccordions.itemsCount', { count: data.recommendations.length })}
          icon="target"
          styles={styles}
          isFirst={takeFirst()}
        >
          <BulletList items={data.recommendations} styles={styles} />
        </FlatSection>
      ) : null}
    </View>
  )
}

function getStyles(theme: { semiBoldFont?: string; regularFont?: string; mediumFont?: string }) {
  return StyleSheet.create({
    stack: {
      width: '100%',
      gap: 4,
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
    // Body flush with section — same left edge as icon (no extra inset).
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
  })
}
