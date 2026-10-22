import { useCallback, useContext, useState, type ReactNode } from 'react'
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, G } from 'react-native-svg'
import { ThemeContext } from '../../context'
import { authClient } from '../../lib/auth-client'
import { TEST_IDS } from '../../lib/testIds'
import type { PhysicalHistoryItem, PhysicalMetricsValues } from '../../lib/physicalMetrics'

const HERO = require('../../../assets/aicoach/home/new-user-hero.jpg')
const GREETING_WASH = require('../../../assets/aicoach/home/greeting-wash.jpg')

type ActivityItem = {
  analysisId?: string
  status?: string
  createdAt?: string
  score?: number | null
  shotLabel?: string | null
}

type Props = {
  displayName: string
  onAnalyze: () => void
  onRecord: () => void
  onGallery: () => void
  onCloud: () => void
  onViewActivities: () => void
  onHasHistory: (hasHistory: boolean) => void
  /** Existing-user coach card. Rendered under the metric chips. */
  coach?: ReactNode
}

function greetingKey(date: Date): 'morning' | 'afternoon' | 'evening' {
  const hour = date.getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

function startOfWeek(date: Date): Date {
  const next = new Date(date)
  const day = next.getDay()
  const mondayOffset = day === 0 ? 6 : day - 1
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() - mondayOffset)
  return next
}

function average(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function CoachHome({
  displayName,
  onAnalyze,
  onRecord,
  onGallery,
  onCloud,
  onViewActivities,
  onHasHistory,
  coach,
}: Props) {
  const { t, i18n } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { width: winW, height: winH } = useWindowDimensions()
  const [history, setHistory] = useState<PhysicalHistoryItem[] | null>(null)
  const [latest, setLatest] = useState<ActivityItem | null>(null)
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0)
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    try {
      const [activityRes, historyRes] = await Promise.all([
        authClient.$fetch<{ items?: ActivityItem[] }>('/technique/activities', { method: 'GET' }),
        authClient.$fetch<{ items?: PhysicalHistoryItem[] }>('/technique/physical-history?limit=12', {
          method: 'GET',
        }),
      ])
      const activityBody = ((activityRes as { data?: { items?: ActivityItem[] } }).data ??
        activityRes) as { items?: ActivityItem[] }
      const historyBody = ((historyRes as { data?: { items?: PhysicalHistoryItem[] } }).data ??
        historyRes) as { items?: PhysicalHistoryItem[] }
      const activities = Array.isArray(activityBody?.items) ? activityBody.items : []
      const completed = activities.filter((item) => item?.status === 'completed')
      const physical = (Array.isArray(historyBody?.items) ? historyBody.items : []).filter(
        (row) => row && typeof row.analysisId === 'string' && row.physicalMetrics
      )
      const weekStart = startOfWeek(new Date()).getTime()
      const weekCount = completed.filter((item) => {
        const at = item.createdAt ? Date.parse(item.createdAt) : NaN
        return Number.isFinite(at) && at >= weekStart
      }).length
      const hasHistory = completed.length > 0 || physical.length > 0
      setSessionsThisWeek(weekCount)
      setHistory(physical)
      setLatest(completed[0] ?? null)
      setReady(true)
      onHasHistory(hasHistory)
    } catch {
      setReady(true)
      onHasHistory(false)
    }
  }, [onHasHistory])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load])
  )

  const firstName = displayName.trim().split(/\s+/)[0] || t('technique.home.player')
  const hasHistory = ready && ((history?.length ?? 0) > 0 || latest != null)
  const newest = history?.[0] ?? null
  const score =
    typeof newest?.score === 'number'
      ? newest.score
      : typeof latest?.score === 'number'
        ? latest.score
        : null
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const recentScores = (history ?? []).filter((item) => {
    const at = Date.parse(item.createdAt)
    return Number.isFinite(at) && now - at <= 30 * day && typeof item.score === 'number'
  })
  const priorScores = (history ?? []).filter((item) => {
    const at = Date.parse(item.createdAt)
    const age = now - at
    return Number.isFinite(at) && age > 30 * day && age <= 60 * day && typeof item.score === 'number'
  })
  const recentAvg = average(recentScores.map((item) => item.score as number))
  const priorAvg = average(priorScores.map((item) => item.score as number))
  const delta =
    recentAvg != null && priorAvg != null ? Math.round(recentAvg - priorAvg) : null
  const bars = (recentScores.length ? recentScores : (history ?? []).filter((item) => typeof item.score === 'number'))
    .slice()
    .reverse()
    .slice(-10)
  // Crop the pose hero so the player fills the band and the record/gallery/cloud actions stay on screen.
  const heroHeight = Math.round(Math.min(236, Math.max(200, winH * 0.27)))
  const nameSize = winW < 360 ? 26 : 30

  return (
    <View style={styles.page}>
      <GreetingCard
        greeting={t(`technique.home.${greetingKey(new Date())}`)}
        name={firstName}
        nameSize={nameSize}
        ready={t('technique.home.ready')}
        sessions={t('technique.home.sessionsCount', { count: sessionsThisWeek })}
        thisWeek={t('technique.home.thisWeek')}
        dateLabel={
          hasHistory
            ? new Date().toLocaleDateString(i18n.language, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })
            : null
        }
        fonts={theme}
      />

      {hasHistory ? (
        <AnalyzeBlock
          onAnalyze={onAnalyze}
          onRecord={onRecord}
          onGallery={onGallery}
          onCloud={onCloud}
          fonts={theme}
        />
      ) : null}

      {!hasHistory && ready ? (
        <View style={[styles.heroFrame, { height: heroHeight }]}>
          <Image
            source={HERO}
            resizeMode="cover"
            style={styles.heroImage}
            accessibilityIgnoresInvertColors
          />
        </View>
      ) : null}

      {!hasHistory && ready ? (
        <View style={styles.headline}>
          <Text allowFontScaling={false} style={[styles.headlineLine, { fontFamily: theme.semiBoldFont }]}>
            {t('technique.home.headline1')}
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.headlineLine, styles.headlineLineDeep, { fontFamily: theme.semiBoldFont }]}
          >
            {t('technique.home.headline2')}
          </Text>
          <Text allowFontScaling={false} style={[styles.headlineSub, { fontFamily: theme.mediumFont }]}>
            {t('technique.home.headlineSub')}
          </Text>
        </View>
      ) : null}

      {!hasHistory ? (
        <AnalyzeBlock
          onAnalyze={onAnalyze}
          onRecord={onRecord}
          onGallery={onGallery}
          onCloud={onCloud}
          fonts={theme}
        />
      ) : null}

      {hasHistory ? (
        <PerformanceCard
          score={score}
          delta={delta}
          bars={bars.map((item) => item.score as number)}
          metrics={newest?.physicalMetrics ?? null}
          windowLabel={recentScores.length ? t('technique.home.last30') : t('technique.home.recent')}
          fonts={theme}
        />
      ) : null}

      {hasHistory && coach ? <View style={styles.coachSlot}>{coach}</View> : null}

      {hasHistory && latest ? (
        <LatestCard
          item={latest}
          locale={i18n.language}
          fonts={theme}
          onPress={onViewActivities}
        />
      ) : null}
    </View>
  )
}

