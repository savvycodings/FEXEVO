import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,

  ActivityIndicator,
  useWindowDimensions,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../context'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import { ShieldProportionalFrame, fitShieldInBox } from '../components/ShieldProportionalFrame'
import { ProfileActionRow, ProfileStatRow } from '../components/profile/ProfileActions'
import { formatCount } from '../lib/formatCount'
import { FriendActionButton } from '../components/FriendActionButton'
import { mapApiToMetrics, ProfileRatingDashboard } from '../components/ProfileRatingDashboard'
import {
  fetchPlayerOverallScore,
  fetchPlayerRatingCategories,
  fetchPlayerRecentVideos,
  fetchPublicPlayerProfile,
  type PlayerRecentVideo,
} from '../lib/leaderboardPlayerApi'
import { resolveUploadUrl } from '../lib/mediaUrl'
import { DOMAIN } from '../../constants'
import type { LeaderboardPlayerParams, MainStackParamList } from '../navigation/types'
import { Header } from '../components/Header'
import { MainTabBarChrome } from '../components/MainTabBarChrome'
import { useTranslation } from 'react-i18next'

const BD_ICON_SVG = require('../../assets/coachs/bdicon.svg')
const SHARE_ICON_SVG = require('../../assets/coachs/shareicon.svg')

const SHARE_ICON_SIZE = 22
const GALLERY_SIZE = 80
const META_MUTED = 'rgba(160, 180, 210, 0.95)'

const API_ROOT = DOMAIN.replace(/\/+$/, '')

function videoUri(path: string): string {
  if (path.startsWith('http')) return path
  return `${API_ROOT}${path}`
}

/** Registered in both the Progress tab stack and the main stack; only goBack() is used. */
type Route = RouteProp<{ LeaderboardPlayer: LeaderboardPlayerParams }, 'LeaderboardPlayer'>
type Nav = NativeStackNavigationProp<{ LeaderboardPlayer: LeaderboardPlayerParams }, 'LeaderboardPlayer'>

