import React, { useContext, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Image, TouchableOpacity, useWindowDimensions } from 'react-native'
import { ThemeContext } from '../context'
import { useTranslation } from 'react-i18next'

const BADGE_FIRST_MATCH = require('../../assets/achivemnets/firstmatch.png')
const BADGE_3_DAYS_STREAK = require('../../assets/achivemnets/3daysstreak.png')
const BADGE_ROOKIE_LEAGUE = require('../../assets/achivemnets/rockieleuge.png')
const BADGE_LOCKED = require('../../assets/achivemnets/locked.png')

const BADGE_COUNT = 4
const BADGE_ROW_GAP = 0
/** Native asset canvases — unlocked PNGs include more outer glow, so they need a larger display box. */
const UNLOCKED_NATIVE_W = 86
const UNLOCKED_NATIVE_H = 96
const LOCKED_NATIVE_W = 65
const LOCKED_NATIVE_H = 75

type BadgeItem = {
  key: string
  image: number
  labelKey?: string
}

const BADGES: BadgeItem[] = [
  { key: 'first-match', image: BADGE_FIRST_MATCH, labelKey: 'progress.badgeFirstMatch' },
  { key: '3-days-streak', image: BADGE_3_DAYS_STREAK, labelKey: 'progress.badge3DaysStreak' },
  { key: 'rockie-league', image: BADGE_ROOKIE_LEAGUE, labelKey: 'progress.badgeRockieLeague' },
  { key: 'locked', image: BADGE_LOCKED },
]

type Props = {
  onViewAllPress?: () => void
  onRankingPress?: () => void
}

export function AchievementsBadgesSection({ onViewAllPress, onRankingPress }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { width: winW } = useWindowDimensions()
  const [rowWidth, setRowWidth] = useState(0)

  const badgeSizes = useMemo(() => {
    const contentW = rowWidth > 0 ? rowWidth : Math.max(1, winW - 40)
    const colSlot = Math.max(1, (contentW - BADGE_ROW_GAP * (BADGE_COUNT - 1)) / BADGE_COUNT)
    const unlockedW = Math.floor(colSlot * 1.05)
    const unlockedH = Math.round((unlockedW * UNLOCKED_NATIVE_H) / UNLOCKED_NATIVE_W)
    const lockedW = Math.floor(colSlot * 0.9)
    const lockedH = Math.round((lockedW * LOCKED_NATIVE_H) / LOCKED_NATIVE_W)
    return { unlockedW, unlockedH, lockedW, lockedH, iconRowH: unlockedH }
  }, [rowWidth, winW])

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text
          allowFontScaling={false}
          style={[styles.sectionTitle, { fontFamily: theme.semiBoldFont }]}
        >
          {t('progress.achievementsBadgesTitle')}
        </Text>
        <TouchableOpacity
          onPress={onViewAllPress}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text
            allowFontScaling={false}
            style={[styles.viewAll, { fontFamily: theme.regularFont }]}
          >
            {t('progress.viewAll')}
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={styles.badgesRow}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width
          if (w > 0 && Math.abs(w - rowWidth) > 1) setRowWidth(w)
        }}
      >
        {BADGES.map((badge) => (
          <View key={badge.key} style={styles.badgeCol}>
            <View style={[styles.badgeIconSlot, { height: badgeSizes.iconRowH }]}>
              <Image
                source={badge.image}
                style={
                  badge.labelKey
                    ? {
                        width: badgeSizes.unlockedW,
                        height: badgeSizes.unlockedH,
                      }
                    : {
                        width: badgeSizes.lockedW,
                        height: badgeSizes.lockedH,
                      }
                }
                resizeMode="contain"
              />
            </View>
            {badge.labelKey ? (
              <Text
                allowFontScaling={false}
                numberOfLines={2}
                style={[styles.badgeLabel, { fontFamily: theme.regularFont }]}
              >
                {t(badge.labelKey)}
              </Text>
            ) : (
              <View style={styles.badgeLabelSpacer} />
            )}
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.rankingBtn}
        onPress={onRankingPress}
        activeOpacity={0.88}
      >
        <Text
          allowFontScaling={false}
          style={[styles.rankingTxt, { fontFamily: theme.mediumFont }]}
        >
          {t('progress.ranking')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    marginTop: 4,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  viewAll: {
    fontSize: 12,
    color: '#86A7D2',
    lineHeight: 16,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: BADGE_ROW_GAP,
    width: '100%',
    marginBottom: 20,
    overflow: 'visible',
  },
  badgeCol: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    overflow: 'visible',
  },
  badgeIconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  badgeLabel: {
    marginTop: 2,
    fontSize: 11,
    color: '#FFFFFF',
    lineHeight: 14,
    textAlign: 'center',
  },
  badgeLabelSpacer: {
    height: 14,
    marginTop: 2,
  },
  rankingBtn: {
    width: '100%',
    backgroundColor: '#041641',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankingTxt: {
    fontSize: 15,
    color: '#00B8FF',
    lineHeight: 19,
  },
})
