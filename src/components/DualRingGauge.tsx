import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle, G } from 'react-native-svg'

/** Outer ring = this week (matches MyCoachScoreRing actual / light). */
export const RING_THIS_WEEK = '#40C0FF'
/** Inner ring = last week (matches MyCoachScoreRing last / dark). */
export const RING_LAST_WEEK = '#2B7CFF'
const RING_TRACK_OUTER = 'rgba(64, 192, 255, 0.28)'
const RING_TRACK_INNER = 'rgba(43, 124, 255, 0.22)'

function clamp100(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, v))
}

function formatScore(v: number): string {
  const c = clamp100(v)
  return Number.isInteger(c) ? String(c) : c.toFixed(1)
}

type ThemeFonts = { semiBoldFont: string; mediumFont: string }

type DualRingGaugeProps = {
  thisWeek: number
  lastWeek: number
  theme: ThemeFonts
  size: number
  /** When true, only the outer ring and a single centered score are shown. */
  single?: boolean
}

export function DualRingGauge({
  thisWeek,
  lastWeek,
  theme,
  size,
  single = false,
}: DualRingGaugeProps) {
  const cx = size / 2
  const cy = size / 2
  const rOuter = size * 0.34
  const rInner = size * 0.282
  const strokeOuter = Math.max(2.6, size * 0.048)
  const strokeInner = Math.max(2.2, size * 0.038)
  const scoreMainSize = size >= 72 ? 12 : size >= 62 ? 11 : 10
  const scoreLastSize = size >= 72 ? 10 : 9

  const cOuter = 2 * Math.PI * rOuter
  const cInner = 2 * Math.PI * rInner
  const pOut = clamp100(thisWeek) / 100
  const pIn = single ? 0 : clamp100(lastWeek) / 100

  const dashOuter = `${pOut * cOuter} ${cOuter}`
  const dashInner = `${pIn * cInner} ${cInner}`

  return (
    <View style={[styles.gaugeWrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill}>
        <G transform={`rotate(-90 ${cx} ${cy})`}>
          <Circle
            cx={cx}
            cy={cy}
            r={rOuter}
            stroke={RING_TRACK_OUTER}
            strokeWidth={strokeOuter}
            fill="none"
          />
          <Circle
            cx={cx}
            cy={cy}
            r={rInner}
            stroke={RING_TRACK_INNER}
            strokeWidth={strokeInner}
            fill="none"
          />
          {!single ? (
            <Circle
              cx={cx}
              cy={cy}
              r={rInner}
              stroke={RING_LAST_WEEK}
              strokeWidth={strokeInner}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={dashInner}
            />
          ) : null}
          <Circle
            cx={cx}
            cy={cy}
            r={rOuter}
            stroke={RING_THIS_WEEK}
            strokeWidth={strokeOuter}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={dashOuter}
          />
        </G>
      </Svg>
      <View style={styles.gaugeLabels} pointerEvents="none">
        <Text
          allowFontScaling={false}
          style={[
            styles.scoreThis,
            { fontFamily: theme.semiBoldFont, fontSize: scoreMainSize, lineHeight: scoreMainSize + 2 },
          ]}
        >
          {formatScore(thisWeek)}
        </Text>
        {!single ? (
          <Text
            allowFontScaling={false}
            style={[
              styles.scoreLast,
              { fontFamily: theme.mediumFont, fontSize: scoreLastSize, lineHeight: scoreLastSize + 2 },
            ]}
          >
            {formatScore(lastWeek)}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  gaugeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeLabels: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  scoreThis: {
    color: '#2D86FF',
  },
  scoreLast: {
    color: '#5260A4',
    marginTop: 0,
  },
})