type Fonts = { semiBoldFont?: string; mediumFont?: string; regularFont?: string }

function GreetingCard({
  greeting,
  name,
  nameSize,
  ready,
  sessions,
  thisWeek,
  dateLabel,
  fonts,
}: {
  greeting: string
  name: string
  nameSize: number
  ready: string
  sessions: string
  thisWeek: string
  dateLabel: string | null
  fonts: Fonts
}) {
  return (
    <View style={styles.greeting}>
      <Image source={GREETING_WASH} resizeMode="cover" style={styles.greetingWash} />
      <View pointerEvents="none" style={styles.greetingGlow} />
      <View style={styles.greetingRow}>
        <View style={styles.greetingText}>
          <Text allowFontScaling={false} style={[styles.greetingHello, { fontFamily: fonts.regularFont }]}>
            {greeting}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.greetingName, { fontFamily: fonts.semiBoldFont, fontSize: nameSize }]}
          >
            {name}
          </Text>
          <Text allowFontScaling={false} style={[styles.greetingReady, { fontFamily: fonts.regularFont }]}>
            {ready}
          </Text>
        </View>
        <View style={styles.greetingMeta}>
          {dateLabel ? (
            <Text allowFontScaling={false} style={[styles.greetingDate, { fontFamily: fonts.mediumFont }]}>
              {dateLabel}
            </Text>
          ) : null}
          <View style={styles.sessionRow}>
            <View style={styles.sessionBars}>
              <View style={[styles.sessionBar, { height: 10 }]} />
              <View style={[styles.sessionBar, { height: 15 }]} />
              <View style={[styles.sessionBar, { height: 21 }]} />
            </View>
            <Text allowFontScaling={false} style={[styles.sessionCount, { fontFamily: fonts.mediumFont }]}>
              {sessions}
              {'\n'}
              {thisWeek}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

