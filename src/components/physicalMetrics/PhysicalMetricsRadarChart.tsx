import React, { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg'
import {
  radarPolygonPathProgress,
  radarVertex,
} from './physicalMetricsRadarLayout'
import {
  PHYSICAL_CURRENT_COLOR,
  PHYSICAL_PRIOR_COLOR,
} from '../../lib/physicalMetrics'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)
const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedG = Animated.createAnimatedComponent(G)

const GRID = 'rgba(255,255,255,0.12)'
const SCORE_LABEL = PHYSICAL_CURRENT_COLOR
const ABBREV_LABEL = 'rgba(255,255,255,0.55)'
const PRIOR_FILL = 'rgba(0,34,255,0.28)'
const CURRENT_FILL = 'rgba(0,184,255,0.22)'
const LEVELS = 5
const DOT_R = 4.5
const DOT_STROKE = 1.75

const GRID_SPRING = { damping: 15, stiffness: 100, mass: 1 } as const
const AXIS_SPRING = { damping: 15, stiffness: 80, mass: 1 } as const
const AREA_SPRING = { damping: 18, stiffness: 90, mass: 1 } as const

export type PhysicalMetricsRadarLabel =
  | string
  | {
      score: number | string
      abbrev: string
    }

function clamp01(n: number): number {
  'worklet'
  return Math.max(0, Math.min(1, n))
}

function AnimatedGridRing({
  cx,
  cy,
  targetR,
  index,
  progress,
}: {
  cx: number
  cy: number
  targetR: number
  index: number
  progress: SharedValue<number>
}) {
  const animatedProps = useAnimatedProps(() => {
    const local = clamp01(progress.value * LEVELS - index * 0.85)
    return {
      r: targetR * local,
      opacity: local,
    }
  })
  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      fill="none"
      stroke={GRID}
      strokeWidth={1}
      animatedProps={animatedProps}
    />
  )
}

function AnimatedAxisLine({
  cx,
  cy,
  tipX,
  tipY,
  index,
  count,
  progress,
}: {
  cx: number
  cy: number
  tipX: number
  tipY: number
  index: number
  count: number
  progress: SharedValue<number>
}) {
  const animatedProps = useAnimatedProps(() => {
    const local = clamp01(progress.value * count - index * 0.35)
    return {
      x2: cx + (tipX - cx) * local,
      y2: cy + (tipY - cy) * local,
      opacity: local,
    }
  })
  return (
    <AnimatedLine
      x1={cx}
      y1={cy}
      stroke={GRID}
      strokeWidth={1}
      animatedProps={animatedProps}
    />
  )
}

function AnimatedMetricDot({
  value,
  index,
  count,
  radius,
  centerX,
  centerY,
  fill,
  stroke,
  strokeWidth = 0,
  progress,
  size = DOT_R,
}: {
  value: number
  index: number
  count: number
  radius: number
  centerX: number
  centerY: number
  fill: string
  stroke?: string
  strokeWidth?: number
  progress: SharedValue<number>
  size?: number
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = progress.value
    const tip = radarVertex(index, count, radius, centerX, centerY, (value / 100) * t)
    return {
      cx: tip.x,
      cy: tip.y,
      opacity: t,
    }
  })
  return (
    <AnimatedCircle
      r={size}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      animatedProps={animatedProps}
    />
  )
}

export type PhysicalMetricsRadarChartProps = {
  values: number[]
  /** Optional prior series drawn under current (dark blue). */
  priorValues?: number[] | null
  /** Vertex labels: stacked `{ score, abbrev }` or a plain string (legacy). */
  labels: PhysicalMetricsRadarLabel[]
  color?: string
  priorColor?: string
  contentWidth?: number
  compactBottom?: boolean
}

