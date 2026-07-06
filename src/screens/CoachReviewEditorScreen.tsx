import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  PanResponder,
  Platform,
  Keyboard,
  useWindowDimensions,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import Svg, { Path, Polygon } from 'react-native-svg'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { captureRef } from 'react-native-view-shot'
import * as VideoThumbnails from 'expo-video-thumbnails'
import * as FileSystemLegacy from 'expo-file-system/legacy'
import { ThemeContext } from '../context'
import { authClient } from '../lib/auth-client'
import { DOMAIN } from '../../constants'
import type { MainStackParamList } from '../navigation/types'
import type { ReviewAnnotation } from '../components/VideoReviewModal'
import { ProLibraryGradientFrame } from '../components/ProLibraryGradientFrame'
import { proLibraryChrome } from '../theme/proLibraryChrome'
import { useTranslation } from 'react-i18next'
import { LocalSvgAsset } from '../components/LocalSvgAsset'

const SMALLER_BRUSH_ICON = require('../../assets/videoanalysis/smallericon.svg')
const BIGGER_BRUSH_ICON = require('../../assets/videoanalysis/biggericon.svg')
const GOOD_SEND_ICON = require('../../assets/videoanalysis/goodsendbutton.svg')
const BAD_SEND_ICON = require('../../assets/videoanalysis/badsendcomment.svg')
const GOOD_INDICATOR_ICON = require('../../assets/videoanalysis/goodindicator.svg')
const BAD_INDICATOR_ICON = require('../../assets/videoanalysis/badindicaor.svg')
const BRUSH_TRACK_H = 22
const BRUSH_THUMB_SIZE = 14
const BRUSH_WEDGE_LEFT_HALF = 3
const BRUSH_WEDGE_RIGHT_HALF = 9

function brushWedgePoints(trackW: number): string {
  const cy = BRUSH_TRACK_H / 2
  const topLeft = cy - BRUSH_WEDGE_LEFT_HALF
  const bottomLeft = cy + BRUSH_WEDGE_LEFT_HALF
  const topRight = cy - BRUSH_WEDGE_RIGHT_HALF
  const bottomRight = cy + BRUSH_WEDGE_RIGHT_HALF
  return `0,${topLeft} ${trackW},${topRight} ${trackW},${bottomRight} 0,${bottomLeft}`
}

type Nav = NativeStackNavigationProp<MainStackParamList>
type R = RouteProp<MainStackParamList, 'CoachReviewEditor'>

const C_WRONG = '#FF005E'
const C_GOOD = '#00FFC3'
const BRUSH_MIN = 3
const BRUSH_MAX = 16

type Stroke = { d: string; color: string; width: number }
type EditorAnnotation = ReviewAnnotation & { tone?: 'wrong' | 'good'; clientId?: string }

type ReviewPayload = {
  id: string
  status: string
  techniqueVideoId: string
  videoPath: string
  coachFeedbackText: string | null
  coachMarksJson: unknown | null
  shotLabel?: string | null
}

function isSafeImageUri(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const s = value.trim()
  if (!s) return false
  return (
    /^data:image\/[a-z0-9.+-]+;base64,/i.test(s) ||
    /^https?:\/\//i.test(s) ||
    /^\/uploads\//i.test(s)
  )
}

function toDisplayImageUri(raw: string): string {
  const s = raw.trim()
  if (s.startsWith('http') || s.startsWith('data:image/')) return s
  if (s.startsWith('/')) return `${DOMAIN.replace(/\/+$/, '')}${s}`
  return s
}

function guessImageMime(uri: string): string {
  const low = uri.toLowerCase()
  if (low.endsWith('.jpg') || low.endsWith('.jpeg')) return 'image/jpeg'
  if (low.endsWith('.webp')) return 'image/webp'
  return 'image/png'
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('file-reader-failed'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(blob)
  })
}

