import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  PHYSICAL_METRIC_ABBREV,
  PHYSICAL_METRIC_KEYS,
  pickCurrentAndPrior,
  physicalMetricsRadarValues,
  type PhysicalHistoryItem,
  type PhysicalMetricKey,
  type PhysicalMetricsValues,
} from '../../lib/physicalMetrics'
import { PhysicalMetricsRadarChart } from './PhysicalMetricsRadarChart'
import { PhysicalMetricsDualRings } from './PhysicalMetricsDualRings'
import { PhysicalMetricsHistoryBars } from './PhysicalMetricsHistoryBars'
import { PhysicalMetricsBarGrid } from './PhysicalMetricsBarGrid'

const METRIC_I18N: Record<PhysicalMetricKey, string> = {
  stability: 'technique.physicalMetricStability',
  power: 'technique.physicalMetricPower',
  agility: 'technique.physicalMetricAgility',
  reactions: 'technique.physicalMetricReactions',
  acceleration: 'technique.physicalMetricAcceleration',
}

export type PhysicalMetricsSectionProps = {
  /** Current analysis metrics (fallback when history is empty / missing this id). */
  metrics: PhysicalMetricsValues | null
  /** Newest-first history from GET /technique/physical-history. */
  history?: PhysicalHistoryItem[]
  /** Prefer selecting this analysis id (usually the live Step 3 analysis). */
  currentAnalysisId?: string | null
  contentWidth?: number
  accentColor?: string
  trackColor?: string
  /** When false, keep legacy single radar + bar grid (Activities). Default true on Step 3. */
  compareMode?: boolean
}

/**
 * Dual current/prior physical metrics: radar + rings + last-10 overall score bars.
 * Falls back to single-series radar + bar grid when compareMode is false.
 */
export function PhysicalMetricsSection({
  metrics,
  history = [],
  currentAnalysisId = null,
  contentWidth,
  accentColor = '#00BBFF',
  trackColor = 'rgba(255,255,255,0.1)',
  compareMode = false,
}: PhysicalMetricsSectionProps) {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!compareMode) return
    if (currentAnalysisId && history.some((h) => h.analysisId === currentAnalysisId)) {
      setSelectedId(currentAnalysisId)
      return
    }
    if (history[0]?.analysisId) {
      setSelectedId(history[0].analysisId)
    }
  }, [compareMode, currentAnalysisId, history])

  const labelForKey = useCallback(
    (key: PhysicalMetricKey) => t(METRIC_I18N[key]),
    [t]
  )

  const { current, prior } = useMemo(
    () => pickCurrentAndPrior(history, selectedId),
    [history, selectedId]
  )

  const displayCurrent: PhysicalMetricsValues | null =
    current?.physicalMetrics ?? metrics
  const displayPrior: PhysicalMetricsValues | null = prior?.physicalMetrics ?? null

  const radarLabels = useMemo(() => {
    if (!displayCurrent) return []
    return PHYSICAL_METRIC_KEYS.map((k) => ({
      score: Math.round(displayCurrent[k]),
      abbrev: PHYSICAL_METRIC_ABBREV[k],
    }))
  }, [displayCurrent])

  if (!displayCurrent && !metrics) return null

  const radarWidth =
    contentWidth != null ? Math.max(120, Math.floor(contentWidth)) : undefined

  // Legacy single-series (Activities / no history).
  if (!compareMode) {
    if (!metrics) return null
    return (
      <View
        style={[
          styles.container,
          contentWidth != null ? { width: contentWidth, alignSelf: 'center' as const } : null,
        ]}
      >
        <PhysicalMetricsRadarChart
          values={physicalMetricsRadarValues(metrics)}
          labels={PHYSICAL_METRIC_KEYS.map((k) => labelForKey(k))}
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

  if (!displayCurrent) return null

  return (
    <View
      style={[
        styles.container,
        contentWidth != null ? { width: contentWidth, alignSelf: 'center' as const } : null,
      ]}
    >
      <PhysicalMetricsRadarChart
        values={physicalMetricsRadarValues(displayCurrent)}
        priorValues={
          displayPrior ? physicalMetricsRadarValues(displayPrior) : null
        }
        labels={radarLabels}
        contentWidth={radarWidth}
        compactBottom
      />
      <PhysicalMetricsDualRings
        current={displayCurrent}
        prior={displayPrior}
        labelForKey={labelForKey}
      />
      {history.length > 0 ? (
        <PhysicalMetricsHistoryBars
          historyNewestFirst={history}
          selectedAnalysisId={selectedId}
          onSelect={setSelectedId}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
    paddingTop: 0,
    paddingBottom: 4,
    marginTop: 0,
    gap: 0,
    alignItems: 'stretch',
  },
  barsWrap: {
    width: '100%',
    marginTop: 0,
  },
})
