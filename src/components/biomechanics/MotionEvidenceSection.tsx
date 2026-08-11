import React, { useContext, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../../context'
import {
  pickPrimaryEvidenceRows,
  shouldShowMotionEvidence,
  type BiomechanicsSummary,
  type MotionEvidenceIcon,
  type MotionEvidenceRow,
} from '../../lib/biomechanicsSummary'

export type MotionEvidenceSectionProps = {
  summary: BiomechanicsSummary | null | undefined
}

const CARD_BG = '#0E214F'
const ICON_CHIP_BG = '#0022FF'
const NEUTRAL_BORDER = 'rgba(0, 184, 255, 0.45)'
const ALERT_BORDER = 'rgba(255, 45, 85, 0.75)'
const ALERT_TEXT = '#FF2D55'
const NEUTRAL_ICON = 'rgba(160, 195, 230, 0.9)'
const NEUTRAL_LABEL = 'rgba(180, 200, 230, 0.72)'

const ROW_ICON: Record<MotionEvidenceIcon, keyof typeof Feather.glyphMap> = {
  torso: 'rotate-cw',
  elbow: 'git-commit',
  wrist: 'zap',
  contact: 'radio',
}

/**
 * Overview + Measured motion bubble with metric tiles.
 * Same biomechanics selection as before — presentation only.
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
      bodyLengthsUnit: t('technique.motionEvidenceBodyLengthsUnit'),
      wristMpsEstNote: t('technique.motionEvidenceWristMpsEst'),
    }),
    [t]
  )

  const rows = useMemo(() => pickPrimaryEvidenceRows(summary, labels), [summary, labels])

  if (!shouldShowMotionEvidence(summary) || rows.length === 0) return null

  return (
    <View style={styles.wrap}>
      <View style={styles.divider} />
      <Text allowFontScaling={false} style={styles.overviewTitle}>
        {t('technique.motionEvidenceOverview')}
      </Text>

      <View style={styles.card}>
        <View style={styles.titleRow}>
          <View style={styles.iconChip}>
            <Feather name="activity" size={16} color="#FFFFFF" />
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

        <View style={styles.tiles}>
          {rows.map((row) => (
            <MetricTile key={row.id} row={row} styles={styles} />
          ))}
        </View>
      </View>
    </View>
  )
}

/** Compact metric chip: icon + value, label underneath — no secondary notes. */
function MetricTile({
  row,
  styles,
}: {
  row: MotionEvidenceRow
  styles: ReturnType<typeof getStyles>
}) {
  const alert = row.accent === 'alert'
  const iconName = ROW_ICON[row.icon]
  const iconColor = alert ? ALERT_TEXT : NEUTRAL_ICON
  return (
    <View
      style={[
        styles.tile,
        {
          borderColor: alert ? ALERT_BORDER : NEUTRAL_BORDER,
        },
      ]}
    >
      <View style={styles.tileTopRow}>
        <Feather name={iconName} size={18} color={iconColor} />
        <Text allowFontScaling={false} style={styles.tileValue} numberOfLines={1}>
          {row.value}
        </Text>
      </View>
      <Text
        allowFontScaling={false}
        style={[styles.tileLabel, alert && styles.tileLabelAlert]}
        numberOfLines={2}
      >
        {row.label}
      </Text>
    </View>
  )
}

function getStyles(theme: { semiBoldFont?: string; regularFont?: string; mediumFont?: string }) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
    },
    divider: {
      width: '100%',
      height: 2,
      backgroundColor: 'rgba(0, 34, 255, 0.7)',
      marginBottom: 14,
    },
    overviewTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 20,
      color: '#FFFFFF',
      marginBottom: 12,
    },
    card: {
      width: '100%',
      borderRadius: 22,
      backgroundColor: CARD_BG,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 12,
    },
    iconChip: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: ICON_CHIP_BG,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    titleTextCol: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: 'rgba(210, 220, 240, 0.95)',
    },
    subtitle: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: 'rgba(255,255,255,0.45)',
      marginTop: 3,
      lineHeight: 16,
    },
    tiles: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tile: {
      width: '31.5%',
      flexGrow: 0,
      borderRadius: 12,
      borderWidth: 1,
      backgroundColor: 'rgba(4, 16, 40, 0.55)',
      paddingHorizontal: 10,
      paddingVertical: 10,
      gap: 6,
    },
    tileTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    tileValue: {
      flex: 1,
      minWidth: 0,
      fontFamily: theme.semiBoldFont,
      fontSize: 17,
      color: '#FFFFFF',
      lineHeight: 20,
    },
    tileLabel: {
      fontFamily: theme.regularFont,
      fontSize: 10,
      color: NEUTRAL_LABEL,
      lineHeight: 13,
    },
    tileLabelAlert: {
      color: ALERT_TEXT,
    },
  })
}
