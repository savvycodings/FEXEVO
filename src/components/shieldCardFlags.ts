import type { ImageSourcePropType } from 'react-native'
import { findCountry } from '../lib/countries'

/**
 * Single source of truth for non-US shield flags is `app/src/lib/countries.ts`
 * (the same registry used by the location picker on Profile Settings).
 *
 * The US badge uses the original `assets/shield-card/flags/US.png` (~41×28,
 * aspect ≈ 1.46) that the shield composition was tuned against — the newer
 * `flags/flag/US.png` is a true 3∶2 image and renders slightly wider in the
 * shield's 3∶2 slot, which makes the flag appear to have shifted.
 *
 * `flagCode` on `<ShieldCoachCard />` accepts an ISO code ("ZA"), an English
 * country name ("South Africa"), or `null`/`undefined` (falls back to US).
 */
const US_FLAG: ImageSourcePropType = require('../../assets/shield-card/flags/US.png')

/** Default flag when no location is set or the saved value is unrecognized. */
export const DEFAULT_SHIELD_FLAG = 'US'

/**
 * Back-compat alias: the prop was strictly typed before. We now accept any
 * code/name string; unknown values resolve to the US fallback.
 */
export type ShieldFlagCode = string

export function shieldFlagSource(value?: string | null): ImageSourcePropType {
  const country = findCountry(value)
  // Always serve the original US asset for the United States so the shield
  // composition matches the historical look pixel-for-pixel.
  if (!country || country.code === 'US') return US_FLAG
  return country.flag
}

export function isShieldFlagCode(value: string): boolean {
  return findCountry(value) != null
}
