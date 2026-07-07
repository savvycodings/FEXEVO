import React, { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRoute, useNavigation, useFocusEffect, type RouteProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { MainTabParamList } from '../navigation/types'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Pressable,
  Platform,
  Share,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ThemeContext } from '../context'
import { useSessionData } from '../context/SessionDataContext'
import { authClient } from '../lib/auth-client'
import { storedAiScoreToPercent } from '../lib/techniqueScoreDisplay'
import { DOMAIN } from '../../constants'
import { ACTIVITIES_FAVORITES_STORAGE_KEY } from '../constants/activitiesFavorites'
import type { ActivitySession } from '../lib/activitySession'
import { displayTrainShotTitle } from '../lib/trainShotDisplay'
import { getMainStackNavigation } from '../lib/mainStackNavigation'
import { fetchCoachSubmissions, type CoachSubmission } from '../lib/coachSubmissionsApi'
import { ActivitiesVideoAnalysis } from './ActivitiesVideoAnalysis'
import { ProLibraryGradientProgressBar } from '../components'
import { ProfileHeroScoreBlock } from '../components/ProfileHeroScoreBlock'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import { useTranslation } from 'react-i18next'
import { profileImageSource } from '../lib/defaultProfilePicture'

const AI_COACH_PLACEHOLDER = require('../../assets/actiities/aicoachplacehokder.svg')
const YOU_SHARE_ICON = require('../../assets/youpage/shareicon.svg')
const GOOD_COMMENT_ICON = require('../../assets/videoanalysis/good.svg')
const BAD_COMMENT_ICON = require('../../assets/videoanalysis/bad.svg')
const MIXED_COMMENT_ICON = require('../../assets/videoanalysis/badandgood.svg')
/** Matches My Students scroll + hero horizontal inset. */
const HERO_HORIZONTAL_PAD = 20

/** Shots tab — progress high scores */
const SHOTS_BAR_CYAN = '#00B8FF'
/** Bar + score when overall score is 70 or below. */
const SHOTS_BAR_AMBER = '#F5A623'
const SHOTS_CARD_BG = '#001435'
const SHOTS_TRACK_BG = '#061428'
const SHOTS_TEXT_DIM = '#86A7D2'

const API_ROOT = DOMAIN.replace(/\/+$/, '')

export type { ActivitySession } from '../lib/activitySession'

const C = {
  sky: '#38BDF8',
  slateBar: '#1E293B',
  track: '#E2E8F0',
  good: '#22C55E',
  wrong: '#EF4444',
}

function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function videoUri(path: string): string {
  if (path.startsWith('http')) return path
  return `${API_ROOT}${path}`
}

function getCalendarCells(monthStart: Date): { inMonth: boolean; date: Date }[] {
  const y = monthStart.getFullYear()
  const m = monthStart.getMonth()
  const first = new Date(y, m, 1)
  const startPad = (first.getDay() + 6) % 7
  const cells: { inMonth: boolean; date: Date }[] = []
  let d = new Date(y, m, 1 - startPad)
  for (let i = 0; i < 42; i++) {
    const inMonth = d.getMonth() === m
    cells.push({ inMonth, date: new Date(d) })
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  }
  return cells
}

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

const MONTH_PILL_CYAN = '#00BBFF'
/** Days with sessions — solid circle behind the date (matches reference). */
const CAL_ACTIVITY_CIRCLE = '#2B59FF'
/** Days a student sent the coach a video — distinct accent dot under the date. */
const CAL_SUBMISSION_DOT = '#1FD1A0'
const CAL_WEEK_LABEL = '#86A7D2'
const CAL_DAY_NUM = 'rgba(134, 167, 210, 0.75)'
const CAL_DAY_MUTED = 'rgba(134, 167, 210, 0.25)'

function monthYearPillLines(d: Date): { month: string; year: string } {
  return {
    month: d.toLocaleDateString(undefined, { month: 'long' }),
    year: d.toLocaleDateString(undefined, { year: 'numeric' }),
  }
}

function parseDateKey(dateKey: string): Date {
  const [yy, mm, dd] = dateKey.split('-').map(Number)
  return new Date(yy, mm - 1, dd)
}

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const d = parseDateKey(dateKey)
  d.setDate(d.getDate() + deltaDays)
  return localDateKey(d)
}

function ActivitiesNoShotsPlaceholder({
  styles,
}: {
  styles: ReturnType<typeof getShotsStyles>
}) {
  const { t } = useTranslation()
  return (
    <View style={styles.emptyShotsWrap}>
      <Text allowFontScaling={false} style={styles.emptyShotsText}>
        {t('activities.emptyShotsPlaceholderLine1')}
        {'\n'}
        {t('activities.emptyShotsPlaceholderLine2')}
        {'\n'}
        {t('activities.emptyShotsPlaceholderLine3Prefix')}
        <Text allowFontScaling={false} style={styles.emptyShotsAccent}>
          {t('activities.emptyShotsPlaceholderAccent')}
        </Text>
        {t('activities.emptyShotsPlaceholderLine3Suffix')}
      </Text>
      <LocalSvgAsset assetModule={AI_COACH_PLACEHOLDER} width={70} height={70} />
    </View>
  )
}

/** API list score / snapshot scores are 0–100. Show whole-number score out of 100. */
function displayScoreWhole(score0to100: number): number {
  return Math.round(Math.max(0, Math.min(100, score0to100)))
}

/**
 * Real coach-comment stats for a shot, taken from the coach's review
 * annotations (coachMarksJson). Each annotation carries a tone of
 * 'good' | 'wrong'. Shots with no coach review return zero counts.
 */
function coachCommentStats(s: ActivitySession): { total: number; good: number; bad: number } {
  const marks = s.coachMarksJson
  let good = 0
  let bad = 0
  let total = 0
  if (Array.isArray(marks)) {
    for (const row of marks) {
      const r = row as Record<string, unknown> | null
      if (!r) continue
      const comment = typeof r.comment === 'string' ? r.comment.trim() : ''
      const hasImage = typeof r.imageUri === 'string' && r.imageUri.trim().length > 0
      if (!comment && !hasImage) continue
      total++
      const tone = r.tone
      if (tone === 'good') good++
      else if (tone === 'wrong' || tone === 'bad') bad++
    }
  }
  return { total, good, bad }
}

