import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'

export type BodyPartId = 'head' | 'shoulder' | 'elbow' | 'wrist' | 'torso' | 'knee' | 'feet' | 'racket'

/** One glyph per body part, shared by View Angles, Full Body Analysis and the joint close-up. */
export const JOINT_ICON: Record<BodyPartId, keyof typeof MaterialCommunityIcons.glyphMap> = {
  head: 'head-outline',
  shoulder: 'arm-flex-outline',
  elbow: 'arm-flex',
  wrist: 'hand-back-right-outline',
  torso: 'human',
  knee: 'human-handsdown',
  feet: 'shoe-sneaker',
  racket: 'tennis',
}
