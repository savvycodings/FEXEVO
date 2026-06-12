import React, { useContext, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native'
import { ThemeContext } from '../context'
import { useSessionData } from '../context/SessionDataContext'
import { ShieldProportionalFrame, fitShieldInBox } from './ShieldProportionalFrame'
import { LocalSvgAsset } from './LocalSvgAsset'
import { useTranslation } from 'react-i18next'

const SCORE_BG = require('../../assets/aicoach/scorepng.png')
const SMALL_SHIELD_CAP_REF_WIN_W = 430
const DEFAULT_HORIZONTAL_PAD = 20
const HERO_GAP = 10

export type ProfileHeroPlayerOverride = {
  name: string
  imageUri?: string | null
  areaLocation?: string | null
  score?: number | null
}

type Props = {
  /** Must match parent scroll `paddingHorizontal` (You / My Coach use 20). */
  horizontalPadding?: number
  /** Nudge “Premium” slightly closer to the name (My Students hero). */
  premiumLabelNudgeUp?: number
  /** When set, shows this player instead of the signed-in profile (e.g. leaderboard #1). */
  playerOverride?: ProfileHeroPlayerOverride
  marginBottom?: number
  marginTop?: number
  /** When false, only the shield column is shown (ranking #1 hero). */
  showScoreCard?: boolean
  onSharePress?: () => void
  shareAccessibilityLabel?: string
  shareIconModule?: number
  shareIconSize?: number
  /** Load shield pillar scores for another user (leaderboard player profile). */
  ratingUserId?: string
  /** You tab — shield flush left, score beside it, share icon inline top-right. */
  youPageLayout?: boolean
}

const YOU_SHARE_SLOT_MIN = 36
const YOU_SCORE_NUDGE_RIGHT = 14

/**
 * Shield + score hero row (You / Profile tab). Shared with My Coach so layout stays identical.
 */
export function ProfileHeroScoreBlock({
  horizontalPadding = DEFAULT_HORIZONTAL_PAD,
  premiumLabelNudgeUp = 0,
  playerOverride,
  marginBottom = 20,
  marginTop = 0,
  showScoreCard = true,
  onSharePress,
  shareAccessibilityLabel = 'Share',
  shareIconModule,
  shareIconSize = 32,
  ratingUserId,
  youPageLayout = false,
}: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { width: winW } = useWindowDimensions()
  const { profileName, profileImageUri, overallPillarScore, profileAreaLocation } = useSessionData()
  const [rowWidth, setRowWidth] = useState(0)

  const displayName = playerOverride?.name?.trim() || profileName?.trim() || ''
  const displayImageUri = playerOverride?.imageUri ?? profileImageUri
  const displayAreaLocation = playerOverride?.areaLocation ?? profileAreaLocation
  const displayScore = playerOverride
    ? playerOverride.score != null
      ? playerOverride.score
      : 54
    : overallPillarScore != null
      ? overallPillarScore
      : 54

  const contentW = rowWidth > 0 ? rowWidth : Math.max(1, winW - horizontalPadding * 2)
  const colW = Math.max(1, (contentW - HERO_GAP) / 2)

  const heroH = useMemo(() => Math.min(220, Math.max(160, winW * 0.42)), [winW])
  const shieldMaxW = useMemo(() => {
    const refHeroRowInnerW = SMALL_SHIELD_CAP_REF_WIN_W - DEFAULT_HORIZONTAL_PAD * 2
    const refApproxColW = (refHeroRowInnerW - HERO_GAP) / 2
    const reference = Math.min(refApproxColW, SMALL_SHIELD_CAP_REF_WIN_W * 0.44)
    if (youPageLayout) {
      return Math.min(contentW * 0.46, winW * 0.44, reference)
    }
    const current = Math.min(colW, winW * 0.44)
    return Math.min(current, reference)
  }, [colW, winW, youPageLayout, contentW])

  /** Square score card — width matches column, capped so it aligns with shield height. */
  const shieldFit = useMemo(
    () => fitShieldInBox(shieldMaxW, heroH),
    [shieldMaxW, heroH]
  )

  const shareSlotW = youPageLayout
    ? Math.max(YOU_SHARE_SLOT_MIN, shareIconSize + 8)
    : YOU_SHARE_SLOT_MIN

  const scoreSize = youPageLayout
    ? Math.min(heroH, Math.max(120, contentW - shieldFit.width - shareSlotW))
    : Math.min(colW, heroH)

  const showShare = onSharePress != null && shareIconModule != null

  const scoreCard = showScoreCard ? (
    <View style={[styles.scoreCard, { width: scoreSize, height: scoreSize }]}>
      <Image source={SCORE_BG} style={styles.scoreImg} resizeMode="contain" />
      <View style={styles.scoreOverlay}>
        <View style={styles.scoreTopCluster}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.scoreUserName, { fontFamily: theme.semiBoldFont }]}
          >
            {displayName}
          </Text>
          <Text
            allowFontScaling={false}
            style={[
              styles.scorePremiumLabel,
              premiumLabelNudgeUp > 0 && { marginTop: -premiumLabelNudgeUp },
              { fontFamily: theme.mediumFont },
            ]}
          >
            {t('common.premium')}
          </Text>
        </View>
        <View style={styles.scoreCenterCluster}>
          <Text
            allowFontScaling={false}
            style={[styles.scoreNumber, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}
          >
            {displayScore}
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
  ) : null

  return (
    <View
      style={[styles.block, { marginBottom, marginTop }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width
        if (w > 0 && Math.abs(w - rowWidth) > 1) setRowWidth(w)
      }}
    >
      <View
        style={[
          styles.heroRow,
          youPageLayout ? styles.heroRowYou : { width: contentW },
          !showScoreCard && styles.heroRowShieldOnly,
        ]}
      >
        <View
          style={[
            styles.shieldCol,
            youPageLayout ? styles.shieldColYou : { width: colW },
            youPageLayout && { width: shieldFit.width },
          ]}
        >
          <View
            style={[
              styles.shieldSlot,
              { height: heroH },
              youPageLayout ? styles.shieldSlotYou : null,
              youPageLayout ? { width: shieldFit.width } : { width: colW },
            ]}
          >
            <ShieldProportionalFrame
              maxWidth={shieldFit.width}
              maxHeight={heroH}
              style={youPageLayout ? styles.shieldFrameYou : undefined}
              variant="small"
              coachName={displayName}
              coachImageUri={displayImageUri}
              flagCode={displayAreaLocation}
              showName={false}
              showScore={false}
              showCrest={false}
              showFlag
              showPillarScores
              ratingUserId={ratingUserId}
            />
          </View>
        </View>
        {showScoreCard && youPageLayout ? (
          <View style={styles.scoreCenterLane}>
            <View style={styles.scoreNudgeRight}>{scoreCard}</View>
          </View>
        ) : showScoreCard ? (
          <View style={[styles.scoreCol, { width: colW }]}>{scoreCard}</View>
        ) : null}
        {youPageLayout && showShare ? (
          <TouchableOpacity
            onPress={onSharePress}
            style={[styles.shareInlineYou, { width: shareSlotW }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={shareAccessibilityLabel}
          >
            <LocalSvgAsset assetModule={shareIconModule} width={shareIconSize} height={shareIconSize} />
          </TouchableOpacity>
        ) : null}
      </View>
      {!youPageLayout && showShare ? (
        <TouchableOpacity
          onPress={onSharePress}
          style={styles.shareHit}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={shareAccessibilityLabel}
        >
          <LocalSvgAsset assetModule={shareIconModule} width={shareIconSize} height={shareIconSize} />
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  block: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  shareHit: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: HERO_GAP,
    width: '100%',
  },
  heroRowYou: {
    width: '100%',
    gap: 0,
  },
  heroRowShieldOnly: {
    justifyContent: 'center',
  },
  shieldCol: {
    alignItems: 'center',
  },
  shieldColYou: {
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  shieldSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  shieldSlotYou: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    overflow: 'visible',
  },
  shieldFrameYou: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  scoreCol: {
    alignItems: 'center',
  },
  scoreCenterLane: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  scoreNudgeRight: {
    transform: [{ translateX: YOU_SCORE_NUDGE_RIGHT }],
  },
  shareInlineYou: {
    flexShrink: 0,
    alignSelf: 'flex-start',
    paddingTop: 10,
    minHeight: 32,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
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
