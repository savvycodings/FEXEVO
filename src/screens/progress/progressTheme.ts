import { Platform, type ViewStyle } from 'react-native'

export const PG = {
  bg: '#050A18',
  /** Glow card / pill track fill (top → bottom). */
  cardTop: '#061A45',
  cardBottom: '#020B22',
  /** Plain card (category / consistency) fill. */
  cardPlain: '#030B1E',
  border: 'rgba(0, 102, 255, 0.55)',
  borderSoft: 'rgba(0, 102, 255, 0.28)',
  glow: '#0066FF',
  accent: '#00B8FF',
  /** Active segment pill gradient + text. */
  pillTop: '#A9D8FF',
  pillBottom: '#4DA6FF',
  pillText: '#06204F',
  pillIdleText: '#4D9BFF',
  labelBlue: '#4DB8FF',
  text: 'rgba(255,255,255,0.92)',
  muted: 'rgba(255,255,255,0.55)',
  axis: '#86A7D2',
  barFill: '#4DB8FF',
  barTrack: '#0B2A6B',
  dayOn: '#4DB8FF',
  dayOnText: '#06204F',
  dayOff: '#0A1A3A',
  dayOffText: 'rgba(255,255,255,0.6)',
  chartLine: '#4DA6FF',
  chartGrid: 'rgba(134, 167, 210, 0.22)',
  ringTrack: 'rgba(77, 166, 255, 0.12)',
}

/** Blue glow around cards and pill tracks; Android has no coloured shadows, so it relies on the border. */
export function glow(radius = 16, opacity = 0.55): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: { shadowColor: PG.glow, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: 0 } },
    web: { boxShadow: `0 0 ${radius}px rgba(0, 102, 255, ${opacity})` } as ViewStyle,
    default: {},
  })!
}