function commentToneFromStats(stats: { good: number; bad: number }): 'good' | 'bad' | 'both' {
  if (stats.good > 0 && stats.bad > 0) return 'both'
  if (stats.bad > 0) return 'bad'
  return 'good'
}

function ShotCommentToneIcon({ tone }: { tone: 'good' | 'bad' | 'both' }) {
  if (tone === 'both') {
    return <LocalSvgAsset assetModule={MIXED_COMMENT_ICON} width={14} height={8} />
  }
  if (tone === 'bad') {
    return <LocalSvgAsset assetModule={BAD_COMMENT_ICON} width={8} height={8} />
  }
  return <LocalSvgAsset assetModule={GOOD_COMMENT_ICON} width={8} height={8} />
}

/** Stable “last score” marker for dual-bar UI when API does not send lastScore. */
function derivedLastScore(s: ActivitySession): number | null {
  if (typeof s.lastScore === 'number') return Math.max(0, Math.min(100, s.lastScore))
  if (typeof s.score !== 'number') return null
  let h = 0
  for (let i = 0; i < s.analysisId.length; i++) {
    h = (h * 31 + s.analysisId.charCodeAt(i)) >>> 0
  }
  const jitter = (h % 19) - 9
  return Math.max(0, Math.min(100, s.score + jitter))
}

function SessionScoreBar({ score }: { score: number; last: number | null }) {
  const pct = Math.max(0, Math.min(100, score))
  return (
    <View style={detailScoreBarStyles.wrap}>
      <View style={detailScoreBarStyles.markerRow} pointerEvents="none">
        <View style={[detailScoreBarStyles.marker, { left: `${pct}%` }]}>
          <Text allowFontScaling={false} style={detailScoreBarStyles.markerGlyph}>
            ▼
          </Text>
        </View>
      </View>
      <View style={detailScoreBarStyles.track}>
        <View style={[detailScoreBarStyles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  )
}

const detailScoreBarStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    marginRight: 8,
  },
  markerRow: {
    height: 9,
    position: 'relative',
    marginBottom: 1,
  },
  marker: {
    position: 'absolute',
    bottom: 0,
    marginLeft: -5,
    width: 10,
    alignItems: 'center',
  },
  markerGlyph: {
    fontSize: 8,
    color: C.sky,
    lineHeight: 8,
  },
  track: {
    height: 7,
    borderRadius: 4,
    backgroundColor: C.track,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
    backgroundColor: C.sky,
  },
})

