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
  shortenRadarLabel,
} from './physicalMetricsRadarLayout'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)
const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedG = Animated.createAnimatedComponent(G)

const GRID = 'rgba(255,255,255,0.12)'
const AXIS = 'rgba(255,255,255,0.55)'
const AREA_FILL = 'rgba(0,184,255,0.18)'
const LEVELS = 5

const GRID_SPRING = { damping: 15, stiffness: 100, mass: 1 } as const
const AXIS_SPRING = { damping: 15, stiffness: 80, mass: 1 } as const
const AREA_SPRING = { damping: 18, stiffness: 90, mass: 1 } as const

function clamp01(n: number): number {
  'worklet'
  return Math.max(0, Math.min(1, n))
}

type RingProps = {
  cx: number
  cy: number
  targetR: number
  index: number
  progress: SharedValue<number>
}

function AnimatedGridRing({ cx, cy, targetR, index, progress }: RingProps) {
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

type AxisProps = {
  cx: number
  cy: number
  tipX: number
  tipY: number
  index: number
  count: number
  progress: SharedValue<number>
}

function AnimatedAxisLine({ cx, cy, tipX, tipY, index, count, progress }: AxisProps) {
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

type DotProps = {
  value: number
  index: number
  count: number
  radius: number
  centerX: number
  centerY: number
  color: string
  progress: SharedValue<number>
}

function AnimatedMetricDot({
  value,
  index,
  count,
  radius,
  centerX,
  centerY,
  color,
  progress,
}: DotProps) {
  const animatedProps = useAnimatedProps(() => {
    const t = progress.value
    const tip = radarVertex(index, count, radius, centerX, centerY, (value / 100) * t)
    return {
      cx: tip.x,
      cy: tip.y,
      opacity: t,
    }
  })
  return <AnimatedCircle r={4} fill={color} animatedProps={animatedProps} />
}

export type PhysicalMetricsRadarChartProps = {
  values: number[]
  labels: string[]
  color?: string
  /** When set, chart fills this width (e.g. match video panel). */
  contentWidth?: number
  /** Trim empty space below axis labels (bars list sits underneath). */
  compactBottom?: boolean
}

export function PhysicalMetricsRadarChart({
  values,
  labels,
  color = '#00BBFF',
  contentWidth,
  compactBottom = false,
}: PhysicalMetricsRadarChartProps) {
  const reduceMotion = useReducedMotion()
  const [measuredWidth, setMeasuredWidth] = useState(0)
  const chartSize = Math.floor(contentWidth ?? measuredWidth)
  const count = Math.min(values.length, labels.length)

  const gridProgress = useSharedValue(reduceMotion ? 1 : 0)
  const axisProgress = useSharedValue(reduceMotion ? 1 : 0)
  const areaProgress = useSharedValue(reduceMotion ? 1 : 0)
  const labelOpacity = useSharedValue(reduceMotion ? 1 : 0)

  const layout = useMemo(() => {
    if (count < 3 || chartSize < 120) return null
    const marginSide = Math.max(44, Math.round(chartSize * 0.16))
    const marginBottom = compactBottom
      ? Math.max(24, Math.round(chartSize * 0.07))
      : marginSide
    const cx = chartSize / 2
    const cy = compactBottom ? marginSide + (chartSize - marginSide - marginBottom) / 2 : chartSize / 2
    const radius = compactBottom
      ? Math.max(24, Math.min(cx - marginSide, cy - marginSide, chartSize - marginSide - marginBottom - 8))
      : Math.max(24, chartSize / 2 - marginSide)
    const labelOffset = Math.min(22, marginSide - 18)
    const slice = values.slice(0, count)
    const gridLevels = Array.from({ length: LEVELS }, (_, i) => (radius * (i + 1)) / LEVELS)
    const axisTips = Array.from({ length: count }, (_, i) =>
      radarVertex(i, count, radius, cx, cy, 1)
    )
    const labelPoints = Array.from({ length: count }, (_, i) =>
      radarVertex(i, count, radius + labelOffset, cx, cy, 1)
    )
    const svgHeight = compactBottom
      ? Math.ceil(cy + radius + labelOffset + 10)
      : chartSize
    return { cx, cy, radius, gridLevels, slice, axisTips, labelPoints, svgHeight }
  }, [chartSize, count, values, compactBottom])

  const valuesKey = useMemo(() => values.join(','), [values])

  useEffect(() => {
    if (!layout) return

    if (reduceMotion) {
      gridProgress.value = 1
      axisProgress.value = 1
      areaProgress.value = 1
      labelOpacity.value = 1
      return
    }

    gridProgress.value = 0
    axisProgress.value = 0
    areaProgress.value = 0
    labelOpacity.value = 0

    gridProgress.value = withSpring(1, GRID_SPRING)
    axisProgress.value = withDelay(120, withSpring(1, AXIS_SPRING))
    labelOpacity.value = withDelay(280, withTiming(1, { duration: 450 }))
    areaProgress.value = withDelay(380, withSpring(1, AREA_SPRING))
  }, [valuesKey, chartSize, layout, reduceMotion, gridProgress, axisProgress, areaProgress, labelOpacity])

  const slice = layout?.slice ?? []
  const layoutRadius = layout?.radius ?? 0
  const layoutCx = layout?.cx ?? 0
  const layoutCy = layout?.cy ?? 0

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

        <AnimatedPath
          d="M 0 0 Z"
          fill={AREA_FILL}
          stroke={color}
          strokeWidth={2}
          animatedProps={areaAnimatedProps}
        />

        {layout.slice.map((value, i) => (
          <AnimatedMetricDot
            key={`dot-${i}`}
            value={value}
            index={i}
            count={count}
            radius={layout.radius}
            centerX={layout.cx}
            centerY={layout.cy}
            color={color}
            progress={areaProgress}
          />
        ))}

        <AnimatedG animatedProps={labelsAnimatedProps}>
          {layout.labelPoints.map((labelPt, i) => (
            <SvgText
              key={`label-${i}`}
              x={labelPt.x}
              y={labelPt.y + 4}
              fontSize={9}
              fill={AXIS}
              textAnchor="middle"
            >
              {shortenRadarLabel(labels[i] ?? '')}
            </SvgText>
          ))}
        </AnimatedG>
      </Svg>
    </View>
  )
}
