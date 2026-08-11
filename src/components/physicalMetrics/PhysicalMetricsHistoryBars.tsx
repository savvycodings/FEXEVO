import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import {
  PHYSICAL_CURRENT_COLOR,
  PHYSICAL_PRIOR_COLOR,
  historyBarsOldestFirst,
  shortHistoryBarLabel,
  type PhysicalHistoryItem,
} from '../../lib/physicalMetrics'

const BAR_MAX_H = 88
const BAR_MIN_H = 10

export type PhysicalMetricsHistoryBarsProps = {
  /** Newest-first from API. */
  historyNewestFirst: PhysicalHistoryItem[]
  selectedAnalysisId: string | null
  onSelect: (analysisId: string) => void
}

export function PhysicalMetricsHistoryBars({
  historyNewestFirst,
  selectedAnalysisId,
  onSelect,
}: PhysicalMetricsHistoryBarsProps) {
  const bars = useMemo(
    () => historyBarsOldestFirst(historyNewestFirst).slice(-10),
    [historyNewestFirst]
  )
  const styles = useMemo(() => getStyles(), [])

  if (bars.length === 0) return null

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {bars.map((item) => {
          const selected = item.analysisId === selectedAnalysisId
          const score =
            typeof item.score === 'number' && Number.isFinite(item.score)
              ? Math.max(0, Math.min(100, Math.round(item.score)))
              : 0
          const h = BAR_MIN_H + (BAR_MAX_H - BAR_MIN_H) * (score / 100)
          const color = selected ? PHYSICAL_CURRENT_COLOR : PHYSICAL_PRIOR_COLOR
          return (
            <TouchableOpacity
              key={item.analysisId}
              style={styles.cell}
              onPress={() => onSelect(item.analysisId)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text
                allowFontScaling={false}
                style={[styles.score, selected && styles.scoreSelected]}
              >
                {score || '—'}
              </Text>
              <View style={[styles.barTrack, { height: BAR_MAX_H }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: Math.max(BAR_MIN_H, h),
                      backgroundColor: color,
                    },
                  ]}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.date, selected && styles.dateSelected]}
                numberOfLines={2}
              >
                {shortHistoryBarLabel(item.createdAt)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

function getStyles() {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      marginTop: 14,
      paddingTop: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      width: '100%',
      gap: 4,
    },
    cell: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
    },
    score: {
      color: 'rgba(255,255,255,0.45)',
      fontSize: 10,
      fontWeight: '600',
      marginBottom: 4,
    },
    scoreSelected: {
      color: PHYSICAL_CURRENT_COLOR,
    },
    barTrack: {
      width: 7,
      maxWidth: 8,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    barFill: {
      width: '100%',
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      borderBottomLeftRadius: 1,
      borderBottomRightRadius: 1,
    },
    date: {
      marginTop: 6,
      color: 'rgba(255,255,255,0.35)',
      fontSize: 9,
      textAlign: 'center',
      lineHeight: 11,
    },
    dateSelected: {
      color: 'rgba(255,255,255,0.75)',
    },
  })
}