function ActivitiesDayDetail({
  dateKey,
  sessions,
  onBack,
  theme,
  monthVideoCount,
  onShiftDay,
  onSessionPress,
  backToCalendarLabel,
  coachSubmissions = [],
  onOpenReview,
}: {
  dateKey: string
  sessions: ActivitySession[]
  onBack: () => void
  theme: any
  monthVideoCount: number
  onShiftDay: (delta: number) => void
  onSessionPress?: (s: ActivitySession) => void
  backToCalendarLabel?: string
  coachSubmissions?: CoachSubmission[]
  onOpenReview?: (reviewId: string) => void
}) {
  const { t } = useTranslation()
  const { width: winW } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => getDetailStyles(theme, winW), [theme, winW])
  const backLabel = backToCalendarLabel ?? t('activities.backToProfile')
  const dayDate = parseDateKey(dateKey)
  const dayNum = dayDate.getDate()
  const monthName = dayDate.toLocaleDateString(undefined, { month: 'long' })
  const yearNum = String(dayDate.getFullYear())

  const visibleSessions = useMemo(
    () => sessions.filter((s) => String(s.status).toLowerCase() !== 'failed'),
    [sessions]
  )

  return (
    <View
      /** Already rendered below global Header; adding safe-area top again creates a large visual gap. */
      style={[styles.gradientScreen, { paddingTop: 6, backgroundColor: theme.backgroundColor }]}
    >
      <View style={styles.dayTopBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={12} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={22} color={C.sky} />
          <Text allowFontScaling={false} style={styles.backText}>
            {backLabel}
          </Text>
        </TouchableOpacity>
      </View>

      <Text allowFontScaling={false} style={styles.videoActivitiesTitle}>
        {t('activities.videoActivities')}
      </Text>

      <View style={styles.recordingsRow}>
        <View style={styles.recordingsStack}>
          <Text allowFontScaling={false} style={styles.recordingsLabel}>
            {t('activitiesExtra.videoRecordings')}
          </Text>
          <Text allowFontScaling={false} style={styles.recordingsCountLine}>
            {monthVideoCount}
          </Text>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendLine}>
            <View style={[styles.legendDot, { backgroundColor: C.sky }]} />
            <Text allowFontScaling={false} style={styles.legendText}>
              {t('myCoach.actualScore')}
            </Text>
          </View>
          <View style={styles.legendLine}>
            <View style={[styles.legendDot, { backgroundColor: C.slateBar }]} />
            <Text allowFontScaling={false} style={styles.legendText}>
              {t('myCoach.lastScore')}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.dateSelectorBar}>
        <TouchableOpacity onPress={() => onShiftDay(-1)} hitSlop={12} style={styles.dateNavHit}>
          <Ionicons name="chevron-back" size={20} color={C.sky} />
        </TouchableOpacity>
        <View style={styles.dateBlock}>
          <Text allowFontScaling={false} style={styles.dateBigNum}>
            {dayNum}
          </Text>
          <View style={styles.dateMonthYearCol}>
            <Text allowFontScaling={false} style={styles.dateMonthLine}>
              {monthName}
            </Text>
            <Text allowFontScaling={false} style={styles.dateYearLine}>
              {yearNum}
            </Text>
          </View>
        </View>
        <View style={styles.dateBarSpacer} />
        <TouchableOpacity onPress={() => onShiftDay(1)} hitSlop={12} style={styles.dateNavHit}>
          <Ionicons name="chevron-forward" size={20} color={C.sky} />
        </TouchableOpacity>
      </View>

      <View style={styles.wrongGoodLegendRow}>
        <View style={styles.wrongGoodLine}>
          <LocalSvgAsset assetModule={BAD_COMMENT_ICON} width={8} height={8} />
          <Text allowFontScaling={false} style={styles.wrongGoodLabel}>
            {t('common.wrong')}
          </Text>
        </View>
        <View style={styles.wrongGoodLine}>
          <LocalSvgAsset assetModule={GOOD_COMMENT_ICON} width={8} height={8} />
          <Text allowFontScaling={false} style={styles.wrongGoodLabel}>
            {t('common.good')}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.dayScroll}
        contentContainerStyle={[styles.dayScrollInner, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {coachSubmissions.length > 0 ? (
          <View style={styles.studentSubsBlock}>
            <Text allowFontScaling={false} style={styles.studentSubsTitle}>
              {t('activitiesExtra.videosFromStudents')}
            </Text>
            {coachSubmissions.map((sub) => {
              const reviewed = String(sub.status).toLowerCase() === 'completed'
              return (
                <Pressable
                  key={sub.reviewId}
                  style={styles.subCard}
                  onPress={() => onOpenReview?.(sub.reviewId)}
                  android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
                >
                  <Image
                    source={profileImageSource(sub.studentImage)}
                    style={styles.subAvatar}
                    resizeMode="cover"
                  />
                  <View style={styles.subInfoCol}>
                    <Text allowFontScaling={false} style={styles.subName} numberOfLines={1}>
                      {sub.studentName}
                    </Text>
                    <Text allowFontScaling={false} style={styles.subShot} numberOfLines={1}>
                      {sub.shotLabel ?? t('activitiesExtra.subShotFallback')}
                    </Text>
                  </View>
                  {typeof sub.score === 'number' ? (
                    <View style={styles.subScoreChip}>
                      <Text allowFontScaling={false} style={styles.subScoreText}>
                        {sub.score}
                      </Text>
                    </View>
                  ) : null}
                  <View
                    style={[styles.subBadge, reviewed ? styles.subBadgeDone : styles.subBadgePending]}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.subBadgeText,
                        reviewed ? styles.subBadgeTextDone : styles.subBadgeTextPending,
                      ]}
                    >
                      {reviewed
                        ? t('activitiesExtra.subReviewed')
                        : t('activitiesExtra.subPending')}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        ) : null}
        {visibleSessions.length === 0 ? (
          coachSubmissions.length === 0 ? (
            <Text allowFontScaling={false} style={styles.emptyDay}>
              {t('activitiesExtra.noSessionsDay')}
            </Text>
          ) : null
        ) : (
          visibleSessions.map((s) => {
            const shot = displayTrainShotTitle({
              strokeLabel: s.shotLabel,
              strokeName: s.shotLabel,
            })
            const coachStats = coachCommentStats(s)
            const comments = coachStats.total
            const hasComments = comments > 0
            const tone = commentToneFromStats(coachStats)
            const score = typeof s.score === 'number' ? s.score : null
            const last = derivedLastScore(s)

            return (
              <Pressable
                key={s.analysisId}
                style={styles.sessionCardRow}
                onPress={() => onSessionPress?.(s)}
                android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
              >
                <View style={styles.thumbCol}>
                  <Video
                    source={{ uri: videoUri(s.videoPath) }}
                    style={styles.thumbVideo}
                    resizeMode={ResizeMode.COVER}
                    useNativeControls={false}
                    isLooping={false}
                    shouldPlay={false}
                  />
                  <View style={styles.playOverlay} pointerEvents="none">
                    <Ionicons name="play-circle" size={30} color="rgba(255,255,255,0.92)" />
                  </View>
                </View>
                <View style={styles.whitePanel}>
                  <View style={styles.whiteTopRow}>
                    <Text allowFontScaling={false} numberOfLines={1} style={styles.shotTitle}>
                      {shot}
                    </Text>
                    <View style={styles.commentsPill}>
                      {hasComments ? <ShotCommentToneIcon tone={tone} /> : null}
                      <Text allowFontScaling={false} style={styles.commentsText}>
                        {comments} Comments
                      </Text>
                    </View>
                  </View>
                  <View style={styles.scoreSection}>
                    <View style={styles.scoreBarCol}>
                      <View style={styles.scoreBarRow}>
                        <View style={styles.scoreBarTrackWrap}>
                          {score != null ? (
                            <SessionScoreBar score={score} last={last} />
                          ) : (
                            <View style={[detailScoreBarStyles.track, { justifyContent: 'center' }]}>
                              <Text allowFontScaling={false} style={styles.scorePending}>
                                —
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text allowFontScaling={false} style={styles.scoreBig}>
                          {score != null ? String(displayScoreWhole(score)) : '—'}
                        </Text>
                      </View>
                      <Text allowFontScaling={false} style={styles.scoreLabel}>
                        {t('playlist.score')}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

export type ActivitiesCalendarFlowProps = {
  /**
   * `calendar` = shield/score hero + month calendar (Profile).
   * `shots` = full-page Shots list + All / Favorites (Activities tab only).
   */
  layout?: 'calendar' | 'shots'
  /** Heading under the hero row (shield + score). */
  sectionTitle?: string
  /** Label for the day-detail back control. */
  dayDetailBackLabel?: string
  /** Extra content below the calendar on the main scroll (e.g. Profile settings). */
  belowCalendar?: ReactNode
  /**
   * `inline` = month + arrows inside the calendar card (Activities tab, original).
   * `pill` = dark pill banner above the card (You / Profile only).
   */
  monthNavStyle?: 'pill' | 'inline'
  /** Inserted between hero and section title (You tab: AI Insight). */
  aboveActivitiesTitle?: ReactNode
  /** Profile uses `false` to drop the placeholder shield/score hero; Activities tab keeps the default. */
  showHeroRow?: boolean
  /** Deep link from notifications — opens shot detail when activities list has the session. */
  openAnalysisId?: string
  /** Called when user leaves shot detail opened via deep link (clears latched id). */
  onOpenAnalysisConsumed?: () => void
  /** Coach Calendar tab: also mark days students sent videos and list them in day detail. */
  coachInbox?: boolean
  /** Incremented by the parent when the Activities tab is re-pressed — closes any open shot/day detail. */
  resetSignal?: number
}

/**
 * Shield + score hero, month calendar, day list, and video analysis — shared by Activities tab and Profile.
 */
export function ActivitiesCalendarFlow({
  layout = 'calendar',
  sectionTitle,
  dayDetailBackLabel,
  belowCalendar,
  monthNavStyle = 'inline',
  aboveActivitiesTitle,
  showHeroRow = true,
  openAnalysisId,
  onOpenAnalysisConsumed,
  coachInbox = false,
  resetSignal,
}: ActivitiesCalendarFlowProps) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { width: winW } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const resolvedSectionTitle = sectionTitle ?? t('activities.title')
  const resolvedDayBackLabel = dayDetailBackLabel ?? t('activities.backToProfile')
  const styles = useMemo(() => getStyles(theme, winW), [theme, winW])
  const shotsStyles = useMemo(() => getShotsStyles(theme, winW), [theme, winW])
  const scrollHorizontalPad = showHeroRow
    ? HERO_HORIZONTAL_PAD
    : Math.max(16, Math.min(24, winW * 0.05))

  const {
    activities: items,
    activitiesLoading: loading,
    activitiesError: error,
    profileName,
    overallPillarScore,
  } = useSessionData()

  const [viewMonth, setViewMonth] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [detailDateKey, setDetailDateKey] = useState<string | null>(null)
  const [analysisSession, setAnalysisSession] = useState<ActivitySession | null>(null)
  const [shotsTab, setShotsTab] = useState<'all' | 'favorites'>('all')
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [coachSubmissions, setCoachSubmissions] = useState<CoachSubmission[]>([])

  /** Re-pressing the Activities tab closes an open shot/day detail (back to main page). */
  const didInitResetSignal = useRef(false)
  useEffect(() => {
    if (!didInitResetSignal.current) {
      didInitResetSignal.current = true
      return
    }
    setAnalysisSession(null)
    setDetailDateKey(null)
  }, [resetSignal])

  /** Load favorites on mount and when returning from shot detail (star toggled there). */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(ACTIVITIES_FAVORITES_STORAGE_KEY)
        if (cancelled) return
        const parsed = raw ? JSON.parse(raw) : []
        if (Array.isArray(parsed)) {
          setFavoriteIds(new Set(parsed.filter((x): x is string => typeof x === 'string')))
        }
      } catch {
        /* ignore corrupt storage */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [analysisSession])

  const datesWithActivity = useMemo(() => {
    const set = new Set<string>()
    for (const it of items) {
      set.add(localDateKey(new Date(it.createdAt)))
    }
    return set
  }, [items])

  /** Coach Calendar: load videos students sent the coach; refresh on focus (status may change after review). */
  useFocusEffect(
    useCallback(() => {
      if (!coachInbox) return
      let cancelled = false
      ;(async () => {
        const rows = await fetchCoachSubmissions().catch(() => [])
        if (!cancelled) setCoachSubmissions(rows)
      })()
      return () => {
        cancelled = true
      }
    }, [coachInbox])
  )

  const datesWithSubmissions = useMemo(() => {
    const set = new Set<string>()
    if (!coachInbox) return set
    for (const s of coachSubmissions) {
      set.add(localDateKey(new Date(s.createdAt)))
    }
    return set
  }, [coachInbox, coachSubmissions])

  const submissionsByDate = useMemo(() => {
    const m = new Map<string, CoachSubmission[]>()
    if (!coachInbox) return m
    for (const s of coachSubmissions) {
      const k = localDateKey(new Date(s.createdAt))
      const arr = m.get(k) ?? []
      arr.push(s)
      m.set(k, arr)
    }
    for (const [, arr] of m) {
      arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return m
  }, [coachInbox, coachSubmissions])

  const openCoachReview = useCallback(
    (reviewId: string) => {
      const stack = getMainStackNavigation(navigation as never)
      stack?.navigate('CoachReviewEditor', { reviewId })
    },
    [navigation]
  )

  const itemsByDate = useMemo(() => {
    const m = new Map<string, ActivitySession[]>()
    for (const it of items) {
      const k = localDateKey(new Date(it.createdAt))
      const arr = m.get(k) ?? []
      arr.push(it)
      m.set(k, arr)
    }
    for (const [, arr] of m) {
      arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return m
  }, [items])

  const shotsSessionsAll = useMemo(
    () =>
      items
        .filter((s) => String(s.status).toLowerCase() !== 'failed')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [items]
  )

  useEffect(() => {
    if (!openAnalysisId || layout !== 'shots') return
    const session = shotsSessionsAll.find((s) => s.analysisId === openAnalysisId)
    if (session) {
      setAnalysisSession(session)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await authClient
          .$fetch<{
            id?: string
            status?: string
            createdAt?: string
            techniqueVideoId?: string
            metrics?: Record<string, unknown>
            aiSummary?: { score?: number | null; rating?: string | null }
          }>(`/technique/analysis/${openAnalysisId}`, { method: 'GET' })
          .catch(() => null)
        const body: any = (res as any)?.data ?? res
        if (cancelled || !body?.id) return
        const videoId =
          typeof body.techniqueVideoId === 'string'
            ? body.techniqueVideoId
            : typeof (body.metrics as any)?.technique_video_id === 'string'
              ? (body.metrics as any).technique_video_id
              : ''
        const fallback: ActivitySession = {
          analysisId: body.id,
          techniqueVideoId: videoId,
          status: String(body.status ?? 'completed'),
          createdAt:
            typeof body.createdAt === 'string'
              ? body.createdAt
              : new Date().toISOString(),
          feedbackSnippet: null,
          videoPath: videoId ? `/technique/video/${videoId}` : '',
          score:
            typeof body.aiSummary?.score === 'number'
              ? body.aiSummary.score
              : storedAiScoreToPercent(
                  (body.metrics as any)?.ai_analysis as Record<string, unknown>
                ),
          rating: body.aiSummary?.rating ?? null,
        }
        setAnalysisSession(fallback)
      } catch {
        /* list may load on next activities refresh */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [openAnalysisId, layout, shotsSessionsAll])

  const shotsSessionsFiltered = useMemo(() => {
    if (shotsTab === 'all') return shotsSessionsAll
    return shotsSessionsAll.filter((s) => favoriteIds.has(s.analysisId))
  }, [shotsSessionsAll, shotsTab, favoriteIds])

  const calendarCells = useMemo(() => getCalendarCells(viewMonth), [viewMonth])
  const monthPillLines = useMemo(
    () => (monthNavStyle === 'pill' ? monthYearPillLines(viewMonth) : null),
    [viewMonth, monthNavStyle]
  )

  const monthVideoCountForDetail = useMemo(() => {
    if (!detailDateKey) return 0
    const [y, m] = detailDateKey.split('-').map(Number)
    let n = 0
    for (const it of items) {
      const d = new Date(it.createdAt)
      if (d.getFullYear() === y && d.getMonth() + 1 === m) n += 1
    }
    return n
  }, [items, detailDateKey])

  const onShareProfile = useCallback(async () => {
    try {
      const name = profileName?.trim() || 'Player'
      const score = overallPillarScore != null ? String(overallPillarScore) : '—'
      await Share.share({
        message: `${name} · Score ${score} on Xevo`,
      })
    } catch {
      /* dismissed */
    }
  }, [profileName, overallPillarScore])

  const goPrevMonth = () => {
    setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }
  const goNextMonth = () => {
    setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }

  const onPressDay = (date: Date, inMonth: boolean) => {
    if (!inMonth) {
      setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1))
      return
    }
    const key = localDateKey(date)
    setSelectedKey(key)
    if (datesWithActivity.has(key) || datesWithSubmissions.has(key)) {
      setDetailDateKey(key)
    }
  }

  const todayKey = localDateKey(new Date())

  /** Six rows of seven equal-width cells (explicit width; avoids iOS prod flex collapse). */
  const dayGrid = (
    <>
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <View key={row} style={styles.calendarWeekRow}>
          {calendarCells.slice(row * 7, row * 7 + 7).map((cell, col) => {
            const idx = row * 7 + col
            const dk = localDateKey(cell.date)
            const has = datesWithActivity.has(dk)
            const hasSubmission = datesWithSubmissions.has(dk)
            const isSel = selectedKey === dk
            const isToday = cell.inMonth && dk === todayKey
            return (
              <Pressable
                key={idx}
                onPress={() => onPressDay(cell.date, cell.inMonth)}
                style={styles.dayCell}
                android_ripple={{ color: 'rgba(0, 187, 255, 0.14)', borderless: false }}
              >
                {has ? (
                  <View style={styles.dayNumCircle}>
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.dayNumInCircle,
                        !cell.inMonth && styles.dayNumMuted,
                        isToday && styles.dayNumToday,
                      ]}
                    >
                      {cell.date.getDate()}
                    </Text>
                  </View>
                ) : (
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.dayNum,
                      isSel && styles.dayNumSelected,
                      !cell.inMonth && styles.dayNumMuted,
                      isToday && styles.dayNumToday,
                    ]}
                  >
                    {cell.date.getDate()}
                  </Text>
                )}
                {hasSubmission && cell.inMonth ? (
                  <View style={styles.daySubmissionDotWrap} pointerEvents="none">
                    <View style={styles.daySubmissionDot} />
                  </View>
                ) : null}
              </Pressable>
            )
          })}
        </View>
      ))}
    </>
  )

  if (layout === 'shots' && analysisSession) {
    return (
      <ActivitiesVideoAnalysis
        session={analysisSession}
        onBack={() => {
          setAnalysisSession(null)
          onOpenAnalysisConsumed?.()
        }}
      />
    )
  }

  if (layout === 'shots') {
    const pad = Math.max(16, Math.min(24, winW * 0.05))
    return (
      <View style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            // Sits below the global <Header/> in main.tsx, which already pads insets.top.
            // Re-adding insets.top here doubled the gap above the "Shots" title.
            flexGrow: 1,
            paddingTop: 8,
            paddingHorizontal: pad,
            paddingBottom: 32 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text allowFontScaling={false} style={shotsStyles.shotsPageTitle}>
            {t('activities.shots')}
          </Text>

          <View style={shotsStyles.segmentWrap}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShotsTab('all')}
              style={[shotsStyles.segmentPill, shotsTab === 'all' && shotsStyles.segmentPillActive]}
            >
              <Text
                allowFontScaling={false}
                style={[shotsStyles.segmentLabel, shotsTab === 'all' && shotsStyles.segmentLabelActive]}
              >
                {t('activities.allShots')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShotsTab('favorites')}
              style={[shotsStyles.segmentPill, shotsTab === 'favorites' && shotsStyles.segmentPillActive]}
            >
              <Text
                allowFontScaling={false}
                style={[
                  shotsStyles.segmentLabel,
                  shotsTab === 'favorites' && shotsStyles.segmentLabelActive,
                ]}
              >
                {t('activities.favorites')}
              </Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <Text allowFontScaling={false} style={shotsStyles.errorInline}>
              {error}
            </Text>
          ) : loading ? (
            <ActivityIndicator color={SHOTS_BAR_CYAN} style={{ marginTop: 36 }} />
          ) : shotsSessionsFiltered.length === 0 ? (
            shotsTab === 'favorites' ? (
              <Text allowFontScaling={false} style={shotsStyles.emptyShots}>
                {t('activities.noFavorites')}
              </Text>
            ) : (
              <ActivitiesNoShotsPlaceholder
                styles={shotsStyles}
              />
            )
          ) : (
            shotsSessionsFiltered.map((s) => {
              const shotTitle = displayTrainShotTitle({
                strokeLabel: s.shotLabel,
                strokeName: s.shotLabel,
              })
              const score =
                typeof s.score === 'number' ? displayScoreWhole(s.score) : null
              const pct = score != null ? Math.max(0, Math.min(100, score)) : 0
              const isAmberZone = score != null && score <= 70
              const barColor = isAmberZone ? SHOTS_BAR_AMBER : SHOTS_BAR_CYAN
              const scoreColor = isAmberZone ? SHOTS_BAR_AMBER : '#FFFFFF'
              return (
                <View key={s.analysisId} style={shotsStyles.shotCard}>
                  <Pressable
                    style={shotsStyles.shotCardPressable}
                    onPress={() => setAnalysisSession(s)}
                    android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
                  >
                    <View style={shotsStyles.thumbBox}>
                      <Video
                        source={{ uri: videoUri(s.videoPath) }}
                        style={shotsStyles.thumbVideo}
                        resizeMode={ResizeMode.COVER}
                        useNativeControls={false}
                        isLooping={false}
                        shouldPlay={false}
                      />
                    </View>
                    <View style={shotsStyles.shotCardBody}>
                      <View style={shotsStyles.shotTitleRow}>
                        <Text allowFontScaling={false} numberOfLines={1} style={shotsStyles.shotName}>
                          {shotTitle}
                        </Text>
                        
                      </View>
                      <View style={shotsStyles.progressRow}>
                        <ProLibraryGradientProgressBar
                          progress={pct}
                          flat
                          fillColor={barColor}
                          trackColor="#07256D"
                          height={8}
                          outerBorderRadius={6}
                          innerBorderRadius={4}
                          fillBorderRadius={3}
                          style={shotsStyles.shotsBarGradient}
                        />
                        <View style={shotsStyles.scoreCluster}>
                          <Text
                            allowFontScaling={false}
                            style={[shotsStyles.scoreNum, { color: scoreColor }]}
                          >
                            {score != null ? String(score) : '—'}
                          </Text>
                          <Text allowFontScaling={false} style={shotsStyles.scoreOutOf}>
                            /100
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </View>
              )
            })
          )}
        </ScrollView>
      </View>
    )
  }

  if (detailDateKey) {
    const sessions = itemsByDate.get(detailDateKey) ?? []
    const daySessionsVisible = sessions.filter((s) => String(s.status).toLowerCase() !== 'failed')

    if (analysisSession) {
      return (
        <ActivitiesVideoAnalysis
          session={analysisSession}
          onBack={() => setAnalysisSession(null)}
        />
      )
    }

    return (
      <ActivitiesDayDetail
        dateKey={detailDateKey}
        sessions={sessions}
        theme={theme}
        monthVideoCount={monthVideoCountForDetail}
        backToCalendarLabel={resolvedDayBackLabel}
        coachSubmissions={coachInbox ? submissionsByDate.get(detailDateKey) ?? [] : []}
        onOpenReview={openCoachReview}
        onShiftDay={(delta) => {
          const next = shiftDateKey(detailDateKey, delta)
          setDetailDateKey(next)
          setSelectedKey(next)
          setAnalysisSession(null)
        }}
        onBack={() => {
          setDetailDateKey(null)
          setAnalysisSession(null)
        }}
        onSessionPress={setAnalysisSession}
      />
    )
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollInner, { paddingHorizontal: scrollHorizontalPad }]}
      showsVerticalScrollIndicator={false}
    >
      {showHeroRow ? (
        <ProfileHeroScoreBlock
          horizontalPadding={HERO_HORIZONTAL_PAD}
          premiumLabelNudgeUp={4}
          {...(layout === 'calendar'
            ? {
                marginTop: 22,
                youPageLayout: true,
                onSharePress: () => void onShareProfile(),
                shareIconModule: YOU_SHARE_ICON,
                shareIconSize: 28,
                shareAccessibilityLabel: 'Share profile',
              }
            : {})}
        />
      ) : null}

      {aboveActivitiesTitle}

      <Text allowFontScaling={false} style={styles.sectionTitle}>
        {resolvedSectionTitle}
      </Text>

      {error ? (
        <Text allowFontScaling={false} style={styles.errorText}>
          {error}
        </Text>
      ) : monthNavStyle === 'pill' ? (
        <>
          {monthPillLines ? (
            <View style={styles.monthPillBanner}>
              <TouchableOpacity
                onPress={goPrevMonth}
                hitSlop={12}
                style={styles.monthPillNav}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={20} color={MONTH_PILL_CYAN} />
              </TouchableOpacity>
              <View style={styles.monthPillTextCol}>
                <Text allowFontScaling={false} style={styles.monthPillMonthLine}>
                  {monthPillLines.month}
                </Text>
                <Text allowFontScaling={false} style={styles.monthPillYearLine}>
                  {monthPillLines.year}
                </Text>
              </View>
              <View style={styles.monthPillSpacer} />
              <TouchableOpacity
                onPress={goNextMonth}
                hitSlop={12}
                style={styles.monthPillNav}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={20} color={MONTH_PILL_CYAN} />
              </TouchableOpacity>
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator color="#00BBFF" style={styles.loader} />
          ) : (
            <View style={styles.calendarCard}>
              <View style={styles.weekRow}>
                {WEEK_LABELS.map((w, i) => (
                  <Text allowFontScaling={false} key={`${w}-${i}`} style={styles.weekLabel}>
                    {w}
                  </Text>
                ))}
              </View>
              {dayGrid}
            </View>
          )}
        </>
      ) : loading ? (
        <ActivityIndicator color="#00BBFF" style={styles.loader} />
      ) : (
        <View style={styles.calendarCard}>
          <View style={styles.calHeader}>
            <TouchableOpacity onPress={goPrevMonth} hitSlop={10} style={styles.calNav}>
              <Ionicons name="chevron-back" size={20} color="#00BBFF" />
            </TouchableOpacity>
            <Text allowFontScaling={false} style={styles.calMonth}>
              {formatMonthYear(viewMonth)}
            </Text>
            <TouchableOpacity onPress={goNextMonth} hitSlop={10} style={styles.calNav}>
              <Ionicons name="chevron-forward" size={20} color="#00BBFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.weekRow}>
            {WEEK_LABELS.map((w, i) => (
              <Text allowFontScaling={false} key={`${w}-${i}`} style={styles.weekLabel}>
                {w}
              </Text>
            ))}
          </View>
          {dayGrid}
        </View>
      )}
      {belowCalendar}
    </ScrollView>
  )
}

