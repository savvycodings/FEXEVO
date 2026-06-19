import React, { useCallback, useContext, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../context'
import { vercel as defaultTheme } from '../theme'
import type { MyCoachTabStackParamList } from '../navigation/types'
import { MyCoachScoreRing } from './myCoach/ScoreRing'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import { ProLibraryGradientFrame } from '../components/ProLibraryGradientFrame'
import { EntranceView, usePageFocusKey } from '../components/PageEntrance'
import { useTranslation } from 'react-i18next'

const BG = '#030A17'
const MUTED = '#86A7D2'
const WRONG = '#FF005D'
const GOOD = '#00FFC3'
const FALLBACK_AVATAR = require('../../assets/coachs/img1.png')
const THUMB_PLACEHOLDER = require('../../assets/coachs/img1.png')
const CHAT_ICON = require('../../assets/mystudents/Frame.svg')
const NEWVIDEO_SVG = require('../../assets/chat/newvideo.svg')
const PLAY_BUTTON_SVG = require('../../assets/mystudents/playbutton.svg')

type Nav = NativeStackNavigationProp<MyCoachTabStackParamList, 'StudentProfile'>
type R = RouteProp<MyCoachTabStackParamList, 'StudentProfile'>

type ScheduleDay = {
  key: string
  label: string
  time?: string
  active?: boolean
}

type UploadItem = {
  id: string
  title: string
  subtitle?: string | 'coach'
  score: number
  lastScore?: number
  comments?: number
  status: 'mixed' | 'good' | 'coach'
}

const SCHEDULE: ScheduleDay[] = [
  { key: 'm', label: 'M' },
  { key: 'tu', label: 'T', time: '18:30', active: true },
  { key: 'w', label: 'W' },
  { key: 'th', label: 'T', time: '17:30', active: true },
  { key: 'f', label: 'F' },
  { key: 'sa', label: 'S', time: '14:30', active: true },
  { key: 'su', label: 'S' },
]

const PLACEHOLDER_UPLOADS: UploadItem[] = [
  { id: '1', title: 'Vibora', score: 92, lastScore: 78, comments: 16, status: 'mixed' },
  { id: '2', title: 'Overhead', subtitle: 'Voley', score: 36, lastScore: 42, comments: 2, status: 'good' },
  { id: '3', title: 'Save & Return', subtitle: 'coach', score: 86, lastScore: 80, status: 'coach' },
]

const NEWVIDEO_ROW_H = 16
const NEWVIDEO_ROW_W = Math.round((72 / 13) * NEWVIDEO_ROW_H)

const UPLOAD_ROW_H = 96
const PROFILE_AVATAR_SIZE = 72

function UploadOverlapDots() {
  return (
    <View style={styles.uploadOverlapDots}>
      <View style={[styles.uploadOverlapDot, styles.uploadOverlapDotWrong]} />
      <View style={[styles.uploadOverlapDot, styles.uploadOverlapDotGood]} />
    </View>
  )
}

function UploadScoreBar({ score, lastScore = 0 }: { score: number; lastScore?: number }) {
  const pct = Math.max(0, Math.min(100, score))
  const lastPct = Math.max(0, Math.min(100, lastScore))
  return (
    <View style={styles.uploadScoreTrack}>
      {lastPct > 0 ? <View style={[styles.uploadScoreFillLast, { width: `${lastPct}%` }]} /> : null}
      <View style={[styles.uploadScoreFill, { width: `${pct}%` }]} />
      <View style={[styles.uploadScoreMarker, { left: `${pct}%` }]}>
        <Text allowFontScaling={false} style={styles.uploadScoreMarkerGlyph}>
          ▼
        </Text>
      </View>
    </View>
  )
}

function UploadCard({
  item,
  cardWidth,
  fonts,
  t,
}: {
  item: UploadItem
  cardWidth: number
  fonts: { semiBoldFont: string; mediumFont: string; regularFont: string }
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const thumbW = Math.max(76, Math.round(cardWidth * 0.25))

  return (
    <View style={[styles.uploadCard, { width: cardWidth }]}>
      <View style={[styles.uploadThumbCol, { width: thumbW, minHeight: UPLOAD_ROW_H }]}>
        <Image source={THUMB_PLACEHOLDER} style={styles.uploadThumb} resizeMode="cover" />
        <View style={styles.uploadPlayOverlay} pointerEvents="none">
          <LocalSvgAsset assetModule={PLAY_BUTTON_SVG} width={24} height={28} />
        </View>
      </View>
      <View style={[styles.uploadWhitePanel, { minHeight: UPLOAD_ROW_H }]}>
        <View style={styles.uploadTopRow}>
          <View style={styles.uploadTitleCol}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.uploadTitle, { fontFamily: fonts.semiBoldFont }]}
            >
              {item.title}
            </Text>
            {item.subtitle === 'coach' ? (
              <View style={styles.uploadCoachRow}>
                <Ionicons name="person-circle-outline" size={13} color="#5B9DFF" />
                <Text allowFontScaling={false} style={[styles.uploadCoachTxt, { fontFamily: fonts.regularFont }]}>
                  {t('studentProfile.uploadByCoach')}
                </Text>
              </View>
            ) : item.subtitle ? (
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.uploadSubtitle, { fontFamily: fonts.regularFont }]}>
                {item.subtitle}
              </Text>
            ) : null}
          </View>
          {item.comments != null && item.comments > 0 ? (
            <View style={styles.uploadCommentsPill}>
              {item.status === 'mixed' ? (
                <UploadOverlapDots />
              ) : (
                <View style={[styles.uploadStatusDot, { backgroundColor: GOOD }]} />
              )}
              <Text allowFontScaling={false} style={[styles.uploadComments, { fontFamily: fonts.mediumFont }]}>
                {t('studentProfile.comments', { count: item.comments })}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.uploadScoreSection}>
          <View style={styles.uploadScoreBarRow}>
            <UploadScoreBar score={item.score} lastScore={item.lastScore} />
            <Text allowFontScaling={false} style={[styles.uploadScoreNum, { fontFamily: fonts.semiBoldFont }]}>
              {item.score}
            </Text>
          </View>
          <Text allowFontScaling={false} style={[styles.uploadScoreLabel, { fontFamily: fonts.regularFont }]}>
            Score
          </Text>
        </View>
      </View>
    </View>
  )
}

