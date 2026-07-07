import React, { useCallback, useContext, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
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
import { profileImageSource } from '../lib/defaultProfilePicture'
import { fetchPendingCoachReviewIdForStudent } from '../lib/coachStudentPendingReview'
import { fetchStudentUploadsForCoach, type StudentUploadRow } from '../lib/coachStudentUploadsApi'
import { getMainStackNavigation } from '../lib/mainStackNavigation'
import { displayTrainShotTitle } from '../lib/trainShotDisplay'
import { DOMAIN } from '../../constants'

const BG = '#030A17'
const MUTED = '#86A7D2'
const WRONG = '#FF005D'
const GOOD = '#00FFC3'
const NEWVIDEO_SVG = require('../../assets/chat/newvideo.svg')
const PLAY_BUTTON_SVG = require('../../assets/mystudents/playbutton.svg')
const GOOD_COMMENT_ICON = require('../../assets/videoanalysis/good.svg')
const BAD_COMMENT_ICON = require('../../assets/videoanalysis/bad.svg')
const MIXED_COMMENT_ICON = require('../../assets/videoanalysis/badandgood.svg')

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
  reviewId: string | null
  videoPath: string
  title: string
  subtitle?: string | 'coach'
  score: number | null
  lastScore?: number
  comments?: number
  commentTone?: 'good' | 'bad' | 'both'
  status: 'good' | 'bad' | 'both' | 'coach'
}

function deriveCommentTone(
  goodCount: number,
  badCount: number
): UploadItem['commentTone'] {
  if (goodCount <= 0 && badCount <= 0) return undefined
  if (goodCount > 0 && badCount > 0) return 'both'
  if (badCount > 0) return 'bad'
  return 'good'
}

function mapUploadRow(row: {
  id: string
  kind: string
  reviewId: string | null
  videoPath: string
  title: string
  subtitle: string | null
  score: number | null
  lastScore: number | null
  commentCount: number
  goodCommentCount: number
  badCommentCount: number
}): UploadItem {
  const comments = row.commentCount > 0 ? row.commentCount : undefined
  const commentTone = deriveCommentTone(row.goodCommentCount, row.badCommentCount)
  let status: UploadItem['status'] = 'good'
  if (row.kind === 'coach_sent' || row.subtitle === 'coach') {
    status = 'coach'
  } else if (commentTone === 'both') {
    status = 'both'
  } else if (commentTone === 'bad') {
    status = 'bad'
  } else if (commentTone === 'good') {
    status = 'good'
  }
  return {
    id: row.id,
    reviewId: row.reviewId,
    videoPath: row.videoPath,
    title: displayTrainShotTitle({ strokeLabel: row.title, strokeName: row.title }),
    subtitle: row.subtitle === 'coach' ? 'coach' : row.subtitle ?? undefined,
    score: row.score,
    lastScore: row.lastScore ?? undefined,
    comments,
    commentTone,
    status,
  }
}

