import React, { useContext, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../../context'
import {
  pickPrimaryEvidenceRows,
  shouldShowMotionEvidence,
  type BiomechanicsSummary,
} from '../../lib/biomechanicsSummary'

export type MotionEvidenceSectionProps = {
  summary: BiomechanicsSummary | null | undefined
}

/**
 * Flat coach-style section: icon title + cyan bullet list of measured motion cues.
 * Matches Done well / Strength / Focus / coach feedback layout — not a metric card grid.
 */
export function MotionEvidenceSection({ summary }: MotionEvidenceSectionProps) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])

  const labels = useMemo(
    () => ({
      torsoRotation: t('technique.motionEvidenceTorsoRotation'),
      elbowImpact: t('technique.motionEvidenceElbowImpact'),
      wristSpeed: t('technique.motionEvidenceWristSpeed'),
      contactWindow: t('technique.motionEvidenceContactWindow'),
    }),
    [t]
  )

  const rows = useMemo(() => pickPrimaryEvidenceRows(summary, labels), [summary, labels])

  if (!shouldShowMotionEvidence(summary) || rows.length === 0) return null

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <View style={styles.iconChip}>
          <Feather name="activity" size={14} color="#FFFFFF" />
        </View>
        <View style={styles.titleTextCol}>
          <Text allowFontScaling={false} style={styles.title}>
            {t('technique.motionEvidenceTitle')}
          </Text>
          <Text allowFontScaling={false} style={styles.subtitle}>
            {t('technique.motionEvidenceCaption')}
          </Text>
        </View>
      </View>

      <View style={styles.sectionBody}>
        <View style={styles.bulletList}>
          {rows.map((row) => (
            <View key={row.id} style={styles.bulletRow}>
              <Text allowFontScaling={false} style={styles.bulletDot}>
                •
              </Text>
              <Text allowFontScaling={false} style={styles.bulletText}>
                {row.text}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

function getStyles(theme: { semiBoldFont?: string; regularFont?: string; mediumFont?: string }) {
  return StyleSheet.create({
    section: {
      width: '100%',
      paddingTop: 0,
      paddingBottom: 8,
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
    },
    bulletText: {
      flex: 1,
      minWidth: 0,
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: '#FFFFFF',
      lineHeight: 22,
    },
  })
}
