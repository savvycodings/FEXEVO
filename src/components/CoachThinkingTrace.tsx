import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { ResizeMode, Video, type AVPlaybackStatus } from 'expo-av'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { TFunction } from 'i18next'
import { resolveCoachVideoUrl, type CoachContext, type CoachFocus } from '../lib/coachCharacterApi'
import { CoachEyes } from './CoachCharacterAvatar'

const ACCENT = '#00B8FF'
const MUTED = 'rgba(255,255,255,0.55)'

export type TraceStepStatus = 'complete' | 'active' | 'pending'

export type TraceContent =
  | { type: 'video'; uri: string }
  | { type: 'chips'; items: Array<{ label: string; value?: string; highlight?: boolean }> }
  | { type: 'list'; items: string[] }
  | { type: 'sessions'; items: Array<{ time: string; score: string; area: string | null }> }

export type TraceStep = {
  id: string
  icon: keyof typeof Ionicons.glyphMap
  label: string
  detail?: string
  content?: TraceContent
  status: TraceStepStatus
}

export type CoachTrace = { steps: TraceStep[]; durationMs: number | null }

function humanize(raw: string): string {
  const s = raw.replace(/[_-]+/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function ratingLabel(t: TFunction, rating: string | null): string | null {
  if (!rating) return null
  const key = `coachCharacter.rating.${rating}`
  const label = t(key)
  return label === key ? humanize(rating) : label
}

function shortDate(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  } catch {
    return `${d.getDate()}/${d.getMonth() + 1}`
  }
}

function clock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function orderedMotion(lines: string[], theme: string | null): string[] {
  if (!theme) return lines
  const key = theme.toLowerCase().split(' ')[0] ?? theme.toLowerCase()
  const hit = lines.filter((line) => line.toLowerCase().includes(key))
  const rest = lines.filter((line) => !hit.includes(line))
  return [...hit, ...rest]
}

function focusVideoLabel(t: TFunction, focus: CoachFocus, locale: string): string {
  const a = focus.analysis
  if (!a) return t('coachCharacter.trace.video')
  const date = shortDate(a.createdAt, locale)
  const shot = a.shotName ? humanize(a.shotName) : t('coachCharacter.trace.shotFallback')
  const window = focus.windowLabel ?? ''
  if (a.source === 'best_in_window') return t('coachCharacter.trace.bestInWindow', { shot, window, date })
  if (a.source === 'worst_in_window') return t('coachCharacter.trace.worstInWindow', { shot, window, date })
  if (a.source === 'matching_shot') return t('coachCharacter.trace.matchingShot', { shot, date })
  if (a.source === 'selected') return t('coachCharacter.trace.selectedShot', { shot, date })
  if (focus.showMotion && !focus.showScore) return t('coachCharacter.trace.measuringShot', { shot, date })
  return t('coachCharacter.trace.lastShot', { date })
}

/** Video, score, and motion follow the question. A period summary is not the newest upload. */
function pushFocusSteps(
  steps: TraceStep[],
  t: TFunction,
  focus: CoachFocus,
  videoUri: string | null,
  locale: string
) {
  if (focus.windowLabel && focus.windowCount != null) {
    steps.push({
      id: 'window',
      icon: 'calendar-outline',
      label: t('coachCharacter.trace.windowSummary', {
        count: focus.windowCount,
        window: focus.windowLabel,
        avg: focus.windowAverage ?? '-',
        best: focus.windowBest ?? '-',
      }),
      status: 'pending',
    })
  }
  if (!focus.showVideo && focus.windowLabel) {
    steps.push({
      id: 'no-clip',
      icon: 'chatbubbles-outline',
      label: t('coachCharacter.trace.noClip'),
      status: 'pending',
    })
  }
  const a = focus.analysis
  if (!a) return
  const clip = (a.source === 'selected' ? videoUri : null) ?? resolveCoachVideoUrl(a.videoUrl)
  if (focus.showVideo && clip) {
    steps.push({
      id: 'video',
      icon: 'film-outline',
      label: focusVideoLabel(t, focus, locale),
      detail: a.shotName ? humanize(a.shotName) : undefined,
      content: { type: 'video', uri: clip },
      status: 'pending',
    })
  }
  if (focus.showScore && a.score != null) {
    const rating = ratingLabel(t, a.rating)
    steps.push({
      id: 'score',
      icon: 'speedometer-outline',
      label: t('coachCharacter.trace.score'),
      content: {
        type: 'chips',
        items: [
          { label: t('coachCharacter.trace.overall'), value: `${a.score}/100`, highlight: true },
          ...(rating ? [{ label: rating }] : []),
        ],
      },
      status: 'pending',
    })
  }
  if (focus.showBreakdown) {
    const b = a.breakdown
    const parts = [
      b.technique != null ? { label: t('coachCharacter.trace.technique'), value: String(b.technique) } : null,
      b.outcome != null ? { label: t('coachCharacter.trace.outcome'), value: String(b.outcome) } : null,
      b.tactics != null ? { label: t('coachCharacter.trace.tactics'), value: String(b.tactics) } : null,
    ].filter((x): x is { label: string; value: string } => x != null)
    if (parts.length) {
      steps.push({
        id: 'breakdown',
        icon: 'stats-chart-outline',
        label: t('coachCharacter.trace.breakdown'),
        content: { type: 'chips', items: parts },
        status: 'pending',
      })
    }
    if (a.strengths.length) {
      steps.push({
        id: 'strengths',
        icon: 'checkmark-done-outline',
        label: t('coachCharacter.trace.strengths'),
        content: { type: 'list', items: a.strengths },
        status: 'pending',
      })
    }
    const errors = a.technicalErrors ?? []
    if (errors.length) {
      steps.push({
        id: 'errors',
        icon: 'alert-circle-outline',
        label: t('coachCharacter.trace.errors'),
        content: { type: 'list', items: errors },
        status: 'pending',
      })
    }
  }
  if (focus.showMotion) {
    const motion = orderedMotion(a.measuredMotion ?? [], focus.theme)
    if (motion.length) {
      steps.push({
        id: 'motion',
        icon: 'body-outline',
        label: t('coachCharacter.trace.measuredMotion'),
        content: { type: 'list', items: motion },
        status: 'pending',
      })
    } else if (a.citeOk === false) {
      steps.push({
        id: 'motion',
        icon: 'body-outline',
        label: t('coachCharacter.trace.measuredMotionLimited'),
        status: 'pending',
      })
    }
    if (a.proReference?.label) {
      const skill = a.proReference.skillLevel ? ` · ${a.proReference.skillLevel}` : ''
      steps.push({
        id: 'proRef',
        icon: 'trophy-outline',
        label: t('coachCharacter.trace.proReference'),
        detail: `${a.proReference.label}${skill}`,
        status: 'pending',
      })
    }
    const vsPro = a.vsProJoints ?? []
    if (vsPro.length) {
      steps.push({
        id: 'vsPro',
        icon: 'git-compare-outline',
        label: t('coachCharacter.trace.vsProJoints'),
        content: { type: 'list', items: vsPro },
        status: 'pending',
      })
    }
  }
}

/** Steps the coach "walks through" before answering; all content comes from real analysis data. */
export function buildCoachTraceSteps(
  t: TFunction,
  ctx: CoachContext,
  videoUri: string | null,
  locale: string
): TraceStep[] {
  const steps: TraceStep[] = [
    { id: 'question', icon: 'chatbubble-ellipses-outline', label: t('coachCharacter.trace.question'), status: 'pending' },
  ]
  if (ctx.focus) pushFocusSteps(steps, t, ctx.focus, videoUri, locale)
  const a = ctx.analysis
  if (a && ctx.kind === 'analysis' && !ctx.focus) {
    const clip = (a.source === 'selected' ? videoUri : null) ?? resolveCoachVideoUrl(a.videoUrl)
    if (clip) {
      steps.push({
        id: 'video',
        icon: 'film-outline',
        label:
          a.source === 'latest'
            ? t('coachCharacter.trace.lastShot', { date: shortDate(a.createdAt, locale) })
            : t('coachCharacter.trace.video'),
        detail: a.shotName ?? undefined,
        content: { type: 'video', uri: clip },
        status: 'pending',
      })
    }
    if (a.score != null) {
      const rating = ratingLabel(t, a.rating)
      steps.push({
        id: 'score',
        icon: 'speedometer-outline',
        label: t('coachCharacter.trace.score'),
        content: {
          type: 'chips',
          items: [
            { label: t('coachCharacter.trace.overall'), value: `${a.score}/100`, highlight: true },
            ...(rating ? [{ label: rating }] : []),
          ],
        },
        status: 'pending',
      })
    }
    const b = a.breakdown
    const parts = [
      b.technique != null ? { label: t('coachCharacter.trace.technique'), value: String(b.technique) } : null,
      b.outcome != null ? { label: t('coachCharacter.trace.outcome'), value: String(b.outcome) } : null,
      b.tactics != null ? { label: t('coachCharacter.trace.tactics'), value: String(b.tactics) } : null,
    ].filter((x): x is { label: string; value: string } => x != null)
    if (parts.length) {
      steps.push({
        id: 'breakdown',
        icon: 'stats-chart-outline',
        label: t('coachCharacter.trace.breakdown'),
        content: { type: 'chips', items: parts },
        status: 'pending',
      })
    }
    if (a.strengths.length) {
      steps.push({
        id: 'strengths',
        icon: 'checkmark-done-outline',
        label: t('coachCharacter.trace.strengths'),
        content: { type: 'list', items: a.strengths },
        status: 'pending',
      })
    }
    const errors = a.technicalErrors ?? []
    if (errors.length) {
      steps.push({
        id: 'errors',
        icon: 'alert-circle-outline',
        label: t('coachCharacter.trace.errors'),
        content: { type: 'list', items: errors },
        status: 'pending',
      })
    }
    if (a.corrections.length || a.focusArea) {
      steps.push({
        id: 'fixes',
        icon: 'construct-outline',
        label: t('coachCharacter.trace.fixes'),
        detail: a.focusArea ? t('coachCharacter.trace.focus', { area: humanize(a.focusArea) }) : undefined,
        content: a.corrections.length ? { type: 'list', items: a.corrections } : undefined,
        status: 'pending',
      })
    }
    const motion = a.measuredMotion ?? []
    if (motion.length) {
      steps.push({
        id: 'motion',
        icon: 'body-outline',
        label: t('coachCharacter.trace.measuredMotion'),
        content: { type: 'list', items: motion },
        status: 'pending',
      })
    } else if (a.citeOk === false) {
      steps.push({
        id: 'motion',
        icon: 'body-outline',
        label: t('coachCharacter.trace.measuredMotionLimited'),
        status: 'pending',
      })
    }
    if (a.proReference?.label) {
      const skill = a.proReference.skillLevel ? ` · ${a.proReference.skillLevel}` : ''
      steps.push({
        id: 'proRef',
        icon: 'trophy-outline',
        label: t('coachCharacter.trace.proReference'),
        detail: `${a.proReference.label}${skill}`,
        status: 'pending',
      })
    }
    const vsPro = a.vsProJoints ?? []
    if (vsPro.length) {
      steps.push({
        id: 'vsPro',
        icon: 'git-compare-outline',
        label: t('coachCharacter.trace.vsProJoints'),
        content: { type: 'list', items: vsPro },
        status: 'pending',
      })
    }
  }
  const d = ctx.day
  if (d && ctx.kind === 'day') {
    steps.push({
      id: 'day',
      icon: 'calendar-outline',
      label: t('coachCharacter.trace.day'),
      detail: t('coachCharacter.trace.daySummary', {
        count: d.count,
        avg: d.averageScore ?? '-',
        best: d.bestScore ?? '-',
      }),
      content: {
        type: 'sessions',
        items: d.sessions.map((s) => ({
          time: clock(s.createdAt),
          score: s.score != null ? `${s.score}` : '-',
          area: s.focusArea ? humanize(s.focusArea) : null,
        })),
      },
      status: 'pending',
    })
  }
  const hist = ctx.history
  if (hist && ctx.kind === 'history') {
    steps.push({
      id: 'history-search',
      icon: 'library-outline',
      label: t('coachCharacter.trace.historySearch', {
        window: hist.windowLabel,
        shot: hist.shotQuery ? humanize(hist.shotQuery) : t('coachCharacter.trace.historyAllShots'),
      }),
      detail: hist.theme ? t('coachCharacter.trace.historyTheme', { theme: humanize(hist.theme) }) : undefined,
      status: 'pending',
    })
    if (hist.sessions.length) {
      steps.push({
        id: 'history-sessions',
        icon: 'list-outline',
        label: t('coachCharacter.trace.historySessions', { count: hist.sessions.length }),
        content: {
          type: 'sessions',
          items: hist.sessions.slice(0, 8).map((s) => ({
            time: shortDate(s.createdAt, locale),
            score: s.score != null ? `${s.score}` : '-',
            area: s.shotName,
          })),
        },
        status: 'pending',
      })
    }
    if (hist.notes.length) {
      steps.push({
        id: 'history-notes',
        icon: 'bulb-outline',
        label: t('coachCharacter.trace.historyNotes'),
        content: { type: 'list', items: hist.notes.slice(0, 5) },
        status: 'pending',
      })
    }
  }
  const cmp = ctx.compare
  if (cmp && ctx.kind === 'compare') {
    steps.push({
      id: 'compare-search',
      icon: 'search-outline',
      label: t('coachCharacter.trace.compareSearch', { shot: humanize(cmp.shotQuery) }),
      detail: t('coachCharacter.trace.comparePriorTarget', { when: cmp.priorLabel }),
      status: 'pending',
    })
    const cur = cmp.current
    if (cur) {
      const clip = resolveCoachVideoUrl(cur.videoUrl)
      steps.push({
        id: 'compare-current',
        icon: 'film-outline',
        label: t('coachCharacter.trace.compareCurrent', {
          shot: cur.shotName ?? humanize(cmp.shotQuery),
          date: shortDate(cur.createdAt, locale),
        }),
        detail: cur.score != null ? `${cur.score}/100` : undefined,
        content: clip ? { type: 'video', uri: clip } : undefined,
        status: 'pending',
      })
    }
    const prior = cmp.prior
    if (prior) {
      const clip = resolveCoachVideoUrl(prior.videoUrl)
      steps.push({
        id: 'compare-prior',
        icon: 'time-outline',
        label: t('coachCharacter.trace.comparePrior', {
          shot: prior.shotName ?? humanize(cmp.shotQuery),
          date: shortDate(prior.createdAt, locale),
        }),
        detail: prior.score != null ? `${prior.score}/100` : undefined,
        content: clip ? { type: 'video', uri: clip } : undefined,
        status: 'pending',
      })
    }
    if (cmp.missing === 'both' || cmp.missing === 'current' || cmp.missing === 'prior') {
      steps.push({
        id: 'compare-missing',
        icon: 'alert-circle-outline',
        label: t(`coachCharacter.trace.compareMissing.${cmp.missing}`, {
          shot: humanize(cmp.shotQuery),
          when: cmp.priorLabel,
        }),
        status: 'pending',
      })
    } else if (cur && prior && cur.score != null && prior.score != null) {
      const delta = cur.score - prior.score
      steps.push({
        id: 'compare-delta',
        icon: 'swap-vertical-outline',
        label: t('coachCharacter.trace.compareDelta'),
        content: {
          type: 'chips',
          items: [
            {
              label: t('coachCharacter.trace.compareChange'),
              value: `${delta > 0 ? '+' : ''}${delta}`,
              highlight: true,
            },
            { label: t('coachCharacter.trace.comparePriorScore'), value: `${prior.score}` },
            { label: t('coachCharacter.trace.compareCurrentScore'), value: `${cur.score}` },
          ],
        },
        status: 'pending',
      })
    }
  }
  steps.push({ id: 'answer', icon: 'create-outline', label: t('coachCharacter.trace.answer'), status: 'pending' })
  return steps
}

function usePulse(active: boolean) {
  const v = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (!active) {
      v.setValue(1)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.35, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [active, v])
  return v
}

// The technique screen already runs several video players; a live player per trace exhausts the Java heap,
// so cards show a cached frame and only mount a player while the user plays the clip.
const thumbnailCache = new Map<string, Promise<string | null>>()

export function clipThumbnail(uri: string): Promise<string | null> {
  let pending = thumbnailCache.get(uri)
  if (!pending) {
    pending = VideoThumbnails.getThumbnailAsync(uri, { time: 1000, quality: 0.6 })
      .then((r) => r.uri)
      .catch(() => {
        thumbnailCache.delete(uri)
        return null
      })
    thumbnailCache.set(uri, pending)
  }
  return pending
}

export function CoachClipCard({ uri }: { uri: string }) {
  const [thumb, setThumb] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [buffering, setBuffering] = useState(false)
  useEffect(() => {
    let alive = true
    void clipThumbnail(uri).then((t) => {
      if (!alive) return
      if (t) setThumb(t)
      else setFailed(true)
    })
    return () => {
      alive = false
    }
  }, [uri])
  const onPress = () => {
    if (!playing) {
      setPlaying(true)
      setPaused(false)
      setBuffering(true)
    } else {
      setPaused((p) => !p)
    }
  }
  const onStatus = (s: AVPlaybackStatus) => {
    if (!s.isLoaded) return
    setBuffering(s.isBuffering && !s.isPlaying)
    if (s.didJustFinish) {
      setPlaying(false)
      setPaused(false)
    }
  }
  const showBadge = (thumb || playing) && (!playing || paused)
  return (
    <Pressable
      style={styles.videoWrap}
      onPress={onPress}
      disabled={failed && !thumb}
      accessibilityRole="button"
      accessibilityLabel="Play shot"
    >
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.video} resizeMode="cover" />
      ) : failed ? (
        <Ionicons name="film-outline" size={28} color={MUTED} />
      ) : (
        <ActivityIndicator size="small" color={ACCENT} />
      )}
      {playing ? (
        <Video
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay={!paused}
          isMuted={false}
          onPlaybackStatusUpdate={onStatus}
          onError={() => {
            setPlaying(false)
            setBuffering(false)
          }}
        />
      ) : null}
      {playing && buffering ? <ActivityIndicator style={styles.clipSpinner} size="small" color="#FFFFFF" /> : null}
      {showBadge ? (
        <View style={styles.playBadge}>
          <Ionicons name="play" size={14} color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  )
}