export function LeaderboardPlayerScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const insets = useSafeAreaInsets()
  const { theme } = useContext(ThemeContext)
  const { t } = useTranslation()
  const styles = useMemo(() => getStyles(theme), [theme])

  const { userId, name, image, areaLocation, totalXp, rank, overallScore } = route.params

  const [loading, setLoading] = useState(true)
  const [headline, setHeadline] = useState('Player')
  const [birthDisplay, setBirthDisplay] = useState<string | null>(null)
  const [locationDisplay, setLocationDisplay] = useState(areaLocation?.trim() || null)
  const [displayName, setDisplayName] = useState(name)
  const [imageUri, setImageUri] = useState(resolveUploadUrl(image))
  const [score, setScore] = useState<number | null>(overallScore)
  const [ratingCategories, setRatingCategories] = useState<
    { id: string; thisWeek: number; lastWeek: number }[]
  >([])
  const [recentVideos, setRecentVideos] = useState<PlayerRecentVideo[]>([])

  const horizontalPad = Math.max(20, insets.left, insets.right)
  const { width: winW } = useWindowDimensions()
  const shieldBox = useMemo(
    () => fitShieldInBox(Math.min(170, (winW - horizontalPad * 2) * 0.42), 230),
    [winW, horizontalPad],
  )

  const ratingMetrics = useMemo(() => mapApiToMetrics(ratingCategories), [ratingCategories])

  const screenHeader = (
    <View style={[styles.screenHeaderWrap, { paddingHorizontal: horizontalPad }]}>
      <View style={styles.screenHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backHit}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={28} color="#86A7D2" />
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
      </View>
    </View>
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [profile, categories, overall, videos] = await Promise.all([
        fetchPublicPlayerProfile(userId),
        fetchPlayerRatingCategories(userId),
        overallScore == null ? fetchPlayerOverallScore(userId) : Promise.resolve(overallScore),
        fetchPlayerRecentVideos(userId, 5),
      ])

      if (profile) {
        setDisplayName(profile.user.name || name)
        setImageUri(resolveUploadUrl(profile.user.image ?? image))
        setLocationDisplay(profile.profile.areaLocation?.trim() || areaLocation?.trim() || null)
        setHeadline(profile.profile.headline || 'Player')
        setBirthDisplay(profile.profile.birthDisplay)
      }

      setRatingCategories(categories)
      setRecentVideos(videos)
      if (overall != null) setScore(overall)
    } finally {
      setLoading(false)
    }
  }, [userId, name, image, areaLocation, overallScore])

  useEffect(() => {
    void load()
  }, [load])

  const onShare = useCallback(async () => {
    try {
      const loc = locationDisplay ? `\n${locationDisplay}` : ''
      await Share.share({
        message: `${displayName}${loc}\n#${rank} on the Xevo leaderboard · ${totalXp} XP`,
      })
    } catch {
      /* dismissed */
    }
  }, [displayName, locationDisplay, rank, totalXp])

  if (loading) {
    return (
      <View style={styles.root}>
        {screenHeader}
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#00B8FF" />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {screenHeader}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          { paddingHorizontal: horizontalPad, paddingBottom: 32 + insets.bottom + 74 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <View style={styles.shareRow}>
          <TouchableOpacity
            onPress={() => void onShare()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={t('progress.rankingShare')}
          >
            <LocalSvgAsset assetModule={SHARE_ICON_SVG} width={SHARE_ICON_SIZE} height={SHARE_ICON_SIZE} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroRow}>
          <ShieldProportionalFrame
            maxWidth={shieldBox.width}
            maxHeight={shieldBox.height}
            variant="small"
            coachName={displayName}
            coachImageUri={imageUri}
            flagCode={(locationDisplay || null) as never}
            showName={false}
            showScore
            scoreLabel={t('common.score')}
            scoreValue={score != null ? String(score) : '—'}
            showFlag
            showCrest={false}
            showPillarScores={false}
          />
          <View style={styles.heroText}>
            <Text allowFontScaling={false} style={[styles.heroName, { fontFamily: theme.regularFont }]} numberOfLines={2}>
              {displayName}
            </Text>
            {headline ? (
              <Text allowFontScaling={false} style={[styles.heroHeadline, { fontFamily: theme.regularFont }]} numberOfLines={1}>
                {headline}
              </Text>
            ) : null}
            {locationDisplay ? (
              <View style={styles.heroLocation}>
                <Ionicons name="location-outline" size={18} color="#4DA6FF" />
                <Text allowFontScaling={false} style={[styles.heroLocationText, { fontFamily: theme.regularFont }]} numberOfLines={1}>
                  {locationDisplay}
                </Text>
              </View>
            ) : null}
            <ProfileStatRow
              items={[
                { value: `#${rank}`, label: t('common.ranking') },
                { value: formatCount(totalXp), label: t('common.xp') },
              ]}
            />
          </View>
        </View>

        <ProfileActionRow>
          <FriendActionButton userId={userId} name={displayName} />
        </ProfileActionRow>

        {recentVideos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryScroll}
            nestedScrollEnabled
          >
            {recentVideos.map((video) => (
              <View key={video.analysisId} style={styles.galleryThumb}>
                <Video
                  source={{ uri: videoUri(video.videoPath) }}
                  style={{ width: GALLERY_SIZE, height: GALLERY_SIZE }}
                  resizeMode={ResizeMode.COVER}
                  useNativeControls={false}
                  isLooping={false}
                  shouldPlay={false}
                />
                <View style={styles.galleryPlayOverlay} pointerEvents="none">
                  <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.92)" />
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={[styles.galleryEmpty, { fontFamily: theme.regularFont }]}>
            {t('progress.rankingPlayerNoVideos')}
          </Text>
        )}

        {birthDisplay ? (
          <View style={styles.personalBlock}>
            <View style={styles.personalMeta}>
              <View style={styles.metaLine}>
                <LocalSvgAsset assetModule={BD_ICON_SVG} width={18} height={18} />
                <Text style={styles.metaText}>{birthDisplay}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <ProfileRatingDashboard metrics={ratingMetrics} />
      </ScrollView>
    </View>
  )
}

function getStyles(theme: {
  backgroundColor?: string
  mediumFont?: string
  regularFont?: string
  semiBoldFont?: string
}) {
  return StyleSheet.create({
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
    heroText: { flex: 1, minWidth: 0, gap: 6 },
    heroName: { color: '#FFFFFF', fontSize: 22, flexShrink: 1 },
    heroHeadline: { color: '#86A7D2', fontSize: 15, marginTop: -4 },
    heroLocation: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    heroLocationText: { color: '#86A7D2', fontSize: 15, flexShrink: 1 },
    root: {
      flex: 1,
      backgroundColor: '#050A18',
    },
    screenHeaderWrap: {
      paddingTop: 8,
      paddingBottom: 6,
    },
    screenHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
    },
    backHit: {
      width: 32,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerSpacer: {
      width: 32,
      height: 44,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: 6,
    },
    scroll: {
      flex: 1,
    },
    scrollInner: {},
    galleryScroll: {
      paddingVertical: 4,
      paddingRight: 8,
      marginTop: 20,
    },
    galleryThumb: {
      borderRadius: 12,
      overflow: 'hidden',
      marginRight: 12,
      position: 'relative',
      backgroundColor: '#000',
    },
    galleryPlayOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.18)',
    },
    galleryEmpty: {
      marginTop: 20,
      color: META_MUTED,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      alignSelf: 'stretch',
    },
    personalBlock: {
      marginTop: 20,
      alignItems: 'center',
      alignSelf: 'stretch',
    },
    personalMeta: {
      marginTop: 0,
      alignItems: 'center',
      alignSelf: 'stretch',
    },
    metaLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 4,
    },
    metaText: {
      color: '#FFFFFF',
      fontFamily: theme.regularFont ?? 'System',
      fontSize: 15,
    },
  })
}

/**
 * Main-stack entry (Friends › Ranking rows): the same profile with the app header above it and
 * the tab bar below, so it opens on top of the People screen and Back returns there.
 */
export function MainStackLeaderboardPlayerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList, 'LeaderboardPlayer'>>()
  return (
    <View style={{ flex: 1, backgroundColor: '#050A18' }}>
      <Header
        flatOverlay
        onProPress={() => navigation.navigate('ProSubscription')}
        onSettingsPress={() => navigation.navigate('ProfileSettings')}
        onNotificationsPress={() => navigation.navigate('Notifications')}
      />
      <View style={{ flex: 1 }}>
        <LeaderboardPlayerScreen />
      </View>
      <MainTabBarChrome />
    </View>
  )
}