function AnalyzeBlock({
  onAnalyze,
  onRecord,
  onGallery,
  onCloud,
  fonts,
}: {
  onAnalyze: () => void
  onRecord: () => void
  onGallery: () => void
  onCloud: () => void
  fonts: Fonts
}) {
  const { t } = useTranslation()
  return (
    <View style={styles.analyzeWrap}>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onAnalyze}
        activeOpacity={0.82}
        style={styles.analyzeCard}
      >
        <LinearGradient
          colors={['#0A39A7', '#061F5B', '#041641']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.analyzeFill}
        />
        <View style={styles.analyzeRow}>
          <LinearGradient
            colors={['#00BBFF', '#0B285A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cameraTile}
          >
            <Ionicons name="camera" size={22} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.analyzeCopy}>
            <Text allowFontScaling={false} style={[styles.analyzeTitle, { fontFamily: fonts.semiBoldFont }]}>
              {t('technique.home.analyzeTitle')}
            </Text>
            <Text allowFontScaling={false} style={[styles.analyzeSub, { fontFamily: fonts.mediumFont }]}>
              {t('technique.home.analyzeSubtitle')}
            </Text>
          </View>
          <LinearGradient colors={['#00BBFF', '#2454FF']} style={styles.arrowBtn}>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </LinearGradient>
        </View>
      </TouchableOpacity>
      <View style={styles.sourceRow}>
        <SourceButton
          testID={TEST_IDS.techniqueRecord}
          icon="camera-outline"
          label={t('technique.home.record')}
          onPress={onRecord}
          font={fonts.regularFont}
        />
        <SourceButton
          testID={TEST_IDS.techniqueChooseFile}
          icon="image-outline"
          label={t('technique.home.gallery')}
          onPress={onGallery}
          font={fonts.regularFont}
        />
        <SourceButton
          icon="cloud-upload-outline"
          label={t('technique.home.cloud')}
          onPress={onCloud}
          font={fonts.regularFont}
        />
      </View>
    </View>
  )
}

function SourceButton({
  icon,
  label,
  onPress,
  font,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
  font?: string
  testID?: string
}) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      activeOpacity={0.82}
      style={styles.sourceBtn}
    >
      <View style={styles.sourceIconTile}>
        <Ionicons name={icon} size={16} color="#3DB7FF" />
      </View>
      <Text allowFontScaling={false} numberOfLines={2} style={[styles.sourceLabel, { fontFamily: font }]}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