async function toPortableImageUri(raw: string): Promise<string> {
  const uri = raw.trim()
  if (!uri) return ''
  if (uri.startsWith('data:image/') || uri.startsWith('http') || uri.startsWith('/uploads/')) {
    return uri
  }
  try {
    const res = await fetch(uri)
    const blob = await res.blob()
    const dataUri = await blobToDataUri(blob)
    if (dataUri.startsWith('data:image/')) return dataUri
  } catch {
    // Fall through to filesystem fallback.
  }
  try {
    const base64 = await FileSystemLegacy.readAsStringAsync(uri, { encoding: 'base64' as any })
    if (base64 && typeof base64 === 'string') {
      return `data:${guessImageMime(uri)};base64,${base64}`
    }
  } catch {
    // Return empty to avoid broken URIs crashing display.
  }
  return ''
}

function toReviewAnnotations(input: unknown): EditorAnnotation[] {
  if (!Array.isArray(input)) return []
  return input
    .map((r) => {
      const row = r as Record<string, unknown>
      const rawImage =
        isSafeImageUri(row.imageUri) ? row.imageUri.trim() :
        isSafeImageUri(row.cloudinaryUrl) ? row.cloudinaryUrl.trim() :
        ''
      const imageUri = rawImage ? toDisplayImageUri(rawImage) : ''
      const comment = typeof row.comment === 'string' ? row.comment : ''
      const timeMsRaw = row.timeMs
      const timeMs = typeof timeMsRaw === 'number' && Number.isFinite(timeMsRaw) ? timeMsRaw : 0
      const toneRaw = row.tone
      const tone = toneRaw === 'good' || toneRaw === 'wrong' ? toneRaw : undefined
      if (!imageUri && !comment.trim()) return null
      return { imageUri, comment, timeMs, tone } as EditorAnnotation
    })
    .filter((r): r is EditorAnnotation => !!r)
}

