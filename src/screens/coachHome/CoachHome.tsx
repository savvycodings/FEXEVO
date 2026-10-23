import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Image } from 'expo-image'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { ThemeContext } from '../../context'
import { TEST_IDS } from '../../lib/testIds'
import type { PhysicalHistoryItem, PhysicalMetricsValues } from '../../lib/physicalMetrics'
import { peekCoachHome, prefetchCoachHome, type ActivityItem } from './coachHomeData'
import { DOMAIN } from '../../../constants'
import { getThumbnailAsync } from '../../lib/videoThumbnails'
import { normalizeThumbnailImageUri } from '../../components/VideoFrameCarousel'

const HERO = require('../../../assets/aicoach/home/new-user-hero.jpg')
const GREETING_WASH = require('../../../assets/aicoach/home/greeting-card.jpg')
const ICON_CAMERA = require('../../../assets/aicoach/home/icon-camera.svg')
const ICON_ARROW = require('../../../assets/aicoach/home/icon-arrow-btn.svg')
const ICON_ARROW_GLYPH = require('../../../assets/aicoach/home/icon-arrow-glyph.svg')
const ANALYZE_HALO = require('../../../assets/aicoach/home/analyze-halo.png')
const PERF_BAR_STREAK = require('../../../assets/aicoach/home/perf-bar-streak.svg')
const GLOW_DOT = require('../../../assets/aicoach/home/glow-dot.png')
const ICON_METRIC_STABILITY_1 = require('../../../assets/aicoach/home/icon-metric-stability-1.svg')
const ICON_METRIC_STABILITY_2 = require('../../../assets/aicoach/home/icon-metric-stability-2.svg')
const ICON_METRIC_STABILITY_3 = require('../../../assets/aicoach/home/icon-metric-stability-3.svg')
const ICON_METRIC_POWER = require('../../../assets/aicoach/home/icon-metric-power.svg')
const ICON_METRIC_AGILITY = require('../../../assets/aicoach/home/icon-metric-agility.svg')
const ICON_METRIC_REACTION = require('../../../assets/aicoach/home/icon-metric-reaction.svg')
const ICON_METRIC_ACCELERATION = require('../../../assets/aicoach/home/icon-metric-acceleration.svg')
const ICON_VIEWALL = require('../../../assets/aicoach/home/icon-viewall-arrow.svg')
const ICON_PLAY = require('../../../assets/aicoach/home/icon-play-btn.svg')
const ICON_RECORD = require('../../../assets/aicoach/home/icon-record.svg')
const ICON_GALLERY = require('../../../assets/aicoach/home/icon-gallery.svg')
const ICON_CLOUD = require('../../../assets/aicoach/home/icon-cloud.svg')

type Props = {
  displayName: string
  /** Signed-in user. The home waits for this before deciding new vs existing. */
  userId?: string | null
  onAnalyze: () => void
  onRecord: () => void
  onGallery: () => void
  onCloud: () => void
  onViewActivities: () => void
  onHasHistory: (hasHistory: boolean) => void
  /** Existing-user coach card. Rendered under the metric chips. */
  coach?: ReactNode
  /** Measured height of the scroll viewport. The new-user home fits inside it (no scroll). */
  viewportHeight?: number
}

