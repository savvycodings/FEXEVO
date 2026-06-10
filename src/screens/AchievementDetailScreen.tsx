import React, { useCallback, useContext, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Share,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { LinearGradient } from 'expo-linear-gradient'
import { ThemeContext } from '../context'
import { useSessionData } from '../context/SessionDataContext'
import { ShieldProportionalFrame } from '../components/ShieldProportionalFrame'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import {
  getAchievementByKey,
  getAchievementDetailImage,
  withAchievementState,
} from '../lib/achievementsCatalog'
import { claimAchievement } from '../lib/gamificationApi'
import type { ProgressTabStackParamList } from '../navigation/types'
import { useTranslation } from 'react-i18next'

const SHARE_ICON = require('../../assets/coachs/shareicon.svg')

const PG = {
  bg: '#050A18',
  muted: '#86A7D2',
  accent: '#00B8FF',
}

const BADGE_NATIVE_W = 86
const BADGE_NATIVE_H = 96

type Nav = NativeStackNavigationProp<ProgressTabStackParamList, 'AchievementDetail'>
type Route = RouteProp<ProgressTabStackParamList, 'AchievementDetail'>

function AchievementDetailScreen() {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { width: winW } = useWindowDimensions()
  const {
    profileName,
    profileImageUri,
    profileAreaLocation,
    overallPillarScore,
    claimedAchievementKeys,
    claimableAchievementKeys,
    refreshGamification,
  } = useSessionData()
  const [claiming, setClaiming] = useState(false)

  const achievement = useMemo(() => {
    const base = getAchievementByKey(route.params.achievementKey)
    if (!base) return undefined
    return withAchievementState(claimedAchievementKeys, claimableAchievementKeys).find(
      (a) => a.key === base.key
    )
  }, [route.params.achievementKey, claimedAchievementKeys, claimableAchievementKeys])

  const isClaimed = achievement?.kind === 'unlocked'
  const isClaimable = achievement?.kind === 'claimable'

  const horizontalPad = Math.max(20, insets.left, insets.right)

  const badgeSize = useMemo(() => {
    const w = Math.min(240, Math.round(winW * 0.52))
    const h = Math.round((w * BADGE_NATIVE_H) / BADGE_NATIVE_W)
    return { w, h }
  }, [winW])

  const shieldSize = useMemo(() => {
    const maxW = Math.min(150, Math.round(winW * 0.34))
    const maxH = Math.round(maxW * 1.28)
    return { maxW, maxH }
  }, [winW])

  const scoreDisplay =
    overallPillarScore != null ? String(overallPillarScore) : '54'

  const subtitleKey = isClaimed
    ? 'progress.achievementUnlocked'
    : isClaimable
      ? 'progress.achievementClaimable'
      : 'progress.achievementLocked'

  const subtitleColor = isClaimed ? PG.accent : isClaimable ? '#3DDC84' : PG.muted

  const primaryLabelKey = isClaimable ? 'progress.claim' : 'progress.achievementGotIt'

  async function onShare() {
    if (!achievement) return
    const title = t(achievement.labelKey).replace('\n', ' ')
    try {
      await Share.share({
        message: `${t('progress.achievementSharePrefix')} ${title} — ${t(achievement.descriptionKey)}`,
      })
    } catch {
      /* dismissed */
    }
  }

  const onPrimaryPress = useCallback(async () => {
    if (!achievement) {
      navigation.goBack()
      return
    }
    if (!isClaimable) {
      navigation.goBack()
      return
    }
    setClaiming(true)
    try {
      await claimAchievement(achievement.key)
      await refreshGamification()
    } finally {
      setClaiming(false)
    }
  }, [achievement, isClaimable, navigation, refreshGamification])

  if (!achievement) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12, paddingHorizontal: horizontalPad }]}>
        <Text allowFontScaling={false} style={[styles.fallbackText, { fontFamily: theme.regularFont }]}>
          {t('progress.achievementNotFound')}
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Text allowFontScaling={false} style={[styles.fallbackLink, { fontFamily: theme.mediumFont }]}>
            {t('common.back')}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          {
            paddingTop: 12,
            paddingHorizontal: horizontalPad,
            paddingBottom: 24 + insets.bottom + 80,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <View style={styles.titleSpacer} />
          <View style={styles.titleCenter}>
            <Text allowFontScaling={false} style={[styles.heroTitle, { fontFamily: theme.semiBoldFont }]}>
              {t('progress.achievementTitle')}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.heroSubtitle, { fontFamily: theme.regularFont, color: subtitleColor }]}
            >
              {t(subtitleKey)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => void onShare()}
            style={styles.shareHit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Share"
          >
            <LocalSvgAsset assetModule={SHARE_ICON} width={22} height={22} />
          </TouchableOpacity>
        </View>

        <View style={[styles.badgeWrap, { height: badgeSize.h + 16 }]}>
          <Image
            source={getAchievementDetailImage(achievement)}
            style={{
              width: isClaimed ? badgeSize.w : Math.round(badgeSize.w * 0.72),
              height: isClaimed ? badgeSize.h : Math.round(badgeSize.h * 0.72),
            }}
            resizeMode="contain"
          />
        </View>

        <View style={[styles.shieldWrap, { height: shieldSize.maxH }]}>
          <ShieldProportionalFrame
            maxWidth={shieldSize.maxW}
            maxHeight={shieldSize.maxH}
            variant="small"
            coachName={profileName?.trim() ?? ''}
            coachImageUri={profileImageUri}
            flagCode={profileAreaLocation}
            scoreValue={scoreDisplay}
            showName
            showScore
            showFlag
            showCrest={false}
            showPillarScores={false}
          />
        </View>

        <Text allowFontScaling={false} style={[styles.achievementName, { fontFamily: theme.semiBoldFont }]}>
          {t(achievement.labelKey)}
        </Text>
        <Text allowFontScaling={false} style={[styles.achievementDesc, { fontFamily: theme.regularFont }]}>
          {t(achievement.descriptionKey)}
        </Text>
      </ScrollView>

      <View
        style={[
          styles.claimBar,
          {
            paddingHorizontal: horizontalPad,
            paddingBottom: Math.max(16, insets.bottom + 8),
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => void onPrimaryPress()}
          style={styles.claimOuter}
          disabled={claiming}
        >
          <LinearGradient
            colors={isClaimable ? ['#006EFF', '#00B8FF'] : ['#1A3A6B', '#243B6E']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.claimBtn}
          >
            {claiming ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text allowFontScaling={false} style={[styles.claimTxt, { fontFamily: theme.semiBoldFont }]}>
                {t(primaryLabelKey)}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PG.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollInner: {
    alignItems: 'center',
  },
  titleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleSpacer: {
    width: 40,
    height: 44,
  },
  titleCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    gap: 2,
  },
  shareHit: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 28,
    color: '#FFFFFF',
    lineHeight: 34,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
  badgeWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  shieldWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  achievementName: {
    fontSize: 20,
    color: '#FFFFFF',
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 6,
  },
  achievementDesc: {
    fontSize: 14,
    color: PG.muted,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
  claimBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    backgroundColor: PG.bg,
  },
  claimOuter: {
    width: '100%',
  },
  claimBtn: {
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  claimTxt: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  fallbackText: {
    color: PG.muted,
    fontSize: 15,
    marginBottom: 12,
  },
  fallbackLink: {
    color: PG.accent,
    fontSize: 15,
  },
})

export { AchievementDetailScreen }
export default AchievementDetailScreen
