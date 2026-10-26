import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg'
import { PG } from './progressTheme'

type Props = {
  /** 0–100, or `null` for the empty state. */
  score: number | null
  size?: number
  numberFont?: string
  labelFont?: string
  outOfLabel: string
}

const STROKE = 9

export function ScoreRing({ score, size = 120, numberFont, labelFont, outOfLabel }: Props) {
  const cx = size / 2
  const r = size / 2 - STROKE
  const circ = 2 * Math.PI * r
  const pct = score != null ? Math.max(0, Math.min(100, score)) / 100 : 0
  const arcLen = circ * pct
  // End cap sits where the arc stops (arc starts at 12 o'clock, runs clockwise).
  const endAngle = -Math.PI / 2 + pct * 2 * Math.PI
  const capX = cx + r * Math.cos(endAngle)
  const capY = cx + r * Math.sin(endAngle)

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          {/* Blue at the top-right start of the arc, fading to green toward the bottom-left end. */}
          <LinearGradient id="scoreRingGrad" x1="1" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2F6BFF" />
            <Stop offset="0.55" stopColor="#2FC3FF" />
            <Stop offset="1" stopColor="#5BF5B0" />
          </LinearGradient>
        </Defs>
        <Circle cx={cx} cy={cx} r={r} stroke={PG.ringTrack} strokeWidth={STROKE} fill="none" />
        {pct > 0 ? (
          <>
            <Circle
              cx={cx}
              cy={cx}
              r={r}
              stroke="url(#scoreRingGrad)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${arcLen} ${circ}`}
              transform={`rotate(-90 ${cx} ${cx})`}
            />
            <Circle cx={capX} cy={capY} r={STROKE * 0.9} fill="#FFFFFF" opacity={0.25} />
            <Circle cx={capX} cy={capY} r={STROKE * 0.45} fill="#FFFFFF" />
          </>
        ) : null}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text allowFontScaling={false} style={[styles.num, { fontFamily: numberFont, fontSize: size * 0.36 }]}>
          {score != null ? String(Math.round(score)) : '—'}
        </Text>
        <Text allowFontScaling={false} style={[styles.outOf, { fontFamily: labelFont }]}>
          {outOfLabel}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: {
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  outOf: {
    fontSize: 11,
    color: PG.muted,
    marginTop: -4,
  },
})
