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
  /**
   * Buttons (design spec): primary `linear-gradient(180deg, #A9D8FF 0%, #4DA6FF 100%)`, radius 20,
   * height 60, 35px side padding, dark navy label. Secondary: deep indigo with a white label.
   * Every gradient button should use GlowButton / PrimaryFill so the look stays in one place.
   */
  btnPrimaryGradient: ['#A9D8FF', '#4DA6FF'] as const,
  /** Primary label: `#07256D`, Inter 600 18px. */
  btnPrimaryText: '#07256D',
  btnRadius: 20,
  btnPaddingX: 35,
  /** Secondary (e.g. "Coach Signup"): solid `#041641` (the spec's two-stop gradient is one colour), no border, inset blue glow. */
  btnSecondaryBg: '#041641',
  /** Secondary label: white, Inter 500 18px. */
  btnSecondaryText: '#FFFFFF',
  /** Text-only button (e.g. welcome "Login"): `#86A7D2`, Inter 500 18px, no fill. */
  btnTextColor: '#86A7D2',


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

/** Secondary button: `#041641` fill + `box-shadow: 0 0 16px 0 rgba(0, 72, 255, 0.25) inset`. Spread on any secondary control. */
export const SECONDARY_BUTTON: ViewStyle = {
  backgroundColor: UI.btnSecondaryBg,
  boxShadow: '0px 0px 16px 0px rgba(0, 72, 255, 0.25) inset',
}

/** Glow surface: `#041641` fill + `0 0 30px rgba(0, 72, 255, 0.5) inset`. Inputs, social buttons, video controls. */
export const GLOW_SURFACE: ViewStyle = {
  backgroundColor: '#041641',
  boxShadow: '0px 0px 30px 0px rgba(0, 72, 255, 0.5) inset',
}

/** Card (design spec): radius 20, 1px Light-Stroke `#006EFF`, solid `#041641`. Used by GlassCard and the setup cards. */
export const CARD: ViewStyle = {
  borderRadius: 20,
  borderWidth: 1,
  borderColor: '#006EFF',
  backgroundColor: '#041641',
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

/**
 * Text field box (auth inputs, country picker): `#041641`, radius 20, 59pt tall, 15px side padding, inset "Frame Glow".
 * The border is always 1.5px (transparent at rest) so focusing a field only recolours it and nothing below shifts.
 */
export const FIELD_BORDER_WIDTH = 1
export const FIELD_BOX: ViewStyle = {
  height: 59,
  borderRadius: 20,
  paddingHorizontal: 15,
  ...GLOW_SURFACE,
  borderWidth: FIELD_BORDER_WIDTH,
  borderColor: 'transparent',
  marginBottom: 10,
}

/** Focused field: 1px `#00B8FF` border, soft outer glow plus the inset "Frame" glow. */
export const FIELD_BOX_ACTIVE: ViewStyle = {
  borderColor: '#00B8FF',
  boxShadow: '0px 0px 20px 0px rgba(0, 72, 255, 0.2), 0px 0px 30px 0px rgba(0, 72, 255, 0.5) inset',
}

/** Field placeholder: `#86A7D2`, Inter 500 11px (apply while the field is empty; RN styles the placeholder via the input). */
export const FIELD_PLACEHOLDER_COLOR = '#86A7D2'
export const FIELD_PLACEHOLDER_SIZE = 11
