import type { ImageSourcePropType } from 'react-native'

/** `full` is the standalone bot with its floor shadow, `pill` the smiling orb in the input, `tab` the tab bar orb. */
export type CoachOrbVariant = 'full' | 'pill' | 'tab'

export const COACH_ORB_IMAGES: Record<CoachOrbVariant, ImageSourcePropType> = {
  full: require('../../assets/assistant/orb.png'),
  pill: require('../../assets/assistant/orb-small.png'),
  tab: require('../../assets/assistant/tab-orb.png'),
}

/** Width / height of each source asset, so non-square variants keep their proportions. */
export const COACH_ORB_ASPECT: Record<CoachOrbVariant, number> = {
  full: 1,
  pill: 1,
  tab: 50.5405 / 51.4674,
}

export const COACH_EYES_IMAGE: ImageSourcePropType = require('../../assets/assistant/eyes.png')
export const COACH_EYES_ASPECT = 29.4837 / 24.2636
export const COACH_CLOSE_IMAGE: ImageSourcePropType = require('../../assets/assistant/close.png')
export const COACH_MIC_IMAGE: ImageSourcePropType = require('../../assets/assistant/mic.png')