function formatTime(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

function formatAnnotationTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}:00`
}

type BrushSizeSliderProps = {
  value: number
  min: number
  max: number
  onChange: (size: number) => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
}

function BrushSizeSlider({ value, min, max, onChange, onUndo, onRedo, canUndo, canRedo }: BrushSizeSliderProps) {
  const trackWRef = useRef(0)
  const [trackW, setTrackW] = useState(0)
  const pct = (value - min) / (max - min)

  function handleTouch(x: number) {
    const w = trackWRef.current || 1
    const next = Math.round(min + Math.max(0, Math.min(1, x / w)) * (max - min))
    onChange(next)
  }

  const wedgePoints = trackW > 0 ? brushWedgePoints(trackW) : ''

  return (
    <View style={brushSliderStyles.row}>
      <TouchableOpacity
        onPress={() => onChange(min)}
        onLongPress={canUndo ? onUndo : undefined}
        delayLongPress={280}
        activeOpacity={0.75}
        hitSlop={8}
        accessibilityLabel="Smaller brush"
      >
        <LocalSvgAsset assetModule={SMALLER_BRUSH_ICON} width={21} height={22} />
      </TouchableOpacity>
      <View
        style={brushSliderStyles.track}
        onLayout={(e) => {
          trackWRef.current = e.nativeEvent.layout.width
          setTrackW(e.nativeEvent.layout.width)
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => handleTouch(e.nativeEvent.locationX)}
        onResponderMove={(e) => handleTouch(e.nativeEvent.locationX)}
      >
        {trackW > 0 ? (
          <Svg width={trackW} height={BRUSH_TRACK_H} style={StyleSheet.absoluteFill}>
            <Polygon points={wedgePoints} fill="rgba(0, 119, 255, 0.2)" />
          </Svg>
        ) : null}
        <View
          style={[
            brushSliderStyles.thumb,
            { left: Math.max(0, Math.min(trackW - BRUSH_THUMB_SIZE, pct * Math.max(0, trackW - BRUSH_THUMB_SIZE))) },
          ]}
        />
      </View>
      <TouchableOpacity
        onPress={() => onChange(max)}
        onLongPress={canRedo ? onRedo : undefined}
        delayLongPress={280}
        activeOpacity={0.75}
        hitSlop={8}
        accessibilityLabel="Bigger brush"
      >
        <LocalSvgAsset assetModule={BIGGER_BRUSH_ICON} width={30} height={30} />
      </TouchableOpacity>
    </View>
  )
}

const brushSliderStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  track: {
    flex: 1,
    height: BRUSH_TRACK_H,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    width: BRUSH_THUMB_SIZE,
    height: BRUSH_THUMB_SIZE,
    borderRadius: BRUSH_THUMB_SIZE / 2,
    backgroundColor: '#0077FF',
    top: (BRUSH_TRACK_H - BRUSH_THUMB_SIZE) / 2,
  },
})

export function CoachReviewEditorScreen() {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const navigation = useNavigation<Nav>()
  const route = useRoute<R>()
  const insets = useSafeAreaInsets()
  const { width: winW } = useWindowDimensions()
  const { reviewId } = route.params
  const styles = useMemo(() => getStyles(theme), [theme])

  const HPAD = 20
  const contentW = Math.max(240, winW - HPAD * 2)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [review, setReview] = useState<ReviewPayload | null>(null)
  const [feedback, setFeedback] = useState('')
  const [annotations, setAnnotations] = useState<EditorAnnotation[]>([])

  // Video state
  const videoRef = useRef<Video | null>(null)
  const [videoAspect, setVideoAspect] = useState(16 / 9)
  const [videoReady, setVideoReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [positionMs, setPositionMs] = useState(0)
  const [totalDurMs, setTotalDurMs] = useState(0)

  // Drawing state
  const boxRef = useRef<View | null>(null)
  const [frameImageUri, setFrameImageUri] = useState<string | null>(null)
  const [frozen, setFrozen] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [redoStack, setRedoStack] = useState<Stroke[]>([])
  const strokesRef = useRef<Stroke[]>([])
  const [currentPath, setCurrentPath] = useState('')
  const [drawColor, setDrawColor] = useState(C_WRONG)
  const [brushSize, setBrushSize] = useState(6)
  const [isDrawing, setIsDrawing] = useState(false)
  const pointsRef = useRef<{ x: number; y: number }[]>([])
  const drawColorRef = useRef(C_WRONG)
  const brushSizeRef = useRef(6)
  const [goodCommentDraft, setGoodCommentDraft] = useState('')
  const [badCommentDraft, setBadCommentDraft] = useState('')

  useEffect(() => { drawColorRef.current = drawColor }, [drawColor])
  useEffect(() => { brushSizeRef.current = brushSize }, [brushSize])

  const videoUri = useMemo(() => {
    if (!review?.videoPath) return null
    const base = DOMAIN.replace(/\/+$/, '')
    const p = review.videoPath.startsWith('/') ? review.videoPath : `/${review.videoPath}`
    return `${base}${p}`
  }, [review?.videoPath])

  const aspectClamped = Math.max(0.42, Math.min(2.2, videoAspect || 16 / 9))
  const boxW = contentW
  const boxH = Math.round(boxW / aspectClamped)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authClient
        .$fetch(`/coach/review/${encodeURIComponent(reviewId)}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        .catch(() => null)
      const body = ((res as { data?: unknown })?.data ?? res) as {
        review?: ReviewPayload & { aiSummary?: { shotLabel?: string | null } }
        error?: string
      }
      if (!body?.review) {
        Alert.alert(t('commonAlerts.unavailable'), body?.error || t('coachFlow.couldNotLoadReview'))
        navigation.goBack()
        return
      }
      setReview({ ...body.review, shotLabel: body.review.aiSummary?.shotLabel ?? null })
      setFeedback(body.review.coachFeedbackText || '')
      setAnnotations(toReviewAnnotations(body.review.coachMarksJson))
    } finally {
      setLoading(false)
    }
  }, [navigation, reviewId, t])

  useEffect(() => {
    void load()
  }, [load])

  // --- Video controls ---
  const freezeFrame = useCallback(
    async (ms: number) => {
      if (!videoUri) return
      try {
        const thumb = await VideoThumbnails.getThumbnailAsync(videoUri, { time: Math.max(0, Math.round(ms)) })
        if (thumb?.uri) {
          setFrameImageUri(thumb.uri)
          if (thumb.width > 0 && thumb.height > 0) setVideoAspect(thumb.width / thumb.height)
        }
        setFrozen(true)
      } catch {
        setFrozen(true)
      }
    },
    [videoUri]
  )

  async function togglePlay() {
    if (!videoRef.current) return
    if (isPlaying) {
      await videoRef.current.pauseAsync().catch(() => {})
    } else {
      // Leaving frozen/annotate mode discards the in-progress (unsaved) drawing.
      setFrozen(false)
      setFrameImageUri(null)
      strokesRef.current = []
      setStrokes([])
      setRedoStack([])
      setCurrentPath('')
      await videoRef.current.playAsync().catch(() => {})
    }
  }

  async function seekTo(ms: number) {
    const clamped = Math.max(0, Math.min(totalDurMs || 0, ms))
    if (frozen && strokes.length > 0) {
      strokesRef.current = []
      setStrokes([])
      setRedoStack([])
      setCurrentPath('')
    }
    setGoodCommentDraft('')
    setBadCommentDraft('')
    setPositionMs(clamped)
    if (videoRef.current) {
      try {
        await videoRef.current.setPositionAsync(clamped, { toleranceMillisBefore: 40, toleranceMillisAfter: 40 })
      } catch {}
    }
    if (frozen || !isPlaying) {
      void freezeFrame(clamped)
    }
  }

  // Auto-freeze the current frame whenever the video is paused so the coach can draw.
  useEffect(() => {
    if (!videoReady) return
    if (!isPlaying && !frozen) {
      void freezeFrame(positionMs)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, videoReady])

  // --- Drawing ---
  function pointsToD(pts: { x: number; y: number }[]): string {
    if (pts.length === 0) return ''
    let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
    for (let i = 1; i < pts.length; i++) d += ` L${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`
    return d
  }

  function commitStroke() {
    if (pointsRef.current.length > 1) {
      const newStroke: Stroke = {
        d: pointsToD(pointsRef.current),
        color: drawColorRef.current,
        width: brushSizeRef.current,
      }
      strokesRef.current = [...strokesRef.current, newStroke]
      setStrokes([...strokesRef.current])
      setRedoStack([])
    }
    pointsRef.current = []
    setCurrentPath('')
    setIsDrawing(false)
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        setIsDrawing(true)
        const { locationX: x, locationY: y } = e.nativeEvent
        pointsRef.current = [{ x, y }]
        setCurrentPath(`M${x.toFixed(1)},${y.toFixed(1)}`)
      },
      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent
        pointsRef.current.push({ x, y })
        setCurrentPath(pointsToD(pointsRef.current))
      },
      onPanResponderRelease: commitStroke,
      onPanResponderTerminate: commitStroke,
    })
  ).current

  function undo() {
    if (strokesRef.current.length === 0) return
    const last = strokesRef.current[strokesRef.current.length - 1]
    strokesRef.current = strokesRef.current.slice(0, -1)
    setStrokes([...strokesRef.current])
    setRedoStack((prev) => [...prev, last])
  }

  function redo() {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      strokesRef.current = [...strokesRef.current, last]
      setStrokes([...strokesRef.current])
      return prev.slice(0, -1)
    })
  }

  function sendComment(tone: 'good' | 'wrong') {
    Keyboard.dismiss()
    const draft = tone === 'good' ? goodCommentDraft : badCommentDraft
    const trimmed = draft.trim()
    if (!trimmed) return

    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const captureTimeMs = positionMs
    const hasDrawing = strokes.length > 0

    if (tone === 'good') setGoodCommentDraft('')
    else setBadCommentDraft('')

    setAnnotations((prev) => [
      ...prev,
      { clientId, comment: trimmed, timeMs: captureTimeMs, tone, imageUri: '' },
    ])

    if (!hasDrawing) {
      strokesRef.current = []
      setStrokes([])
      setRedoStack([])
      setCurrentPath('')
      return
    }

    void (async () => {
      let imageUri = ''
      if (boxRef.current) {
        try {
          const base64 = await captureRef(boxRef, { format: 'png', quality: 0.92, result: 'base64' })
          imageUri = base64 ? `data:image/png;base64,${base64}` : ''
        } catch {
          imageUri = ''
        }
      }

      strokesRef.current = []
      setStrokes([])
      setRedoStack([])
      setCurrentPath('')

      if (!imageUri) return
      setAnnotations((prev) =>
        prev.map((ann) => (ann.clientId === clientId ? { ...ann, imageUri, clientId: undefined } : ann))
      )
    })()
  }

  async function submit() {
    setSubmitting(true)
    try {
      const normalizedAnnotations = await Promise.all(
        annotations.map(async (ann) => ({
          imageUri: ann.imageUri ? await toPortableImageUri(ann.imageUri) : '',
          comment: ann.comment,
          timeMs: ann.timeMs,
          tone: ann.tone ?? null,
        }))
      )
      const coachMarksJson: unknown =
        normalizedAnnotations.length > 0
          ? normalizedAnnotations.filter((ann) => ann.imageUri || ann.comment.trim().length > 0)
          : null
      const res = await authClient
        .$fetch<{ ok?: boolean; error?: string }>(
          `/coach/review/${encodeURIComponent(reviewId)}/submit`,
          {
            method: 'POST',
            body: {
              coachFeedbackText: feedback.trim(),
              coachMarksJson,
            } as Record<string, unknown>,
          }
        )
        .catch((e) => ({ error: e?.message || 'Request failed' }))
      const body = ((res as { data?: unknown })?.data ?? res) as { ok?: boolean; error?: string }
      if (!body?.ok) {
        Alert.alert(t('coachFlow.submitFailed'), body?.error || t('coachFlow.submitFailed'))
        return
      }
      Alert.alert(t('coachFlow.reviewSent'), t('coachFlow.reviewSentBody'), [
        { text: t('commonAlerts.ok'), onPress: () => navigation.goBack() },
      ])
    } finally {
      setSubmitting(false)
    }
  }

  const timelineTrackWRef = useRef(0)

  // Brush-size slider (wedge track between smaller / bigger icons)
  function handleBrushChange(size: number) {
    setBrushSize(Math.max(BRUSH_MIN, Math.min(BRUSH_MAX, size)))
  }

  if (loading || !review) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color="#00BBFF" />
      </View>
    )
  }

  const progressPct = totalDurMs > 0 ? positionMs / totalDurMs : 0

  return (
    <KeyboardAwareScrollView
      style={[styles.root, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={[styles.inner, { paddingTop: 8 + insets.top, paddingBottom: 28 + insets.bottom, paddingHorizontal: HPAD }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEnabled={!isDrawing}
      bottomOffset={insets.bottom + 12}
    >
      {/* Top bar */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow} activeOpacity={0.85} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color="#00BBFF" />
        <Text allowFontScaling={false} style={[styles.backText, { fontFamily: theme.mediumFont }]}>
          {t('coachReview.backToStudent')}
        </Text>
      </TouchableOpacity>

      <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.semiBoldFont }]}>
        {t('coachReview.videoAnalysis')}
      </Text>

      {/* Comments count + legend */}
      <View style={styles.metaRow}>
        <View>
          <Text allowFontScaling={false} style={[styles.metaLabel, { fontFamily: theme.regularFont }]}>
            {t('coachReview.comments')}
          </Text>
          <Text allowFontScaling={false} style={[styles.metaCount, { fontFamily: theme.semiBoldFont }]}>
            {annotations.length}
          </Text>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: C_WRONG }]} />
            <Text allowFontScaling={false} style={[styles.legendText, { fontFamily: theme.regularFont }]}>
              {t('coachReview.wrong')}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: C_GOOD }]} />
            <Text allowFontScaling={false} style={[styles.legendText, { fontFamily: theme.regularFont }]}>
              {t('coachReview.good')}
            </Text>
          </View>
        </View>
      </View>

      {/* Shot selector */}
      {review.shotLabel ? (
        <View style={styles.shotCard}>
          <Text allowFontScaling={false} style={[styles.shotTitle, { fontFamily: theme.semiBoldFont }]} numberOfLines={1}>
            {review.shotLabel}
          </Text>
        </View>
      ) : null}

      {/* Video + connected control panel */}
      <View style={[styles.mediaUnit, { width: boxW }]}>
        <ProLibraryGradientFrame
          style={{ width: boxW }}
          borderRadius={14}
          innerBorderRadius={14 - proLibraryChrome.frameStrokeWidth}
          strokeWidth={proLibraryChrome.frameStrokeWidth}
          innerShadow={false}
          innerStyle={{ backgroundColor: 'transparent' }}
        >
        <View
          style={[styles.videoBox, { width: boxW, height: boxH }]}
        >
          <View ref={boxRef} collapsable={false} style={StyleSheet.absoluteFill}>
          {videoUri ? (
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={false}
              isMuted={false}
              onLoad={(status) => {
                if (!status.isLoaded) return
                setVideoReady(true)
                if (typeof status.durationMillis === 'number' && status.durationMillis > 0) setTotalDurMs(status.durationMillis)
                const ns: any = (status as any).naturalSize
                if (ns?.width > 0 && ns?.height > 0) setVideoAspect(ns.width / ns.height)
              }}
              onReadyForDisplay={(e) => {
                setVideoReady(true)
                const ns = e.naturalSize
                if (ns?.width > 0 && ns?.height > 0) setVideoAspect(ns.width / ns.height)
              }}
              onPlaybackStatusUpdate={(status) => {
                if (!status.isLoaded) return
                setIsPlaying(!!status.isPlaying)
                setPositionMs(status.positionMillis ?? 0)
                if (typeof status.durationMillis === 'number' && status.durationMillis > 0) setTotalDurMs(status.durationMillis)
              }}
            />
          ) : null}

          {frozen && frameImageUri ? (
            <Image source={{ uri: frameImageUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          ) : null}

          <View style={StyleSheet.absoluteFill} pointerEvents={frozen ? 'auto' : 'none'} {...(frozen ? panResponder.panHandlers : {})}>
            <Svg width={boxW} height={boxH} style={StyleSheet.absoluteFill}>
              {strokes.map((sk, i) => (
                <Path key={i} d={sk.d} stroke={sk.color} strokeWidth={sk.width} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              ))}
              {currentPath ? (
                <Path d={currentPath} stroke={drawColor} strokeWidth={brushSize} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              ) : null}
            </Svg>
          </View>
          </View>

          {!videoReady ? (
            <View style={styles.videoLoading}>
              <ActivityIndicator color="#00BBFF" size="large" />
            </View>
          ) : null}

          {/* Playback controls overlaid at bottom of video */}
          <View style={styles.playbackOverlay} pointerEvents="box-none">
            <View style={styles.playbackRow}>
              <TouchableOpacity onPress={() => void togglePlay()} style={styles.playBtn} activeOpacity={0.8}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color="#FFFFFF" />
              </TouchableOpacity>
              <View
                style={styles.timelineTrack}
                onLayout={(e) => { timelineTrackWRef.current = e.nativeEvent.layout.width }}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(e) => { void seekTo((e.nativeEvent.locationX / Math.max(1, timelineTrackWRef.current)) * totalDurMs) }}
                onResponderMove={(e) => { void seekTo((e.nativeEvent.locationX / Math.max(1, timelineTrackWRef.current)) * totalDurMs) }}
              >
                <View style={styles.timelineBase} />
                <View style={[styles.timelineFill, { width: `${progressPct * 100}%` }]} />
                {annotations.map((ann, i) => {
                  const pct = totalDurMs > 0 ? Math.max(0, Math.min(1, ann.timeMs / totalDurMs)) : 0
                  return (
                    <View
                      key={`${ann.timeMs}-${i}`}
                      style={[
                        styles.timelineMarker,
                        { left: `${pct * 100}%`, backgroundColor: ann.tone === 'good' ? C_GOOD : C_WRONG },
                      ]}
                    />
                  )
                })}
                <View style={[styles.timelineThumb, { left: `${progressPct * 100}%` }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Connected control panel — #041641 */}
        <View style={styles.controlPanel}>
          <View style={styles.toolsRow}>
            <BrushSizeSlider
              value={brushSize}
              min={BRUSH_MIN}
              max={BRUSH_MAX}
              onChange={handleBrushChange}
              onUndo={undo}
              onRedo={redo}
              canUndo={strokes.length > 0}
              canRedo={redoStack.length > 0}
            />
          </View>

          <View style={styles.commentAtRow}>
            <View>
              <Text allowFontScaling={false} style={[styles.commentAtLabel, { fontFamily: theme.regularFont }]}>
                {t('coachReview.commentAt')}
              </Text>
              <Text allowFontScaling={false} style={[styles.commentAtTime, { fontFamily: theme.semiBoldFont }]}>
                {formatTime(positionMs)}
              </Text>
            </View>
            <View style={styles.colorPickRow}>
              <TouchableOpacity onPress={() => setDrawColor(C_GOOD)} activeOpacity={0.85}>
                <View style={[styles.colorDot, { backgroundColor: C_GOOD }, drawColor === C_GOOD && styles.colorDotActive]} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setDrawColor(C_WRONG)} activeOpacity={0.85}>
                <View style={[styles.colorDot, { backgroundColor: C_WRONG }, drawColor === C_WRONG && styles.colorDotActive]} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.commentCardsWrap}>
            <View style={styles.commentCard}>
              <View style={styles.commentInputRow}>
                <TextInput
                  value={goodCommentDraft}
                  onChangeText={setGoodCommentDraft}
                  placeholder={t('coachReview.goodComments')}
                  placeholderTextColor="#86A7D2"
                  multiline
                  style={[styles.commentInput, { fontFamily: theme.regularFont }]}
                />
                <TouchableOpacity
                  onPress={() => sendComment('good')}
                  activeOpacity={0.85}
                  hitSlop={6}
                  style={styles.commentSendBtn}
                  accessibilityLabel={t('coachReview.sendGoodComment')}
                >
                  <LocalSvgAsset assetModule={GOOD_SEND_ICON} width={32} height={32} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.commentCard, styles.commentCardCompact]}>
              <View style={styles.commentInputRow}>
                <TextInput
                  value={badCommentDraft}
                  onChangeText={setBadCommentDraft}
                  placeholder={t('coachReview.badComments')}
                  placeholderTextColor="#86A7D2"
                  multiline
                  style={[styles.commentInput, { fontFamily: theme.regularFont }]}
                />
                <TouchableOpacity
                  onPress={() => sendComment('wrong')}
                  activeOpacity={0.85}
                  hitSlop={6}
                  style={styles.commentSendBtn}
                  accessibilityLabel={t('coachReview.sendBadComment')}
                >
                  <LocalSvgAsset assetModule={BAD_SEND_ICON} width={32} height={32} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {annotations.length > 0 ? (
            <View style={styles.annotationsSection}>
              <View style={styles.annotationsDivider} />
              {annotations.map((ann, idx) => (
                <View key={ann.clientId ?? `${ann.timeMs}-${idx}`} style={styles.annotationItem}>
                  <View style={styles.annotationHeaderRow}>
                    <Text allowFontScaling={false} style={[styles.annotationLabel, { fontFamily: theme.regularFont }]}>
                      {t('coachReview.annotationComment')}
                    </Text>
                    <View style={styles.annotationMetaRight}>
                      <LocalSvgAsset
                        assetModule={ann.tone === 'good' ? GOOD_INDICATOR_ICON : BAD_INDICATOR_ICON}
                        width={12}
                        height={12}
                      />
                      <Text allowFontScaling={false} style={[styles.annotationTimestamp, { fontFamily: theme.mediumFont }]}>
                        {formatAnnotationTime(ann.timeMs)}
                      </Text>
                    </View>
                  </View>
                  {ann.comment ? (
                    <Text allowFontScaling={false} style={[styles.annotationBody, { fontFamily: theme.regularFont }]}>
                      {ann.comment}
                    </Text>
                  ) : null}
                  {ann.imageUri ? (
                    <Image
                      source={{ uri: ann.imageUri }}
                      style={[styles.annotationImage, { aspectRatio: aspectClamped }]}
                      resizeMode="cover"
                    />
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
        </ProLibraryGradientFrame>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
          accessibilityLabel={t('coachReview.backToStudent')}
        >
          <Ionicons name="chevron-back" size={22} color="#00BBFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButtonOuter, submitting && styles.submitButtonDisabled]}
          onPress={() => void submit()}
          disabled={submitting}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={['#0022FF', '#00BBFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitButtonInner}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text allowFontScaling={false} style={[styles.submitButtonText, { fontFamily: theme.semiBoldFont }]}>
                {t('coachReview.submitReviews')}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollView>
  )
}

function getStyles(theme: { backgroundColor?: string; mutedForegroundColor?: string }) {
  return StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    inner: {},
    backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 14 },
    backText: { color: '#00BBFF', fontSize: 15 },
    actionRow: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16,
    },
    backButton: {
      width: 54,
      height: 54,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(6, 26, 86, 0.9)',
    },
    submitButtonOuter: {
      flex: 1,
      borderRadius: 16,
      overflow: 'hidden',
    },
    submitButtonDisabled: {
      opacity: 0.7,
    },
    submitButtonInner: {
      minHeight: 54,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitButtonText: {
      fontSize: 17,
      color: '#FFFFFF',
    },
    title: { color: '#FFFFFF', fontSize: 24, marginBottom: 14 },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    metaLabel: { color: '#5E7BA6', fontSize: 13 },
    metaCount: { color: '#FFFFFF', fontSize: 15, marginTop: 2 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 2 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { color: 'rgba(232,240,255,0.75)', fontSize: 12 },
    shotCard: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#041641',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 16,
    },
    shotTitle: { color: '#00B8FF', fontSize: 16, textAlign: 'center' },
    mediaUnit: {
      alignSelf: 'center',
      marginBottom: 18,
    },
    videoBox: {
      overflow: 'hidden',
      backgroundColor: '#000',
    },
    playbackOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 10,
      paddingBottom: 10,
      paddingTop: 28,
      backgroundColor: 'rgba(0, 8, 24, 0.45)',
    },
    videoLoading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    playbackRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    playBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    timelineTrack: { flex: 1, height: 20, justifyContent: 'center' },
    timelineBase: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 3,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    timelineFill: {
      position: 'absolute',
      left: 0,
      height: 3,
      borderRadius: 2,
      backgroundColor: '#00BBFF',
    },
    timelineMarker: {
      position: 'absolute',
      width: 8,
      height: 8,
      borderRadius: 4,
      marginLeft: -4,
    },
    timelineThumb: {
      position: 'absolute',
      width: 14,
      height: 14,
      borderRadius: 7,
      marginLeft: -7,
      backgroundColor: '#00BBFF',
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    toolsRow: { flexDirection: 'row', alignItems: 'center' },
    controlPanel: {
      backgroundColor: '#041641',
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 14,
    },
    commentAtRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginVertical: 20,
    },
    commentAtLabel: { color: '#5E7BA6', fontSize: 13 },
    commentAtTime: { color: '#FFFFFF', fontSize: 16, marginTop: 2 },
    colorPickRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    colorDot: { width: 22, height: 22, borderRadius: 11 },
    colorDotActive: { borderWidth: 3, borderColor: '#00B8FF' },
    commentCardsWrap: { gap: 10 },
    commentCard: {
      borderWidth: 1,
      borderColor: 'rgba(0, 102, 255, 0.25)',
      borderRadius: 12,
      backgroundColor: 'rgba(3, 10, 23, 0.5)',
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 6,
      overflow: 'hidden',
    },
    commentCardCompact: {
      paddingTop: 6,
      paddingBottom: 6,
    },
    commentInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 32,
    },
    commentInput: {
      flex: 1,
      color: '#FFFFFF',
      fontSize: 14,
      lineHeight: 18,
      minHeight: 32,
      maxHeight: 120,
      paddingVertical: 0,
      paddingTop: Platform.OS === 'ios' ? 6 : 4,
      paddingBottom: Platform.OS === 'ios' ? 6 : 4,
      textAlignVertical: 'center',
      ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
    },
    commentSendBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 10,
      flexShrink: 0,
    },
    annotationsSection: {
      marginTop: 14,
      gap: 16,
    },
    annotationsDivider: {
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    annotationItem: {
      gap: 8,
    },
    annotationHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    annotationLabel: {
      color: 'rgba(94, 123, 166, 0.9)',
      fontSize: 12,
    },
    annotationMetaRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    annotationTimestamp: {
      color: 'rgba(232, 240, 255, 0.75)',
      fontSize: 12,
    },
    annotationBody: {
      color: 'rgba(232, 240, 255, 0.88)',
      fontSize: 14,
      lineHeight: 20,
    },
    annotationImage: {
      width: '100%',
      borderRadius: 10,
      backgroundColor: '#000',
      marginTop: 4,
    },
  })
}
