import React, { useContext, useEffect, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../../context'
import {
  PHYSICAL_CURRENT_COLOR,
  PHYSICAL_METRIC_ABBREV,
  PHYSICAL_METRIC_KEYS,
  PHYSICAL_PRIOR_COLOR,
  type PhysicalMetricKey,
  type PhysicalMetricsValues,
} from '../../lib/physicalMetrics'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const RING_SIZE = 58
const OUTER_R = 24
const INNER_R = 17
const OUTER_STROKE = 4.5
const INNER_STROKE = 3.5

type RingProps = {
  value: number
  radius: number
  stroke: number
  color: string
  delayMs: number
}

function MetricArc({ value, radius, stroke, color, delayMs }: RingProps) {
  const reduceMotion = useReducedMotion()
  const progress = useSharedValue(reduceMotion ? 1 : 0)
  const c = 2 * Math.PI * radius

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1
      return
    }
    progress.value = 0
    progress.value = withDelay(delayMs, withTiming(1, { duration: 700 }))
  }, [value, delayMs, reduceMotion, progress])

  const animatedProps = useAnimatedProps(() => {
    const t = Math.max(0, Math.min(1, progress.value))
    const pct = Math.max(0, Math.min(100, value)) / 100
    const dash = c * pct * t
    return {
      strokeDasharray: `${dash} ${c}`,
      opacity: 0.35 + 0.65 * t,
    }
  })

  return (
    <AnimatedCircle
      cx={RING_SIZE / 2}
      cy={RING_SIZE / 2}
      r={radius}
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      rotation={-90}
      origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
      animatedProps={animatedProps}
    />
  )
}

export type PhysicalMetricsDualRingsProps = {
  current: PhysicalMetricsValues
  prior?: PhysicalMetricsValues | null
  labelForKey: (key: PhysicalMetricKey) => string
}

export function PhysicalMetricsDualRings({
  current,
  prior = null,
  labelForKey,
}: PhysicalMetricsDualRingsProps) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const trackColor = theme.backgroundColor
  const styles = useMemo(() => getStyles(), [])

  return (
    <View style={styles.wrap}>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: PHYSICAL_CURRENT_COLOR }]} />
          <Text allowFontScaling={false} style={styles.legendText}>
            {t('technique.physicalMetricNewRating')}
          </Text>
        </View>
        {prior ? (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: PHYSICAL_PRIOR_COLOR }]} />
            <Text allowFontScaling={false} style={styles.legendText}>
              {t('technique.physicalMetricPastRating')}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.row}>
        {PHYSICAL_METRIC_KEYS.map((key, idx) => {
          const cur = current[key]
          const prev = prior?.[key]
          return (
            <View key={key} style={styles.cell}>
              <View style={styles.ringBox}>
                <Svg width={RING_SIZE} height={RING_SIZE}>
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={OUTER_R}
                    fill="none"
                    stroke={trackColor}
                    strokeWidth={OUTER_STROKE}
                  />
                  {prev != null ? (
                    <Circle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={INNER_R}
                      fill="none"
                      stroke={trackColor}
                      strokeWidth={INNER_STROKE}
                    />
                  ) : null}
                  <MetricArc
                    value={cur}
                    radius={OUTER_R}
                    stroke={OUTER_STROKE}
                    color={PHYSICAL_CURRENT_COLOR}
                    delayMs={80 + idx * 60}
                  />
                  {prev != null ? (
                    <MetricArc
                      value={prev}
                      radius={INNER_R}
                      stroke={INNER_STROKE}
                      color={PHYSICAL_PRIOR_COLOR}
                      delayMs={140 + idx * 60}
                    />
                  ) : null}
                </Svg>
                <View style={styles.centerNums} pointerEvents="none">
                  <Text allowFontScaling={false} style={styles.curNum}>
                    {Math.round(cur)}
                  </Text>
                  {prev != null ? (
                    <Text allowFontScaling={false} style={styles.prevNum}>
                      {Math.round(prev)}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text allowFontScaling={false} style={styles.abbrev}>
                {PHYSICAL_METRIC_ABBREV[key]}
              </Text>
              <Text allowFontScaling={false} style={styles.name} numberOfLines={1}>
                {labelForKey(key)}
              </Text>
            </View>
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
      marginTop: 8,
      marginBottom: 4,
    },
    legendRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 14,
      marginBottom: 10,
      paddingHorizontal: 4,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    legendText: {
      color: 'rgba(255,255,255,0.55)',
      fontSize: 11,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
    },
    cell: {
      flex: 1,
      alignItems: 'center',
      minWidth: 0,
      paddingHorizontal: 1,
    },
    ringBox: {
      width: RING_SIZE,
      height: RING_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerNums: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    curNum: {
      color: PHYSICAL_CURRENT_COLOR,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 15,
    },
    prevNum: {
      color: PHYSICAL_PRIOR_COLOR,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 13,
      marginTop: 1,
    },
    abbrev: {
      marginTop: 6,
      color: 'rgba(255,255,255,0.7)',
      fontSize: 11,
      fontWeight: '600',
    },
    name: {
      marginTop: 1,
      color: 'rgba(255,255,255,0.35)',
      fontSize: 9,
      textAlign: 'center',
    },
  })
}