export function ActivitiesScreen() {
  const { viewerIsCoach } = useSessionData()
  const route = useRoute<RouteProp<MainTabParamList, 'Activities'>>()
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList, 'Activities'>>()
  const routeOpenId = route.params?.openAnalysisId
  const [latchedOpenAnalysisId, setLatchedOpenAnalysisId] = useState<string | undefined>()
  const [resetSignal, setResetSignal] = useState(0)

  useEffect(() => {
    if (!routeOpenId) return
    setLatchedOpenAnalysisId(routeOpenId)
    navigation.setParams({ openAnalysisId: undefined })
  }, [routeOpenId, navigation])

  /** Pressing the Activities tab again returns to the main Activities page (closes any open shot/day). */
  useEffect(() => {
    const unsub = navigation.addListener('tabPress', () => {
      setResetSignal((n) => n + 1)
    })
    return unsub
  }, [navigation])

  const openAnalysisId = latchedOpenAnalysisId

  return (
    <ActivitiesCalendarFlow
      layout={viewerIsCoach ? 'calendar' : 'shots'}
      monthNavStyle="pill"
      openAnalysisId={openAnalysisId}
      onOpenAnalysisConsumed={() => setLatchedOpenAnalysisId(undefined)}
      coachInbox={viewerIsCoach}
      resetSignal={resetSignal}
    />
  )
}

