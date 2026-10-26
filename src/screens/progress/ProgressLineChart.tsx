import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop, Circle, Rect } from 'react-native-svg'
import { PG } from './progressTheme'

type Props = {
  /** Width available for the chart, including the Y-axis labels. */
  width: number
  height?: number
  series: number[]
  labels: string[]
}

const Y_AXIS_W = 26
const X_AXIS_H = 22
const PAD_T = 6
const POINT_R = 2.5
const GRID_TICKS = [100, 75, 50, 25] as const

/** Minimum horizontal room per X label ("W12" at 11px). */
const MIN_LABEL_SPACING = 30

/** Indices of X labels to show so they don't collide: every k-th week, always including the last. */
function visibleLabelIndices(n: number, plotW: number): Set<number> {
  const maxLabels = Math.max(2, Math.floor(plotW / MIN_LABEL_SPACING) + 1)
  if (n <= maxLabels) return new Set(Array.from({ length: n }, (_, i) => i))
  const step = Math.ceil((n - 1) / (maxLabels - 1))
  const pxPerWeek = plotW / (n - 1)
  const out: number[] = []
  for (let i = 0; i < n; i += step) out.push(i)
  // Swap the last stepped label for the final week when they'd sit too close together.
  if (out[out.length - 1] !== n - 1) {
    if ((n - 1 - out[out.length - 1]) * pxPerWeek < MIN_LABEL_SPACING) out.pop()
    out.push(n - 1)
  }
  return new Set(out)
}

export function ProgressLineChart({ width, height = 150, series, labels }: Props) {
  const svgW = Math.max(64, width - Y_AXIS_W)
  const plotH = height - X_AXIS_H - PAD_T
  const bottomY = PAD_T + plotH
  const n = series.length
  // Inset points so the first/last glow isn't clipped by the plot frame.
  const insetX = 6
  const innerW = svgW - insetX * 2

  const yFor = (v: number) => PAD_T + (1 - Math.max(0, Math.min(100, v)) / 100) * plotH

  const xFor = (i: number) => (n === 1 ? svgW / 2 : insetX + (i / (n - 1)) * innerW)
  const pts = series.map((v, i) => ({ x: xFor(i), y: yFor(v) }))

  const linePath = n < 2 ? '' : pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  const areaPath = linePath
    ? `${linePath} L ${pts[pts.length - 1].x.toFixed(2)} ${bottomY.toFixed(2)} L ${pts[0].x.toFixed(2)} ${bottomY.toFixed(2)} Z`
    : ''

  const shown = useMemo(() => visibleLabelIndices(labels.length, innerW), [labels.length, innerW])

  return (
    <View style={{ width, height }}>
      <View style={styles.row}>
        <View style={[styles.yAxis, { height: PAD_T + plotH }]}>
          {GRID_TICKS.map((tick) => (
            <Text
              key={tick}
              allowFontScaling={false}
              style={[styles.yTick, { top: yFor(tick) - 7 }]}
            >
              {tick}
            </Text>
          ))}
        </View>
        <Svg width={svgW} height={PAD_T + plotH + 1}>
          <Defs>
            <LinearGradient id="progressAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#1F5BFF" stopOpacity="0.55" />
              <Stop offset="1" stopColor="#1F5BFF" stopOpacity="0.05" />
            </LinearGradient>
          </Defs>
          <Rect
            x={0.5}
            y={PAD_T + 0.5}
            width={svgW - 1}
            height={plotH}
            fill="none"
            stroke={PG.chartGrid}
            strokeWidth={1}
          />
          {GRID_TICKS.map((tick) => (
            <Path
              key={`grid-${tick}`}
              d={`M 0 ${yFor(tick).toFixed(2)} L ${svgW} ${yFor(tick).toFixed(2)}`}
              stroke={PG.chartGrid}
              strokeWidth={1}
            />
          ))}
          {areaPath ? <Path d={areaPath} fill="url(#progressAreaGrad)" /> : null}
          {linePath ? (
            <Path d={linePath} stroke={PG.chartLine} strokeWidth={1.75} fill="none" strokeLinejoin="round" />
          ) : null}
          {pts.map((p, i) => (
            <React.Fragment key={i}>
              <Circle cx={p.x} cy={p.y} r={POINT_R * 2.4} fill="#FFFFFF" opacity={0.18} />
              <Circle cx={p.x} cy={p.y} r={POINT_R} fill="#FFFFFF" />
            </React.Fragment>
          ))}
        </Svg>
      </View>
      <View style={[styles.xAxis, { marginLeft: Y_AXIS_W, width: svgW }]}>
        {labels.map((lb, i) =>
          shown.has(i) ? (
            <Text
              key={`${lb}-${i}`}
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.xTick, { left: xFor(i) - 16 }]}
            >
              {lb}
            </Text>
          ) : null
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  yAxis: { width: Y_AXIS_W, position: 'relative' },
  yTick: {
    position: 'absolute',
    right: 4,
    fontSize: 10,
    color: PG.axis,
    textAlign: 'right',
  },
  xAxis: { height: X_AXIS_H, position: 'relative', marginTop: 4 },
  xTick: {
    position: 'absolute',
    width: 32,
    fontSize: 11,
    color: PG.axis,
    textAlign: 'center',
  },
})