function videoUri(path: string): string {
  const base = DOMAIN.replace(/\/+$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

const WEEKDAY_BASE: Pick<ScheduleDay, 'key' | 'label'>[] = [
  { key: 'm', label: 'M' },
  { key: 'tu', label: 'T' },
  { key: 'w', label: 'W' },
  { key: 'th', label: 'T' },
  { key: 'f', label: 'F' },
  { key: 'sa', label: 'S' },
  { key: 'su', label: 'S' },
]

function mondayLocal(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

function formatScheduleTime(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Mon=0 … Sun=6 — highlight days with student uploads in the current calendar week. */
function buildWeeklyScheduleFromUploads(rows: StudentUploadRow[]): ScheduleDay[] {
  const mon = mondayLocal(new Date())
  const next = new Date(mon)
  next.setDate(mon.getDate() + 7)

  const latestByDay = new Map<number, Date>()
  for (const row of rows) {
    if (row.kind !== 'student_upload') continue
    const d = new Date(row.createdAt)
    if (Number.isNaN(d.getTime())) continue
    const t = d.getTime()
    if (t < mon.getTime() || t >= next.getTime()) continue
    const idx = (d.getDay() + 6) % 7
    const existing = latestByDay.get(idx)
    if (!existing || d > existing) latestByDay.set(idx, d)
  }

  return WEEKDAY_BASE.map((day, idx) => {
    const uploadAt = latestByDay.get(idx)
    return {
      ...day,
      active: !!uploadAt,
      time: uploadAt ? formatScheduleTime(uploadAt) : undefined,
    }
  })
}

const NEWVIDEO_ROW_H = 16
const NEWVIDEO_ROW_W = Math.round((72 / 13) * NEWVIDEO_ROW_H)

const UPLOAD_ROW_H = 96
const PROFILE_AVATAR_SIZE = 72

function UploadCommentIcon({ tone }: { tone: NonNullable<UploadItem['commentTone']> }) {
  if (tone === 'both') {
    return <LocalSvgAsset assetModule={MIXED_COMMENT_ICON} width={14} height={8} />
  }
  if (tone === 'bad') {
    return <LocalSvgAsset assetModule={BAD_COMMENT_ICON} width={8} height={8} />
  }
  return <LocalSvgAsset assetModule={GOOD_COMMENT_ICON} width={8} height={8} />
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
  onPress,
}: {
  item: UploadItem
  cardWidth: number
  fonts: { semiBoldFont: string; mediumFont: string; regularFont: string }
  t: (key: string, opts?: Record<string, unknown>) => string
  onPress?: () => void
}) {
  const thumbW = Math.max(76, Math.round(cardWidth * 0.25))
  const hasScore = typeof item.score === 'number'

  return (
    <Pressable
      style={[styles.uploadCard, { width: cardWidth }]}
      onPress={onPress}
      disabled={!onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
    >
      <View style={[styles.uploadThumbCol, { width: thumbW, minHeight: UPLOAD_ROW_H }]}>
        <Video
          source={{ uri: videoUri(item.videoPath) }}
          style={styles.uploadThumb}
          resizeMode={ResizeMode.COVER}
          useNativeControls={false}
          isLooping={false}
          shouldPlay={false}
        />
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
          {item.comments != null && item.comments > 0 && item.commentTone ? (
            <View style={styles.uploadCommentsPill}>
              <UploadCommentIcon tone={item.commentTone} />
              <Text allowFontScaling={false} style={[styles.uploadComments, { fontFamily: fonts.mediumFont }]}>
                {t('studentProfile.comments', { count: item.comments })}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.uploadScoreSection}>
          <View style={styles.uploadScoreBarRow}>
            {hasScore ? (
              <UploadScoreBar score={item.score!} lastScore={item.lastScore} />
            ) : (
              <View style={[styles.uploadScoreTrack, { justifyContent: 'center' }]}>
                <Text allowFontScaling={false} style={[styles.uploadScorePending, { fontFamily: fonts.semiBoldFont }]}>
                  —
                </Text>
              </View>
            )}
            <Text allowFontScaling={false} style={[styles.uploadScoreNum, { fontFamily: fonts.semiBoldFont }]}>
              {hasScore ? String(Math.round(item.score!)) : '—'}
            </Text>
          </View>
          <Text allowFontScaling={false} style={[styles.uploadScoreLabel, { fontFamily: fonts.regularFont }]}>
            {t('playlist.score')}
          </Text>
        </View>
      </View>
    </Pressable>
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
    pendingCoachReviewId: initialPendingCoachReviewId,
    showNewVideoBadge: _showNewVideoBadge,
  } = route.params

  const [pendingCoachReviewId, setPendingCoachReviewId] = useState<string | null>(
    typeof initialPendingCoachReviewId === 'string' && initialPendingCoachReviewId.trim().length > 0
      ? initialPendingCoachReviewId.trim()
      : null
  )
  const [uploadRows, setUploadRows] = useState<StudentUploadRow[]>([])
  const [uploadsLoading, setUploadsLoading] = useState(true)

  const uploads = useMemo(() => uploadRows.map(mapUploadRow), [uploadRows])
  const weeklySchedule = useMemo(() => buildWeeklyScheduleFromUploads(uploadRows), [uploadRows])

  const loadUploads = useCallback(async () => {
    setUploadsLoading(true)
    try {
      const rows = await fetchStudentUploadsForCoach(peerUserId)
      setUploadRows(rows)
    } finally {
      setUploadsLoading(false)
    }
  }, [peerUserId])

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void fetchPendingCoachReviewIdForStudent(peerUserId).then((id) => {
        if (!cancelled) setPendingCoachReviewId(id)
      })
      void loadUploads()
      return () => {
        cancelled = true
      }
    }, [peerUserId, loadUploads])
  )

  const showNewVideoRow = !!pendingCoachReviewId

  const focusKey = usePageFocusKey()

  const fonts = useMemo(
    () => ({
      regularFont: theme.regularFont,
      mediumFont: theme.mediumFont,
      semiBoldFont: theme.semiBoldFont,
    }),
    [theme.regularFont, theme.mediumFont, theme.semiBoldFont]
  )

  const peerAvatarSource = profileImageSource(peerImageUri)
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
      showNewVideoBadge: !!pendingCoachReviewId,
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
  ])

  const onOpenUpload = useCallback(
    (item: UploadItem) => {
      if (!item.reviewId) return
      const stack = getMainStackNavigation(navigation)
      if (stack) {
        stack.navigate('CoachReviewEditor', { reviewId: item.reviewId })
        return
      }
    },
    [navigation]
  )

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
            {showNewVideoRow ? (
              <View style={styles.studentMetaRow}>
                <View style={styles.newVideoAssetWrap}>
                  <LocalSvgAsset assetModule={NEWVIDEO_SVG} width={NEWVIDEO_ROW_W} height={NEWVIDEO_ROW_H} />
                </View>
              </View>
            ) : null}
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
            {weeklySchedule.map((day) => (
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
          {uploadsLoading ? (
            <ActivityIndicator color="#00BBFF" style={{ marginVertical: 20 }} />
          ) : uploads.length === 0 ? (
            <Text allowFontScaling={false} style={[styles.emptyUploads, { fontFamily: fonts.regularFont }]}>
              {t('studentProfile.noUploadsYet')}
            </Text>
          ) : (
            uploads.map((item) => (
              <UploadCard
                key={item.id}
                item={item}
                cardWidth={cardWidth}
                fonts={fonts}
                t={t}
                onPress={item.reviewId ? () => onOpenUpload(item) : undefined}
              />
            ))
          )}
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
    alignSelf: 'flex-start',
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
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
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
  emptyUploads: {
    color: 'rgba(232,240,255,0.55)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
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
  uploadScorePending: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
  },
})
