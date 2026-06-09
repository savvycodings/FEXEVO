import React, { useContext, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { ThemeContext } from '../context'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import type { ProgressTabStackParamList } from '../navigation/types'
import { useTranslation } from 'react-i18next'

const BADGE_FIRST_MATCH = require('../../assets/achivemnets/firstmatch.png')
const BADGE_3_DAYS_STREAK = require('../../assets/achivemnets/3daysstreak.png')
const LOCKED_ACHIEVEMENT = require('../../assets/achivemnets/lockedachivment.png')
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
const LOCKED_NATIVE_W = 104
const LOCKED_NATIVE_H = 130
const TOTAL_ACHIEVEMENTS = 28

type AchievementItem =
  | { key: string; kind: 'unlocked'; image: number; labelKey: string }
  | { key: string; kind: 'locked'; image: number; labelKey: string }

const ACHIEVEMENTS: AchievementItem[] = [
  { key: 'first-match', kind: 'unlocked', image: BADGE_FIRST_MATCH, labelKey: 'progress.badgeFirstMatch' },
  {
    key: '3-days-streak',
    kind: 'unlocked',
    image: BADGE_3_DAYS_STREAK,
    labelKey: 'progress.badge3DaysStreak',
  },
  {
    key: 'tie-break-king',
    kind: 'locked',
    image: LOCKED_ACHIEVEMENT,
    labelKey: 'progress.badgeTieBreakKing',
  },
  { key: 'net-master', kind: 'locked', image: LOCKED_ACHIEVEMENT, labelKey: 'progress.badgeNetMaster' },
  {
    key: 'invincible-locked',
    kind: 'locked',
    image: LOCKED_ACHIEVEMENT,
    labelKey: 'progress.badgeInvincible',
  },
  {
    key: 'perfect-smash',
    kind: 'locked',
    image: LOCKED_ACHIEVEMENT,
    labelKey: 'progress.badgePerfectSmash',
  },
  {
    key: 'first-ia-analysis',
    kind: 'locked',
    image: LOCKED_ACHIEVEMENT,
    labelKey: 'progress.badgeFirstIaAnalysis',
  },
  { key: 'score-80', kind: 'locked', image: LOCKED_ACHIEVEMENT, labelKey: 'progress.badgeScore80' },
  {
    key: '7-days-streak',
    kind: 'locked',
    image: LOCKED_ACHIEVEMENT,
    labelKey: 'progress.badge7DaysStreak',
  },
]

type Nav = NativeStackNavigationProp<ProgressTabStackParamList>

function LockedCardLabel({
  label,
  fontFamily,
  emphasizeSecondLine = false,
}: {
  label: string
  fontFamily: string
  emphasizeSecondLine?: boolean
}) {
  const lines = label.split('\n')
  if (lines.length > 1) {
    return (
      <View style={styles.lockedLabelWrap}>
        <Text allowFontScaling={false} style={[styles.lockedLabelLine, { fontFamily }]}>
          {lines[0]}
        </Text>
        <Text
          allowFontScaling={false}
          style={[
            styles.lockedLabelLine,
            emphasizeSecondLine && styles.lockedLabelLineSecond,
            { fontFamily },
          ]}
        >
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

export function AllAchievementsScreen() {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const { width: winW } = useWindowDimensions()

  const horizontalPad = Math.max(20, insets.left, insets.right)
  const unlockedCount = ACHIEVEMENTS.filter((a) => a.kind === 'unlocked').length

  const gridSizes = useMemo(() => {
    const contentW = Math.max(1, winW - horizontalPad * 2)
    const colW = Math.floor((contentW - COL_GAP * (COLS - 1)) / COLS)
    const unlockedW = Math.floor(colW * 0.88)
    const unlockedH = Math.round((unlockedW * UNLOCKED_NATIVE_H) / UNLOCKED_NATIVE_W)
    const lockedW = colW
    const lockedH = Math.round((lockedW * LOCKED_NATIVE_H) / LOCKED_NATIVE_W)
    return { colW, unlockedW, unlockedH, lockedW, lockedH }
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
            paddingBottom: 24 + insets.bottom + 74,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {ACHIEVEMENTS.map((item) => (
            <View key={item.key} style={[styles.gridCell, { width: gridSizes.colW }]}>
              {item.kind === 'unlocked' ? (
                <>
                  <View style={[styles.unlockedSlot, { height: gridSizes.unlockedH }]}>
                    <Image
                      source={item.image}
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
                    style={[styles.itemLabel, { fontFamily: theme.regularFont }]}
                  >
                    {t(item.labelKey)}
                  </Text>
                </>
              ) : (
                <View
                  style={[
                    styles.lockedCard,
                    { width: gridSizes.lockedW, height: gridSizes.lockedH },
                  ]}
                >
                  <Image
                    source={item.image}
                    style={{ width: gridSizes.lockedW, height: gridSizes.lockedH }}
                    resizeMode="contain"
                  />
                  <LockedCardLabel
                    label={t(item.labelKey)}
                    fontFamily={theme.regularFont}
                    emphasizeSecondLine={item.key === 'tie-break-king'}
                  />
                </View>
              )}
            </View>
          ))}
        </View>

        <TouchableOpacity activeOpacity={0.9} style={styles.viewAllBtnOuter}>
          <LinearGradient
            colors={['#006EFF', '#00B8FF']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.viewAllBtn}
          >
            <Text allowFontScaling={false} style={[styles.viewAllTxt, { fontFamily: theme.semiBoldFont }]}>
              {t('progress.viewAll')}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
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
  lockedLabelLineSecond: {
    fontSize: 12,
    lineHeight: 15,
  },
  unlockedSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  tickWrap: {
    position: 'absolute',
    top: 2,
    right: -4,
  },
  itemLabel: {
    marginTop: -2,
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