function getStyles(theme: any, _winW: number) {
  /** Fixed 7 columns; percentage basis is more stable than pixel math in iOS release builds. */
  const dayColumnPct = '14.285714%'
  return StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
    },
    scrollInner: {
      paddingBottom: 32,
      paddingTop: 8,
    },
    sectionTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 18,
      color: theme.textColor,
      marginBottom: 12,
    },
    loader: {
      marginVertical: 24,
    },
    errorText: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: '#ff8a8a',
    },
    monthPillBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#041641',
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 10,
      marginBottom: 12,
    },
    monthPillNav: {
      minWidth: 40,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthPillTextCol: {
      marginLeft: 4,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    monthPillMonthLine: {
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      color: MONTH_PILL_CYAN,
      lineHeight: 20,
    },
    monthPillYearLine: {
      fontFamily: theme.mediumFont,
      fontSize: 15,
      color: MONTH_PILL_CYAN,
      lineHeight: 19,
      marginTop: 1,
    },
    monthPillSpacer: {
      flex: 1,
      minWidth: 8,
    },
    calendarCard: {
      backgroundColor: 'transparent',
      paddingVertical: 12,
      paddingHorizontal: 0,
    },
    calHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    calNav: {
      padding: 6,
    },
    calMonth: {
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      color: '#00BBFF',
    },
    weekRow: {
      flexDirection: 'row',
      width: '100%',
      marginBottom: 12,
    },
    weekLabel: {
      width: dayColumnPct,
      flexBasis: dayColumnPct,
      maxWidth: dayColumnPct,
      flexGrow: 0,
      flexShrink: 0,
      textAlign: 'center',
      fontFamily: theme.mediumFont,
      fontSize: 11,
      color: CAL_WEEK_LABEL,
    },
    calendarWeekRow: {
      flexDirection: 'row',
      width: '100%',
      alignItems: 'stretch',
    },
    dayCell: {
      width: dayColumnPct,
      flexBasis: dayColumnPct,
      maxWidth: dayColumnPct,
      flexGrow: 0,
      flexShrink: 0,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    dayNum: {
      fontFamily: theme.mediumFont,
      fontSize: 13,
      lineHeight: 16,
      textAlign: 'center',
      color: CAL_DAY_NUM,
      ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
    },
    dayNumMuted: {
      color: CAL_DAY_MUTED,
    },
    dayNumSelected: {
      color: '#00BBFF',
      textDecorationLine: 'underline',
    },
    dayNumCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: CAL_ACTIVITY_CIRCLE,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    dayNumInCircle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      lineHeight: 15,
      textAlign: 'center',
      color: CAL_DAY_NUM,
      ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
    },
    daySubmissionDotWrap: {
      position: 'absolute',
      bottom: 3,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    daySubmissionDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: CAL_SUBMISSION_DOT,
      borderWidth: 1,
      borderColor: theme.backgroundColor,
    },
    dayNumToday: {
      textDecorationLine: 'underline',
    },
  })
}

