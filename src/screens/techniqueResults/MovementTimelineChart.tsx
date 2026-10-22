import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Line, Path } from 'react-native-svg'
import {
  TIMELINE_SAMPLES,
  type TimelineId,
  type TimelineSeries,
  seriesHasPoints,
} from './movementTimeline'

const SERIES_COLOR: Record<TimelineId, string> = {
  shoulder: '#2F80FF',
  elbow: '#FF3B30',
  racket: '#FF9F0A',
  hip: '#C44DFF',
}

const CHART_H = 148
const PAD_L = 28
const PAD_R = 8
const PAD_T = 10
const PAD_B = 8
const Y_MAX = 180

type Props = {
  series: TimelineSeries
  impactIndex: number
  phases: string[]
  font: string
}

function pathFor(values: (number | null)[], width: number): string[] {
  const plotW = Math.max(1, width - PAD_L - PAD_R)
  const plotH = CHART_H - PAD_T - PAD_B
  const paths: string[] = []
  let d = ''
  values.forEach((value, index) => {
    if (value == null) {
      if (d) paths.push(d)
      d = ''
      return
    }
    const x = PAD_L + (plotW * index) / (TIMELINE_SAMPLES - 1)
    const y = PAD_T + plotH * (1 - Math.max(0, Math.min(Y_MAX, value)) / Y_MAX)
    d += d ? ` L ${x} ${y}` : `M ${x} ${y}`
  })
  if (d) paths.push(d)
  return paths
}

export function MovementTimelineChart({ series, impactIndex, phases, font }: Props) {
  const [width, setWidth] = useState(0)
  const ids = (Object.keys(SERIES_COLOR) as TimelineId[]).filter((id) => seriesHasPoints(series[id]))
  const paths = width > 0 ? ids.map((id) => ({ id, d: pathFor(series[id], width) })) : []

  const impactX =
    width > 0 ? PAD_L + ((width - PAD_L - PAD_R) * impactIndex) / (TIMELINE_SAMPLES - 1) : 0

  return (
    <View>
      <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={CHART_H}>
            {[180, 90, 0].map((tick) => {
              const y = PAD_T + (CHART_H - PAD_T - PAD_B) * (1 - tick / Y_MAX)
              return (
                <Line
                  key={tick}
                  x1={PAD_L}
                  x2={width - PAD_R}
                  y1={y}
                  y2={y}
                  stroke="rgba(134,167,210,0.18)"
                  strokeWidth={1}
                />
              )
            })}
            <Line
              x1={impactX}
              x2={impactX}
              y1={PAD_T}
              y2={CHART_H - PAD_B}
              stroke="rgba(255,255,255,0.85)"
              strokeWidth={1.5}
              strokeDasharray="3 4"
            />
            {paths.map((seriesPath) =>
              seriesPath.d.map((d, index) => (
                <Path
                  key={`${seriesPath.id}-${index}`}
                  d={d}
                  stroke={SERIES_COLOR[seriesPath.id]}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))
            )}
          </Svg>
        ) : null}
        <View style={styles.yAxis} pointerEvents="none">
          {['180°', '90°', '0°'].map((label) => (
            <Text key={label} allowFontScaling={false} style={[styles.yLabel, { fontFamily: font }]}>
              {label}
            </Text>
          ))}
        </View>
      </View>
      <View style={styles.phases}>
        {phases.map((phase) => (
          <Text
            key={phase}
            allowFontScaling={false}
            numberOfLines={2}
            style={[styles.phase, { fontFamily: font }]}
          >
            {phase}
          </Text>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  chart: { height: CHART_H, width: '100%' },
  yAxis: {
    position: 'absolute',
    left: 0,
    top: PAD_T - 4,
    bottom: PAD_B - 4,
    width: PAD_L,
    justifyContent: 'space-between',
  },
  yLabel: { color: '#86A7D2', fontSize: 9 },
  phases: { flexDirection: 'row', marginTop: 6, paddingLeft: PAD_L },
  phase: { flex: 1, color: '#86A7D2', fontSize: 10, lineHeight: 13, textAlign: 'center' },
})
