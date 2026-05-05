import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { ThemeContext } from '../context'
import { authClient } from '../lib/auth-client'
import { DOMAIN } from '../../constants'
import type { MainStackParamList } from '../navigation/types'
import { VideoReviewModal, type ReviewAnnotation } from '../components/VideoReviewModal'
import * as FileSystemLegacy from 'expo-file-system/legacy'

type Nav = NativeStackNavigationProp<MainStackParamList>
type R = RouteProp<MainStackParamList, 'CoachReviewEditor'>

type ReviewPayload = {
  id: string
  status: string
  techniqueVideoId: string
  videoPath: string
  coachFeedbackText: string | null
  coachMarksJson: unknown | null
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

function toReviewAnnotations(input: unknown): ReviewAnnotation[] {
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
      if (!imageUri) return null
      return { imageUri, comment, timeMs }
    })
    .filter((r): r is ReviewAnnotation => !!r)
}

function formatTime(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export function CoachReviewEditorScreen() {
  const { theme } = useContext(ThemeContext)
  const navigation = useNavigation<Nav>()
  const route = useRoute<R>()
  const insets = useSafeAreaInsets()
  const { width: winW } = useWindowDimensions()
  const { reviewId } = route.params
  const styles = useMemo(() => getStyles(theme), [theme])

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [review, setReview] = useState<ReviewPayload | null>(null)
  const [feedback, setFeedback] = useState('')
  const [reviewModalVisible, setReviewModalVisible] = useState(false)
  const [annotations, setAnnotations] = useState<ReviewAnnotation[]>([])

  const videoUri = useMemo(() => {
    if (!review?.videoPath) return null
    const base = DOMAIN.replace(/\/+$/, '')
    const p = review.videoPath.startsWith('/') ? review.videoPath : `/${review.videoPath}`
    return `${base}${p}`
  }, [review?.videoPath])
  const videoHeight = useMemo(() => {
    const contentW = Math.max(220, winW - 40)
    return Math.round(contentW * (9 / 16))
  }, [winW])

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
        review?: ReviewPayload
        error?: string
      }
      if (!body?.review) {
        Alert.alert('Unavailable', body?.error || 'Could not load this review.')
        navigation.goBack()
        return
      }
      setReview(body.review)
      setFeedback(body.review.coachFeedbackText || '')
      setAnnotations(toReviewAnnotations(body.review.coachMarksJson))
    } finally {
      setLoading(false)
    }
  }, [navigation, reviewId])

  useEffect(() => {
    void load()
  }, [load])

  async function submit() {
    setSubmitting(true)
    try {
      const normalizedAnnotations = await Promise.all(
        annotations.map(async (ann) => ({
          imageUri: await toPortableImageUri(ann.imageUri),
          comment: ann.comment,
          timeMs: ann.timeMs,
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
        Alert.alert('Submit failed', body?.error || 'Unknown error')
        return
      }
      Alert.alert('Review sent', 'Your student will see this in notifications.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ])
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !review) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color="#00BBFF" />
      </View>
    )
  }

  return (
    <KeyboardAwareScrollView
      style={[styles.root, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={[styles.inner, { paddingTop: 8 + insets.top, paddingBottom: 28 + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      bottomOffset={insets.bottom + 12}
    >
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow} activeOpacity={0.85} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color="#00BBFF" />
        <Text allowFontScaling={false} style={[styles.backText, { fontFamily: theme.mediumFont }]}>
          Back
        </Text>
      </TouchableOpacity>
      <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.semiBoldFont }]}>
        Coach review
      </Text>

      {videoUri ? (
        <Video
          source={{ uri: videoUri }}
          style={[styles.video, { height: videoHeight }]}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={false}
        />
      ) : null}

      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => setReviewModalVisible(true)}
        style={styles.openToolsOuter}
      >
        <LinearGradient
          colors={['#0022FF', '#00BBFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.openToolsInner}
        >
          <Ionicons name="brush-outline" size={18} color="#FFFFFF" />
          <Text allowFontScaling={false} style={[styles.openToolsText, { fontFamily: theme.semiBoldFont }]}>
            Open drawing tools
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <Text allowFontScaling={false} style={[styles.label, { fontFamily: theme.mediumFont }]}>
        Feedback
      </Text>
      <TextInput
        value={feedback}
        onChangeText={setFeedback}
        placeholder="Written feedback for your student…"
        placeholderTextColor={theme.mutedForegroundColor}
        multiline
        style={[styles.input, { fontFamily: theme.regularFont }]}
      />

      <View style={styles.annotationHeaderRow}>
        <Text allowFontScaling={false} style={[styles.label, { fontFamily: theme.mediumFont, marginBottom: 0 }]}>
          Annotations
        </Text>
        <Text allowFontScaling={false} style={[styles.annotationCount, { fontFamily: theme.regularFont }]}>
          {annotations.length}
        </Text>
      </View>
      {annotations.length === 0 ? (
        <Text allowFontScaling={false} style={[styles.emptyText, { fontFamily: theme.regularFont }]}>
          No annotations yet.
        </Text>
      ) : (
        annotations.map((ann, idx) => (
          <View key={`${ann.timeMs}-${idx}`} style={styles.annotationCard}>
            {ann.imageUri ? (
              <Image source={{ uri: ann.imageUri }} style={styles.annotationImage} resizeMode="cover" />
            ) : null}
            <View style={styles.annotationMetaRow}>
              <Text allowFontScaling={false} style={[styles.annotationTime, { fontFamily: theme.mediumFont }]}>
                Frame {formatTime(ann.timeMs)}
              </Text>
              <TouchableOpacity
                onPress={() => setAnnotations((prev) => prev.filter((_, i) => i !== idx))}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={17} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            {ann.comment ? (
              <Text allowFontScaling={false} style={[styles.annotationComment, { fontFamily: theme.regularFont }]}>
                {ann.comment}
              </Text>
            ) : null}
          </View>
        ))
      )}

      <TouchableOpacity
        activeOpacity={0.88}
        disabled={submitting}
        onPress={() => void submit()}
        style={styles.submitOuter}
      >
        <LinearGradient
          colors={['#0022FF', '#00BBFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.submitInner}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text allowFontScaling={false} style={[styles.submitText, { fontFamily: theme.semiBoldFont }]}>
              Submit review
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <VideoReviewModal
        visible={reviewModalVisible}
        videoUri={videoUri}
        durationMs={0}
        onClose={() => setReviewModalVisible(false)}
        onSave={(ann) => setAnnotations((prev) => [...prev, ann])}
        theme={theme}
      />
    </KeyboardAwareScrollView>
  )
}

function getStyles(theme: { backgroundColor?: string; mutedForegroundColor?: string }) {
  return StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    inner: { paddingHorizontal: 20 },
    backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
    backText: { color: '#00BBFF', fontSize: 15 },
    title: { color: '#FFFFFF', fontSize: 22, marginBottom: 12 },
    video: {
      width: '100%',
      borderRadius: 12,
      backgroundColor: '#000',
      marginBottom: 16,
    },
    openToolsOuter: { borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
    openToolsInner: {
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    openToolsText: { color: '#FFFFFF', fontSize: 15 },
    label: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderColor: 'rgba(0,187,255,0.35)',
      borderRadius: 14,
      padding: 12,
      color: '#fff',
      minHeight: 88,
      textAlignVertical: 'top',
      marginBottom: 14,
    },
    annotationHeaderRow: {
      marginTop: 4,
      marginBottom: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    annotationCount: {
      color: 'rgba(255,255,255,0.55)',
      fontSize: 13,
    },
    emptyText: {
      color: 'rgba(232,240,255,0.58)',
      fontSize: 13,
      marginBottom: 14,
    },
    annotationCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(0,187,255,0.3)',
      backgroundColor: 'rgba(6, 20, 52, 0.55)',
      overflow: 'hidden',
      marginBottom: 10,
    },
    annotationImage: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: '#000',
    },
    annotationMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 4,
    },
    annotationTime: {
      color: '#8BCBFF',
      fontSize: 12,
    },
    annotationComment: {
      color: '#FFFFFF',
      fontSize: 13,
      lineHeight: 18,
      paddingHorizontal: 10,
      paddingBottom: 10,
    },
    submitOuter: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
    submitInner: {
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitText: { color: '#FFFFFF', fontSize: 17 },
  })
}
