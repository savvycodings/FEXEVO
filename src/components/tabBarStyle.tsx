import React from 'react'
import { Platform, View, type TextStyle, type ViewStyle } from 'react-native'
import {
  NavIconActivities,
  NavIconHome,
  NavIconMyCoach,
  NavIconMyStudents,
  NavIconPlaylist,
  NavIconProgress,
  NavIconYou,
} from './NavTabIcons'
import { CoachTabOrb } from './CoachCharacterAvatar'
import type { MainTabParamList } from '../navigation/types'
import { UI } from './ui/tokens'

/** Shared by the tab navigator (`main.tsx`) and `MainTabBarChrome`, so both bars stay identical. */
/** Home design: active icon in the accent blue with a white label, inactive icon and label muted. */
export const TAB_ACTIVE = UI.accent
export const TAB_INACTIVE = UI.textMuted
export const TAB_LABEL_ACTIVE = UI.text

/** Active label style (plain white in the design, no glow). */
export const tabLabelActive: TextStyle = { color: TAB_LABEL_ACTIVE }

/** Glow behind the active icon (no colored shadow on Android). */
const iconGlow: ViewStyle =
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#00B7FF',
      shadowOpacity: 0.9,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
    },
    web: { filter: 'drop-shadow(0 0 6px rgba(0, 183, 255, 0.85))' } as ViewStyle,
    default: {},
  }) ?? {}

export function renderTabIcon(
  tab: keyof MainTabParamList,
  focused: boolean,
  size: number,
  viewerIsCoach: boolean
) {
  if (tab === 'Assistant') return <CoachTabOrb ring />
  const color = focused ? TAB_ACTIVE : TAB_INACTIVE
  const icon =
    tab === 'AICoach' ? (
      <NavIconHome color={color} size={size} filled={focused} />
    ) : tab === 'Playlist' ? (
      <NavIconPlaylist color={color} size={size} />
    ) : tab === 'MyCoach' ? (
      viewerIsCoach ? (
        <NavIconMyStudents color={color} size={size} />
      ) : (
        <NavIconMyCoach color={color} size={size} />
      )
    ) : tab === 'Activities' ? (
      <NavIconActivities color={color} size={size} filled={focused} />
    ) : tab === 'Progress' ? (
      <NavIconProgress color={color} size={size} filled={focused} />
    ) : (
      <NavIconYou color={color} size={size} filled={focused} />
    )
  return focused ? <View style={iconGlow}>{icon}</View> : icon
}
