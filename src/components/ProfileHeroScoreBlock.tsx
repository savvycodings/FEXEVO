import React, { useContext, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Image, useWindowDimensions } from 'react-native'
import { ThemeContext } from '../context'
import { useSessionData } from '../context/SessionDataContext'
import { ShieldProportionalFrame } from './ShieldProportionalFrame'
import { useTranslation } from 'react-i18next'

const SCORE_BG = require('../../assets/aicoach/scorepng.png')
const SMALL_SHIELD_CAP_REF_WIN_W = 430
const DEFAULT_HORIZONTAL_PAD = 20
const HERO_GAP = 10

type Props = {
  /** Must match parent scroll `paddingHorizontal` (You / My Coach use 20). */
  horizontalPadding?: number
}

/**
 * Shield + score hero row (You / Profile tab). Shared with My Coach so layout stays identical.
 */
export function ProfileHeroScoreBlock({ horizontalPadding = DEFAULT_HORIZONTAL_PAD }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { width: winW } = useWindowDimensions()
  const { profileName, profileImageUri, overallPillarScore, profileAreaLocation } = useSessionData()
  const [rowWidth, setRowWidth] = useState(0)

  const contentW = rowWidth > 0 ? rowWidth : Math.max(1, winW - horizontalPadding * 2)
  const colW = Math.max(1, (contentW - HERO_GAP) / 2)

  const heroH = useMemo(() => Math.min(220, Math.max(160, winW * 0.42)), [winW])
  const shieldMaxW = useMemo(() => {
    const current = Math.min(colW, winW * 0.44)
    const refHeroRowInnerW = SMALL_SHIELD_CAP_REF_WIN_W - DEFAULT_HORIZONTAL_PAD * 2
    const refApproxColW = (refHeroRowInnerW - HERO_GAP) / 2
    const reference = Math.min(refApproxColW, SMALL_SHIELD_CAP_REF_WIN_W * 0.44)
    return Math.min(current, reference)
  }, [colW, winW])

  /** Square score card — width matches column, capped so it aligns with shield height. */
  const scoreSize = Math.min(colW, heroH)

  return (
    <View
      style={styles.block}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width
        if (w > 0 && Math.abs(w - rowWidth) > 1) setRowWidth(w)
      }}
    >
      <View style={[styles.heroRow, { width: contentW }]}>
        <View style={[styles.shieldCol, { width: colW }]}>
          <View style={[styles.shieldSlot, { height: heroH, width: colW }]}>
            <ShieldProportionalFrame
              maxWidth={shieldMaxW}
              maxHeight={heroH}
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
        <View style={[styles.scoreCol, { width: colW }]}>
          <View style={[styles.scoreCard, { width: scoreSize, height: scoreSize }]}>
            <Image source={SCORE_BG} style={styles.scoreImg} resizeMode="contain" />
            <View style={styles.scoreOverlay}>
              <View style={styles.scoreTopCluster}>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.scoreUserName, { fontFamily: theme.semiBoldFont }]}
                >
                  {profileName ?? ''}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[styles.scorePremiumLabel, { fontFamily: theme.mediumFont }]}
                >
                  {t('common.premium')}
                </Text>
              </View>
              <View style={styles.scoreCenterCluster}>
                <Text
                  allowFontScaling={false}
                  style={[styles.scoreNumber, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}
                >
                  {overallPillarScore != null ? overallPillarScore : 54}
                </Text>
                <Text allowFontScaling={false} style={[styles.scoreLabel, { fontFamily: theme.regularFont }]}>
                  {t('common.score')}
                </Text>
              </View>
              <View style={styles.scoreStatsRow}>
                <View style={styles.scoreStatCol}>
                  <Text
                    allowFontScaling={false}
                    style={[styles.scoreStatNumber, { fontFamily: theme.semiBoldFont }]}
                  >
                    0
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={[styles.scoreStatLabel, { fontFamily: theme.regularFont }]}
                  >
                    {t('common.following')}
                  </Text>
                </View>
                <View style={styles.scoreStatCol}>
                  <Text
                    allowFontScaling={false}
                    style={[styles.scoreStatNumber, { fontFamily: theme.semiBoldFont }]}
                  >
                    0
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={[styles.scoreStatLabel, { fontFamily: theme.regularFont }]}
                  >
                    {t('common.followers')}
                  </Text>
                </View>
              </View>
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
    marginBottom: 20,
    overflow: 'hidden',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: HERO_GAP,
    width: '100%',
  },
  shieldCol: {
    alignItems: 'center',
  },
  shieldSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scoreCol: {
    alignItems: 'center',
  },
  scoreCard: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  scoreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    transform: [{ translateX: -5 }],
  },
  scoreTopCluster: {
    alignItems: 'center',
    marginTop: 10,
  },
  scoreCenterCluster: {
    position: 'absolute',
    top: '50%',
    alignItems: 'center',
    transform: [{ translateY: -27 }],
  },
  scoreUserName: {
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 1,
  },
  scorePremiumLabel: {
    fontSize: 10,
    color: '#00BBFF',
    letterSpacing: 0.5,
  },
  scoreNumber: {
    fontSize: 36,
    color: '#FFFFFF',
    lineHeight: 40,
  },
  scoreLabel: {
    fontSize: 11,
    color: 'rgba(200,220,255,0.7)',
    marginTop: -1,
  },
  scoreStatsRow: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    gap: 20,
  },
  scoreStatCol: {
    alignItems: 'center',
  },
  scoreStatNumber: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  scoreStatLabel: {
    fontSize: 9,
    color: 'rgba(200,220,255,0.6)',
    marginTop: 1,
  },
})
