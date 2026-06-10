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
import { ShieldHeroRow } from '../components/ShieldHeroRow'
import { ShieldProportionalFrame } from '../components/ShieldProportionalFrame'
import {
  fetchXpLeaderboard,
  type LeaderboardEntry,
  type LeaderboardScope,
} from '../lib/leaderboardApi'
import { resolveUploadUrl } from '../lib/mediaUrl'
import type { ProgressTabStackParamList } from '../navigation/types'
import { useTranslation } from 'react-i18next'

const SPARKLES = require('../../assets/ranking/sparkles.png')
const UPLOAD_ICON = require('../../assets/ranking/upload.svg')
const LIGHTNING_SVG = require('../../assets/achivemnets/lightning.svg')
const XEVO_BLUE_WORDMARK = require('../../assets/actiities/xevoblue.png')

const PG = {
  bg: '#050A18',
  card: '#041641',
  segmentActive: '#0059FF',
  segmentBorder: '#0066FF',
  muted: '#86A7D2',
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

function rankTint(rank: number): string | null {
  if (rank === 1) return 'rgba(255, 215, 0, 0.22)'
  if (rank === 2) return 'rgba(200, 212, 232, 0.28)'
  if (rank === 3) return 'rgba(205, 127, 50, 0.28)'
  return null
}

function RankMedal({ rank }: { rank: number }) {
  const tint = rankTint(rank)
  if (rank > 3) {
    return (
      <View style={styles.rankNumWrap}>
        <Text allowFontScaling={false} style={styles.rankNumTxt}>
          {rank}
        </Text>
      </View>
    )
  }
  return (
    <View style={styles.rankMedalWrap}>
      <ShieldProportionalFrame
        maxWidth={40}
        maxHeight={52}
        coachName=""
        showName={false}
        showScore={false}
        showFlag={false}
        showCrest
        showPillarScores={false}
        variant="small"
      />
      {tint ? <View style={[styles.rankMedalTint, { backgroundColor: tint }]} /> : null}
    </View>
  )
}

function LeaderboardRow({
  entry,
  theme,
}: {
  entry: LeaderboardEntry
  theme: { regularFont: string; mediumFont: string; semiBoldFont: string }
}) {
  const avatarUri = resolveUploadUrl(entry.image)
  return (
    <View style={styles.listRow}>
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
        {entry.areaLocation ? (
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.listLocation, { fontFamily: theme.regularFont }]}
          >
            {entry.areaLocation}
          </Text>
        ) : null}
      </View>
      <View style={styles.listXpCol}>
        <LocalSvgAsset assetModule={LIGHTNING_SVG} width={16} height={16} />
        <Text allowFontScaling={false} style={[styles.listXp, { fontFamily: theme.semiBoldFont }]}>
          {formatXpLabel(entry.totalXp)}
        </Text>
      </View>
    </View>
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
  const listEntries = rankedEntries.slice(1)
  const topImageUri = resolveUploadUrl(topPlayer?.image ?? null)
  const topXpLabel = topPlayer ? formatXpLabel(topPlayer.totalXp) : '—'

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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingHorizontal: horizontalPad,
          paddingBottom: 32 + insets.bottom + 74,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.segmentTrack}>
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

        <View style={styles.colHead}>
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

        <View style={styles.colDivider} />

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#00B8FF" />
          </View>
        ) : topPlayer ? (
          <>
            <View style={[styles.heroBlock, { width: heroRowW }]}>
              <Image
                source={SPARKLES}
                style={[styles.sparkles, { width: heroRowW, height: Math.round(heroRowW * 0.42) }]}
                resizeMode="contain"
              />
              <View style={styles.heroShieldLayer}>
                <ShieldHeroRow
                  rowWidth={heroRowW}
                  coachName={topPlayer.name}
                  coachImageUri={topImageUri}
                  onSharePress={() => void onShareTop()}
                  shareAccessibilityLabel={t('progress.rankingShare')}
                  shareIconModule={UPLOAD_ICON}
                  shareIconSize={32}
                  maxHeightFrac={0.34}
                  maxShieldHeightCap={260}
                  shieldCardProps={{
                    variant: 'profileSettings',
                    showName: true,
                    showScore: true,
                    scoreLabel: 'XP',
                    scoreValue: topXpLabel,
                    showFlag: true,
                    showCrest: false,
                    showPillarScores: false,
                    flagCode: topPlayer.areaLocation,
                    brandLogoSource: XEVO_BLUE_WORDMARK,
                    topNameScale: 1.85,
                  }}
                />
              </View>
            </View>

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

            <View style={styles.listDivider} />

            {listEntries.map((entry) => (
              <LeaderboardRow key={entry.userId} entry={entry} theme={theme} />
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
    backgroundColor: PG.segmentActive,
    borderColor: PG.segmentActive,
  },
  segmentPillIdle: {
    backgroundColor: PG.card,
    borderColor: PG.segmentBorder,
  },
  segmentTxt: {
    fontSize: 11,
    textAlign: 'center',
  },
  segmentTxtOn: {
    color: '#FFFFFF',
  },
  segmentTxtOff: {
    color: '#00B8FF',
  },
  colHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
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
  colDivider: {
    height: 1,
    backgroundColor: PG.divider,
    marginBottom: 18,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  heroBlock: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
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
  heroRankNum: {
    fontSize: 42,
    color: PG.gold,
    textAlign: 'center',
    lineHeight: 48,
    marginTop: 4,
  },
  heroName: {
    fontSize: 22,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 28,
    marginTop: 2,
  },
  heroLocation: {
    fontSize: 13,
    color: PG.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 8,
  },
  listDivider: {
    height: 1,
    backgroundColor: PG.divider,
    marginVertical: 16,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  rankMedalWrap: {
    width: 44,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankMedalTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
  },
  rankNumWrap: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  listName: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  listLocation: {
    fontSize: 11,
    color: PG.muted,
    lineHeight: 15,
    marginTop: 2,
  },
  listXpCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
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
