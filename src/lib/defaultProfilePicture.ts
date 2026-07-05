import type { ImageSourcePropType } from 'react-native'
import { DOMAIN } from '../../constants'

export const DEFAULT_PROFILE_PICTURE = require('../../assets/betterdefultpic.png')

export function hasProfileImage(imageUri: string | null | undefined): boolean {
  if (typeof imageUri !== 'string') return false
  const trimmed = imageUri.trim()
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false
  return true
}

export function profileImageToAbsoluteUri(
  raw: string | null | undefined,
  domain: string = DOMAIN
): string | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http')) return trimmed
  const base = domain.replace(/\/+$/, '')
  const rel = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${base}${rel}`
}

export function profileImageSource(imageUri: string | null | undefined): ImageSourcePropType {
  if (hasProfileImage(imageUri)) return { uri: String(imageUri).trim() }
  return DEFAULT_PROFILE_PICTURE
}

export function profileImageSourceFromRaw(
  raw: string | null | undefined,
  domain: string = DOMAIN
): ImageSourcePropType {
  return profileImageSource(profileImageToAbsoluteUri(raw, domain))
}
