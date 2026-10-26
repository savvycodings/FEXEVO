import React from 'react'
import Svg, { Path, Circle, Rect } from 'react-native-svg'

type IconProps = { size?: number; color?: string }

const STROKE = 1.6

/** Paddle inside a rounded frame — Technique. */
export function TechniqueIcon({ size = 26, color = '#4DA6FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Circle cx={13.5} cy={10.5} r={4} stroke={color} strokeWidth={STROKE} />
      <Path d="M10.7 13.3 7 17" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Circle cx={12.8} cy={9.8} r={0.6} fill={color} />
      <Circle cx={14.4} cy={11.2} r={0.6} fill={color} />
    </Svg>
  )
}

/** Lightning bolt in a rounded square — Outcome. */
export function OutcomeIcon({ size = 26, color = '#4DA6FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={5} stroke={color} strokeWidth={STROKE} />
      <Path d="M13 6.5 8.5 13h3.5l-1 4.5L15.5 11H12l1-4.5Z" stroke={color} strokeWidth={STROKE} strokeLinejoin="round" />
    </Svg>
  )
}

/** Light bulb with rays — Tactics. */
export function TacticsIcon({ size = 26, color = '#4DA6FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8.5 15.5a5 5 0 1 1 7 0c-.6.5-1 1.2-1 2v.5h-5v-.5c0-.8-.4-1.5-1-2Z" stroke={color} strokeWidth={STROKE} strokeLinejoin="round" />
      <Path d="M10 20.5h4M12 2.5v1.5M4.5 5.5l1 1M19.5 5.5l-1 1M2.5 12h1.5M20 12h1.5" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  )
}
