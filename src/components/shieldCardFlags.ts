import type { ImageSourcePropType } from 'react-native'

/**
 * Shield flags live under `app/assets/shield-card/flags/`.
 *
 * Metro only bundles static `require()` paths. To add a country:
 * 1. Add `flags/XX.png` (or `.webp`).
 * 2. Add one line: `XX: require('../../assets/shield-card/flags/XX.png'),`
 * 3. Use `<ShieldCoachCard flagCode="XX" />`
 */
export const SHIELD_FLAG_MODULES = {
  US: require('../../assets/shield-card/flags/US.png'),
} as const

export type ShieldFlagCode = keyof typeof SHIELD_FLAG_MODULES

export const DEFAULT_SHIELD_FLAG: ShieldFlagCode = 'US'

export function shieldFlagSource(code: ShieldFlagCode): ImageSourcePropType {
  return SHIELD_FLAG_MODULES[code]
}

export function isShieldFlagCode(value: string): value is ShieldFlagCode {
  return value in SHIELD_FLAG_MODULES
}
