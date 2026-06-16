import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
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
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../context'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import { ProfileHeroScoreBlock } from '../components/ProfileHeroScoreBlock'
import {
  fetchXpLeaderboard,
  type LeaderboardEntry,
  type LeaderboardScope,
} from '../lib/leaderboardApi'
import { resolveUploadUrl } from '../lib/mediaUrl'
import type { ProgressTabStackParamList } from '../navigation/types'
import { useTranslation } from 'react-i18next'

const SPARKLES = require('../../assets/ranking/sparkles.png')
const SPARKLES_WIDTH_SCALE = 1.15
const SPARKLES_HEIGHT_RATIO = 0.42
const UPLOAD_ICON = require('../../assets/ranking/upload.svg')
const LIGHTNING_SVG = require('../../assets/achivemnets/lightning.svg')
const GOLD_BADGE = require('../../assets/ranking/goldbadge.png')
const SILVER_BADGE = require('../../assets/ranking/silverbadge.png')
const COPPER_BADGE = require('../../assets/ranking/copperbadge.png')

const PG = {
  bg: '#050A18',
  card: '#041641',
  segmentActiveFill: '#041641',
  segmentIdleBorder: '#0E2969',
  segmentActiveText: '#00B8FF',
  segmentIdleText: '#1F6CD0',
  muted: '#86A7D2',
  colHeadBg: 'rgba(4, 18, 43, 0.9)',
  colHeadStroke: 'rgba(0, 102, 255, 0.25)',
  divider: 'rgba(0, 89, 255, 0.35)',
  gold: '#FFD700',
  silver: '#C8D4E8',
  bronze: '#CD7F32',
}

type ScopeTab = { key: LeaderboardScope; labelKey: string }

const SCOPE_TABS: ScopeTab[] = [
  { key: 'global', labelKey: 'progress.rankingScopeGlobal' },
  { key: 'country', labelKey: 'progress.rankingScopeCountry' },
  { key: 'city', labelKey: 'progress.rankingScopeCity' },
  { key: 'friends', labelKey: 'progress.rankingScopeFriends' },
]

type Nav = NativeStackNavigationProp<ProgressTabStackParamList, 'Ranking'>

function formatXpLabel(xp: number): string {
  return `${Math.max(0, Math.floor(xp)).toLocaleString()} XP`
}

function rankBadgeSource(rank: number): number | null {
  if (rank === 1) return GOLD_BADGE
  if (rank === 2) return SILVER_BADGE
  if (rank === 3) return COPPER_BADGE
  return null
}

function RankMedal({ rank }: { rank: number }) {
  const badge = rankBadgeSource(rank)
  if (badge != null) {
    return (
      <View style={styles.rankBadgeWrap}>
        <Image source={badge} style={styles.rankBadgeImg} resizeMode="contain" />
      </View>
    )
  }
  return (
    <View style={styles.rankNumWrap}>
      <Text allowFontScaling={false} style={styles.rankNumTxt}>
        {rank}
      </Text>
    </View>
  )
}

function LeaderboardRow({
  entry,
  theme,
  onPress,
}: {
  entry: LeaderboardEntry
  theme: { regularFont: string; mediumFont: string; semiBoldFont: string }
  onPress: () => void
}) {
  const avatarUri = resolveUploadUrl(entry.image)
  const locationLabel = entry.areaLocation?.trim() ?? ''
  return (
    <TouchableOpacity style={styles.listRow} onPress={onPress} activeOpacity={0.75}>
      <RankMedal rank={entry.rank} />
      <View style={styles.avatarWrap}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} resizeMode="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]} />
        )}
      </View>
      <View style={styles.listBody}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.listName, { fontFamily: theme.semiBoldFont }]}
        >
          {entry.name}
        </Text>
        {locationLabel ? (
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.listLocation, { fontFamily: theme.regularFont }]}
          >
            {locationLabel}
          </Text>
        ) : null}
      </View>
      <View style={styles.listXpCol}>
        <LocalSvgAsset assetModule={LIGHTNING_SVG} width={16} height={16} />
        <Text allowFontScaling={false} style={[styles.listXp, { fontFamily: theme.semiBoldFont }]}>
          {formatXpLabel(entry.totalXp)}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