function PerformanceCard({
  score,
  delta,
  bars,
  metrics,
  windowLabel,
  fonts,
}: {
  score: number | null
  delta: number | null
  bars: number[]
  metrics: PhysicalMetricsValues | null
  windowLabel: string
  fonts: Fonts
}) {
  const { t } = useTranslation()
  const shown = score == null ? null : Math.round(Math.max(0, Math.min(100, score)))
  const deltaLabel =
    delta == null ? null : `${delta > 0 ? '+' : ''}${delta}%`
  const deltaCopy =
    delta == null
      ? null
      : delta > 0
        ? t('technique.home.improving')
        : delta < 0
          ? t('technique.home.declining')
          : t('technique.home.steady')
  const chips: { key: keyof PhysicalMetricsValues; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { key: 'stability', icon: 'body-outline', label: t('technique.physicalMetricStability') },
    { key: 'power', icon: 'flash-outline', label: t('technique.physicalMetricPower') },
    { key: 'agility', icon: 'speedometer-outline', label: t('technique.physicalMetricAgility') },
    { key: 'reactions', icon: 'flash', label: t('technique.physicalMetricReactions') },
    { key: 'acceleration', icon: 'walk-outline', label: t('technique.physicalMetricAcceleration') },
  ]

  return (
    <View style={styles.performanceWrap}>
      <View style={styles.performanceCard}>
        <View pointerEvents="none" style={styles.performanceGlow} />
        <View style={styles.performanceHead}>
          <Text allowFontScaling={false} style={[styles.performanceTitle, { fontFamily: fonts.semiBoldFont }]}>
            {t('technique.home.performance')}
          </Text>
          <View style={styles.windowPill}>
            <Ionicons name="calendar-outline" size={14} color="#FFFFFF" />
            <Text allowFontScaling={false} style={[styles.windowText, { fontFamily: fonts.mediumFont }]}>
              {windowLabel}
            </Text>
          </View>
        </View>
        <View style={styles.performanceBody}>
          <ScoreRing score={shown} font={fonts.semiBoldFont} size={88} />
          <View style={styles.deltaCol}>
            {deltaLabel ? (
              <Text allowFontScaling={false} style={[styles.deltaValue, { fontFamily: fonts.semiBoldFont }]}>
                {deltaLabel}
              </Text>
            ) : null}
            {delta != null ? (
              <Text allowFontScaling={false} style={[styles.deltaCaption, { fontFamily: fonts.mediumFont }]}>
                {t('technique.home.vsLastMonth')}
              </Text>
            ) : null}
            {deltaCopy ? (
              <Text allowFontScaling={false} style={[styles.deltaNote, { fontFamily: fonts.regularFont }]}>
                {deltaCopy}
              </Text>
            ) : null}
          </View>
          <View style={styles.bars}>
            {(bars.length ? bars : shown != null ? [shown] : []).map((value, index, list) => {
              const height = Math.max(14, (value / 100) * 70)
              const last = index === list.length - 1
              return (
                <View key={`${value}-${index}`} style={styles.barTrack}>
                  {last && shown != null ? (
                    <View style={styles.barBadge}>
                      <Text allowFontScaling={false} style={[styles.barLabel, { fontFamily: fonts.semiBoldFont }]}>
                        {shown}%
                      </Text>
                    </View>
                  ) : null}
                  <LinearGradient
                    colors={['#00FFA6', '#00BBFF', '#0022FF']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[styles.barFill, { height }]}
                  />
                </View>
              )
            })}
          </View>
        </View>
      </View>
      {metrics ? (
        <View style={styles.chipRow}>
          {chips.map((chip) => (
            <View key={chip.key} style={styles.chip}>
              <Ionicons name={chip.icon} size={18} color="#FFFFFF" />
              <Text allowFontScaling={false} style={[styles.chipValue, { fontFamily: fonts.semiBoldFont }]}>
                {metrics[chip.key]}
              </Text>
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.chipLabel, { fontFamily: fonts.regularFont }]}>
                {chip.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function ScoreRing({ score, font, size = 78 }: { score: number | null; font?: string; size?: number }) {
  const stroke = size > 88 ? 8 : 6
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  const progress = score == null ? 0 : score / 100
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#0B285A" strokeWidth={stroke} fill="transparent" />
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#00E5FF"
            strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={`${circ}`}
            strokeDashoffset={circ * (1 - progress)}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <View style={styles.ringCenter}>
        <Text
          allowFontScaling={false}
          style={[styles.ringScore, { fontFamily: font, fontSize: size > 88 ? 26 : 18 }]}
        >
          {score == null ? '—' : score}
        </Text>
        <Text allowFontScaling={false} style={styles.ringDenom}>
          /100
        </Text>
      </View>
    </View>
  )
}

function LatestCard({
  item,
  locale,
  fonts,
  onPress,
}: {
  item: ActivityItem
  locale: string
  fonts: Fonts
  onPress: () => void
}) {
  const { t } = useTranslation()
  const when = item.createdAt ? new Date(item.createdAt) : null
  const isToday = when ? when.toDateString() === new Date().toDateString() : false
  const time = when
    ? when.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
    : ''
  const whenLabel = when
    ? `${isToday ? t('technique.home.today') : when.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} - ${time}`
    : ''
  const score = typeof item.score === 'number' ? Math.round(item.score) : null
  return (
    <View style={styles.latestWrap}>
      <View style={styles.latestHead}>
        <Text allowFontScaling={false} style={[styles.latestTitle, { fontFamily: fonts.semiBoldFont }]}>
          {t('technique.home.latest')}
        </Text>
        <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
          <Text allowFontScaling={false} style={[styles.viewAll, { fontFamily: fonts.mediumFont }]}>
            {t('technique.home.viewAll')} →
          </Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.latestCard, pressed && styles.pressed]}
      >
        <View style={styles.thumb}>
          <Ionicons name="play" size={16} color="#FFFFFF" />
        </View>
        <View style={styles.latestCopy}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.shotName, { fontFamily: fonts.semiBoldFont }]}>
            {item.shotLabel || t('technique.home.latest')}
          </Text>
          <Text allowFontScaling={false} style={[styles.shotWhen, { fontFamily: fonts.regularFont }]}>
            {whenLabel}
          </Text>
        </View>
        <ScoreRing score={score} font={fonts.semiBoldFont} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { width: '100%', gap: 12, paddingBottom: 4 },
  greeting: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 34, 255, 0.1)',
    minHeight: 112,
    justifyContent: 'center',
  },
  greetingWash: { ...StyleSheet.absoluteFillObject, opacity: 0.2 },
  greetingGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    boxShadow: 'inset 0px 0px 30px 1px rgba(0, 34, 255, 0.8)',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  greetingText: { flex: 1, minWidth: 0 },
  greetingHello: { color: '#FFFFFF', fontSize: 12 },
  greetingName: { color: '#00BBFF', marginTop: 2 },
  greetingReady: { color: '#86A7D2', fontSize: 13, marginTop: 2 },
  greetingMeta: { alignItems: 'flex-end', gap: 8 },
  greetingDate: { color: '#FFFFFF', fontSize: 12 },
  sessionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  sessionBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 21 },
  sessionBar: { width: 4, borderRadius: 4, backgroundColor: '#00B8FF' },
  sessionCount: { color: '#86A7D2', fontSize: 12, textAlign: 'left' },
  heroFrame: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#020814',
  },
  heroImage: { width: '100%', height: '100%' },
  headline: { gap: 2 },
  headlineLine: { color: '#00C2FF', fontSize: 28, lineHeight: 32 },
  headlineLineDeep: { color: '#3D6BFF' },
  headlineSub: { color: '#86A7D2', fontSize: 13, marginTop: 4, lineHeight: 18 },
  analyzeWrap: { gap: 10 },
  analyzeCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00B8FF',
    overflow: 'hidden',
    backgroundColor: '#041641',
  },
  analyzeFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  analyzeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cameraTile: {
    width: 60,
    height: 60,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 255, 0.25)',
  },
  analyzeCopy: { flex: 1, minWidth: 0, gap: 2 },
  analyzeTitle: { color: '#00B8FF', fontSize: 16 },
  analyzeSub: { color: '#86A7D2', fontSize: 12, lineHeight: 16 },
  arrowBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceRow: { width: '100%', flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  sourceBtn: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#00C8FF',
    backgroundColor: '#041633',
  },
  sourceIconTile: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#00C8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceLabel: { flexShrink: 1, color: '#FFFFFF', fontSize: 11, lineHeight: 14 },
  pressed: { opacity: 0.82 },
  coachSlot: { width: '100%' },
  performanceWrap: { gap: 5 },
  performanceCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00B8FF',
    backgroundColor: '#001435',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 12,
    overflow: 'hidden',
  },
  performanceGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    boxShadow: 'inset 0px 0px 20px 0px #0048FF',
  },
  performanceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  performanceTitle: { color: '#00B8FF', fontSize: 16, flex: 1 },
  windowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 25, 80, 0.5)',
    paddingHorizontal: 10,
  },
  windowText: { color: '#FFFFFF', fontSize: 11 },
  performanceBody: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deltaCol: { flex: 1, minWidth: 0, gap: 2 },
  deltaValue: { color: '#00FFA6', fontSize: 22 },
  deltaCaption: { color: '#00B8FF', fontSize: 12 },
  deltaNote: { color: '#86A7D2', fontSize: 12, lineHeight: 16 },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 4,
    height: 92,
    paddingTop: 16,
    flexShrink: 1,
  },
  barTrack: {
    width: 8,
    height: 74,
    borderRadius: 20,
    backgroundColor: '#0B285A',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  barFill: { width: '100%', borderRadius: 20 },
  barBadge: {
    position: 'absolute',
    top: -16,
    alignSelf: 'center',
    minWidth: 28,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 255, 0.2)',
    backgroundColor: '#0B285A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  barLabel: { color: '#FFFFFF', fontSize: 8 },
  chipRow: { flexDirection: 'row', gap: 5 },
  chip: {
    flex: 1,
    minWidth: 0,
    height: 92,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#0B285A',
    backgroundColor: 'rgba(0, 25, 80, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
    overflow: 'hidden',
  },
  chipValue: { color: '#FFFFFF', fontSize: 20 },
  chipLabel: { color: '#FFFFFF', fontSize: 9 },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ringScore: { color: '#FFFFFF', fontSize: 18 },
  ringDenom: { color: '#86A7D2', fontSize: 10, marginTop: -2 },
  latestWrap: { gap: 10 },
  latestHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  latestTitle: { color: '#00B8FF', fontSize: 16 },
  viewAll: { color: 'rgba(0, 184, 255, 0.5)', fontSize: 16 },
  latestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 116,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#0B285A',
    backgroundColor: '#001435',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  thumb: {
    width: 112,
    height: 86,
    borderRadius: 10,
    backgroundColor: '#041641',
    alignItems: 'center',
    justifyContent: 'center',
  },
  latestCopy: { flex: 1, minWidth: 0, gap: 4 },
  shotName: { color: '#00BBFF', fontSize: 16 },
  shotWhen: { color: '#86A7D2', fontSize: 12 },
})
