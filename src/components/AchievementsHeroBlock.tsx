import React, { useContext, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { ThemeContext } from '../context'
import { useSessionData } from '../context/SessionDataContext'
import { ShieldProportionalFrame, fitShieldInBox } from './ShieldProportionalFrame'
import { LocalSvgAsset } from './LocalSvgAsset'
import { useTranslation } from 'react-i18next'
import { proLibraryChrome } from '../theme/proLibraryChrome'
import type { ActivitySession } from '../lib/activitySession'

const LIGHTNING_SVG = require('../../assets/achivemnets/lightning.svg')

const SMALL_SHIELD_CAP_REF_WIN_W = 430
const DEFAULT_HORIZONTAL_PAD = 20
const HERO_GAP = 10

/** XP / level come from `/profile/gamification/state`. */
const WIN_RATE_PLACEHOLDER = 67
const WIN_STREAK_PLACEHOLDER = 6

const { accent: SHIELD_GLOW } = proLibraryChrome

type Props = {
  /** Must match parent scroll `paddingHorizontal`. */
  horizontalPadding?: number
  activities?: ActivitySession[]
}

function completedCount(sessions: ActivitySession[]): number {
  return sessions.filter((s) => s.status === 'completed').length
}

/**
 * Achievements tab hero — shield (You page format) + profile XP + match stats.
 */
export function AchievementsHeroBlock({
  horizontalPadding = DEFAULT_HORIZONTAL_PAD,
  activities = [],
}: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { width: winW } = useWindowDimensions()
  const { profileName, profileImageUri, profileAreaLocation, xpInLevel, xpGoal, playerLevel, playerTier } =
    useSessionData()
  const [rowWidth, setRowWidth] = useState(0)

  const contentW = rowWidth > 0 ? rowWidth : Math.max(1, winW - horizontalPadding * 2)

  const heroH = useMemo(() => Math.min(220, Math.max(160, winW * 0.42)), [winW])
  const shieldMaxW = useMemo(() => {
    const current = Math.min(contentW * 0.44, winW * 0.44)
    const refHeroRowInnerW = SMALL_SHIELD_CAP_REF_WIN_W - DEFAULT_HORIZONTAL_PAD * 2
    const refApproxColW = (refHeroRowInnerW - HERO_GAP) / 2
    const reference = Math.min(refApproxColW, SMALL_SHIELD_CAP_REF_WIN_W * 0.44)
    return Math.min(current, reference)
  }, [contentW, winW])

  const shieldSize = useMemo(
    () => fitShieldInBox(shieldMaxW, heroH),
    [shieldMaxW, heroH]
  )

  /** Shield hugs the left margin; gap to the right matches the screen margin. */
  const shieldColW = shieldSize.width
  const shieldInfoGap = horizontalPadding
  const infoColW = Math.max(1, contentW - shieldInfoGap - shieldColW)

  const xpPct = Math.max(0, Math.min(100, Math.round((xpInLevel / Math.max(1, xpGoal)) * 100)))
  const matchCount = completedCount(activities)

  return (
    <View
      style={styles.block}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width
        if (w > 0 && Math.abs(w - rowWidth) > 1) setRowWidth(w)
      }}
    >
      <View style={[styles.heroRow, { gap: shieldInfoGap }]}>
        <View style={[styles.shieldCol, { width: shieldColW }]}>
          <View style={[styles.shieldGlow, { height: shieldSize.height, width: shieldColW }]}>
            <ShieldProportionalFrame
              maxWidth={shieldMaxW}
              maxHeight={heroH}
              style={styles.shieldFrame}
              variant="small"
              coachName={profileName?.trim() ?? ''}
              coachImageUri={profileImageUri}
              flagCode={profileAreaLocation}
              showName={false}
              showScore={false}
              showCrest={false}
              showFlag
              showPillarScores
            />
          </View>
        </View>

        <View style={[styles.infoCol, { width: infoColW, minHeight: heroH }]}>
          <View style={styles.infoTop}>
            <Text
              allowFontScaling={false}
              numberOfLines={2}
              style={[styles.profileName, { fontFamily: theme.semiBoldFont }]}
            >
              {profileName ?? ''}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.premiumLabel, { fontFamily: theme.mediumFont }]}
            >
              {t('common.premium')}
            </Text>
            <View style={styles.levelRow}>
              <Text
                allowFontScaling={false}
                style={[styles.levelMuted, { fontFamily: theme.regularFont }]}
              >
                {t('progress.achievementsLevelPrefix', { level: playerLevel })}{' '}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.levelTier, { fontFamily: theme.regularFont }]}
              >
                {playerTier}
              </Text>
            </View>

            <View style={styles.xpLabelRow}>
              <View style={styles.xpLeft}>
                <LocalSvgAsset assetModule={LIGHTNING_SVG} width={18} height={18} />
                <Text
                  allowFontScaling={false}
                  style={[styles.xpAmount, { fontFamily: theme.semiBoldFont }]}
                >
                  {t('progress.achievementsXp', { xp: xpInLevel.toLocaleString() })}
                </Text>
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.xpGoal, { fontFamily: theme.regularFont }]}
              >
                {xpGoal.toLocaleString()}
              </Text>
            </View>
            <View style={styles.xpBarRow}>
              <View style={styles.xpTrack}>
                <View style={[styles.xpFill, { width: `${xpPct}%` }]}>
                  <LinearGradient
                    colors={['#FF6A00', '#FFBB00']}
                    locations={[0, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.statsBox}>
            <View style={styles.statCol}>
              <Text
                allowFontScaling={false}
                style={[styles.statLabel, { fontFamily: theme.regularFont }]}
              >
                {t('progress.statMatches')}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statValue, { fontFamily: theme.semiBoldFont }]}
              >
                {matchCount}
              </Text>
            </View>
            <View style={styles.statCol}>
              <Text
                allowFontScaling={false}
                style={[styles.statLabel, { fontFamily: theme.regularFont }]}
              >
                {t('progress.statWinRate')}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statValue, { fontFamily: theme.semiBoldFont }]}
              >
                {t('progress.statWinRateValue', { rate: WIN_RATE_PLACEHOLDER })}
              </Text>
            </View>
            <View style={styles.statCol}>
              <Text
                allowFontScaling={false}
                style={[styles.statLabel, { fontFamily: theme.regularFont }]}
              >
                {t('progress.statWinStreak')}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statValue, { fontFamily: theme.semiBoldFont }]}
              >
                {WIN_STREAK_PLACEHOLDER}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  block: {
    width: '100%',
    paddingTop: 18,
    marginBottom: 20,
    overflow: 'hidden',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    width: '100%',
  },
  shieldCol: {
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
  },
  shieldGlow: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    borderRadius: 4,
    ...Platform.select({
      ios: {
        shadowColor: SHIELD_GLOW,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.75,
        shadowRadius: 6,
      },
      android: {
        elevation: 0,
      },
      default: {},
    }),
  },
  shieldFrame: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  infoCol: {
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  infoTop: {
    width: '100%',
  },
  profileName: {
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 22,
    marginBottom: 2,
  },
  premiumLabel: {
    fontSize: 12,
    color: '#00BBFF',
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  levelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 4,
  },
  levelMuted: {
    fontSize: 11,
    color: '#86A7D2',
    lineHeight: 14,
  },
  levelTier: {
    fontSize: 11,
    color: '#FFFFFF',
    lineHeight: 14,
  },
  xpLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    width: '100%',
  },
  xpLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  xpAmount: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  xpBarRow: {
    width: '100%',
  },
  xpTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#07256D',
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpGoal: {
    fontSize: 12,
    lineHeight: 18,
    color: '#336AB3',
    textAlign: 'right',
  },
  statsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#041641',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  statLabel: {
    fontSize: 11,
    color: '#86A7D2',
    marginBottom: 2,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 22,
    textAlign: 'center',
  },
})
