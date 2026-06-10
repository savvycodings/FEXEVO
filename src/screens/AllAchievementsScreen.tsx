import React, { useContext, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { ThemeContext } from '../context'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_GRID_PREVIEW_COUNT,
  TOTAL_ACHIEVEMENTS,
  countUnlockedAchievements,
  getAchievementGridImage,
  withAchievementState,
  type AchievementDef,
} from '../lib/achievementsCatalog'
import { useSessionData } from '../context/SessionDataContext'
import type { ProgressTabStackParamList } from '../navigation/types'
import { useTranslation } from 'react-i18next'

const TICK_ICON = require('../../assets/achivemnets/tickicon.svg')

const PG = {
  bg: '#050A18',
  muted: '#86A7D2',
}

const COLS = 3
const COL_GAP = 10
const ROW_GAP = 18
const UNLOCKED_NATIVE_W = 86
const UNLOCKED_NATIVE_H = 96
const LOCKED_GRID_NATIVE_W = 104
const LOCKED_GRID_NATIVE_H = 130

type Nav = NativeStackNavigationProp<ProgressTabStackParamList>

function LockedCardLabel({
  label,
  fontFamily,
}: {
  label: string
  fontFamily: string
}) {
  const lines = label.split('\n')
  if (lines.length > 1) {
    return (
      <View style={styles.lockedLabelWrap}>
        <Text allowFontScaling={false} style={[styles.lockedLabelLine, { fontFamily }]}>
          {lines[0]}
        </Text>
        <Text allowFontScaling={false} style={[styles.lockedLabelLine, { fontFamily }]}>
          {lines[1]}
        </Text>
      </View>
    )
  }
  return (
    <Text allowFontScaling={false} style={[styles.lockedLabelSingle, { fontFamily }]}>
      {label}
    </Text>
  )
}

