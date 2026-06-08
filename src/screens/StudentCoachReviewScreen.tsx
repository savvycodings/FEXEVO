import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Image,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Video, ResizeMode } from 'expo-av'
import { ThemeContext } from '../context'
import { useTranslation } from 'react-i18next'
import { authClient } from '../lib/auth-client'
import { DOMAIN } from '../../constants'
import type { MainStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<MainStackParamList>
type R = RouteProp<MainStackParamList, 'StudentCoachReview'>

type ReviewPayload = {
  id: string
  status: string
  videoPath: string
  coachFeedbackText: string | null
  coachMarksJson: unknown | null
}

type CoachAnnotation = {
  imageUri: string
  comment: string
  timeMs: number
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

function parseCoachAnnotations(input: unknown): CoachAnnotation[] {
  if (!Array.isArray(input)) return []
  return input
    .map((row) => {
      const r = row as Record<string, unknown>
      const rawImage =
        isSafeImageUri(r.imageUri) ? r.imageUri.trim() :
        isSafeImageUri(r.cloudinaryUrl) ? r.cloudinaryUrl.trim() :
        ''
      const imageUri = rawImage ? toDisplayImageUri(rawImage) : ''
      const comment = typeof r.comment === 'string' ? r.comment : ''
      const timeMsRaw = r.timeMs
      const timeMs = typeof timeMsRaw === 'number' && Number.isFinite(timeMsRaw) ? timeMsRaw : 0
      if (!imageUri) return null
      return { imageUri, comment, timeMs }
    })
    .filter((r): r is CoachAnnotation => !!r)
}

export function StudentCoachReviewScreen() {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const navigation = useNavigation<Nav>()
  const route = useRoute<R>()
  const { reviewId, notificationId } = route.params
  const styles = useMemo(() => getStyles(theme), [theme])

  const [loading, setLoading] = useState(true)
  const [review, setReview] = useState<ReviewPayload | null>(null)

  const videoUri = useMemo(() => {
    if (!review?.videoPath) return null
    const base = DOMAIN.replace(/\/+$/, '')
    const p = review.videoPath.startsWith('/') ? review.videoPath : `/${review.videoPath}`
    return `${base}${p}`
  }, [review?.videoPath])

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
        status?: string
      }
      if (!body?.review) {
        Alert.alert(t('commonAlerts.unavailable'), body?.error || t('coachFlow.couldNotLoadReview'))
        navigation.goBack()
        return
      }
      setReview(body.review)
    } finally {
      setLoading(false)
    }
  }, [navigation, reviewId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!notificationId) return
    void authClient
      .$fetch(`/profile/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: 'POST',
      })
      .catch(() => null)
  }, [notificationId])

  const coachAnnotations = useMemo(
    () => parseCoachAnnotations(review?.coachMarksJson ?? null),
    [review?.coachMarksJson]
  )

  if (loading || !review) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color="#00BBFF" />
      </View>
    )
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.inner}
    >
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.backRow}
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        <Text allowFontScaling={false} style={[styles.backLabel, { fontFamily: theme.mediumFont }]}>
          Back
        </Text>
      </TouchableOpacity>
      <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.semiBoldFont }]}>
        Coach feedback
      </Text>

      {videoUri ? (
        <Video
          source={{ uri: videoUri }}
          style={styles.video}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={false}
        />
      ) : null}

      <Text allowFontScaling={false} style={[styles.sectionTitle, { fontFamily: theme.mediumFont }]}>
        Comments
      </Text>
      <Text allowFontScaling={false} style={[styles.body, { fontFamily: theme.regularFont }]}>
        {review.coachFeedbackText?.trim() ? review.coachFeedbackText : '—'}
      </Text>

      <Text allowFontScaling={false} style={[styles.sectionTitle, { fontFamily: theme.mediumFont }]}>
        Coach annotations
      </Text>
      {coachAnnotations.length === 0 ? (
        <Text allowFontScaling={false} style={[styles.body, { fontFamily: theme.regularFont }]}>
          —
        </Text>
      ) : (
        coachAnnotations.map((ann, idx) => (
          <View key={`${ann.timeMs}-${idx}`} style={styles.annotationCard}>
            {ann.imageUri ? (
              <Image source={{ uri: ann.imageUri }} style={styles.annotationImage} resizeMode="cover" />
            ) : null}
            <Text allowFontScaling={false} style={[styles.annotationTime, { fontFamily: theme.mediumFont }]}>
              Frame {Math.max(0, Math.floor(ann.timeMs / 1000))}s
            </Text>
            {ann.comment ? (
              <Text allowFontScaling={false} style={[styles.body, { fontFamily: theme.regularFont }]}>
                {ann.comment}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  )
}

function getStyles(theme: { backgroundColor?: string }) {
  return StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    inner: { padding: 20, paddingBottom: 40 },
    backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
    backLabel: { color: '#00BBFF', fontSize: 15 },
    title: { color: '#FFFFFF', fontSize: 22, marginBottom: 12 },
    video: {
      width: '100%',
      aspectRatio: 9 / 16,
      maxHeight: 320,
      borderRadius: 12,
      backgroundColor: '#000',
      marginBottom: 20,
    },
    sectionTitle: { color: 'rgba(255,255,255,0.88)', fontSize: 14, marginTop: 8, marginBottom: 6 },
    body: { color: 'rgba(232,240,255,0.9)', fontSize: 15, lineHeight: 22 },
    annotationCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(0,187,255,0.32)',
      backgroundColor: 'rgba(8, 22, 58, 0.6)',
      overflow: 'hidden',
      marginBottom: 10,
      paddingBottom: 10,
    },
    annotationImage: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: '#000',
      marginBottom: 8,
    },
    annotationTime: {
      color: '#8BCBFF',
      fontSize: 12,
      marginBottom: 6,
      paddingHorizontal: 10,
    },
  })
}