function StepContent({ content }: { content: TraceContent }) {
  if (content.type === 'video') return <CoachClipCard uri={content.uri} />
  if (content.type === 'chips') {
    return (
      <View style={styles.chips}>
        {content.items.map((c, i) => (
          <View key={i} style={[styles.chip, c.highlight && styles.chipHighlight]}>
            <Text allowFontScaling={false} style={styles.chipLabel}>
              {c.label}
            </Text>
            {c.value ? (
              <Text allowFontScaling={false} style={styles.chipValue}>
                {c.value}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    )
  }
  if (content.type === 'list') {
    return (
      <View style={styles.list}>
        {content.items.map((line, i) => (
          <Text key={i} style={styles.listItem} numberOfLines={3}>
            {`\u2022 ${line}`}
          </Text>
        ))}
      </View>
    )
  }
  return (
    <View style={styles.list}>
      {content.items.map((s, i) => (
        <View key={i} style={styles.sessionRow}>
          <Text allowFontScaling={false} style={styles.sessionTime}>
            {s.time}
          </Text>
          <Text allowFontScaling={false} style={styles.sessionScore}>
            {s.score}
          </Text>
          {s.area ? (
            <Text allowFontScaling={false} style={styles.sessionArea} numberOfLines={1}>
              {s.area}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  )
}

function StepRow({ step, last }: { step: TraceStep; last: boolean }) {
  const fade = useRef(new Animated.Value(step.status === 'pending' ? 0 : 1)).current
  const visible = step.status !== 'pending'
  useEffect(() => {
    if (!visible) return
    Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start()
  }, [visible, fade])
  const pulse = usePulse(step.status === 'active')
  if (!visible) return null
  return (
    <Animated.View
      style={[
        styles.stepRow,
        { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] },
      ]}
    >
      <View style={styles.rail}>
        <Animated.View style={[styles.stepIcon, step.status === 'active' && styles.stepIconActive, { opacity: pulse }]}>
          <Ionicons
            name={step.status === 'complete' ? 'checkmark' : step.icon}
            size={12}
            color={step.status === 'complete' ? ACCENT : '#FFFFFF'}
          />
        </Animated.View>
        {!last ? <View style={styles.railLine} /> : null}
      </View>
      <View style={styles.stepBody}>
        <Text allowFontScaling={false} style={[styles.stepLabel, step.status === 'active' && styles.stepLabelActive]}>
          {step.label}
        </Text>
        {step.detail ? (
          <Text allowFontScaling={false} style={styles.stepDetail}>
            {step.detail}
          </Text>
        ) : null}
        {step.content ? <StepContent content={step.content} /> : null}
      </View>
    </Animated.View>
  )
}

type CoachThinkingTraceProps = {
  trace: CoachTrace
  thinking: boolean
  thinkingLabel: string
  doneLabel: (seconds: number) => string
  defaultOpen?: boolean
}

export function CoachThinkingTrace({ trace, thinking, thinkingLabel, doneLabel, defaultOpen }: CoachThinkingTraceProps) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  useEffect(() => {
    if (thinking) setOpen(true)
  }, [thinking])
  const seconds = Math.max(1, Math.round((trace.durationMs ?? 0) / 1000))
  const visibleSteps = trace.steps.filter((s) => s.status !== 'pending')

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.trigger}
        onPress={() => setOpen((o) => !o)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <CoachEyes thinking={thinking} />
        <Text allowFontScaling={false} style={styles.triggerText}>
          {thinking ? thinkingLabel : doneLabel(seconds)}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={MUTED} />
      </Pressable>
      {open ? (
        <View style={styles.steps}>
          {visibleSteps.map((s, i) => (
            <StepRow key={s.id} step={s} last={i === visibleSteps.length - 1} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  triggerText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '500',
  },
  steps: {
    marginTop: 8,
    marginLeft: 1,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rail: {
    alignItems: 'center',
    width: 22,
  },
  stepIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,184,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,184,255,0.35)',
  },
  stepIconActive: {
    backgroundColor: 'rgba(0,184,255,0.35)',
    borderColor: ACCENT,
  },
  railLine: {
    flex: 1,
    width: 1,
    marginVertical: 2,
    backgroundColor: 'rgba(0,184,255,0.25)',
  },
  stepBody: {
    flex: 1,
    paddingBottom: 10,
    paddingTop: 2,
  },
  stepLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  stepLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  stepDetail: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
  },
  videoWrap: {
    marginTop: 8,
    width: 165,
    height: 166,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#00BBFF',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playBadge: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  clipSpinner: {
    position: 'absolute',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipHighlight: {
    backgroundColor: 'rgba(0,184,255,0.18)',
    borderColor: 'rgba(0,184,255,0.6)',
  },
  chipLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
  },
  chipValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  list: {
    marginTop: 4,
    gap: 3,
  },
  listItem: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    lineHeight: 17,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionTime: {
    color: MUTED,
    fontSize: 12,
    width: 40,
  },
  sessionScore: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    width: 28,
  },
  sessionArea: {
    flex: 1,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
  },
})
