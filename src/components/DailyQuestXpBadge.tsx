import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import {
  XP_BADGE_COMPLETE,
  XP_COMPLETE_TEXT_COLOR,
  formatDailyQuestXp,
  getDailyQuestXpBadgeImage,
} from '../lib/dailyQuestXpBadge'

type Props = {
  xp: number
  /** Quest objective met or XP already claimed. */
  completed?: boolean
  fontFamily: string
  size?: 'card' | 'banner'
}

const SIZES = {
  card: { wrap: { width: 52, height: 58 }, img: { width: 52, height: 58 }, fontSize: 11, marginTop: 17 },
  banner: { wrap: { width: 56, height: 56 }, img: { width: 56, height: 56 }, fontSize: 11, marginTop: 15 },
} as const

export function DailyQuestXpBadge({
  xp,
  completed = false,
  fontFamily,
  size = 'card',
}: Props) {
  const dims = SIZES[size]
  const source = completed ? XP_BADGE_COMPLETE : getDailyQuestXpBadgeImage(xp)
  const label = formatDailyQuestXp(xp)

  return (
    <View style={[styles.wrap, dims.wrap]}>
      <Image source={source} style={[styles.img, dims.img]} resizeMode="contain" />
      <Text
        allowFontScaling={false}
        style={[
          styles.txt,
          {
            fontFamily,
            fontSize: dims.fontSize,
            marginTop: dims.marginTop,
            color: completed ? XP_COMPLETE_TEXT_COLOR : '#FFFFFF',
          },
        ]}
      >
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  img: {
    position: 'absolute',
  },
  txt: {
    lineHeight: 13,
    textAlign: 'center',
  },
})
