import React from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import Ionicons from '@expo/vector-icons/Ionicons'

type Props = {
  /** Hexagon width; height follows the pointy-top ratio. */
  size: number
  /** Ionicons glyph centred in the hexagon; omit to render `children` instead. */
  icon?: React.ComponentProps<typeof Ionicons>['name']
  /** `bright` = earned / hero, `dim` = locked, `solid` = filled blue (XP badge). */
  variant?: 'bright' | 'dim' | 'solid'
  children?: React.ReactNode
}

/** Pointy-top hexagon with rounded joins, in a 100 × 112 box. */
const HEX_PATH = 'M50 4 L94 29 L94 83 L50 108 L6 83 L6 29 Z'
const RATIO = 112 / 100

let gradientSeq = 0

export function HexIcon({ size, icon, variant = 'bright', children }: Props) {
  // Unique gradient ids: react-native-svg ids are document-global on web.
  const [id] = React.useState(() => `hex${gradientSeq++}`)
  const h = size * RATIO
  const solid = variant === 'solid'
  const dim = variant === 'dim'
  return (
    <View style={{ width: size, height: h }}>
      <Svg width={size} height={h} viewBox="0 0 100 112">
        <Defs>
          <LinearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={solid ? '#4FA8FF' : dim ? '#0A1A44' : '#0D2A78'} />
            <Stop offset="1" stopColor={solid ? '#1F5BFF' : dim ? '#060F2C' : '#06164A'} />
          </LinearGradient>
          <LinearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={dim ? '#1C3F8F' : '#5FB2FF'} />
            <Stop offset="1" stopColor={dim ? '#122C6B' : '#2F6BFF'} />
          </LinearGradient>
        </Defs>
        <Path
          d={HEX_PATH}
          fill={`url(#${id}f)`}
          stroke={`url(#${id}s)`}
          strokeWidth={solid ? 3 : 5}
          strokeLinejoin="round"
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        {icon ? (
          <Ionicons name={icon} size={Math.round(size * 0.46)} color={dim ? '#3D7BE0' : '#6BB8FF'} />
        ) : (
          children
        )}
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
})
