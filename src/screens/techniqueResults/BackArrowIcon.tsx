import Svg, { Path } from 'react-native-svg'

/** Design back arrow (32×32, 2px round stroke). */
export function BackArrowIcon({ size = 32, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M7.33074 16L25.3308 16" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M14.6641 8C14.6641 8 6.66419 13.8919 6.66406 16C6.66406 18.1083 14.6641 24 14.6641 24"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