function AchievementGridCell({
  item,
  gridSizes,
  fontFamily,
  onPress,
}: {
  item: AchievementDef
  gridSizes: {
    colW: number
    unlockedW: number
    unlockedH: number
    lockedW: number
    lockedH: number
    slotH: number
  }
  fontFamily: string
  onPress: () => void
}) {
  const { t } = useTranslation()
  const isUnlocked = item.kind === 'unlocked'
  const label = t(item.labelKey)

  return (
    <Pressable
      onPress={onPress}
      style={[styles.gridCell, { width: gridSizes.colW }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {isUnlocked ? (
        <>
          <View style={[styles.iconSlot, { height: gridSizes.slotH }]}>
            <Image
              source={getAchievementGridImage(item)}
              style={{ width: gridSizes.unlockedW, height: gridSizes.unlockedH }}
              resizeMode="contain"
            />
            <View style={styles.tickWrap}>
              <LocalSvgAsset assetModule={TICK_ICON} width={18} height={18} />
            </View>
          </View>
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[styles.itemLabel, { fontFamily }]}
          >
            {label}
          </Text>
        </>
      ) : (
        <View style={[styles.lockedCard, { width: gridSizes.lockedW, height: gridSizes.lockedH }]}>
          <Image
            source={getAchievementGridImage(item)}
            style={{ width: gridSizes.lockedW, height: gridSizes.lockedH }}
            resizeMode="contain"
          />
          <LockedCardLabel label={label} fontFamily={fontFamily} />
        </View>
      )}
    </Pressable>
  )
}

export function AllAchievementsScreen() {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const { width: winW } = useWindowDimensions()
  const [expanded, setExpanded] = useState(false)

  const { claimedAchievementKeys, claimableAchievementKeys } = useSessionData()
  const achievements = useMemo(
    () => withAchievementState(claimedAchievementKeys, claimableAchievementKeys),
    [claimedAchievementKeys, claimableAchievementKeys]
  )

  const horizontalPad = Math.max(20, insets.left, insets.right)
  const unlockedCount = countUnlockedAchievements(claimedAchievementKeys)
  const showExpandToggle = achievements.length > ACHIEVEMENTS_GRID_PREVIEW_COUNT
  const visibleAchievements = expanded
    ? achievements
    : achievements.slice(0, ACHIEVEMENTS_GRID_PREVIEW_COUNT)

  const gridSizes = useMemo(() => {
    const contentW = Math.max(1, winW - horizontalPad * 2)
    const colW = Math.floor((contentW - COL_GAP * (COLS - 1)) / COLS)
    const unlockedW = Math.floor(colW * 0.88)
    const unlockedH = Math.round((unlockedW * UNLOCKED_NATIVE_H) / UNLOCKED_NATIVE_W)
    const lockedW = colW
    const lockedH = Math.round((lockedW * LOCKED_GRID_NATIVE_H) / LOCKED_GRID_NATIVE_W)
    const slotH = Math.max(unlockedH, lockedH)
    return { colW, unlockedW, unlockedH, lockedW, lockedH, slotH }
  }, [winW, horizontalPad])

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: 8, paddingHorizontal: horizontalPad }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backHit}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={28} color="#86A7D2" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text allowFontScaling={false} style={[styles.headerTitle, { fontFamily: theme.semiBoldFont }]}>
            {t('progress.achievementsBadgesTitle')}
          </Text>
          <View style={styles.headerSubtitleRow}>
            <Text
              allowFontScaling={false}
              style={[styles.headerSubtitleCount, { fontFamily: theme.regularFont }]}
            >
              {unlockedCount}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.headerSubtitle, { fontFamily: theme.regularFont }]}
            >
              {t('progress.achievementsUnlockedSuffix', { total: TOTAL_ACHIEVEMENTS })}
            </Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          {
            paddingHorizontal: horizontalPad,
            paddingBottom: 24 + insets.bottom + (showExpandToggle ? 74 : 24),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {visibleAchievements.map((item) => (
            <AchievementGridCell
              key={item.key}
              item={item}
              gridSizes={gridSizes}
              fontFamily={theme.regularFont}
              onPress={() => navigation.navigate('AchievementDetail', { achievementKey: item.key })}
            />
          ))}
        </View>

        {showExpandToggle ? (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.viewAllBtnOuter}
            onPress={() => setExpanded((v) => !v)}
          >
            <LinearGradient
              colors={['#006EFF', '#00B8FF']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.viewAllBtn}
            >
              <Text allowFontScaling={false} style={[styles.viewAllTxt, { fontFamily: theme.semiBoldFont }]}>
                {expanded ? t('progress.viewLess') : t('progress.viewAll')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PG.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingBottom: 12,
  },
  backHit: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 24,
    textAlign: 'center',
    includeFontPadding: false,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSubtitleCount: {
    fontSize: 12,
    color: '#FFFFFF',
    lineHeight: 16,
  },
  headerSubtitle: {
    fontSize: 12,
    color: PG.muted,
    lineHeight: 16,
  },
  headerSpacer: {
    width: 32,
    height: 44,
  },
  scroll: { flex: 1 },
  scrollInner: {
    paddingTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: COL_GAP,
    rowGap: ROW_GAP,
    width: '100%',
  },
  gridCell: {
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  lockedCard: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  lockedLabelWrap: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedLabelSingle: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 24,
    fontSize: 11,
    color: '#FFFFFF',
    lineHeight: 14,
    textAlign: 'center',
  },
  lockedLabelLine: {
    fontSize: 11,
    color: '#FFFFFF',
    lineHeight: 14,
    textAlign: 'center',
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
    width: '100%',
  },
  tickWrap: {
    position: 'absolute',
    top: 2,
    right: -4,
  },
  itemLabel: {
    marginTop: 2,
    fontSize: 11,
    color: '#FFFFFF',
    lineHeight: 14,
    textAlign: 'center',
    width: '100%',
  },
  viewAllBtnOuter: {
    marginTop: 28,
    width: '100%',
  },
  viewAllBtn: {
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAllTxt: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 19,
  },
})
