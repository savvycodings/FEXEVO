import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { ResizeMode, Video, type AVPlaybackStatus } from 'expo-av'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { TFunction } from 'i18next'
import { resolveCoachVideoUrl, type CoachContext } from '../lib/coachCharacterApi'
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
  const a = ctx.analysis
  if (a && ctx.kind === 'analysis') {
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
