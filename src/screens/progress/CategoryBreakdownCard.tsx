import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ProLibraryGradientProgressBar } from '../../components'
import { TechniqueIcon, OutcomeIcon, TacticsIcon } from './CategoryIcons'
import { PG, glow } from './progressTheme'

type Props = {
  technique: number | null
  outcome: number | null
  tactics: number | null
  theme: any
}

export function CategoryBreakdownCard({ technique, outcome, tactics, theme }: Props) {
  const { t } = useTranslation()
  const rows = [
    { key: 'technique', labelKey: 'progress.metricTechnique', val: technique, Icon: TechniqueIcon },
    { key: 'outcome', labelKey: 'progress.metricOutcome', val: outcome, Icon: OutcomeIcon },
    { key: 'tactics', labelKey: 'progress.metricTactics', val: tactics, Icon: TacticsIcon },
  ] as const

  return (
    <View style={[styles.card, glow(10, 0.25)]}>
      <Text allowFontScaling={false} style={[styles.heading, { fontFamily: theme.semiBoldFont }]}>
        {t('progress.categoryBreakdown')}
      </Text>
      {rows.map(({ key, labelKey, val, Icon }) => {
        const pct = val != null ? Math.max(0, Math.min(100, Math.round(val))) : 0
        return (
          <View key={key} style={styles.row}>
            <View style={styles.iconSlot}>
              <Icon size={30} />
            </View>
            <View style={styles.mid}>
              <Text allowFontScaling={false} style={[styles.label, { fontFamily: theme.mediumFont }]}>
                {t(labelKey)}
              </Text>
              <ProLibraryGradientProgressBar
                progress={pct}
                fillColor={PG.barFill}
                trackColor={PG.barTrack}
                height={10}
                flat
              />
            </View>
            <View style={styles.scoreCol}>
              <Text allowFontScaling={false} style={[styles.score, { fontFamily: theme.mediumFont }]}>
                {val != null ? String(Math.round(val)) : '—'}
              </Text>
              <Text allowFontScaling={false} style={[styles.outOf, { fontFamily: theme.regularFont }]}>
                {t('progress.outOf100')}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PG.cardPlain,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PG.borderSoft,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    marginBottom: 16,
  },
  heading: {
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 14,
  },
  iconSlot: { width: 34, alignItems: 'center' },
  mid: { flex: 1, minWidth: 0, gap: 10 },
  label: { fontSize: 16, color: PG.text },
  scoreCol: { width: 52, alignItems: 'flex-end' },
  score: { fontSize: 24, color: '#FFFFFF', lineHeight: 28 },
  outOf: { fontSize: 15, color: PG.muted },
})