function getShotsStyles(theme: any, winW: number) {
  const pad = Math.max(16, Math.min(24, winW * 0.05))
  const contentW = winW - pad * 2
  const thumbW = Math.max(96, Math.round(contentW * 0.28))
  const cardMinH = 100

  return StyleSheet.create({
    shotsPageTitle: {
      fontFamily: theme.boldFont ?? theme.semiBoldFont,
      fontSize: 32,
      lineHeight: 38,
      color: '#FFFFFF',
      letterSpacing: -0.5,
      marginBottom: 16,
    },
    segmentWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#041641',
      borderRadius: 28,
      padding: 4,
      marginBottom: 18,
    },
    segmentPill: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentPillActive: {
      backgroundColor: '#006EFF',
    },
    segmentLabel: {
      fontFamily: theme.mediumFont,
      fontSize: 12,
      color: '#336AB3',
    },
    segmentLabelActive: {
      color: '#FFFFFF',
    },
    errorInline: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: '#ff8a8a',
      marginTop: 16,
    },
    emptyShots: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: SHOTS_TEXT_DIM,
      marginTop: 28,
      textAlign: 'center',
      lineHeight: 20,
    },
    emptyShotsWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 32,
      minHeight: Math.max(280, winW * 0.85),
    },
    emptyShotsText: {
      fontFamily: theme.regularFont,
      fontSize: 16,
      color: '#FFFFFF',
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 12,
    },
    emptyShotsAccent: {
      color: '#00B8FF',
      fontFamily: theme.semiBoldFont,
    },
    shotCard: {
      backgroundColor: SHOTS_CARD_BG,
      borderRadius: 18,
      marginBottom: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(0, 110, 255, 0.12)',
    },
    shotCardPressable: {
      flexDirection: 'row',
      alignItems: 'stretch',
      minHeight: cardMinH,
    },
    thumbBox: {
      width: thumbW,
      minHeight: cardMinH,
      backgroundColor: '#000',
    },
    thumbVideo: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#000',
    },
    shotCardBody: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 14,
      paddingRight: 8,
      justifyContent: 'center',
      minWidth: 0,
    },
    shotTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    shotName: {
      flex: 1,
      fontFamily: theme.semiBoldFont,
      fontSize: 17,
      color: '#FFFFFF',
      minWidth: 0,
      transform: [{ translateY: 12 }],
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 34,
    },
    scoreCluster: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      flexShrink: 0,
      marginTop: -29,
    },
    scoreNum: {
      fontFamily: theme.boldFont ?? theme.semiBoldFont,
      fontSize: 26,
      lineHeight: 30,
      letterSpacing: -0.5,
      textAlign: 'right',
    },
    scoreOutOf: {
      fontFamily: theme.mediumFont,
      fontSize: 16,
      color: SHOTS_TEXT_DIM,
      lineHeight: 18,
      textAlign: 'right',
      marginTop: 0,
    },
    shotsBarGradient: {
      flex: 1,
      minWidth: 0,
      alignSelf: 'center',
    },
  })
}