export function StudentProfileScreen() {
  const { t } = useTranslation()
  const { theme: ctx } = useContext(ThemeContext)
  const theme = ctx?.backgroundColor != null ? ctx : defaultTheme
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const route = useRoute<R>()
  const { width: winW } = useWindowDimensions()

  const {
    peerUserId,
    peerName,
    peerLocation,
    actualScore,
    lastScore,
    peerImageUri,
    pendingCoachReviewId,
    showNewVideoBadge,
  } = route.params

  const showNewVideoRow =
    showNewVideoBadge === true ||
    !!(typeof pendingCoachReviewId === 'string' && pendingCoachReviewId.trim().length > 0)

  const focusKey = usePageFocusKey()

  const fonts = useMemo(
    () => ({
      regularFont: theme.regularFont,
      mediumFont: theme.mediumFont,
      semiBoldFont: theme.semiBoldFont,
    }),
    [theme.regularFont, theme.mediumFont, theme.semiBoldFont]
  )

  const peerAvatarSource = peerImageUri ? { uri: peerImageUri } : FALLBACK_AVATAR
  const horizontalPad = 20
  const cardWidth = winW - horizontalPad * 2

  const onUploadVideo = useCallback(() => {
    navigation.navigate('StudentShotCategory', {
      peerUserId,
      peerName,
      peerLocation,
      actualScore,
      lastScore,
      peerImageUri,
      pendingCoachReviewId,
      showNewVideoBadge,
    })
  }, [
    navigation,
    peerUserId,
    peerName,
    peerLocation,
    actualScore,
    lastScore,
    peerImageUri,
    pendingCoachReviewId,
    showNewVideoBadge,
  ])

  const onOpenChat = useCallback(() => {
    navigation.navigate('CoachStudentChat', {
      peerUserId,
      peerName,
      peerLocation,
      actualScore,
      lastScore,
      peerImageUri,
      pendingCoachReviewId,
      showNewVideoBadge,
    })
  }, [navigation, peerUserId, peerName, peerLocation, actualScore, lastScore, peerImageUri, pendingCoachReviewId, showNewVideoBadge])

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom + 74 }}
        showsVerticalScrollIndicator={false}
      >
        <EntranceView index={0} replayKey={focusKey} style={[styles.topBar, { paddingHorizontal: horizontalPad }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
            style={styles.backRow}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel={t('coachChat.backToStudents')}
          >
            <Ionicons name="chevron-back" size={22} color={MUTED} />
            <Text allowFontScaling={false} style={[styles.backLabel, { fontFamily: fonts.regularFont }]}>
              {t('coachChat.backToStudents')}
            </Text>
          </TouchableOpacity>
          <ProLibraryGradientFrame
            style={styles.uploadBtnOuter}
            innerStyle={styles.uploadBtnInner}
            borderRadius={16}
            innerBorderRadius={14}
            strokeWidth={1.5}
            gradientVariant="default"
            innerShadow={false}
          >
            <TouchableOpacity style={styles.uploadBtnTouch} activeOpacity={0.88} onPress={() => void onUploadVideo()}>
              <Text allowFontScaling={false} style={[styles.uploadBtnTxt, { fontFamily: fonts.mediumFont }]}>
                {t('studentProfile.uploadNewVideo')}
              </Text>
            </TouchableOpacity>
          </ProLibraryGradientFrame>
        </EntranceView>

        <EntranceView index={1} replayKey={focusKey} style={[styles.legendBar, { paddingHorizontal: horizontalPad }]}>
          <Text allowFontScaling={false} style={[styles.studentLabel, { fontFamily: fonts.regularFont }]}>
            {t('coachChat.student')}
          </Text>
          <View style={styles.legendRight}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2AB4FF' }]} />
              <Text allowFontScaling={false} style={[styles.mutedLabel, { fontFamily: fonts.regularFont }]}>
                {t('myCoach.actualScore')}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3D58FF' }]} />
              <Text allowFontScaling={false} style={[styles.mutedLabel, { fontFamily: fonts.regularFont }]}>
                {t('myCoach.lastScore')}
              </Text>
            </View>
          </View>
        </EntranceView>

        <EntranceView index={2} replayKey={focusKey} style={[styles.studentCard, { paddingHorizontal: horizontalPad }]}>
          <Image source={peerAvatarSource} style={styles.studentAvatar} resizeMode="cover" />
          <View style={styles.studentInfo}>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.studentName, { fontFamily: fonts.semiBoldFont }]}>
              {peerName}
            </Text>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.studentLocation, { fontFamily: fonts.regularFont }]}>
              {peerLocation}
            </Text>
            <View style={styles.studentMetaRow}>
              <TouchableOpacity onPress={onOpenChat} hitSlop={8} accessibilityLabel={t('coachChat.chatTitle')}>
                <LocalSvgAsset assetModule={CHAT_ICON} width={16} height={16} />
              </TouchableOpacity>
              {showNewVideoRow ? (
                <View style={styles.newVideoAssetWrap}>
                  <LocalSvgAsset assetModule={NEWVIDEO_SVG} width={NEWVIDEO_ROW_W} height={NEWVIDEO_ROW_H} />
                </View>
              ) : null}
            </View>
          </View>
          <MyCoachScoreRing
            actualScore={actualScore}
            lastScore={lastScore}
            semiBoldFont={fonts.semiBoldFont}
            size={PROFILE_AVATAR_SIZE}
          />
        </EntranceView>

        <EntranceView index={3} replayKey={focusKey} style={[styles.section, { paddingHorizontal: horizontalPad }]}>
          <Text allowFontScaling={false} style={[styles.sectionTitleMuted, { fontFamily: fonts.semiBoldFont }]}>
            {t('studentProfile.weeklySchedule')}
          </Text>
          <View style={styles.scheduleRow}>
            {SCHEDULE.map((day) => (
              <View key={day.key} style={styles.scheduleCol}>
                <View style={[styles.scheduleDayBubble, day.active && styles.scheduleDayBubbleOn]}>
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.scheduleDayLabel,
                      { fontFamily: fonts.mediumFont },
                      day.active && styles.scheduleDayLabelOn,
                    ]}
                  >
                    {day.label}
                  </Text>
                </View>
                <Text allowFontScaling={false} style={[styles.scheduleTime, { fontFamily: fonts.regularFont }]}>
                  {day.time ?? ' '}
                </Text>
              </View>
            ))}
          </View>
        </EntranceView>

        <EntranceView index={4} replayKey={focusKey} style={[styles.section, { paddingHorizontal: horizontalPad }]}>
          <View style={styles.uploadsHead}>
            <Text allowFontScaling={false} style={[styles.sectionTitle, { fontFamily: fonts.semiBoldFont }]}>
              {t('studentProfile.uploads')}
            </Text>
            <View style={styles.uploadsLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: WRONG }]} />
                <Text allowFontScaling={false} style={[styles.legendText, { fontFamily: fonts.regularFont }]}>
                  {t('studentProfile.wrong')}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: GOOD }]} />
                <Text allowFontScaling={false} style={[styles.legendText, { fontFamily: fonts.regularFont }]}>
                  {t('studentProfile.good')}
                </Text>
              </View>
            </View>
          </View>
          {PLACEHOLDER_UPLOADS.map((item) => (
            <UploadCard key={item.id} item={item} cardWidth={cardWidth} fonts={fonts} t={t} />
          ))}
        </EntranceView>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 44,
    paddingTop: 28,
    paddingBottom: 12,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  backLabel: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 22,
    includeFontPadding: false,
  },
  uploadBtnOuter: {
    flexShrink: 0,
  },
  uploadBtnInner: {
    backgroundColor: '#041641',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  uploadBtnTouch: {
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  uploadBtnTxt: {
    color: '#00B8FF',
    fontSize: 14,
    lineHeight: 17,
  },
  legendBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginBottom: 24,
  },
  studentLabel: {
    color: MUTED,
    fontSize: 13,
  },
  mutedLabel: {
    color: MUTED,
    fontSize: 11,
  },
  legendRight: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: 'rgba(200,220,255,0.9)',
    fontSize: 11,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 22,
  },
  studentAvatar: {
    width: PROFILE_AVATAR_SIZE,
    height: PROFILE_AVATAR_SIZE,
    borderRadius: PROFILE_AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: '#2AB4FF',
  },
  studentInfo: {
    flex: 1,
    minWidth: 0,
  },
  studentName: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 20,
  },
  studentLocation: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 16,
    marginTop: 0,
  },
  studentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  newVideoAssetWrap: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.25)',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 14,
  },
  sectionTitleMuted: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 10,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scheduleCol: {
    alignItems: 'center',
    flex: 1,
  },
  scheduleDayBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  scheduleDayBubbleOn: {
    backgroundColor: '#00B8FF',
  },
  scheduleDayLabel: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 11,
  },
  scheduleDayLabelOn: {
    color: '#FFFFFF',
  },
  scheduleTime: {
    marginTop: 5,
    minHeight: 12,
    color: 'rgba(200,220,255,0.85)',
    fontSize: 8,
    textAlign: 'center',
  },
  uploadsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  uploadsLegend: {
    flexDirection: 'row',
    gap: 10,
  },
  uploadCard: {
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: '#000000',
    alignItems: 'stretch',
  },
  uploadThumbCol: {
    position: 'relative',
    backgroundColor: '#000000',
  },
  uploadThumb: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  uploadPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  uploadWhitePanel: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 13,
    paddingBottom: 8,
    paddingHorizontal: 10,
    justifyContent: 'space-between',
  },
  uploadTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  uploadTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  uploadTitle: {
    color: '#0F172A',
    fontSize: 14,
    lineHeight: 18,
  },
  uploadSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  uploadCoachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  uploadCoachTxt: {
    color: '#5B9DFF',
    fontSize: 10,
  },
  uploadCommentsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
    marginTop: 1,
  },
  uploadOverlapDots: {
    width: 18,
    height: 11,
    position: 'relative',
  },
  uploadOverlapDot: {
    position: 'absolute',
    top: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  uploadOverlapDotWrong: {
    left: 0,
    backgroundColor: '#FF005D',
    zIndex: 1,
  },
  uploadOverlapDotGood: {
    left: 8,
    backgroundColor: '#00FFC3',
    zIndex: 2,
  },
  uploadStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  uploadComments: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 12,
  },
  uploadScoreSection: {
    marginTop: 10,
  },
  uploadScoreBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  uploadScoreTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'visible',
    position: 'relative',
  },
  uploadScoreFillLast: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#3D58FF',
    borderRadius: 4,
  },
  uploadScoreFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#38BDF8',
    borderRadius: 4,
  },
  uploadScoreMarker: {
    position: 'absolute',
    top: -3,
    marginLeft: -5,
    width: 10,
    alignItems: 'center',
  },
  uploadScoreMarkerGlyph: {
    fontSize: 8,
    color: '#38BDF8',
    lineHeight: 10,
  },
  uploadScoreLabel: {
    marginTop: -3,
    color: '#64748B',
    fontSize: 10,
    lineHeight: 12,
    alignSelf: 'flex-start',
  },
  uploadScoreNum: {
    color: '#0F172A',
    fontSize: 22,
    lineHeight: 24,
    minWidth: 28,
    textAlign: 'right',
  },
})
