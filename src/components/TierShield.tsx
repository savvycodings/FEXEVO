import React from 'react'
import { Image, StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import type { CoachTier } from '../lib/coachDirectoryApi'

const XEVO_WORDMARK = require('../../assets/shield-card/Xevo.png')

/** Top light → bottom dark, plus the edge colour. */
const TIER_COLORS: Record<CoachTier, { top: string; bottom: string; band: string; edge: string }> = {
  gold: { top: '#FBE27A', bottom: '#D7A733', band: '#B98620', edge: '#FFF1B8' },
  silver: { top: '#E9ECF1', bottom: '#9AA1AC', band: '#7E8590', edge: '#FFFFFF' },
  bronze: { top: '#D49A63', bottom: '#8E5A31', band: '#6E4222', edge: '#F2C9A1' },
  blue: { top: '#3D6BFF', bottom: '#1630C9', band: '#0F23A0', edge: '#8FB0FF' },
}

/** 100 × 120 shield: flat top with rounded corners, sides tapering to a point. */
const SHIELD = 'M10 4 H90 Q96 4 96 10 V82 Q96 90 88 95 L50 117 L12 95 Q4 90 4 82 V10 Q4 4 10 4 Z'
/** Lower band, clipped by drawing it as its own shape inside the outline. */
const BAND = 'M4 70 Q50 58 96 70 V82 Q96 90 88 95 L50 117 L12 95 Q4 90 4 82 Z'

/** Xevo shield badge in a coach tier colour (gold / silver / bronze for the top three, else blue). */
export function TierShield({ tier, width = 56 }: { tier: CoachTier; width?: number }) {
  const c = TIER_COLORS[tier]
  const height = width * 1.2
  const id = `tier-${tier}`
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox="0 0 100 120">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.top} />
            <Stop offset="1" stopColor={c.bottom} />
          </LinearGradient>
        </Defs>
        <Path d={SHIELD} fill={`url(#${id})`} />
        <Path d={BAND} fill={c.band} opacity={0.55} />
        <Path d={SHIELD} fill="none" stroke={c.edge} strokeWidth={3} />
      </Svg>
      <Image
        source={XEVO_WORDMARK}
        resizeMode="contain"
        style={[styles.wordmark, { top: height * 0.14, width: width * 0.7, height: width * 0.24 }]}
        tintColor={tier === 'gold' ? '#1B1B1B' : '#FFFFFF'}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wordmark: { position: 'absolute', alignSelf: 'center' },
})
