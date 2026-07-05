import React, { useContext } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { DualRingGauge } from './DualRingGauge'
import type { CorrectionFrameInsight } from '../types/correction'

const GAUGE_SIZE = 60
const GAUGE_LABEL = '#86A7D2'

const STAT_KEYS = [
  { key: 'stability' as const, labelKey: 'technique.correctionStatStability' },
  { key: 'power_line' as const, labelKey: 'technique.correctionStatPower' },
]

export type CorrectionFrameSelectorProps = {
  frames: CorrectionFrameInsight[]
  activeIndex: number
}

export function CorrectionFrameSelector({ frames, activeIndex }: CorrectionFrameSelectorProps) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const active = frames[activeIndex] ?? frames[0]
  if (!active) return null

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {STAT_KEYS.map(({ key, labelKey }) => (
          <View key={key} style={styles.col}>
            <DualRingGauge
              size={GAUGE_SIZE}
              thisWeek={active.stats[key]}
              lastWeek={0}
              theme={theme}
              single
            />
            <Text allowFontScaling={false} style={[styles.label, { fontFamily: theme.semiBoldFont }]}>
              {t(labelKey)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-evenly',
    width: '100%',
    gap: 12,
  },
  col: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: GAUGE_LABEL,
    marginTop: 6,
    textAlign: 'center',
  },
})
