import React, { useContext, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import Feather from '@expo/vector-icons/Feather'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'

const GRADIENT_COLORS = [
  '#006EFF',
  'rgba(0, 110, 255, 0)',
  '#006EFF',
  'rgba(0, 110, 255, 0)',
] as const
const GRADIENT_LOCATIONS = [0, 0.33, 0.66, 1] as const

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

type AccordionProps = {
  title: string
  subtitle: string
  icon: keyof typeof Feather.glyphMap
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}

function AccordionCard({ title, subtitle, icon, open, onToggle, children }: AccordionProps) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])

  return (
    <LinearGradient
      colors={[...GRADIENT_COLORS]}
      locations={[...GRADIENT_LOCATIONS]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientWrap}
    >
      <View style={styles.inner}>
        <TouchableOpacity style={styles.header} activeOpacity={0.8} onPress={onToggle}>
          <View style={styles.headerLeft}>
            <Text allowFontScaling={false} style={styles.title}>
              {title}
            </Text>
            <Text allowFontScaling={false} style={styles.subtitle}>
              {subtitle}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.iconChip}>
              <Feather name={icon} size={14} color="#FFFFFF" />
            </View>
            <Ionicons
              name={open ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.mutedForegroundColor ?? 'rgba(255,255,255,0.55)'}
            />
          </View>
        </TouchableOpacity>
        {open ? <View style={styles.body}>{children}</View> : null}
      </View>
    </LinearGradient>
  )
}

function BulletList({
  items,
  styles,
}: {
  items: string[]
  styles: ReturnType<typeof getStyles>
}) {
  return (
    <>
      {items.map((line, idx) => (
        <View key={`${idx}-${line.slice(0, 24)}`} style={styles.bulletRow}>
          <Text allowFontScaling={false} style={styles.bulletDot}>
            •
          </Text>
          <Text allowFontScaling={false} style={styles.bulletText} numberOfLines={8}>
            {line}
          </Text>
        </View>
      ))}
    </>
  )
}

export function CoachAnalysisAccordions({
  data,
  defaultExpanded = true,
}: {
  data: CoachAnalysisAccordionData
  /** Activities: show full feedback expanded by default. */
  defaultExpanded?: boolean
}) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const [ratingOpen, setRatingOpen] = useState(defaultExpanded)
  const [strengthsOpen, setStrengthsOpen] = useState(defaultExpanded)
  const [errorsOpen, setErrorsOpen] = useState(defaultExpanded)
  const [actionableOpen, setActionableOpen] = useState(defaultExpanded)
  const [recommendationsOpen, setRecommendationsOpen] = useState(defaultExpanded)

  const actionableList = useMemo(() => {
    if (data.actionableCorrections.length > 0) return data.actionableCorrections
    return data.recommendations
  }, [data.actionableCorrections, data.recommendations])

  const showRecommendationsAccordion =
    data.recommendations.length > 0 && data.actionableCorrections.length > 0

  const hasRating =
    (data.diagnosis && data.diagnosis.trim().length > 0) ||
    (data.shotContext && data.shotContext.trim().length > 0) ||
    data.score != null ||
    (data.rating && data.rating.trim().length > 0)

  if (
    !hasRating &&
    data.strengths.length === 0 &&
    data.technicalErrors.length === 0 &&
    actionableList.length === 0 &&
    !showRecommendationsAccordion
  ) {
    return null
  }

  const ratingLabel = data.rating
    ? data.rating.replace(/_/g, ' ').toUpperCase()
    : '—'

  return (
    <View style={{ gap: 12 }}>
      {hasRating ? (
        <AccordionCard
          title={t('coachAccordions.techniqueRating')}
          subtitle={ratingLabel}
          icon="activity"
          open={ratingOpen}
          onToggle={() => setRatingOpen((v) => !v)}
        >
          {data.score != null ? (
            <Text allowFontScaling={false} style={styles.scoreLine}>
              {t('coachAccordions.scoreLine', { score: Math.round(data.score) })}
            </Text>
          ) : null}
          {data.diagnosis?.trim() ? (
            <Text allowFontScaling={false} style={styles.bodyText} numberOfLines={16}>
              {data.diagnosis.trim()}
            </Text>
          ) : null}
          {data.shotContext?.trim() ? (
            <>
              <Text allowFontScaling={false} style={styles.bodySectionLabel}>
                {t('coachAccordions.techniqueAnalysis')}
              </Text>
              <Text allowFontScaling={false} style={styles.bodyText} numberOfLines={12}>
                {data.shotContext.trim()}
              </Text>
            </>
          ) : null}
        </AccordionCard>
      ) : null}

      {data.strengths.length > 0 ? (
        <AccordionCard
          title={t('coachAccordions.doneWell')}
          subtitle={t('coachAccordions.strengthsCount', { count: data.strengths.length })}
          icon="eye"
          open={strengthsOpen}
          onToggle={() => setStrengthsOpen((v) => !v)}
        >
          <BulletList items={data.strengths} styles={styles} />
        </AccordionCard>
      ) : null}

      {data.technicalErrors.length > 0 ? (
        <AccordionCard
          title={t('coachAccordions.technicalErrors')}
          subtitle={t('coachAccordions.issuesCount', { count: data.technicalErrors.length })}
          icon="alert-triangle"
          open={errorsOpen}
          onToggle={() => setErrorsOpen((v) => !v)}
        >
          <BulletList items={data.technicalErrors} styles={styles} />
        </AccordionCard>
      ) : null}

      {actionableList.length > 0 ? (
        <AccordionCard
          title={t('coachAccordions.actionableCorrections')}
          subtitle={t('coachAccordions.cuesCount', { count: actionableList.length })}
          icon="check-circle"
          open={actionableOpen}
          onToggle={() => setActionableOpen((v) => !v)}
        >
          <BulletList items={actionableList} styles={styles} />
        </AccordionCard>
      ) : null}

      {showRecommendationsAccordion ? (
        <AccordionCard
          title={t('coachAccordions.recommendations')}
          subtitle={t('coachAccordions.itemsCount', { count: data.recommendations.length })}
          icon="target"
          open={recommendationsOpen}
          onToggle={() => setRecommendationsOpen((v) => !v)}
        >
          <BulletList items={data.recommendations} styles={styles} />
        </AccordionCard>
      ) : null}
    </View>
  )
}

function getStyles(theme: { semiBoldFont?: string; regularFont?: string; mediumFont?: string }) {
  return StyleSheet.create({
    gradientWrap: {
      borderRadius: 14,
      padding: 1.5,
    },
    inner: {
      borderRadius: 12,
      backgroundColor: '#001435',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerLeft: { flex: 1, minWidth: 0 },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: '#FFFFFF',
    },
    subtitle: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: 'rgba(255,255,255,0.55)',
      marginTop: 2,
    },
    iconChip: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(0, 110, 255, 0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      marginTop: 12,
      paddingTop: 4,
    },
    scoreLine: {
      fontFamily: theme.mediumFont,
      fontSize: 14,
      color: '#00B8FF',
      marginBottom: 4,
    },
    bodyText: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: 'rgba(255,255,255,0.92)',
      lineHeight: 21,
      marginTop: 8,
    },
    bodySectionLabel: {
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: '#00B8FF',
      marginTop: 12,
      marginBottom: 4,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 8,
    },
    bulletDot: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: '#00B8FF',
      lineHeight: 21,
    },
    bulletText: {
      flex: 1,
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: 'rgba(255,255,255,0.92)',
      lineHeight: 21,
    },
  })
}