export function PhysicalMetricsRadarChart({
  values,
  priorValues = null,
  labels,
  color = PHYSICAL_CURRENT_COLOR,
  priorColor = PHYSICAL_PRIOR_COLOR,
  contentWidth,
  compactBottom = false,
}: PhysicalMetricsRadarChartProps) {
  const reduceMotion = useReducedMotion()
  const [measuredWidth, setMeasuredWidth] = useState(0)
  const chartSize = Math.floor(contentWidth ?? measuredWidth)
  const count = Math.min(values.length, labels.length)
  const hasPrior =
    Array.isArray(priorValues) &&
    priorValues.length >= count &&
    priorValues.some((v, i) => Math.abs((v ?? 0) - (values[i] ?? 0)) > 0.5)

  const gridProgress = useSharedValue(reduceMotion ? 1 : 0)
  const axisProgress = useSharedValue(reduceMotion ? 1 : 0)
  const areaProgress = useSharedValue(reduceMotion ? 1 : 0)
  const priorAreaProgress = useSharedValue(reduceMotion ? 1 : 0)
  const labelOpacity = useSharedValue(reduceMotion ? 1 : 0)

  const layout = useMemo(() => {
    if (count < 3 || chartSize < 120) return null
    const marginSide = Math.max(52, Math.round(chartSize * 0.19))
    const marginBottom = compactBottom
      ? Math.max(36, Math.round(chartSize * 0.1))
      : marginSide
    const cx = chartSize / 2
    const cy = compactBottom ? marginSide + (chartSize - marginSide - marginBottom) / 2 : chartSize / 2
    const radius = compactBottom
      ? Math.max(24, Math.min(cx - marginSide, cy - marginSide, chartSize - marginSide - marginBottom - 8))
      : Math.max(24, chartSize / 2 - marginSide)
    const labelOffset = Math.min(30, marginSide - 14)
    const slice = values.slice(0, count)
    const priorSlice = hasPrior && priorValues ? priorValues.slice(0, count) : null
    const gridLevels = Array.from({ length: LEVELS }, (_, i) => (radius * (i + 1)) / LEVELS)
    const axisTips = Array.from({ length: count }, (_, i) =>
      radarVertex(i, count, radius, cx, cy, 1)
    )
    const labelPoints = Array.from({ length: count }, (_, i) =>
      radarVertex(i, count, radius + labelOffset, cx, cy, 1)
    )
    const svgHeight = compactBottom
      ? Math.ceil(cy + radius + labelOffset + 22)
      : chartSize
    return { cx, cy, radius, gridLevels, slice, priorSlice, axisTips, labelPoints, svgHeight }
  }, [chartSize, count, values, priorValues, hasPrior, compactBottom])

  const valuesKey = useMemo(
    () => `${values.join(',')}|${(priorValues ?? []).join(',')}`,
    [values, priorValues]
  )

  useEffect(() => {
    if (!layout) return

    if (reduceMotion) {
      gridProgress.value = 1
      axisProgress.value = 1
      areaProgress.value = 1
      priorAreaProgress.value = 1
      labelOpacity.value = 1
      return
    }

    gridProgress.value = 0
    axisProgress.value = 0
    areaProgress.value = 0
    priorAreaProgress.value = 0
    labelOpacity.value = 0

    gridProgress.value = withSpring(1, GRID_SPRING)
    axisProgress.value = withDelay(120, withSpring(1, AXIS_SPRING))
    labelOpacity.value = withDelay(280, withTiming(1, { duration: 450 }))
    priorAreaProgress.value = withDelay(300, withSpring(1, AREA_SPRING))
    areaProgress.value = withDelay(420, withSpring(1, AREA_SPRING))
  }, [
    valuesKey,
    chartSize,
    layout,
    reduceMotion,
    gridProgress,
    axisProgress,
    areaProgress,
    priorAreaProgress,
    labelOpacity,
  ])

  const slice = layout?.slice ?? []
  const priorSlice = layout?.priorSlice ?? []
  const layoutRadius = layout?.radius ?? 0
  const layoutCx = layout?.cx ?? 0
  const layoutCy = layout?.cy ?? 0

  const priorAreaAnimatedProps = useAnimatedProps(() => {
    const t = priorAreaProgress.value
    return {
      d: radarPolygonPathProgress(priorSlice, 100, layoutRadius, layoutCx, layoutCy, t),
      opacity: t * 0.95,
    }
  })

  const areaAnimatedProps = useAnimatedProps(() => {
    const t = areaProgress.value
    return {
      d: radarPolygonPathProgress(slice, 100, layoutRadius, layoutCx, layoutCy, t),
      opacity: t,
    }
  })

  const labelsAnimatedProps = useAnimatedProps(() => ({
    opacity: labelOpacity.value,
  }))

  if (count < 3) return null

  if (chartSize < 120) {
    return (
      <View
        style={{ width: '100%', alignSelf: 'stretch' }}
        onLayout={(e) => {
          if (!contentWidth) setMeasuredWidth(e.nativeEvent.layout.width)
        }}
      />
    )
  }

  if (!layout) return null

  return (
    <View
      style={{ width: chartSize, maxWidth: '100%', alignSelf: 'center' }}
      onLayout={(e) => {
        if (!contentWidth) setMeasuredWidth(e.nativeEvent.layout.width)
      }}
    >
      <Svg width={chartSize} height={layout.svgHeight}>
        {layout.gridLevels.map((r, i) => (
          <AnimatedGridRing
            key={`ring-${i}`}
            cx={layout.cx}
            cy={layout.cy}
            targetR={r}
            index={i}
            progress={gridProgress}
          />
        ))}

        {layout.axisTips.map((tip, i) => (
          <AnimatedAxisLine
            key={`axis-${i}`}
            cx={layout.cx}
            cy={layout.cy}
            tipX={tip.x}
            tipY={tip.y}
            index={i}
            count={count}
            progress={axisProgress}
          />
        ))}

        {layout.priorSlice ? (
          <AnimatedPath
            d="M 0 0 Z"
            fill={PRIOR_FILL}
            stroke={priorColor}
            strokeWidth={2}
            animatedProps={priorAreaAnimatedProps}
          />
        ) : null}

        <AnimatedPath
          d="M 0 0 Z"
          fill={CURRENT_FILL}
          stroke={color}
          strokeWidth={2.5}
          animatedProps={areaAnimatedProps}
        />

        {layout.priorSlice
          ? layout.priorSlice.map((value, i) => (
              <AnimatedMetricDot
                key={`prior-dot-${i}`}
                value={value}
                index={i}
                count={count}
                radius={layout.radius}
                centerX={layout.cx}
                centerY={layout.cy}
                fill={priorColor}
                progress={priorAreaProgress}
                size={DOT_R}
              />
            ))
          : null}

        {layout.slice.map((value, i) => (
          <AnimatedMetricDot
            key={`dot-${i}`}
            value={value}
            index={i}
            count={count}
            radius={layout.radius}
            centerX={layout.cx}
            centerY={layout.cy}
            fill={PHYSICAL_PRIOR_COLOR}
            stroke={color}
            strokeWidth={DOT_STROKE}
            progress={areaProgress}
            size={DOT_R}
          />
        ))}

        <AnimatedG animatedProps={labelsAnimatedProps}>
          {layout.labelPoints.map((labelPt, i) => {
            const label = labels[i]
            if (label != null && typeof label === 'object') {
              return (
                <React.Fragment key={`label-${i}`}>
                  <SvgText
                    x={labelPt.x}
                    y={labelPt.y - 2}
                    fontSize={14}
                    fontWeight="700"
                    fill={SCORE_LABEL}
                    textAnchor="middle"
                  >
                    {String(label.score)}
                  </SvgText>
                  <SvgText
                    x={labelPt.x}
                    y={labelPt.y + 12}
                    fontSize={10}
                    fontWeight="500"
                    fill={ABBREV_LABEL}
                    textAnchor="middle"
                  >
                    {label.abbrev}
                  </SvgText>
                </React.Fragment>
              )
            }
            return (
              <SvgText
                key={`label-${i}`}
                x={labelPt.x}
                y={labelPt.y + 4}
                fontSize={11}
                fontWeight="600"
                fill={SCORE_LABEL}
                textAnchor="middle"
              >
                {typeof label === 'string' ? label : ''}
              </SvgText>
            )
          })}
        </AnimatedG>
      </Svg>
    </View>
  )
}
