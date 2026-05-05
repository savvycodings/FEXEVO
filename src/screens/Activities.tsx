import React, { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ThemeContext } from '../context'
import { useSessionData } from '../context/SessionDataContext'
import { DOMAIN } from '../../constants'
import { ACTIVITIES_FAVORITES_STORAGE_KEY } from '../constants/activitiesFavorites'
import { techniqueQualityTone } from '../lib/technique-quality'
import type { ActivitySession } from '../lib/activitySession'
import { ActivitiesVideoAnalysis } from './ActivitiesVideoAnalysis'
import { ProLibraryGradientProgressBar } from '../components'
import { ShieldProportionalFrame } from '../components/ShieldProportionalFrame'

const SCORE_BG = require('../../assets/aicoach/scorepng.png')
const SMALL_SHIELD_CAP_REF_WIN_W = 430

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

function commentCountHint(snippet: string | null): number {
  if (!snippet?.trim()) return 0
  const w = snippet.trim().split(/\s+/).length
  return Math.min(99, Math.max(1, Math.round(w / 6)))
}

/** API list score / snapshot scores are 0–100. Show whole-number score out of 100. */
function displayScoreWhole(score0to100: number): number {
  return Math.round(Math.max(0, Math.min(100, score0to100)))
}

function formatShotDisplayName(raw: string | null | undefined): string {
  const s = (raw || 'Technique').trim() || 'Technique'
  return s
    .replace(/_/g, ' ')
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function isGoodRating(s: ActivitySession): boolean {
  const tone = techniqueQualityTone(s)
  if (tone === 'good') return true
  if (tone === 'bad') return false
  return true
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

function SessionScoreBar({ score, last }: { score: number; last: number | null }) {
  const pct = Math.max(0, Math.min(100, score))
  const lastPct = last != null ? Math.max(0, Math.min(100, last)) : null
  return (
    <View style={detailScoreBarStyles.track}>
      <View style={[detailScoreBarStyles.fill, { width: `${pct}%` }]} />
      {lastPct != null ? (
        <View style={[detailScoreBarStyles.marker, { left: `${lastPct}%` }]}>
          <Text allowFontScaling={false} style={detailScoreBarStyles.markerGlyph}>
            ▼
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const detailScoreBarStyles = StyleSheet.create({
  track: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.track,
    overflow: 'visible',
    marginRight: 8,
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
    backgroundColor: C.sky,
  },
  marker: {
    position: 'absolute',
    top: -3,
    marginLeft: -5,
    width: 10,
    alignItems: 'center',
  },
  markerGlyph: {
    fontSize: 8,
    color: C.slateBar,
    lineHeight: 10,
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
  backToCalendarLabel = 'Back to Profile',
}: {
  dateKey: string
  sessions: ActivitySession[]
  onBack: () => void
  theme: any
  monthVideoCount: number
  onShiftDay: (delta: number) => void
  onSessionPress?: (s: ActivitySession) => void
  backToCalendarLabel?: string
}) {
  const { width: winW } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => getDetailStyles(theme, winW), [theme, winW])
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
            {backToCalendarLabel}
          </Text>
        </TouchableOpacity>
      </View>

      <Text allowFontScaling={false} style={styles.videoActivitiesTitle}>
        Video Activities
      </Text>

      <View style={styles.recordingsRow}>
        <View style={styles.recordingsStack}>
          <Text allowFontScaling={false} style={styles.recordingsLabel}>
            Video recordings
          </Text>
          <Text allowFontScaling={false} style={styles.recordingsCountLine}>
            {monthVideoCount}
          </Text>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendLine}>
            <View style={[styles.legendDot, { backgroundColor: C.sky }]} />
            <Text allowFontScaling={false} style={styles.legendText}>
              Actual Score
            </Text>
          </View>
          <View style={styles.legendLine}>
            <View style={[styles.legendDot, { backgroundColor: C.slateBar }]} />
            <Text allowFontScaling={false} style={styles.legendText}>
              Last score
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
          <View style={[styles.wrongGoodDot, { backgroundColor: C.wrong }]} />
          <Text allowFontScaling={false} style={styles.wrongGoodLabel}>
            Wrong
          </Text>
        </View>
        <View style={styles.wrongGoodLine}>
          <View style={[styles.wrongGoodDot, { backgroundColor: C.good }]} />
          <Text allowFontScaling={false} style={styles.wrongGoodLabel}>
            Good
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.dayScroll}
        contentContainerStyle={[styles.dayScrollInner, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {visibleSessions.length === 0 ? (
          <Text allowFontScaling={false} style={styles.emptyDay}>
            No AI Coach sessions on this day.
          </Text>
        ) : (
          visibleSessions.map((s) => {
            const shot = (s.shotLabel || 'Technique').trim() || 'Technique'
            const good = isGoodRating(s)
            const comments = commentCountHint(s.feedbackSnippet)
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
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: good ? C.good : C.wrong },
                        ]}
                      />
                      <Text allowFontScaling={false} style={styles.commentsText}>
                        {comments} Comments
                      </Text>
                    </View>
                  </View>
                  <View style={styles.scoreSection}>
                    <View style={styles.scoreBarRow}>
                      {score != null ? (
                        <SessionScoreBar score={score} last={last} />
                      ) : (
                        <View style={[detailScoreBarStyles.track, { justifyContent: 'center' }]}>
                          <Text allowFontScaling={false} style={styles.scorePending}>
                            —
                          </Text>
                        </View>
                      )}
                      <Text allowFontScaling={false} style={styles.scoreBig}>
                        {score != null ? String(displayScoreWhole(score)) : '—'}
                      </Text>
                    </View>
                    <Text allowFontScaling={false} style={styles.scoreLabel}>
                      Score
                    </Text>
                    <View style={styles.categoryBreakdownWrap}>
                      {[
                        { label: 'Technique', value: s.techniqueScore },
                        { label: 'Outcome', value: s.outcomeScore },
                        { label: 'Tactics', value: s.tacticsScore },
                        { label: 'Confidence', value: s.confidenceScore },
                      ].map((row) => {
                        const v =
                          typeof row.value === 'number'
                            ? Math.max(0, Math.min(100, Math.round(row.value)))
                            : null
                        return (
                          <View key={row.label} style={styles.categoryBreakdownRow}>
                            <Text allowFontScaling={false} style={styles.categoryBreakdownLabel}>
                              {row.label}
                            </Text>
                            <View style={styles.categoryBreakdownTrack}>
                              <View style={[styles.categoryBreakdownFill, { width: `${v ?? 0}%` }]} />
                            </View>
                            <Text allowFontScaling={false} style={styles.categoryBreakdownValue}>
                              {v != null ? v : '—'}
                            </Text>
                          </View>
                        )
                      })}
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
}

/**
 * Shield + score hero, month calendar, day list, and video analysis — shared by Activities tab and Profile.
 */
export function ActivitiesCalendarFlow({
  layout = 'calendar',
  sectionTitle = 'Activities',
  dayDetailBackLabel = 'Back to Profile',
  belowCalendar,
  monthNavStyle = 'inline',
  aboveActivitiesTitle,
  showHeroRow = true,
}: ActivitiesCalendarFlowProps) {
  const { theme } = useContext(ThemeContext)
  const { width: winW } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => getStyles(theme, winW), [theme, winW])
  const shotsStyles = useMemo(() => getShotsStyles(theme, winW), [theme, winW])
  const heroH = useMemo(() => Math.min(220, Math.max(160, winW * 0.42)), [winW])
  const shieldMaxW = useMemo(() => {
    const pad = Math.max(16, Math.min(24, winW * 0.05))
    const heroRowInnerW = winW - pad * 2
    const approxColW = (heroRowInnerW - 10) / 2
    const current = Math.min(approxColW, winW * 0.44)
    const refPad = Math.max(16, Math.min(24, SMALL_SHIELD_CAP_REF_WIN_W * 0.05))
    const refHeroRowInnerW = SMALL_SHIELD_CAP_REF_WIN_W - refPad * 2
    const refApproxColW = (refHeroRowInnerW - 10) / 2
    const reference = Math.min(refApproxColW, SMALL_SHIELD_CAP_REF_WIN_W * 0.44)
    return Math.min(current, reference)
  }, [winW])

  const {
    activities: items,
    activitiesLoading: loading,
    activitiesError: error,
    profileName,
    profileImageUri,
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
    if (datesWithActivity.has(key)) {
      setDetailDateKey(key)
    }
  }

  /** Six rows of seven equal-width cells (explicit width; avoids iOS prod flex collapse). */
  const dayGrid = (
    <>
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <View key={row} style={styles.calendarWeekRow}>
          {calendarCells.slice(row * 7, row * 7 + 7).map((cell, col) => {
            const idx = row * 7 + col
            const dk = localDateKey(cell.date)
            const has = datesWithActivity.has(dk)
            const isSel = selectedKey === dk
            return (
              <Pressable
                key={idx}
                onPress={() => onPressDay(cell.date, cell.inMonth)}
                style={[styles.dayCell, !cell.inMonth && styles.dayMuted]}
                android_ripple={{ color: 'rgba(0, 187, 255, 0.14)', borderless: false }}
              >
                {has ? (
                  <View style={styles.dayNumCircle}>
                    <Text allowFontScaling={false} style={styles.dayNumInCircle}>
                      {cell.date.getDate()}
                    </Text>
                  </View>
                ) : (
                  <Text allowFontScaling={false} style={[styles.dayNum, isSel && styles.dayNumSelected]}>
                    {cell.date.getDate()}
                  </Text>
                )}
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
        onBack={() => setAnalysisSession(null)}
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
            paddingTop: Math.max(12, insets.top) + 8,
            paddingHorizontal: pad,
            paddingBottom: 32 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text allowFontScaling={false} style={shotsStyles.shotsPageTitle}>
            Shots
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
                All Shots
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
                Favorites
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
            <Text allowFontScaling={false} style={shotsStyles.emptyShots}>
              {shotsTab === 'favorites'
                ? 'No favorites yet. Open a shot and tap the star in the top right.'
                : 'No shots yet. Analyze a clip in AI Coach to see it here.'}
            </Text>
          ) : (
            shotsSessionsFiltered.map((s) => {
              const shotTitle = formatShotDisplayName(s.shotLabel)
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
                          fillColor={barColor}
                          trackColor={SHOTS_TRACK_BG}
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
        backToCalendarLabel={dayDetailBackLabel}
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
      contentContainerStyle={styles.scrollInner}
      showsVerticalScrollIndicator={false}
    >
      {showHeroRow ? (
        <View style={styles.heroRow}>
          <View style={styles.shieldCol}>
            <View style={[styles.shieldSlot, { height: heroH }]}>
              <ShieldProportionalFrame
                maxWidth={shieldMaxW}
                maxHeight={heroH}
                variant="small"
                coachName={profileName?.trim() ?? ''}
                coachImageUri={profileImageUri}
                showName={false}
                showScore={false}
                showCrest={false}
                showFlag
                showPillarScores
              />
            </View>
          </View>
          <View style={styles.scoreCol}>
            <View style={styles.scoreCard}>
              <Image source={SCORE_BG} style={styles.scoreImg} resizeMode="contain" />
              <View style={styles.scoreOverlay}>
                <View style={styles.scoreTopCluster}>
                  <Text allowFontScaling={false} numberOfLines={1} style={styles.scoreUserName}>
                    {profileName ?? ''}
                  </Text>
                  <Text allowFontScaling={false} style={styles.scorePremiumLabel}>
                    Premium
                  </Text>
                </View>
                <View style={styles.scoreCenterCluster}>
                  <Text allowFontScaling={false} style={styles.scoreNumber}>
                    {overallPillarScore != null ? overallPillarScore : 'N/A'}
                  </Text>
                  <Text allowFontScaling={false} style={styles.scoreLabel}>
                    Score
                  </Text>
                </View>
                <View style={styles.scoreStatsRow}>
                  <View style={styles.scoreStatCol}>
                    <Text allowFontScaling={false} style={styles.scoreStatNumber}>
                      0
                    </Text>
                    <Text allowFontScaling={false} style={styles.scoreStatLabel}>
                      Following
                    </Text>
                  </View>
                  <View style={styles.scoreStatCol}>
                    <Text allowFontScaling={false} style={styles.scoreStatNumber}>
                      0
                    </Text>
                    <Text allowFontScaling={false} style={styles.scoreStatLabel}>
                      Followers
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {aboveActivitiesTitle}

      <Text allowFontScaling={false} style={styles.sectionTitle}>
        {sectionTitle}
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
  return <ActivitiesCalendarFlow layout="shots" monthNavStyle="pill" showHeroRow={false} />
}

function getStyles(theme: any, winW: number) {
  const pad = Math.max(16, Math.min(24, winW * 0.05))
  /** Fixed 7 columns; percentage basis is more stable than pixel math in iOS release builds. */
  const dayColumnPct = '14.285714%'
  const heroH = Math.min(220, Math.max(160, winW * 0.42))
  return StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
    },
    scrollInner: {
      paddingBottom: 32,
      paddingHorizontal: pad,
      paddingTop: 8,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 20,
    },
    shieldCol: {
      flex: 1,
      alignItems: 'center',
      maxWidth: winW * 0.44,
    },
    scoreCol: {
      flex: 1,
      alignItems: 'center',
      maxWidth: winW * 0.5,
    },
    shieldImg: {
      width: '100%',
      height: heroH,
    },
    shieldSlot: {
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    scoreCard: {
      width: '100%',
      aspectRatio: 1,
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
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: '#FFFFFF',
      marginBottom: 1,
    },
    scorePremiumLabel: {
      fontFamily: theme.mediumFont,
      fontSize: 10,
      color: '#00BBFF',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    scoreNumber: {
      fontFamily: theme.boldFont ?? theme.semiBoldFont,
      fontSize: 36,
      color: '#FFFFFF',
      lineHeight: 40,
    },
    scoreLabel: {
      fontFamily: theme.regularFont,
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
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: '#FFFFFF',
      lineHeight: 18,
    },
    scoreStatLabel: {
      fontFamily: theme.regularFont,
      fontSize: 9,
      color: 'rgba(200,220,255,0.6)',
      marginTop: 1,
    },
    heroName: {
      marginTop: 6,
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: 'rgba(255,255,255,0.85)',
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
      marginBottom: 6,
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
      color: 'rgba(255,255,255,0.45)',
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
    dayMuted: {
      opacity: 0.35,
    },
    dayNum: {
      fontFamily: theme.mediumFont,
      fontSize: 13,
      lineHeight: 16,
      textAlign: 'center',
      color: 'rgba(255,255,255,0.92)',
      ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
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
      color: '#FFFFFF',
      ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
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
      borderRadius: 999,
      padding: 4,
      marginBottom: 20,
    },
    segmentPill: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentPillActive: {
      backgroundColor: '#006EFF',
    },
    segmentLabel: {
      fontFamily: theme.mediumFont,
      fontSize: 16,
      color: '#336AB3',
    },
    segmentLabelActive: {
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont,
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
    scoreLabel: {
      fontFamily: theme.regularFont,
      fontSize: 10,
      color: '#64748B',
      marginTop: 5,
      alignSelf: 'flex-start',
    },
    scoreBig: {
      fontFamily: theme.semiBoldFont,
      fontSize: 17,
      color: '#0f172a',
      minWidth: 34,
      textAlign: 'right',
    },
    scorePending: {
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: '#94a3b8',
    },
    categoryBreakdownWrap: {
      marginTop: 7,
      gap: 4,
    },
    categoryBreakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    categoryBreakdownLabel: {
      width: 55,
      fontFamily: theme.regularFont,
      fontSize: 9,
      color: '#64748B',
    },
    categoryBreakdownTrack: {
      flex: 1,
      height: 4,
      borderRadius: 999,
      backgroundColor: '#E2E8F0',
      overflow: 'hidden',
    },
    categoryBreakdownFill: {
      height: '100%',
      backgroundColor: C.sky,
      borderRadius: 999,
    },
    categoryBreakdownValue: {
      width: 24,
      textAlign: 'right',
      fontFamily: theme.mediumFont,
      fontSize: 9,
      color: '#334155',
    },
  })
}