function greetingKey(date: Date): 'morning' | 'afternoon' | 'evening' {
  const hour = date.getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

function average(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function CoachHome({
  displayName,
  userId,
  onAnalyze,
  onRecord,
  onGallery,
  onCloud,
  onViewActivities,
  onHasHistory,
  coach,
  viewportHeight,
}: Props) {
  const { t, i18n } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { width: winW, height: winH } = useWindowDimensions()
  const initial = userId ? peekCoachHome(userId) : null
  const [history, setHistory] = useState<PhysicalHistoryItem[] | null>(initial?.physical ?? null)
  const [latest, setLatest] = useState<ActivityItem | null>(initial?.latest ?? null)
  const [sessionsThisWeek, setSessionsThisWeek] = useState(initial?.sessionsThisWeek ?? 0)
  const [ready, setReady] = useState(initial != null)
  const loadGen = useRef(0)

  const applySnapshot = useCallback(
    (snap: NonNullable<ReturnType<typeof peekCoachHome>>) => {
      setSessionsThisWeek(snap.sessionsThisWeek)
      setHistory(snap.physical)
      setLatest(snap.latest)
      setReady(true)
      onHasHistory(snap.hasHistory)
    },
    [onHasHistory]
  )

  useLayoutEffect(() => {
    if (!userId) return
    const snap = peekCoachHome(userId)
    if (snap) applySnapshot(snap)
  }, [applySnapshot, userId])

  const load = useCallback(async () => {
    if (!userId) return
    const gen = ++loadGen.current
    const snap = await prefetchCoachHome(userId)
    if (gen !== loadGen.current || !snap || snap.userId !== userId) return
    applySnapshot(snap)
  }, [applySnapshot, userId])

  useFocusEffect(
    useCallback(() => {
      void load()
      return () => {
        loadGen.current += 1
      }
    }, [load])
  )

  const firstName = displayName.trim().split(/\s+/)[0] || t('technique.home.player')
  const hasHistory = ready && ((history?.length ?? 0) > 0 || latest != null)
  const newest = history?.[0] ?? null
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const scoredItems = (history ?? []).filter((item) => typeof item.score === 'number')
  const score =
    typeof scoredItems[0]?.score === 'number'
      ? scoredItems[0].score
      : typeof latest?.score === 'number'
        ? latest.score
        : null
  const inWindow = (minDays: number, maxDays: number) =>
    scoredItems.filter((item) => {
      const at = Date.parse(item.createdAt)
      if (!Number.isFinite(at)) return false
      const age = now - at
      return age > minDays * day && age <= maxDays * day
    })
  const last7Items = inWindow(-1, 7)
  const prior7Items = inWindow(7, 14)
  let delta: number | null = null
  let deltaCaption = t('technique.home.vsLastWeek')
  const last7Avg = average(last7Items.map((item) => item.score as number))
  const prior7Avg = average(prior7Items.map((item) => item.score as number))
  if (last7Avg != null && prior7Avg != null) {
    delta = Math.round(last7Avg - prior7Avg)
    deltaCaption = t('technique.home.vsLastWeek')
  } else if (scoredItems.length >= 2) {
    delta = Math.round((scoredItems[0].score as number) - (scoredItems[1].score as number))
    deltaCaption = t('technique.home.vsLastSession')
  }
  const windowLabel = t('technique.home.last7')
  const bars = last7Items
    .slice()
    .reverse()
    .slice(-7)
    .map((item) => item.score as number)
  const heroHeight = Math.round(Math.min(440, Math.max(220, winH * 0.4)))
  const nameSize = winW < 360 ? 26 : 32
  // New-user home must fit the viewport exactly: fixed sections keep their size and the
  // hero absorbs whatever space is left. 26 = ScrollView content padding (top 12 + bottom 14).
  const fitOneScreen = !hasHistory && typeof viewportHeight === 'number' && viewportHeight > 0

  return (
    <View
      style={[
        styles.page,
        // New-user: fill the viewport. Gap 0 so the hero owns every pixel between the
        // greeting card and Analyze; no extra page padding stealing height from it.
        fitOneScreen ? { height: viewportHeight - 26, gap: 0, paddingBottom: 0 } : null,
      ]}
    >
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
        <View style={[styles.heroSlot, fitOneScreen ? styles.heroFlex : { height: heroHeight }]}>
          <Image source={HERO} contentFit="cover" style={StyleSheet.absoluteFill} />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(3,10,23,0)', 'rgba(3,10,23,0.85)']}
            locations={[0.42, 1]}
            style={styles.heroScrim}
          />
          <View style={[styles.headline, styles.heroOverlay]}>
            <Text allowFontScaling={false} style={[styles.headlineLine, { fontFamily: theme.semiBoldFont }]}>
              {t('technique.home.headline1')}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.headlineLine, styles.headlineLineDeep, { fontFamily: theme.semiBoldFont }]}
            >
              {t('technique.home.headline2')}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[styles.headlineSub, { fontFamily: theme.mediumFont }]}
            >
              {t('technique.home.headlineSub')}
            </Text>
          </View>
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
          deltaCaption={deltaCaption}
          bars={bars}
          metrics={newest?.physicalMetrics ?? null}
          windowLabel={windowLabel}
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

type Fonts = {
  boldFont?: string
  semiBoldFont?: string
  mediumFont?: string
  regularFont?: string
  lightFont?: string
}

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
    <View style={styles.greeting} collapsable={false}>
      <View pointerEvents="none" style={styles.greetingTint} />
      <Image
        source={GREETING_WASH}
        contentFit="cover"
        contentPosition="top"
        style={styles.greetingWash}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,72,255,0.5)', 'rgba(0,72,255,0)', 'rgba(0,72,255,0.22)']}
        locations={[0, 0.42, 1]}
        style={styles.greetingEdge}
      />
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
      <View style={styles.analyzeFrame}>
        <AnalyzeRim />
        <View style={styles.analyzeShell}>
        <Pressable
          accessibilityRole="button"
          onPress={onAnalyze}
          style={({ pressed }) => [styles.analyzeCard, pressed && styles.pressed]}
        >
          <AnalyzeFill />
          <View style={styles.analyzeRow}>
            <LinearGradient
              colors={['#00BBFF', '#0B285A']}
              locations={[0.14, 0.61]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cameraTile}
            >
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(255,255,255,0.34)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Image source={ICON_CAMERA} style={styles.cameraIcon} contentFit="contain" />
            </LinearGradient>
            <View style={styles.analyzeCopy}>
              <Text allowFontScaling={false} style={[styles.analyzeTitle, { fontFamily: fonts.boldFont }]}>
                {t('technique.home.analyzeTitle')}
              </Text>
              <Text allowFontScaling={false} style={[styles.analyzeSub, { fontFamily: fonts.mediumFont }]}>
                {t('technique.home.analyzeSubtitle')}
              </Text>
            </View>
            <View style={styles.arrowBtn}>
              <Image source={ICON_ARROW} style={styles.arrowArt} contentFit="contain" />
              <Image source={ICON_ARROW_GLYPH} style={styles.arrowGlyph} contentFit="contain" />
            </View>
          </View>
        </Pressable>
        </View>
      </View>
      <View style={styles.sourceRow}>
        <SourceButton
          testID={TEST_IDS.techniqueRecord}
          icon={ICON_RECORD}
          iconWidth={15.164}
          iconHeight={14}
          label={t('technique.home.record')}
          onPress={onRecord}
          font={fonts.regularFont}
        />
        <SourceButton
          testID={TEST_IDS.techniqueChooseFile}
          icon={ICON_GALLERY}
          iconWidth={14}
          iconHeight={14}
          label={t('technique.home.gallery')}
          onPress={onGallery}
          font={fonts.regularFont}
        />
        <SourceButton
          icon={ICON_CLOUD}
          iconWidth={17.833}
          iconHeight={14}
          label={t('technique.home.cloud')}
          onPress={onCloud}
          font={fonts.regularFont}
        />
      </View>
    </View>
  )
}

