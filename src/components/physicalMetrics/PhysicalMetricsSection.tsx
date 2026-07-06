import React, { useCallback, useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  PHYSICAL_METRIC_KEYS,
  physicalMetricsRadarValues,
  type PhysicalMetricKey,
  type PhysicalMetricsValues,
} from '../../lib/physicalMetrics'
import { PhysicalMetricsRadarChart } from './PhysicalMetricsRadarChart'
import { PhysicalMetricsBarGrid } from './PhysicalMetricsBarGrid'

export type PhysicalMetricsSectionProps = {
  metrics: PhysicalMetricsValues | null
  /** Match video panel width so radar + bars align with the clip. */
  contentWidth?: number
  accentColor?: string
  trackColor?: string
}

const METRIC_I18N: Record<PhysicalMetricKey, string> = {
  stability: 'technique.physicalMetricStability',
  power: 'technique.physicalMetricPower',
  agility: 'technique.physicalMetricAgility',
  reactions: 'technique.physicalMetricReactions',
  acceleration: 'technique.physicalMetricAcceleration',
}

const DEFAULT_TRACK = 'rgba(255,255,255,0.1)'

export function PhysicalMetricsSection({
  metrics,
  contentWidth,
  accentColor = '#00BBFF',
  trackColor = DEFAULT_TRACK,
}: PhysicalMetricsSectionProps) {
  const { t } = useTranslation()

  const labelForKey = useCallback(
    (key: PhysicalMetricKey) => t(METRIC_I18N[key]),
    [t]
  )

  const radarLabels = useMemo(
    () => PHYSICAL_METRIC_KEYS.map((k) => labelForKey(k)),
    [labelForKey]
  )

  if (!metrics) return null

  const radarWidth =
    contentWidth != null ? Math.max(120, Math.floor(contentWidth)) : undefined

  return (
    <View
      style={[
        styles.container,
        contentWidth != null ? { width: contentWidth, alignSelf: 'center' as const } : null,
      ]}
    >
      <PhysicalMetricsRadarChart
        values={physicalMetricsRadarValues(metrics)}
        labels={radarLabels}
        color={accentColor}
        contentWidth={radarWidth}
        compactBottom
      />
      <View style={styles.barsWrap}>
        <PhysicalMetricsBarGrid
          metrics={metrics}
          labelForKey={labelForKey}
          fillColor={accentColor}
          trackColor={trackColor}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
    paddingTop: 0,
    paddingBottom: 8,
    marginTop: -4,
    gap: 0,
    alignItems: 'stretch',
  },
  barsWrap: {
    width: '100%',
    marginTop: -10,
  },
})