function getDetailStyles(theme: any, winW: number) {
  const pad = 16
  const contentW = winW - pad * 2
  const thumbW = Math.max(88, Math.round(contentW * 0.31))
  const rowH = 96

  return StyleSheet.create({
    gradientScreen: {
      flex: 1,
    },
    dayTopBar: {
      paddingHorizontal: pad,
      marginBottom: 8,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    backText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: C.sky,
    },
    videoActivitiesTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 26,
      color: '#fff',
      paddingHorizontal: pad,
      marginBottom: 14,
    },
    recordingsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingHorizontal: pad,
      marginBottom: 16,
    },
    recordingsStack: {
      alignItems: 'flex-start',
    },
    recordingsLabel: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: 'rgba(255,255,255,0.65)',
    },
    recordingsCountLine: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: 'rgba(255,255,255,0.65)',
      marginTop: 3,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flexShrink: 0,
    },
    legendLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontFamily: theme.regularFont,
      fontSize: 11,
      color: 'rgba(255,255,255,0.78)',
    },
    dateSelectorBar: {
      marginHorizontal: pad,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#041641',
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 4,
      marginBottom: 12,
    },
    wrongGoodLegendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 12,
      paddingHorizontal: pad,
      marginBottom: 14,
    },
    wrongGoodLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    wrongGoodDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    wrongGoodLabel: {
      fontFamily: theme.regularFont,
      fontSize: 9,
      color: 'rgba(255,255,255,0.78)',
    },
    dateNavHit: {
      padding: 10,
    },
    dateBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    dateBarSpacer: {
      flex: 1,
    },
    dateBigNum: {
      fontFamily: theme.semiBoldFont,
      fontSize: 36,
      color: C.sky,
      lineHeight: 40,
    },
    dateMonthYearCol: {
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    dateMonthLine: {
      fontFamily: theme.mediumFont,
      fontSize: 16,
      color: C.sky,
      lineHeight: 20,
    },
    dateYearLine: {
      fontFamily: theme.mediumFont,
      fontSize: 16,
      color: C.sky,
      lineHeight: 20,
      marginTop: 2,
    },
    dayScroll: {
      flex: 1,
    },
    dayScrollInner: {
      paddingHorizontal: pad,
      paddingBottom: 40,
    },
    emptyDay: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: 'rgba(255,255,255,0.55)',
      textAlign: 'center',
      marginTop: 28,
    },
    studentSubsBlock: {
      marginBottom: 18,
    },
    studentSubsTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: theme.textColor,
      marginBottom: 10,
    },
    subCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      backgroundColor: SHOTS_CARD_BG,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 10,
    },
    subAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: SHOTS_TRACK_BG,
    },
    subAvatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    subInfoCol: {
      flex: 1,
      marginLeft: 12,
      marginRight: 8,
    },
    subName: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: '#FFFFFF',
    },
    subShot: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: SHOTS_TEXT_DIM,
      marginTop: 2,
    },
    subScoreChip: {
      minWidth: 34,
      paddingHorizontal: 8,
      height: 26,
      borderRadius: 13,
      backgroundColor: SHOTS_TRACK_BG,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    subScoreText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: SHOTS_BAR_CYAN,
    },
    subBadge: {
      paddingHorizontal: 10,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    subBadgePending: {
      backgroundColor: 'rgba(245, 166, 35, 0.16)',
    },
    subBadgeDone: {
      backgroundColor: 'rgba(31, 209, 160, 0.16)',
    },
    subBadgeText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 11,
    },
    subBadgeTextPending: {
      color: SHOTS_BAR_AMBER,
    },
    subBadgeTextDone: {
      color: CAL_SUBMISSION_DOT,
    },
    sessionCardRow: {
      flexDirection: 'row',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 10,
      backgroundColor: '#000',
      alignItems: 'stretch',
    },
    thumbCol: {
      width: thumbW,
      minHeight: rowH,
      backgroundColor: '#000',
      position: 'relative',
    },
    thumbVideo: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#000',
    },
    playOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.15)',
    },
    whitePanel: {
      flex: 1,
      minHeight: rowH,
      backgroundColor: '#fff',
      paddingVertical: 6,
      paddingHorizontal: 10,
      justifyContent: 'center',
    },
    whiteTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      marginBottom: 0,
    },
    shotTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: '#0f172a',
      flex: 1,
    },
    commentsPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      flexShrink: 0,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    commentsText: {
      fontFamily: theme.mediumFont,
      fontSize: 10,
      color: '#334155',
    },
    scoreSection: {
      marginTop: 14,
    },
    scoreBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    scoreBarCol: {
      flex: 1,
      minWidth: 0,
    },
    scoreBarTrackWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
    },
    scoreLabel: {
      fontFamily: theme.regularFont,
      fontSize: 10,
      color: '#64748B',
      marginTop: 4,
    },
    scoreBig: {
      fontFamily: theme.semiBoldFont,
      fontSize: 17,
      color: '#0f172a',
      minWidth: 34,
      textAlign: 'right',
      lineHeight: 20,
    },
    scorePending: {
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: '#94a3b8',
    },
  })
}