function AnalyzeFill() {
  const [box, setBox] = useState({ w: 0, h: 0 })
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout
        setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }))
      }}
    >
      {box.w > 0 ? (
        <Svg width={box.w} height={box.h}>
          <Defs>
            <RadialGradient id="analyzeFill" cx="50%" cy="54%" rx="58%" ry="90%">
              <Stop offset="0" stopColor="#0A39A7" />
              <Stop offset="0.62" stopColor="#041641" />
            </RadialGradient>
            <SvgLinearGradient id="analyzeRim" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0.216" stopColor="#00B8FF" />
              <Stop offset="0.5" stopColor="#FFFFFF" />
              <Stop offset="0.788" stopColor="#00B8FF" />
              <Stop offset="1" stopColor="#87DDFF" />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width={box.w} height={box.h} rx={20} ry={20} fill="url(#analyzeFill)" opacity={0.7} />
          <Rect
            x={0.75}
            y={0.75}
            width={box.w - 1.5}
            height={box.h - 1.5}
            rx={19.25}
            ry={19.25}
            stroke="url(#analyzeRim)"
            strokeWidth={1.25}
            fill="none"
          />
        </Svg>
      ) : null}
    </View>
  )
}

function AnalyzeRim() {
  const [box, setBox] = useState({ w: 0, h: 0 })
  const pad = 20
  return (
    <View
      pointerEvents="none"
      style={styles.analyzeRim}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout
        setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }))
      }}
    >
      <Image source={ANALYZE_HALO} style={StyleSheet.absoluteFill} contentFit="fill" />
      {box.w > 0 ? (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="analyzeBloom" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#00B8FF" stopOpacity="0.8" />
              <Stop offset="1" stopColor="#00B8FF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse
            cx={pad + (box.w - pad * 2) * (243 / 390)}
            cy={pad + 1}
            rx={(box.w - pad * 2) * (89 / 390)}
            ry={9}
            fill="url(#analyzeBloom)"
          />
          <Ellipse
            cx={pad + (box.w - pad * 2) * (177 / 390)}
            cy={box.h - pad}
            rx={(box.w - pad * 2) * (89 / 390)}
            ry={9}
            fill="url(#analyzeBloom)"
          />
        </Svg>
      ) : null}
    </View>
  )
}