export function RankingScreen() {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const { width: winW } = useWindowDimensions()

  const [scope, setScope] = useState<LeaderboardScope>('global')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const horizontalPad = Math.max(20, insets.left, insets.right)
  const heroRowW = winW - horizontalPad * 2

  const load = useCallback(async (nextScope: LeaderboardScope) => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetchXpLeaderboard(nextScope)
      if (!res.ok) {
        setEntries([])
        setLoadError(res.error)
        return
      }
      setEntries(res.data.entries)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(scope)
  }, [load, scope])

  const rankedEntries = useMemo(() => {
    const xp = (entry: LeaderboardEntry) => Number(entry.totalXp) || 0
    const sorted = [...entries].sort(
      (a, b) => xp(b) - xp(a) || a.name.localeCompare(b.name)
    )
    return sorted.map((entry, index) => ({ ...entry, rank: index + 1 }))
  }, [entries])

  const emptyMessageKey = useMemo(() => {
    if (scope === 'friends') return 'progress.rankingEmptyFriends'
    if (scope === 'country' || scope === 'city') return 'progress.rankingEmptyScoped'
    return 'progress.rankingEmpty'
  }, [scope])

  const topPlayer = rankedEntries[0] ?? null
  const topImageUri = resolveUploadUrl(topPlayer?.image ?? null)

  const onShareTop = useCallback(async () => {
    if (!topPlayer) return
    try {
      await Share.share({
        message: `${topPlayer.name} is #${topPlayer.rank} on the Xevo XP leaderboard with ${formatXpLabel(topPlayer.totalXp)}!`,
      })
    } catch {
      /* dismissed */
    }
  }, [topPlayer])

  return (
    <View style={styles.root}>
      <View style={styles.stickyHead}>
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
          <Text allowFontScaling={false} style={[styles.headerTitle, { fontFamily: theme.semiBoldFont }]}>
            {t('progress.ranking')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.segmentTrack, { paddingHorizontal: horizontalPad }]}>
          {SCOPE_TABS.map((tab) => {
            const active = scope === tab.key
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.segmentPill,
                  active ? styles.segmentPillActive : styles.segmentPillIdle,
                ]}
                onPress={() => setScope(tab.key)}
                activeOpacity={0.88}
              >
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.segmentTxt,
                    active ? styles.segmentTxtOn : styles.segmentTxtOff,
                    { fontFamily: theme.mediumFont },
                  ]}
                >
                  {t(tab.labelKey)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={[styles.colHead, { paddingHorizontal: horizontalPad }]}>
          <Text allowFontScaling={false} style={[styles.colHeadTxt, styles.colNo, { fontFamily: theme.mediumFont }]}>
            {t('progress.rankingColumnNo')}
          </Text>
          <Text allowFontScaling={false} style={[styles.colHeadTxt, styles.colPlayer, { fontFamily: theme.mediumFont }]}>
            {t('progress.rankingColumnPlayer')}
          </Text>
          <Text allowFontScaling={false} style={[styles.colHeadTxt, styles.colScore, { fontFamily: theme.mediumFont }]}>
            {t('progress.rankingColumnScore')}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingHorizontal: horizontalPad,
          paddingTop: 16,
          paddingBottom: 32 + insets.bottom + 74,
        }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#00B8FF" />
          </View>
        ) : topPlayer ? (
          <>
            <TouchableOpacity
              style={[styles.heroBlock, { width: heroRowW }]}
              activeOpacity={0.92}
              onPress={() =>
                topPlayer &&
                navigation.navigate('LeaderboardPlayer', {
                  userId: topPlayer.userId,
                  name: topPlayer.name,
                  image: topPlayer.image,
                  areaLocation: topPlayer.areaLocation,
                  totalXp: topPlayer.totalXp,
                  rank: topPlayer.rank,
                  overallScore: topPlayer.overallScore,
                })
              }
            >
              <Image
                source={SPARKLES}
                style={[
                  styles.sparkles,
                  {
                    width: Math.round(heroRowW * SPARKLES_WIDTH_SCALE),
                    height: Math.round(heroRowW * SPARKLES_HEIGHT_RATIO * SPARKLES_WIDTH_SCALE),
                  },
                ]}
                resizeMode="contain"
              />
              <View style={styles.heroShieldLayer}>
                <ProfileHeroScoreBlock
                  horizontalPadding={horizontalPad}
                  premiumLabelNudgeUp={4}
                  marginBottom={0}
                  showScoreCard={false}
                  playerOverride={{
                    name: topPlayer.name,
                    imageUri: topImageUri,
                    areaLocation: topPlayer.areaLocation,
                  }}
                  onSharePress={() => void onShareTop()}
                  shareAccessibilityLabel={t('progress.rankingShare')}
                  shareIconModule={UPLOAD_ICON}
                  shareIconSize={32}
                />
              </View>
            </TouchableOpacity>

            <View style={styles.heroCaption}>
              <Text allowFontScaling={false} style={[styles.heroRankNum, { fontFamily: theme.semiBoldFont }]}>
                1
              </Text>
              <Text allowFontScaling={false} style={[styles.heroName, { fontFamily: theme.semiBoldFont }]}>
                {topPlayer.name}
              </Text>
              {topPlayer.areaLocation ? (
                <Text allowFontScaling={false} style={[styles.heroLocation, { fontFamily: theme.regularFont }]}>
                  {topPlayer.areaLocation}
                </Text>
              ) : null}
            </View>

            <View style={styles.listDivider} />

            {rankedEntries.map((entry) => (
              <LeaderboardRow
                key={entry.userId}
                entry={entry}
                theme={theme}
                onPress={() =>
                  navigation.navigate('LeaderboardPlayer', {
                    userId: entry.userId,
                    name: entry.name,
                    image: entry.image,
                    areaLocation: entry.areaLocation,
                    totalXp: entry.totalXp,
                    rank: entry.rank,
                    overallScore: entry.overallScore,
                  })
                }
              />
            ))}
          </>
        ) : (
          <View style={styles.emptyWrap}>
            <Text allowFontScaling={false} style={[styles.emptyTxt, { fontFamily: theme.regularFont }]}>
              {loadError ?? t(emptyMessageKey)}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PG.bg,
  },
  stickyHead: {
    backgroundColor: PG.bg,
    zIndex: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingBottom: 10,
  },
  backHit: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
  },
  headerSpacer: {
    width: 32,
    height: 44,
  },
  scroll: { flex: 1 },
  segmentTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
    marginTop: 4,
  },
  segmentPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  segmentPillActive: {
    backgroundColor: PG.segmentActiveFill,
    borderColor: PG.segmentActiveFill,
  },
  segmentPillIdle: {
    backgroundColor: 'transparent',
    borderColor: PG.segmentIdleBorder,
  },
  segmentTxt: {
    fontSize: 11,
    textAlign: 'center',
  },
  segmentTxtOn: {
    color: PG.segmentActiveText,
  },
  segmentTxtOff: {
    color: PG.segmentIdleText,
  },
  colHead: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: PG.colHeadBg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: PG.colHeadStroke,
    borderBottomColor: PG.colHeadStroke,
    paddingVertical: 10,
  },
  colHeadTxt: {
    fontSize: 11,
    color: PG.muted,
    letterSpacing: 0.3,
  },
  colNo: {
    width: 44,
  },
  colPlayer: {
    flex: 1,
  },
  colScore: {
    minWidth: 108,
    textAlign: 'right',
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  heroBlock: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  sparkles: {
    position: 'absolute',
    alignSelf: 'center',
    opacity: 0.95,
  },
  heroShieldLayer: {
    zIndex: 2,
    width: '100%',
    alignItems: 'center',
  },
  heroCaption: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  heroRankNum: {
    fontSize: 18,
    color: PG.gold,
    textAlign: 'center',
    lineHeight: 22,
  },
  heroName: {
    fontSize: 22,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 28,
    marginTop: 4,
  },
  heroLocation: {
    fontSize: 13,
    color: PG.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  listDivider: {
    height: 1,
    backgroundColor: PG.divider,
    marginVertical: 16,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  rankBadgeWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rankBadgeImg: {
    width: 40,
    height: 40,
  },
  rankNumWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rankNumTxt: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#07256D',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    backgroundColor: '#0A2F6E',
  },
  listBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    minHeight: 44,
  },
  listName: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  listLocation: {
    fontSize: 13,
    color: PG.muted,
    lineHeight: 18,
    marginTop: 4,
  },
  listXpCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    marginTop: 12,
  },
  listXp: {
    fontSize: 12,
    color: '#FFFFFF',
    lineHeight: 15,
  },
  emptyWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyTxt: {
    fontSize: 14,
    color: PG.muted,
    textAlign: 'center',
  },
})
