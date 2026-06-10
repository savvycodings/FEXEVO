import React, { useContext, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Image, TouchableOpacity, useWindowDimensions } from 'react-native'
import { ThemeContext } from '../context'
import { getAchievementDisplayImage, withAchievementState } from '../lib/achievementsCatalog'
import { useSessionData } from '../context/SessionDataContext'
import { useTranslation } from 'react-i18next'

const PREVIEW_COUNT = 4
const BADGE_ROW_GAP = 0
const UNLOCKED_NATIVE_W = 86
const UNLOCKED_NATIVE_H = 96
const LOCKED_NATIVE_W = 65
const LOCKED_NATIVE_H = 75

type Props = {
  onViewAllPress?: () => void
  onRankingPress?: () => void
}

export function AchievementsBadgesSection({ onViewAllPress, onRankingPress }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { width: winW } = useWindowDimensions()
  const [rowWidth, setRowWidth] = useState(0)

  const { claimedAchievementKeys, claimableAchievementKeys } = useSessionData()

  const previewBadges = useMemo(
    () =>
      withAchievementState(claimedAchievementKeys, claimableAchievementKeys).slice(
        0,
        PREVIEW_COUNT
      ),
    [claimedAchievementKeys, claimableAchievementKeys]
  )

  const badgeSizes = useMemo(() => {
    const contentW = rowWidth > 0 ? rowWidth : Math.max(1, winW - 40)
    const colSlot = Math.max(1, (contentW - BADGE_ROW_GAP * (PREVIEW_COUNT - 1)) / PREVIEW_COUNT)
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
        {previewBadges.map((badge) => {
          const isUnlocked = badge.kind === 'unlocked'
          const imgW = isUnlocked ? badgeSizes.unlockedW : badgeSizes.lockedW
          const imgH = isUnlocked ? badgeSizes.unlockedH : badgeSizes.lockedH
          return (
            <View key={badge.key} style={styles.badgeCol}>
              <View style={[styles.badgeIconSlot, { height: badgeSizes.iconRowH }]}>
                <Image
                  source={getAchievementDisplayImage(badge)}
                  style={{ width: imgW, height: imgH }}
                  resizeMode="contain"
                />
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={2}
                style={[styles.badgeLabel, { fontFamily: theme.regularFont }]}
              >
                {t(badge.labelKey)}
              </Text>
            </View>
          )
        })}
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