function SourceButton({
  icon,
  iconWidth,
  iconHeight,
  label,
  onPress,
  font,
  testID,
}: {
  icon: number
  iconWidth: number
  iconHeight: number
  label: string
  onPress: () => void
  font?: string
  testID?: string
}) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={styles.sourceBtnWrap}>
      {({ pressed }) => (
        <View style={[styles.sourceBtn, pressed && styles.pressed]}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
            locations={[0, 0.45]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.35, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Image source={icon} style={{ width: iconWidth, height: iconHeight, flexShrink: 0 }} contentFit="contain" />
          <Text allowFontScaling={false} numberOfLines={2} style={[styles.sourceLabel, { fontFamily: font }]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

function MetricIcon({ metric }: { metric: keyof PhysicalMetricsValues }) {
  if (metric === 'stability') {
    return (
      <View style={styles.metricStability}>
        <Image
          source={ICON_METRIC_STABILITY_1}
          style={[styles.metricPart, { left: 2, top: 0.2, width: 16.28, height: 23.71 }]}
          contentFit="contain"
        />
        <Image
          source={ICON_METRIC_STABILITY_2}
          style={[styles.metricPart, { left: 8.86, top: 2.92, width: 4.689, height: 4.689 }]}
          contentFit="contain"
        />
        <Image
          source={ICON_METRIC_STABILITY_3}
          style={[styles.metricPart, { left: 19.05, top: 0.48, width: 2.954, height: 2.954 }]}
          contentFit="contain"
        />
      </View>
    )
  }
  if (metric === 'power') {
    return <Image source={ICON_METRIC_POWER} style={{ width: 28, height: 28 }} contentFit="contain" />
  }
  if (metric === 'agility') {
    return <Image source={ICON_METRIC_AGILITY} style={{ width: 25, height: 25 }} contentFit="contain" />
  }
  if (metric === 'reactions') {
    return <Image source={ICON_METRIC_REACTION} style={{ width: 18.216, height: 24 }} contentFit="contain" />
  }
  return <Image source={ICON_METRIC_ACCELERATION} style={{ width: 24, height: 24 }} contentFit="contain" />
}

function PerformanceCard({
  score,
  delta,
  deltaCaption,
  bars,
  metrics,
  windowLabel,
  fonts,
}: {
  score: number | null
  delta: number | null
  deltaCaption: string
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
  const chips: { key: keyof PhysicalMetricsValues; label: string }[] = [
    { key: 'stability', label: t('technique.physicalMetricStability') },
    { key: 'power', label: t('technique.physicalMetricPower') },
    { key: 'agility', label: t('technique.physicalMetricAgility') },
    { key: 'reactions', label: t('technique.home.reaction') },
    { key: 'acceleration', label: t('technique.physicalMetricAcceleration') },
  ]

  return (
    <View style={styles.performanceWrap}>
      <View style={styles.performanceCard}>
        <View style={styles.performanceHead}>
          <Text
            allowFontScaling={false}
            style={[styles.performanceTitle, { fontFamily: fonts.boldFont ?? fonts.semiBoldFont }]}
          >
            {t('technique.home.performance')}
          </Text>
          <View style={styles.windowPill}>
            <Ionicons name="calendar-outline" size={14} color="#FFFFFF" />
            <Text allowFontScaling={false} style={[styles.windowText, { fontFamily: fonts.regularFont }]}>
              {windowLabel}
            </Text>
            <Ionicons name="chevron-down" size={12} color="#FFFFFF" />
          </View>
        </View>
        <View style={styles.performanceBody}>
          <ScoreRing score={shown} font={fonts.mediumFont ?? fonts.semiBoldFont} size={102} accent />
          <View style={styles.deltaCol}>
            {deltaLabel ? (
              <Text
                allowFontScaling={false}
                style={[styles.deltaValue, { fontFamily: fonts.boldFont ?? fonts.semiBoldFont }]}
              >
                {deltaLabel}
              </Text>
            ) : null}
            {delta != null ? (
              <Text allowFontScaling={false} style={[styles.deltaCaption, { fontFamily: fonts.mediumFont }]}>
                {deltaCaption}
              </Text>
            ) : null}
            {deltaCopy ? (
              <Text allowFontScaling={false} style={[styles.deltaNote, { fontFamily: fonts.regularFont }]}>
                {deltaCopy}
              </Text>
            ) : (
              <Text allowFontScaling={false} style={[styles.deltaNote, { fontFamily: fonts.regularFont }]}>
                {t('technique.home.startingPoint')}
              </Text>
            )}
          </View>
          <View style={styles.bars}>
            {bars.map((value, index, list) => {
              const height = Math.max(12, (Math.max(0, Math.min(100, value)) / 100) * 89)
              const last = index === list.length - 1
              return (
                <View key={`${value}-${index}`} style={styles.barTrack}>
                  {last ? (
                    <LinearGradient
                      colors={['#00BBFF', '#0B285A']}
                      locations={[0.14, 0.61]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.barBadge}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[styles.barLabel, { fontFamily: fonts.boldFont ?? fonts.semiBoldFont }]}
                      >
                        {Math.round(value)}%
                      </Text>
                    </LinearGradient>
                  ) : null}
                  <LinearGradient
                    colors={['#00FFA6', '#00BBFF', '#0022FF']}
                    locations={[0.02, 0.29, 0.98]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[styles.barFill, { height }]}
                  />
                  {last ? (
                    <>
                      <Image
                        pointerEvents="none"
                        source={PERF_BAR_STREAK}
                        style={styles.barStreak}
                        contentFit="fill"
                      />
                      <GlowDot style={{ left: -21, top: 89 - height - 23 }} />
                    </>
                  ) : null}
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
              <MetricIcon metric={chip.key} />
              <Text
                allowFontScaling={false}
                style={[styles.chipValue, { fontFamily: fonts.boldFont ?? fonts.semiBoldFont }]}
              >
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

/** White-hot centre fading softly to nothing, like the dots on the Figma ring and last bar. */
function GlowDot({ style }: { style: { left: number; top: number } }) {
  return <Image pointerEvents="none" source={GLOW_DOT} style={[styles.glowDot, style]} contentFit="fill" />
}

function ScoreRing({
  score,
  font,
  size = 78,
  accent = false,
}: {
  score: number | null
  font?: string
  size?: number
  accent?: boolean
}) {
  const small = size <= 50
  const stroke = small ? 3.6 : size > 88 ? 8 : 6
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  const progress = score == null ? 0 : score / 100
  const endAngle = (-90 + progress * 360) * (Math.PI / 180)
  const endX = size / 2 + radius * Math.cos(endAngle)
  const endY = size / 2 + radius * Math.sin(endAngle)
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          {small ? (
            <SvgLinearGradient id={`scoreRing-${size}`} x1="0" y1="0.5" x2="0.95" y2="0.72">
              <Stop offset="0" stopColor="#00BBFF" />
              <Stop offset="1" stopColor="#0022FF" />
            </SvgLinearGradient>
          ) : (
            <SvgLinearGradient id={`scoreRing-${size}`} x1="0" y1="0.5" x2="1" y2="0.5">
              <Stop offset="0" stopColor="#00FFA6" />
              <Stop offset="0.236" stopColor="#00BBFF" />
              <Stop offset="1" stopColor="#0022FF" />
            </SvgLinearGradient>
          )}
        </Defs>
        {accent ? <Circle cx={size / 2} cy={size / 2} r={radius} fill="#041641" /> : null}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={small ? 'rgba(4,22,65,0.5)' : '#0B285A'}
          strokeWidth={stroke}
          fill="transparent"
        />
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          {accent ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={`url(#scoreRing-${size})`}
              strokeWidth={stroke + 6}
              strokeOpacity={0.18}
              fill="transparent"
              strokeDasharray={`${circ}`}
              strokeDashoffset={circ * (1 - progress)}
              strokeLinecap="round"
            />
          ) : null}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#scoreRing-${size})`}
            strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={`${circ}`}
            strokeDashoffset={circ * (1 - progress)}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      {accent && score != null && progress > 0 ? (
        <GlowDot style={{ left: endX - 26, top: endY - 26 }} />
      ) : null}
      <View style={styles.ringCenter}>
        <Text
          allowFontScaling={false}
          style={[styles.ringScore, { fontFamily: font, fontSize: size > 88 ? 28 : size <= 50 ? 17 : 18 }]}
        >
          {score == null ? '—' : score}
        </Text>
        <Text allowFontScaling={false} style={[styles.ringDenom, (accent || size <= 50) && { fontSize: 8 }]}>
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
  const [localThumb, setLocalThumb] = useState<string | null>(null)
  useEffect(() => {
    if (item.thumbnailUrl || !item.videoPath) return
    let cancelled = false
    const url = item.videoPath.startsWith('http')
      ? item.videoPath
      : `${DOMAIN.replace(/\/+$/, '')}${item.videoPath}`
    void (async () => {
      try {
        const { uri } = await getThumbnailAsync(url, { time: 0, quality: 0.8 })
        if (!cancelled && uri) setLocalThumb(normalizeThumbnailImageUri(uri))
      } catch {
        /* keep the dark placeholder */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [item.thumbnailUrl, item.videoPath])
  const thumbUri = item.thumbnailUrl ?? localThumb
  const durationLabel =
    typeof item.durationMs === 'number' && item.durationMs > 0
      ? `${Math.floor(item.durationMs / 60000)}:${String(Math.round((item.durationMs % 60000) / 1000)).padStart(2, '0')}`
      : null
  return (
    <View style={styles.latestWrap}>
      <View style={styles.latestHead}>
        <Text
          allowFontScaling={false}
          style={[styles.latestTitle, { fontFamily: fonts.boldFont ?? fonts.semiBoldFont }]}
        >
          {t('technique.home.latest')}
        </Text>
        <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={styles.viewAllBtn}>
          <Text allowFontScaling={false} style={[styles.viewAll, { fontFamily: fonts.lightFont ?? fonts.regularFont }]}>
            {t('technique.home.viewAll')}
          </Text>
          <Image source={ICON_VIEWALL} style={styles.viewAllArrow} contentFit="contain" />
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.latestCard}>
        {({ pressed }) => (
          <View style={[styles.latestCardInner, pressed && styles.pressed]}>
            <View style={styles.thumb}>
              {thumbUri ? (
                <>
                  <Image source={{ uri: thumbUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <View pointerEvents="none" style={styles.thumbShade} />
                </>
              ) : null}
              <Image source={ICON_PLAY} style={styles.playBtn} contentFit="contain" />
              {durationLabel ? (
                <View style={styles.durationPill}>
                  <Text allowFontScaling={false} style={[styles.durationText, { fontFamily: fonts.mediumFont }]}>
                    {durationLabel}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.latestCopy}>
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.shotName, { fontFamily: fonts.mediumFont }]}>
                {item.shotLabel || t('technique.home.latest')}
              </Text>
              <Text allowFontScaling={false} style={[styles.shotWhen, { fontFamily: fonts.regularFont }]}>
                {whenLabel}
              </Text>
            </View>
            <ScoreRing score={score} font={fonts.mediumFont ?? fonts.semiBoldFont} size={48} />
          </View>
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { width: '100%', gap: 20, paddingBottom: 12 },
  greeting: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#071433',
    minHeight: 116,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 72, 255, 0.35)',
  },
  greetingTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 34, 255, 0.18)',
  },
  greetingWash: { ...StyleSheet.absoluteFillObject, opacity: 0.55 },
  greetingEdge: { ...StyleSheet.absoluteFillObject },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 16,
    paddingVertical: 20,
    gap: 12,
    minHeight: 116,
  },
  greetingText: { flex: 1, minWidth: 0 },
  greetingHello: { color: '#FFFFFF', fontSize: 12 },
  greetingName: { color: '#00BBFF', marginTop: 2 },
  greetingReady: { color: '#86A7D2', fontSize: 13, marginTop: 2 },
  greetingMeta: { alignItems: 'flex-end', justifyContent: 'space-between' },
  greetingDate: { color: '#FFFFFF', fontSize: 12 },
  sessionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  sessionBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 21 },
  sessionBar: { width: 4, borderRadius: 4, backgroundColor: '#00B8FF' },
  sessionCount: { color: '#86A7D2', fontSize: 12, textAlign: 'left' },
  // Responsive hero: fills whatever height is left between the greeting card and the
  // Analyze section, full width. No fixed crop/zoom — cover adapts to the slot.
  heroSlot: { width: '100%', overflow: 'hidden' },
  heroFlex: { flex: 1, minHeight: 180, alignSelf: 'stretch' },
  headline: { gap: 2 },
  headlineLine: { color: '#00BBFF', fontSize: 28, lineHeight: 32 },
  headlineLineDeep: { color: '#3D6BFF' },
  headlineSub: { color: '#86A7D2', fontSize: 11.5, marginTop: 6, lineHeight: 15, letterSpacing: -0.3 },
  heroScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  heroOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingBottom: 10 },
  analyzeWrap: { gap: 20 },
  analyzeFrame: {
    overflow: 'visible',
  },
  analyzeShell: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#041641',
  },
  analyzeRim: {
    position: 'absolute',
    left: -20,
    right: -20,
    top: -20,
    bottom: -20,
    zIndex: 0,
    opacity: 0.96,
  },
  analyzeCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  analyzeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 17,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 85,
  },
  cameraTile: {
    width: 60,
    height: 60,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 255, 0.2)',
  },
  cameraIcon: { width: 26.667, height: 22.667 },
  analyzeCopy: { flex: 1, minWidth: 0, gap: 2 },
  analyzeTitle: { color: '#00B8FF', fontSize: 16 },
  analyzeSub: { color: '#86A7D2', fontSize: 12, lineHeight: 16 },
  arrowBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  arrowArt: { position: 'absolute', width: 68, height: 68 },
  arrowGlyph: { width: 13.1385, height: 14.9946, transform: [{ rotate: '-90deg' }] },
  sourceRow: { flexDirection: 'row', gap: 5, width: '100%' },
  sourceBtnWrap: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, height: 39 },
  sourceBtn: {
    flex: 1,
    height: 39,
    width: '100%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 13,
    paddingRight: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0B285A',
    backgroundColor: 'rgba(3, 31, 77, 0.2)',
    overflow: 'hidden',
    boxShadow: '0px 0px 3px 0px rgba(0, 75, 255, 0.3)',
  },
  sourceLabel: { flex: 1, color: '#FFFFFF', fontSize: 9, lineHeight: 11, letterSpacing: -0.4 },
  pressed: { opacity: 0.82 },
  coachSlot: { width: '100%' },
  performanceWrap: { gap: 20 },
  performanceCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00B8FF',
    backgroundColor: '#001435',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 12,
    overflow: 'hidden',
    boxShadow: 'inset 0px 0px 20px 0px rgba(0, 72, 255, 0.55)',
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
  windowText: { color: '#FFFFFF', fontSize: 9 },
  performanceBody: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  deltaCol: { flex: 1, minWidth: 0, gap: 2 },
  deltaValue: { color: '#00FFA6', fontSize: 22 },
  deltaCaption: { color: '#00B8FF', fontSize: 12 },
  deltaNote: { color: '#86A7D2', fontSize: 12, lineHeight: 16 },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 6,
    height: 108,
    paddingTop: 18,
    flexShrink: 1,
  },
  barTrack: {
    width: 10,
    height: 89,
    borderRadius: 20,
    backgroundColor: '#0B285A',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  barFill: {
    width: '100%',
    borderRadius: 20,
    boxShadow: '0px 0px 10px 0px #0022FF',
  },
  barBadge: {
    position: 'absolute',
    top: -17,
    alignSelf: 'center',
    width: 32,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  barLabel: { color: '#FFFFFF', fontSize: 8 },
  barStreak: { position: 'absolute', top: 18, left: 4.5, width: 1, height: 66.453, zIndex: 2 },
  glowDot: { position: 'absolute', width: 52, height: 52, zIndex: 3 },
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
  chipValue: { color: '#FFFFFF', fontSize: 24, letterSpacing: -0.48 },
  chipLabel: { color: '#FFFFFF', fontSize: 9, letterSpacing: -0.18 },
  metricStability: { width: 24, height: 24, position: 'relative' },
  metricPart: { position: 'absolute' },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ringScore: { color: '#FFFFFF', fontSize: 18 },
  ringDenom: { color: '#86A7D2', fontSize: 10, marginTop: -2 },
  latestWrap: { gap: 10 },
  latestHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  latestTitle: { color: '#00B8FF', fontSize: 16 },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewAll: { color: 'rgba(0, 184, 255, 0.5)', fontSize: 16 },
  viewAllArrow: { width: 22, height: 22, transform: [{ rotate: '-90deg' }] },
  latestCard: {
    minHeight: 116,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#0B285A',
    backgroundColor: '#001435',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  latestCardInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: {
    width: 124,
    height: 86,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#041641',
  },
  thumbShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
  playBtn: { position: 'absolute', left: 4, bottom: 5, width: 32, height: 32 },
  durationPill: {
    position: 'absolute',
    right: 7,
    bottom: 5,
    width: 40,
    height: 20,
    borderRadius: 100,
    backgroundColor: '#041641',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationText: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  latestCopy: { flex: 1, minWidth: 0, gap: 4 },
  shotName: { color: '#00B8FF', fontSize: 16 },
  shotWhen: { color: '#86A7D2', fontSize: 11 },
})
