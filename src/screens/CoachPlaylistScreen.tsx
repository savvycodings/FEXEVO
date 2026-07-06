import React, { useCallback, useContext, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  useWindowDimensions,
  Alert,
  ActivityIndicator,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Video, ResizeMode } from 'expo-av'
import * as ImagePicker from 'expo-image-picker'
import { ThemeContext } from '../context'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import { ProLibraryGradientFrame } from '../components/ProLibraryGradientFrame'
import { useTranslation } from 'react-i18next'
import { DOMAIN } from '../../constants'
import { fetchCoachSubmissions, type CoachSubmission } from '../lib/coachSubmissionsApi'
import { displayTrainShotTitle } from '../lib/trainShotDisplay'
import { getMainStackNavigation } from '../lib/mainStackNavigation'

const PLAY_ICON = require('../../assets/playlist/playicon.svg')
const BIN_ICON = require('../../assets/playlist/binicon.svg')
const BANNER_ICON = require('../../assets/playlist/bannericon.svg')
const SEND_ICON = require('../../assets/playlist/sendicon.svg')

const API_ROOT = DOMAIN.replace(/\/+$/, '')

function videoUri(path: string): string {
  if (path.startsWith('http')) return path
  return `${API_ROOT}${path}`
}

type PlaylistCardItem = {
  reviewId: string
  title: string
  subtitle: string
  score: number
  videoPath: string
}

const ARROW_W = 5
const ARROW_H = 6
const TRACK_H = 8
const SCORE_LINE_H = 22
/** Vertically center score text with the progress track (below arrow lane). */
const SCORE_MARGIN_TOP = ARROW_H + 2 + (TRACK_H - SCORE_LINE_H) / 2

function ProgressBarArrow() {
  return (
    <Svg width={ARROW_W} height={ARROW_H} viewBox="0 0 5 6" fill="none">
      <Path
        d="M2.5 6L0.039 0.693C0.144 0.363 0.5 0 0.501 0H4.001C4.358 0 4.6 0.363 4.463 0.693L2.5 6Z"
        fill="#86A7D2"
      />
    </Svg>
  )
}

function DifficultyBar({ value, scoreFont }: { value: number; scoreFont: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <View style={styles.diffBarWrap}>
      <View style={styles.diffTrackRow}>
        <View style={styles.diffTrackCol}>
          <View style={styles.diffMarkerLane}>
            <View style={[styles.diffMarker, { left: `${pct}%`, marginLeft: -ARROW_W / 2 }]}>
              <ProgressBarArrow />
            </View>
          </View>
          <View style={styles.diffTrack}>
            <LinearGradient
              colors={['#00E676', '#FFD54F', '#FF9100']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.diffFill, { width: `${pct}%` }]}
            />
          </View>
        </View>
        <View style={styles.difficultyNumWrap}>
          <Text
            allowFontScaling={false}
            style={[styles.difficultyNum, { fontFamily: scoreFont }]}
          >
            {value}
          </Text>
        </View>
      </View>
    </View>
  )
}

function submissionToCardItem(submission: CoachSubmission): PlaylistCardItem {
  return {
    reviewId: submission.reviewId,
    title: displayTrainShotTitle({ strokeLabel: submission.shotLabel }),
    subtitle: submission.studentName,
    score:
      typeof submission.score === 'number'
        ? Math.max(0, Math.min(100, Math.round(submission.score)))
        : 0,
    videoPath: `/technique/video/${submission.techniqueVideoId}`,
  }
}

function PlaylistCard({
  item,
  cardWidth,
  fonts,
  scoreLabel,
  onPressThumbnail,
}: {
  item: PlaylistCardItem
  cardWidth: number
  fonts: { semiBoldFont: string; mediumFont: string; regularFont: string }
  scoreLabel: string
  onPressThumbnail: () => void
}) {
  const thumbH = Math.round(cardWidth * 1.04)

  return (
    <View style={[styles.playlistCard, { width: cardWidth }]}>
      <Pressable
        onPress={onPressThumbnail}
        style={[styles.thumbWrap, { height: thumbH }]}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <Video
          source={{ uri: videoUri(item.videoPath) }}
          style={styles.thumbImg}
          resizeMode={ResizeMode.COVER}
          useNativeControls={false}
          isLooping={false}
          shouldPlay={false}
        />
        <View style={styles.playOverlay} pointerEvents="none">
          <LocalSvgAsset assetModule={PLAY_ICON} width={44} height={54} />
        </View>
      </Pressable>

      <View style={styles.infoPanel}>
        <View style={styles.infoTopRow}>
          <View style={styles.titleCol}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.cardTitle, { fontFamily: fonts.semiBoldFont }]}
            >
              {item.title}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.cardSubtitle, { fontFamily: fonts.regularFont }]}
            >
              {item.subtitle}
            </Text>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity hitSlop={8} activeOpacity={0.75} accessibilityLabel="Delete">
              <LocalSvgAsset assetModule={BIN_ICON} width={24} height={24} />
            </TouchableOpacity>
            <TouchableOpacity hitSlop={8} activeOpacity={0.75} accessibilityLabel="Bookmark">
              <LocalSvgAsset assetModule={BANNER_ICON} width={24} height={24} />
            </TouchableOpacity>
            <TouchableOpacity hitSlop={8} activeOpacity={0.75} accessibilityLabel="Send">
              <LocalSvgAsset assetModule={SEND_ICON} width={24} height={24} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.difficultySection}>
          <DifficultyBar value={item.score} scoreFont={fonts.semiBoldFont} />
          <Text
            allowFontScaling={false}
            style={[styles.difficultyLabel, { fontFamily: fonts.regularFont }]}
          >
            {scoreLabel}
          </Text>
        </View>
      </View>
    </View>
  )
}

