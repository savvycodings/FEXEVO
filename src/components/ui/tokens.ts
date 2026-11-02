import type { ViewStyle } from 'react-native'

/**
 * Shared look for auth, welcome and onboarding. Values come from the design spec
 * (Figma CSS), not from PNG exports — those render the blues shifted toward violet.
 */
export const UI = {
  pageBg: '#030A17',
  /** Top-of-screen radial wash behind auth screens. */
  pageGlow: '#071D47',

  /** Glass cards (setup boxes, "Don't have an account?" card): `background: #001435`. */
  cardBg: '#001435',
  cardBorder: 'rgba(0, 72, 255, 0.35)',

  /** Inputs, social buttons, secondary buttons, unselected options. */
  surface: '#0B1F57',
  surfaceBorder: 'rgba(0, 102, 255, 0.3)',
  /** Segmented-toggle track. */
  track: '#0B1F57',
  trackBorder: 'rgba(0, 102, 255, 0.45)',

  /** Primary gradient: `linear-gradient(102.5deg, #00BBFF 9.07%, #0022FF 90.93%)`. */
  gradient: ['#00BBFF', '#0022FF'] as const,
  gradientLocations: [0.0907, 0.9093] as const,
  /** 102.5deg ≈ left → right with a slight downward tilt. */
  gradientStart: { x: 0, y: 0.39 },
  gradientEnd: { x: 1, y: 0.61 },
  /** Dark circle behind the arrow on primary buttons. */
  arrowBadge: 'rgba(0, 21, 212, 0.7)',

  text: '#FFFFFF',
  textMuted: '#8CB0E2',
  textSubtle: 'rgba(255, 255, 255, 0.55)',
  /** Links, field icons, selected language. */
  accent: '#00BBFF',
  /** "account" in "Create your account". */
  accentStrong: '#2F6BFF',
  divider: 'rgba(255, 255, 255, 0.14)',
  error: '#FF6B7A',

  /** Coach card (Coaches list): deep navy fill and a blue-violet border, from the coach card mockup. */
  coachCardBg: '#060B24',
  coachCardBorder: 'rgba(52, 72, 255, 0.6)',
  /** Specialty chips on the coach card and coach profile. */
  chipBg: '#050A26',
  chipBorder: 'rgba(70, 96, 255, 0.55)',

  /** Buttons and options: radius 16, 1px border, 16/8 padding (design spec). */
  radius: 16,
  radiusCard: 20,
  radiusPill: 999,
  buttonHeight: 60,
  fieldHeight: 56,
} as const

/** Primary button glow from the spec: inner cyan glow + cyan and deep-blue outer glows. */
export const PRIMARY_GLOW: ViewStyle = {
  boxShadow: '0px 0px 16px 0px #35C7FF inset, 0px 0px 10px 0px #00B8FF, 0px 0px 15px 0px #0015D4',
}

/** Card glow from the spec: inset `0 0 30px #0048FF80`, outer `0 0 20px #0048FF33`. */
export const CARD_GLOW: ViewStyle = {
  boxShadow: '0px 0px 30px 0px #0048FF80 inset, 0px 0px 20px 0px #0048FF33',
}

/** Selected segment / option: the same glow, a little tighter. */
export const SELECTED_GLOW: ViewStyle = {
  boxShadow: '0px 0px 12px 0px #35C7FF inset, 0px 0px 8px 0px #00B8FF',
}

/** Coach card glow: a stronger blue-violet halo than CARD_GLOW, like the coach card mockup. */
export const COACH_CARD_GLOW: ViewStyle = {
  boxShadow: '0px 0px 28px 0px #2B3BFF40 inset, 0px 0px 18px 2px #3448FF66',
}
