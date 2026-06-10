import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  Image,
  ActivityIndicator,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../context'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import { ProfileHeroScoreBlock } from '../components/ProfileHeroScoreBlock'
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
import type { ProgressTabStackParamList } from '../navigation/types'
import { useTranslation } from 'react-i18next'

const UNFOLLOW_ICON = require('../../assets/youpage/unfollowicon.svg')
const BOOK_VIDEO_ICON = require('../../assets/youpage/bookvideocall.svg')
const PERSONAL_ICON = require('../../assets/coachs/personalicon.png')
const BD_ICON_SVG = require('../../assets/coachs/bdicon.svg')
const SHARE_ICON_SVG = require('../../assets/coachs/shareicon.svg')

const SHARE_ICON_SIZE = 22
const GALLERY_SIZE = 80
const ACCENT = '#00B8FF'
const PILL_INACTIVE = '#0E1830'
const OUTLINE_BORDER = 'rgba(0, 184, 255, 0.45)'
const META_MUTED = 'rgba(160, 180, 210, 0.95)'

const API_ROOT = DOMAIN.replace(/\/+$/, '')

function videoUri(path: string): string {
  if (path.startsWith('http')) return path
  return `${API_ROOT}${path}`
}

type Route = RouteProp<ProgressTabStackParamList, 'LeaderboardPlayer'>
type Nav = NativeStackNavigationProp<ProgressTabStackParamList, 'LeaderboardPlayer'>

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
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.screenHeaderTitle, { fontFamily: theme.semiBoldFont }]}
        >
          {displayName}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      {headline || locationDisplay ? (
        <View style={styles.screenHeaderSubtitleRow}>
          {headline ? (
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.screenHeaderSubtitle, { fontFamily: theme.mediumFont }]}
            >
              {headline}
            </Text>
          ) : null}
          {locationDisplay ? (
            <>
              {headline ? <View style={styles.headerSubtitleGap} /> : null}
              <Ionicons name="location-outline" size={16} color={ACCENT} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.screenHeaderLocation, { fontFamily: theme.regularFont }]}
              >
                {locationDisplay}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}
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

        <ProfileHeroScoreBlock
          horizontalPadding={horizontalPad}
          premiumLabelNudgeUp={4}
          marginBottom={0}
          ratingUserId={userId}
          playerOverride={{
            name: displayName,
            imageUri: imageUri,
            areaLocation: locationDisplay,
            score,
          }}
        />

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnFilled]} activeOpacity={0.85}>
            <Image source={PERSONAL_ICON} style={styles.perfilIcon} resizeMode="contain" />
            <Text style={styles.actionBtnTextFilled}>Perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} activeOpacity={0.85}>
            <LocalSvgAsset assetModule={UNFOLLOW_ICON} width={16} height={16} />
            <Text style={styles.actionBtnTextOutline}>Unfollow</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} activeOpacity={0.85}>
            <LocalSvgAsset assetModule={BOOK_VIDEO_ICON} width={16} height={16} />
            <Text style={[styles.actionBtnTextOutline, styles.actionBtnTextNarrow]} numberOfLines={2}>
              Book Video Call
            </Text>
          </TouchableOpacity>
        </View>

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
    screenHeaderSubtitle: {
      fontSize: 14,
      lineHeight: 18,
      color: ACCENT,
      flexShrink: 1,
    },
    screenHeaderSubtitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      marginTop: 2,
      marginBottom: 4,
      paddingHorizontal: 36,
      gap: 6,
    },
    headerSubtitleGap: {
      width: 12,
    },
    screenHeaderLocation: {
      fontSize: 14,
      lineHeight: 18,
      color: ACCENT,
      flexShrink: 1,
      maxWidth: '46%',
    },
    backHit: {
      width: 32,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    screenHeaderTitle: {
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
    actionRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 20,
    },
    actionBtn: {
      flex: 1,
      minWidth: 0,
      borderRadius: 20,
      paddingVertical: 12,
      paddingHorizontal: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    actionBtnFilled: {
      backgroundColor: PILL_INACTIVE,
    },
    actionBtnOutline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: OUTLINE_BORDER,
    },
    actionBtnTextFilled: {
      color: '#FFFFFF',
      fontFamily: theme.mediumFont ?? 'System',
      fontSize: 12,
    },
    perfilIcon: {
      width: 16,
      height: 16,
    },
    actionBtnTextOutline: {
      color: '#FFFFFF',
      fontFamily: theme.mediumFont ?? 'System',
      fontSize: 11,
      textAlign: 'center',
    },
    actionBtnTextNarrow: {
      flexShrink: 1,
    },
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