export function CoachPlaylistScreen() {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const { width: winW } = useWindowDimensions()

  const [submissions, setSubmissions] = useState<CoachSubmission[]>([])
  const [loading, setLoading] = useState(true)

  const horizontalPad = Math.max(20, insets.left, insets.right)
  const cardW = winW - horizontalPad * 2

  const fonts = useMemo(
    () => ({
      semiBoldFont: theme.semiBoldFont,
      mediumFont: theme.mediumFont,
      regularFont: theme.regularFont,
    }),
    [theme.semiBoldFont, theme.mediumFont, theme.regularFont]
  )

  const cardItems = useMemo(
    () => submissions.map((s) => submissionToCardItem(s)),
    [submissions]
  )

  const loadSubmissions = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchCoachSubmissions()
      setSubmissions(rows)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadSubmissions()
    }, [loadSubmissions])
  )

  const openCoachReview = useCallback(
    (reviewId: string) => {
      const stack = getMainStackNavigation(navigation as never)
      stack?.navigate('CoachReviewEditor', { reviewId })
    },
    [navigation]
  )

  const onUpload = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(t('commonAlerts.permissionNeeded'), t('coachFlow.permissionPhotos'))
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    })
    if (result.canceled || !result.assets?.[0]?.uri) return
    Alert.alert(t('coachFlow.videoSelected'), t('coachFlow.videoSelectedBody'), [
      { text: t('commonAlerts.ok') },
    ])
  }, [t])

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingHorizontal: horizontalPad,
          paddingTop: 20,
          paddingBottom: 32 + insets.bottom + 74,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text
            allowFontScaling={false}
            style={[styles.pageTitle, { fontFamily: theme.semiBoldFont }]}
          >
            {t('playlist.title')}
          </Text>
          <TouchableOpacity onPress={() => void onUpload()} activeOpacity={0.88}>
            <ProLibraryGradientFrame
              borderRadius={14}
              innerBorderRadius={12}
              strokeWidth={1.5}
              gradientVariant="default"
              innerShadow={false}
              innerStyle={styles.uploadBtnInner}
            >
              <Text
                allowFontScaling={false}
                style={[styles.uploadBtnText, { fontFamily: theme.mediumFont }]}
              >
                {t('studentProfile.uploadNewVideo')}
              </Text>
            </ProLibraryGradientFrame>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#00B8FF" />
          </View>
        ) : (
          cardItems.map((item) => (
            <PlaylistCard
              key={item.reviewId}
              item={item}
              cardWidth={cardW}
              fonts={fonts}
              scoreLabel={t('playlist.score')}
              onPressThumbnail={() => openCoachReview(item.reviewId)}
            />
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050A18',
  },
  scroll: {
    flex: 1,
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  pageTitle: {
    flex: 1,
    fontSize: 22,
    color: '#FFFFFF',
    lineHeight: 28,
  },
  uploadBtnInner: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#041641',
    borderRadius: 12,
  },
  uploadBtnText: {
    fontSize: 12,
    color: '#00B8FF',
    lineHeight: 16,
  },
  playlistCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#041641',
  },
  thumbWrap: {
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  infoPanel: {
    backgroundColor: '#041641',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 22,
  },
  infoTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#86A7D2',
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 4,
  },
  difficultySection: {
    marginTop: 14,
    overflow: 'visible',
  },
  diffBarWrap: {
    flex: 1,
    position: 'relative',
    overflow: 'visible',
  },
  diffTrackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    overflow: 'visible',
  },
  diffTrackCol: {
    flex: 1,
    minWidth: 0,
  },
  diffMarkerLane: {
    height: ARROW_H,
    marginBottom: 2,
    position: 'relative',
  },
  diffTrack: {
    width: '100%',
    height: TRACK_H,
    borderRadius: 4,
    backgroundColor: '#07256D',
    overflow: 'hidden',
    position: 'relative',
  },
  diffFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  diffMarker: {
    position: 'absolute',
    bottom: 0,
    width: ARROW_W,
    alignItems: 'center',
  },
  difficultyNumWrap: {
    minWidth: 28,
    marginTop: SCORE_MARGIN_TOP,
    zIndex: 2,
    elevation: 2,
    overflow: 'visible',
  },
  difficultyNum: {
    fontSize: 18,
    color: '#86A7D2',
    lineHeight: SCORE_LINE_H,
    textAlign: 'right',
  },
  difficultyLabel: {
    marginTop: -5,
    fontSize: 11,
    color: '#86A7D2',
    lineHeight: 14,
  },
})
