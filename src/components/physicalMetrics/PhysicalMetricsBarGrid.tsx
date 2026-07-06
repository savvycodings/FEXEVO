import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { ProLibraryGradientProgressBar } from '../ProLibraryGradientProgressBar'
import {
  PHYSICAL_METRIC_KEYS,
  type PhysicalMetricKey,
  type PhysicalMetricsValues,
} from '../../lib/physicalMetrics'

export type PhysicalMetricsBarGridProps = {
  metrics: PhysicalMetricsValues
  labelForKey: (key: PhysicalMetricKey) => string
  fillColor?: string
  trackColor?: string
}

export function PhysicalMetricsBarGrid({
  metrics,
  labelForKey,
  fillColor = '#00BBFF',
  trackColor = 'rgba(255,255,255,0.1)',
}: PhysicalMetricsBarGridProps) {
  const rows: PhysicalMetricKey[][] = []
  for (let i = 0; i < PHYSICAL_METRIC_KEYS.length; i += 2) {
    rows.push(PHYSICAL_METRIC_KEYS.slice(i, i + 2) as PhysicalMetricKey[])
  }

  return (
    <View style={styles.grid}>
      {rows.map((pair, rowIdx) => (
        <View key={`row-${rowIdx}`} style={styles.row}>
          {pair.map((key) => {
            const value = metrics[key]
            return (
              <View key={key} style={styles.cell}>
                <Text allowFontScaling={false} style={styles.label}>
                  {labelForKey(key)}
                </Text>
                <View style={styles.barRow}>
                  <ProLibraryGradientProgressBar
                    progress={value}
                    fillColor={fillColor}
                    trackColor={trackColor}
                    flat
                    height={7}
                    outerBorderRadius={4}
                    fillBorderRadius={3}
                    style={styles.bar}
                  />
                  <View style={styles.scoreWrap}>
                    <Text allowFontScaling={false} style={styles.scoreNum}>
                      {value}
                    </Text>
                    <Text allowFontScaling={false} style={styles.scoreDenom}>
                      /100
                    </Text>
                  </View>
                </View>
              </View>
            )
          })}
          {pair.length === 1 ? <View style={styles.cellSpacer} /> : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  cell: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  cellSpacer: {
    flex: 1,
  },
  label: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '600',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    width: '100%',
  },
  bar: {
    flex: 1,
    minWidth: 0,
  },
  scoreWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 0,
    minWidth: 40,
    justifyContent: 'flex-end',
  },
  scoreNum: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontWeight: '700',
  },
  scoreDenom: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '500',
  },
})
