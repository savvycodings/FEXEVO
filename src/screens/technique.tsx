import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
} from 'react-native'
import { useState, useContext, useRef } from 'react'
import { ThemeContext } from '../context'
import { DOMAIN } from '../../constants'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { Video, ResizeMode } from 'expo-av'
import Ionicons from '@expo/vector-icons/Ionicons'
import FeatherIcon from '@expo/vector-icons/Feather'
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
  Circle,
  G,
  Filter,
  FeGaussianBlur,
} from 'react-native-svg'
import { authClient } from '../lib/auth-client'
import { LinearGradient } from 'expo-linear-gradient'
// @ts-ignore - web + native masked view
import MaskedView from '@react-native-masked-view/masked-view'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const HORIZONTAL_PADDING = 24
const FRAME_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2
const FRAME_ASPECT = 9 / 16
const FRAME_HEIGHT = FRAME_WIDTH / FRAME_ASPECT
const STROKE_WIDTH = 4
const FRAME_RADIUS = 24
const GRADIENT_COLORS = ['#0022FF', '#00BBFF', '#00BBFF', '#0022FF']
const GRADIENT_STOPS = ['0%', '30%', '70%', '100%']
const THUMB_SIZE = 144
const SCROLLUI_IMAGE = require('../../assets/scrollui.png')
const COURT_IMAGE = require('../../assets/court.png')
const BALL_IMAGE = require('../../assets/ball.png')

const PROGRESS_HEIGHT = 6
const STEP_SEGMENT_COLORS = ['#0022FF', '#0048FF', '#0078FF', '#009BFF', '#00BBFF']
const STEP_TITLES = [
  'Player profile setup.',
  'Set ranking and level.',
  'Upload or record your Padel video.',
  'Select frame of the video.',
  'Results of the analysis.',
]
const LEVEL_OPTIONS = [
  'Beginner',
  'High Beginner',
  'Low Intermediate',
  'Intermediate',
  'High Intermediate',
  'Low Advanced',
  'Advanced',
  'High Advanced',
  'Competition/Open',
  'Other',
]
const RANKING_ORG_OPTIONS = [
  'Playtomic',
  'Redpadel',
  'USPA',
  'Spain Federation',
  'Play by Point',
]
const FRAME_SNAP_POINTS = 15
const DEFAULT_CLIP_HALF_WINDOW_MS = 2000

type TechniqueClip = {
  id: string
  startMs: number
  endMs: number
}

type RunAnalysisOptions = {
  navigateOnDone?: boolean
  resetState?: boolean
}

export function Technique() {
  const { theme } = useContext(ThemeContext)
  const [step, setStep] = useState(1)
  const [dominantHand, setDominantHand] = useState<'left' | 'right' | null>(null)
  const [courtSide, setCourtSide] = useState<'left' | 'right' | null>(null)
  const [hasRanking, setHasRanking] = useState<boolean | null>(null)
  const [level, setLevel] = useState<string | null>(null)
  const [rankingOrg, setRankingOrg] = useState<string | null>(null)
  const [rankingValue, setRankingValue] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null)
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null)
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisJson, setAnalysisJson] = useState<any>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const mainVideoRef = useRef<Video | null>(null)
  const trimVideoRef = useRef<Video | null>(null)
  const [introMode, setIntroMode] = useState(true)
  const [ratingOpen, setRatingOpen] = useState(true)
  const [observationsOpen, setObservationsOpen] = useState(true)
  const [recommendationsOpen, setRecommendationsOpen] = useState(true)
  const [markerProgress, setMarkerProgress] = useState(0.5)
  const [trimTrackWidth, setTrimTrackWidth] = useState(0)
  const [isTrimPlaying, setIsTrimPlaying] = useState(false)
  const [currentTrimMs, setCurrentTrimMs] = useState(0)
  const [clips, setClips] = useState<TechniqueClip[]>([])
  const styles = getStyles(theme)
  const lastSeekMsRef = useRef(0)
  const isScrubbingRef = useRef(false)
  const lastPlaybackUiSyncRef = useRef(0)

  const API_BASE = DOMAIN.replace(/\/+$/, '')
  const metrics = analysisJson?.metrics || null
  const aiAnalysis = metrics?.ai_analysis || null
  const score =
    typeof aiAnalysis?.score === 'number'
      ? Math.max(0, Math.min(10, aiAnalysis.score))
      : null
  const SCORE_RADIUS = 70
  const SCORE_STROKE = 10
  const scoreCirc = 2 * Math.PI * SCORE_RADIUS
  const scoreProgress = score != null ? score / 10 : 0
  const analysisReady =
    analysisJson?.status === 'completed' || analysisJson?.status === 'failed'
  const canContinueProfileStep1 = dominantHand != null && courtSide != null
  const canContinueProfileStep2 =
    hasRanking === false
      ? !!level
      : hasRanking === true
      ? !!rankingOrg && rankingValue.trim().length > 0
      : false

  const STEP2_MAX_LENGTH_SEC = 20

  function clamp01(v: number) {
    return Math.max(0, Math.min(1, v))
  }

  function setMarkerProgressStable(next: number) {
    const p = clamp01(next)
    setMarkerProgress(prev => (Math.abs(prev - p) < 0.002 ? prev : p))
  }

  function snapProgress(v: number) {
    if (FRAME_SNAP_POINTS <= 1) return clamp01(v)
    const p = clamp01(v)
    const idx = Math.round(p * (FRAME_SNAP_POINTS - 1))
    return idx / (FRAME_SNAP_POINTS - 1)
  }

  function formatTimeFromMs(ms: number) {
    const totalSec = Math.max(0, Math.floor(ms / 1000))
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  async function seekTrimToProgress(progress: number) {
    if (!trimVideoRef.current || videoDurationSeconds == null) return
    const p = clamp01(progress)
    const ms = Math.round(videoDurationSeconds * 1000 * p)
    const now = Date.now()
    // Keep dragging smooth: avoid flooding seek calls on every pointer move.
    if (now - lastSeekMsRef.current < 16) return
    lastSeekMsRef.current = now
    setCurrentTrimMs(ms)
    try {
      await trimVideoRef.current.setStatusAsync({ positionMillis: ms, shouldPlay: false })
      setIsTrimPlaying(false)
    } catch {
      // ignore seek errors while scrubbing
    }
  }

  async function toggleTrimPlay() {
    if (!trimVideoRef.current) return
    try {
      await trimVideoRef.current.setStatusAsync({ shouldPlay: !isTrimPlaying, isMuted: true })
      setIsTrimPlaying(prev => !prev)
    } catch (err) {
      console.log('[Technique] toggleTrimPlay error', err)
    }
  }

  function getClipRangeFromProgress(progress: number) {
    if (videoDurationSeconds == null || videoDurationSeconds <= 0) return { startMs: 0, endMs: 0 }
    const totalMs = videoDurationSeconds * 1000
    const impactMs = Math.round(totalMs * clamp01(progress))
    const startMs = Math.max(0, impactMs - DEFAULT_CLIP_HALF_WINDOW_MS * 2)
    return {
      startMs,
      endMs: impactMs,
    }
  }

  function addClipAtCurrentMarker() {
    if (videoDurationSeconds == null || videoDurationSeconds <= 0) return
    const totalMs = videoDurationSeconds * 1000
    const { startMs, endMs } = getClipRangeFromProgress(markerProgress)
    const nextClip: TechniqueClip = {
      id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      startMs,
      endMs: Math.max(startMs + 300, Math.min(totalMs, endMs)),
    }
    setClips(prev => [...prev, nextClip])
  }

  function removeClip(id: string) {
    setClips(prev => prev.filter(c => c.id !== id))
  }

  async function pickVideo() {
    // Prefer camera for recording; fall back to library if needed
    let status = (await ImagePicker.requestCameraPermissionsAsync()).status
    let useLibrary = false
    if (status !== 'granted') {
      const mediaPerm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (mediaPerm.status !== 'granted') return
      useLibrary = true
    }

    const result = useLibrary
      ? await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          allowsEditing: false,
          quality: 1,
        })
      : await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          quality: 1,
        })
    if (result.canceled || !result.assets?.[0]) return
    await uploadVideo(
      result.assets[0].uri,
      result.assets[0].fileName ?? 'video.mp4',
      result.assets[0].mimeType ?? 'video/mp4'
    )
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'video/*',
      copyToCacheDirectory: true,
    })
    if (result.canceled) return
    const f = result.assets[0]
    await uploadVideo(f.uri, f.name ?? 'video.mp4', f.mimeType ?? 'video/mp4')
  }

  async function pickFromGallery() {
    const mediaPerm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (mediaPerm.status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    })
    if (result.canceled || !result.assets?.[0]) return
    await uploadVideo(
      result.assets[0].uri,
      result.assets[0].fileName ?? 'video.mp4',
      result.assets[0].mimeType ?? 'video/mp4'
    )
  }

  async function uploadVideo(uri: string, fileName: string, mimeType: string): Promise<void> {
    try {
      console.log('[Technique] Upload started', { fileName, mimeType })
      setUploading(true)
      setUploadProgress(0)
      setUploadError(null)

      const formData = new FormData()

      if (Platform.OS === 'web') {
        try {
          const res = await fetch(uri)
          const blob = await res.blob()
          const file = new File([blob], fileName, { type: mimeType })
          // @ts-ignore
          formData.append('video', file)
        } catch (err) {
          console.error('[Technique] Failed to load blob for web upload', err)
          setUploading(false)
          return
        }
      } else {
        // @ts-ignore - React Native FormData file
        formData.append('video', { uri, name: fileName, type: mimeType })
      }

      const res = await authClient
        .$fetch<{ id?: string; url?: string; error?: string }>('/technique/upload', {
          method: 'POST',
          body: formData,
        })
        .catch((err) => {
          console.error('[Technique] Upload request error', err)
          return { error: err?.message || 'Upload failed' } as any
        })

      const data = ((res as any)?.data ?? res) as { id?: string; url?: string; error?: string }
      const responseText = JSON.stringify(data)
      console.log('[Technique] Upload response', {
        status: (res as any)?.status ?? null,
        responseText: responseText.slice(0, 200),
      })

      if (!data?.id) {
        console.error('[Technique] Upload failed body:', data)
        setUploadError(data?.error || 'Upload failed. Please try again.')
        return
      }

      try {
        const url = data?.url
        const id = data?.id
        console.log('[Technique] Upload success', {
          id,
          url: url ? `${url.slice(0, 50)}...` : '',
        })
        if (url) {
          const absoluteUrl = url.startsWith('http') ? url : `${API_BASE}${url}`
          setUploadedVideoUrl(absoluteUrl)
        }
        if (id) {
          setUploadedVideoId(id)
          console.log('[Technique] Stored uploadedVideoId', id)
          setClips([])
          setMarkerProgress(0.5)
          setCurrentTrimMs(0)
          setAnalysisId(null)
          setAnalysisError(null)
          setAnalysisJson(null)
          setIntroMode(false)
          setStep(4)
          // Kick off analysis immediately in background while user sets clips.
          void runAnalysis(id, { navigateOnDone: false, resetState: true })
        } else {
          console.log('[Technique] Upload succeeded but no id in response, not advancing to step 2')
          setUploadError('Upload succeeded but no video id was returned. Please try again.')
        }
      } catch (err) {
        console.error('[Technique] Failed to parse response JSON', err)
        setUploadError('Upload failed: invalid server response.')
      }
    } catch (err) {
      console.error('[Technique] Upload error', err)
      setUploadError('Upload failed due to a network error. Please try again.')
    } finally {
      setUploading(false)
      setUploadProgress(100)
    }
  }

  async function runAnalysis(forcedVideoId?: string, options: RunAnalysisOptions = {}) {
    if (analysisLoading) return
    const videoId = forcedVideoId ?? uploadedVideoId
    if (!videoId) {
      console.log('[Technique] No uploadedVideoId, cannot analyze')
       setAnalysisError('Please upload a video before analyzing.')
      return
    }
    try {
      console.log('[Technique] Starting analysis for video', videoId)
      setAnalysisLoading(true)
      setAnalysisError(null)
      if (options.resetState ?? true) {
        setAnalysisJson(null)
      }

      const res = await authClient
        .$fetch<{ analysisId?: string; error?: string }>('/technique/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ techniqueVideoId: videoId }),
        })
        .catch((err) => ({ error: err?.message || 'Analyze failed' } as any))

      const body = ((res as any)?.data ?? res) as { analysisId?: string; error?: string }
      console.log('[Technique] Analyze response', {
        status: (res as any)?.status ?? null,
        body,
      })

      const analysisId = (body as any)?.analysisId as string | undefined
      const errorMsg = (body as any)?.error as string | undefined

      if (!analysisId) {
        setAnalysisError(errorMsg || 'Analyze failed')
        setAnalysisLoading(false)
        return
      }

      const id = analysisId
      setAnalysisId(id)
      setStep(4)

      // Poll for analysis result
      const pollStart = Date.now()
      let done = false
      while (!done && Date.now() - pollStart < 600000) {
        await new Promise(r => setTimeout(r, 3000))
        const pollRes = await authClient
          .$fetch<{
            id?: string
            status?: string
            metrics?: any
            feedbackText?: string
            error?: string
          }>(`/technique/analysis/${id}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          })
          .catch((err) => ({ error: err?.message || 'Failed to fetch analysis' } as any))

        const pollBody = ((pollRes as any)?.data ?? pollRes) as {
          id?: string
          status?: string
          metrics?: any
          feedbackText?: string
          error?: string
        }
        console.log('[Technique] Analysis poll', { status: (pollRes as any)?.status ?? null, body: pollBody })

        if (pollBody?.error && !pollBody?.status) {
          setAnalysisError(pollBody.error || 'Failed to fetch analysis')
          break
        }
        if (pollBody.status === 'completed' || pollBody.status === 'failed') {
          console.log('[Technique] Final analysis payload', {
            id,
            status: pollBody.status,
            metricsSummary: {
              total_frames: pollBody?.metrics?.total_frames,
              analyzed_frames: pollBody?.metrics?.analyzed_frames,
              pose_samples: Array.isArray(pollBody?.metrics?.pose_data)
                ? pollBody.metrics.pose_data.length
                : 0,
              ai_score: pollBody?.metrics?.ai_analysis?.score,
              ai_rating: pollBody?.metrics?.ai_analysis?.rating,
            },
          })
          setAnalysisJson(pollBody)
          if (pollBody.status === 'failed') {
            setAnalysisError(pollBody.feedbackText || 'Analysis failed')
          }
          done = true
          break
        }
      }

      setAnalysisLoading(false)
      if (done && (options.navigateOnDone ?? true)) {
        setStep(5)
      }
    } catch (err: any) {
      console.error('[Technique] runAnalysis error', err)
      setAnalysisError(err?.message || 'Analyze error')
      setAnalysisLoading(false)
    }
  }

  if (introMode) {
    return (
      <View style={styles.container}>
        <View style={styles.heroGlow} pointerEvents="none" />
        <LinearGradient
          pointerEvents="none"
          colors={['#071D47', '#030A17']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.heroGlow}
        />
        <ScrollView
          style={styles.stepContent}
          contentContainerStyle={[styles.stepContentInner, { paddingTop: 32, alignItems: 'center' }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heroTitlePrefix}>Master your</Text>
          {Platform.OS === 'web' ? (
            <Text style={styles.heroTitleTechniqueWeb}>Technique</Text>
          ) : (
            <MaskedView
              style={styles.heroTitleMask}
              maskElement={
                <Text style={[styles.heroTitleTechnique, { color: '#ffffff' }]}>
                  Technique
                </Text>
              }
            >
              <LinearGradient
                colors={['#0022FF', '#00BBFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={[styles.heroTitleTechnique, { color: 'transparent' }]}>
                  Technique
                </Text>
              </LinearGradient>
            </MaskedView>
          )}
          <Text style={styles.heroSubtitle}>
          Upload your Padel video. Get AI-powered feedback on your serve, bandeja, and movement instantly
          </Text>
          <View style={styles.progressWrapIntro}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={[
                  styles.progressSegment,
                  i === 1 && { backgroundColor: STEP_SEGMENT_COLORS[0] },
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              setStep(1)
              setIntroMode(false)
            }}
            style={styles.introCardPrimaryOuter}
          >
            <LinearGradient
              colors={['#0022FF', '#00BBFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.introCardPrimary}
            >
              <View style={styles.introCardRowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.introCardTitle}>Upload or Record{'\n'}your Video</Text>
                </View>
                <View style={styles.introCardIconCircle}>
                  <FeatherIcon name="upload" size={18} color="#FFFFFF" />
                </View>
              </View>
              <View style={styles.introCardRowBottom}>
                <Text style={styles.introCardBody}>We accept MP4, MOV up to 50MB</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.introCard}>
            <View style={styles.introCardRowTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.introCardTitle}>Analyse</Text>
              </View>
              <View style={styles.introCardIconCircle}>
                <FeatherIcon name="activity" size={18} color={theme.textColor} />
              </View>
            </View>
            <View style={styles.introCardRowBottom}>
              <Text style={styles.introCardBody}>
                Our AI extracts your pose and compares it to pro mechanics.
              </Text>
            </View>
          </View>

          <View style={styles.introCard}>
            <View style={styles.introCardRowTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.introCardTitle}>Improve</Text>
              </View>
              <View style={styles.introCardIconCircle}>
                <FeatherIcon name="check-circle" size={18} color={theme.textColor} />
              </View>
            </View>
            <View style={styles.introCardRowBottom}>
              <Text style={styles.introCardBody}>
                Get actionable feedback and drills to fix your technique.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={async () => {
              console.log('[Auth] SignOut pressed from Technique intro')
              await authClient.signOut()
            }}
            activeOpacity={0.7}
            style={{ marginTop: 24, marginBottom: 8 }}
          >
            <Text
              style={{
                textAlign: 'center',
                textDecorationLine: 'underline',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 13,
              }}
            >
              Sign out
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.progressSection}>
        <View style={styles.progressWrap}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                i <= step && { backgroundColor: STEP_SEGMENT_COLORS[i - 1] },
              ]}
            />
          ))}
        </View>
        <Text style={styles.stepTitle}>{STEP_TITLES[step - 1]}</Text>
      </View>

      <ScrollView
        style={styles.stepContent}
        contentContainerStyle={styles.stepContentInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <View style={styles.profileCard}>
            <Text style={styles.profileTitle}>Are you:</Text>
            <View style={styles.profileChoiceRow}>
              <TouchableOpacity
                style={[styles.profileChoicePill, dominantHand === 'left' && styles.profileChoicePillActive]}
                onPress={() => setDominantHand('left')}
                activeOpacity={0.85}
              >
                <Text style={[styles.profileChoiceText, dominantHand === 'left' && styles.profileChoiceTextActive]}>
                  Left Handed
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.profileChoicePill, dominantHand === 'right' && styles.profileChoicePillActive]}
                onPress={() => setDominantHand('right')}
                activeOpacity={0.85}
              >
                <Text style={[styles.profileChoiceText, dominantHand === 'right' && styles.profileChoiceTextActive]}>
                  Right Handed
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.profileTitle, { marginTop: 14 }]}>What side of court do you play?</Text>
            <View style={styles.profileChoiceRow}>
              <TouchableOpacity
                style={[styles.profileChoicePill, courtSide === 'left' && styles.profileChoicePillActive]}
                onPress={() => setCourtSide('left')}
                activeOpacity={0.85}
              >
                <Text style={[styles.profileChoiceText, courtSide === 'left' && styles.profileChoiceTextActive]}>
                  Left
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.profileChoicePill, courtSide === 'right' && styles.profileChoicePillActive]}
                onPress={() => setCourtSide('right')}
                activeOpacity={0.85}
              >
                <Text style={[styles.profileChoiceText, courtSide === 'right' && styles.profileChoiceTextActive]}>
                  Right
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.courtWrap}>
              <Image source={COURT_IMAGE} style={styles.courtImage} resizeMode="contain" />
              {courtSide && (
                <Image
                  source={BALL_IMAGE}
                  style={[
                    styles.courtBall,
                    courtSide === 'left' ? { left: 24 } : { right: 24 },
                  ]}
                  resizeMode="contain"
                />
              )}
            </View>

            <TouchableOpacity
              style={[styles.profileNextButton, !canContinueProfileStep1 && { opacity: 0.45 }]}
              onPress={() => setStep(2)}
              disabled={!canContinueProfileStep1}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#0022FF', '#00BBFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.profileNextButtonInner}
              >
                <Text style={styles.profileNextButtonText}>Set your Ranking</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.profileCard}>
            <Text style={styles.profileTitle}>Set your Ranking</Text>
            <Text style={styles.profileSubtitle}>Do you have a ranking rating?</Text>
            <View style={styles.profileChoiceRow}>
              <TouchableOpacity
                style={[styles.profileChoicePill, hasRanking === false && styles.profileChoicePillActive]}
                onPress={() => {
                  setHasRanking(false)
                  setRankingOrg(null)
                  setRankingValue('')
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.profileChoiceText, hasRanking === false && styles.profileChoiceTextActive]}>
                  No
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.profileChoicePill, hasRanking === true && styles.profileChoicePillActive]}
                onPress={() => setHasRanking(true)}
                activeOpacity={0.85}
              >
                <Text style={[styles.profileChoiceText, hasRanking === true && styles.profileChoiceTextActive]}>
                  Yes
                </Text>
              </TouchableOpacity>
            </View>

            {hasRanking === false && (
              <>
                <Text style={[styles.profileTitle, { marginTop: 14 }]}>Set your Level</Text>
                <View style={styles.levelList}>
                  {LEVEL_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.levelOption, level === opt && styles.levelOptionActive]}
                      onPress={() => setLevel(opt)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.levelOptionText, level === opt && styles.levelOptionTextActive]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {hasRanking === true && (
              <>
                <Text style={[styles.profileTitle, { marginTop: 14 }]}>Choose ranking source</Text>
                <View style={styles.rankOrgWrap}>
                  {RANKING_ORG_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.rankOrgChip, rankingOrg === opt && styles.rankOrgChipActive]}
                      onPress={() => setRankingOrg(opt)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.rankOrgChipText, rankingOrg === opt && styles.rankOrgChipTextActive]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={rankingValue}
                  onChangeText={setRankingValue}
                  placeholder="Please put your rating"
                  placeholderTextColor={theme.mutedForegroundColor}
                  style={styles.rankInput}
                />
              </>
            )}

            <TouchableOpacity
              style={[styles.profileNextButton, !canContinueProfileStep2 && { opacity: 0.45 }]}
              onPress={() => setStep(3)}
              disabled={!canContinueProfileStep2}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#0022FF', '#00BBFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.profileNextButtonInner}
              >
                <Text style={styles.profileNextButtonText}>Go to Upload</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.step1}>
            {uploading ? (
              <View style={styles.uploadProgressWrap}>
                <ActivityIndicator size="large" color="#E85D04" />
                <Text style={styles.uploadProgressText}>Uploading… {uploadProgress}%</Text>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
                </View>
              </View>
            ) : (
              <View style={styles.frameWrap}>
                <View style={[styles.frameOuter, { width: FRAME_WIDTH, height: FRAME_HEIGHT }]}>
                  <Svg width={FRAME_WIDTH} height={FRAME_HEIGHT} style={StyleSheet.absoluteFill}>
                    <Defs>
                      <SvgLinearGradient id="frameStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                        {GRADIENT_COLORS.map((color, i) => (
                          <Stop key={`${color}-${i}`} offset={GRADIENT_STOPS[i]} stopColor={color} />
                        ))}
                      </SvgLinearGradient>
                      <Filter id="frameGlow" x="-30%" y="-30%" width="160%" height="160%">
                        <FeGaussianBlur in="SourceGraphic" stdDeviation={80} />
                      </Filter>
                    </Defs>
                    <G filter="url(#frameGlow)">
                      <Rect
                        x={STROKE_WIDTH / 2}
                        y={STROKE_WIDTH / 2}
                        width={FRAME_WIDTH - STROKE_WIDTH}
                        height={FRAME_HEIGHT - STROKE_WIDTH}
                        rx={FRAME_RADIUS}
                        ry={FRAME_RADIUS}
                        fill="none"
                        stroke="url(#frameStroke)"
                        strokeWidth={STROKE_WIDTH * 2}
                      />
                    </G>
                    <Rect
                      x={STROKE_WIDTH / 2}
                      y={STROKE_WIDTH / 2}
                      width={FRAME_WIDTH - STROKE_WIDTH}
                      height={FRAME_HEIGHT - STROKE_WIDTH}
                      rx={FRAME_RADIUS}
                      ry={FRAME_RADIUS}
                      fill="#000"
                      stroke="url(#frameStroke)"
                      strokeWidth={STROKE_WIDTH}
                    />
                  </Svg>
                  <View style={styles.frameInner}>
                    <View style={styles.videoPreview}>
                      <FeatherIcon name="video" size={40} color="rgba(255,255,255,0.4)" />
                      <Text style={styles.videoPreviewText}>Record or choose a video</Text>
                    </View>
                    <View style={styles.frameActions}>
                      <View style={styles.frameActionsSpacer} />
                      <TouchableOpacity
                        style={styles.recordButton}
                        onPress={pickVideo}
                        activeOpacity={0.85}
                      >
                        <View style={styles.recordButtonInner} />
                      </TouchableOpacity>
                      <View style={[styles.frameActionsSpacer, { alignItems: 'flex-end' }]}>
                        <TouchableOpacity
                          style={styles.galleryButton}
                          onPress={pickFromGallery}
                          activeOpacity={0.85}
                        >
                          <FeatherIcon name="image" size={14} color="#fff" />
                          <Text style={styles.galleryButtonText}>Gallery</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            )}
            {analysisLoading && (
              <View style={styles.step1AnalyzingRow}>
                <ActivityIndicator size="small" color="#00BBFF" />
                <Text style={styles.step1AnalyzingText}>Analyzing your technique…</Text>
              </View>
            )}
          </View>
        )}

        {step === 4 && (
          <View style={styles.step2}>
            {/* Centered video thumbnail with gradient border */}
            <View style={styles.step2ThumbnailContainer}>
              <View style={styles.step2ThumbnailWrap}>
                <Svg width={THUMB_SIZE} height={THUMB_SIZE} style={StyleSheet.absoluteFill}>
                  <Defs>
                      <SvgLinearGradient id="thumbStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                        {GRADIENT_COLORS.map((color, i) => (
                          <Stop key={`${color}-${i}`} offset={GRADIENT_STOPS[i]} stopColor={color} />
                        ))}
                      </SvgLinearGradient>
                  </Defs>
                  <Rect
                    x={1}
                    y={1}
                    width={THUMB_SIZE - 2}
                    height={THUMB_SIZE - 2}
                    rx={8}
                    ry={8}
                    fill="#000"
                    stroke="url(#thumbStroke)"
                    strokeWidth={2}
                  />
                </Svg>
                {uploadedVideoUrl ? (
                  <Video
                    ref={trimVideoRef}
                    source={{ uri: uploadedVideoUrl }}
                    style={styles.step2ThumbnailVideo}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={false}
                    isMuted
                    onPlaybackStatusUpdate={(status) => {
                      if (status.isLoaded && typeof status.durationMillis === 'number' && videoDurationSeconds == null) {
                        setVideoDurationSeconds(Math.round(status.durationMillis / 1000))
                      }
                      if (status.isLoaded) {
                        // While the user is dragging the timeline, ignore playback-driven UI updates
                        // so the thumb does not jitter/flicker.
                        if (isScrubbingRef.current) return

                        const now = Date.now()
                        if (now - lastPlaybackUiSyncRef.current < 60) return
                        lastPlaybackUiSyncRef.current = now

                        setCurrentTrimMs(status.positionMillis ?? 0)
                        setIsTrimPlaying(!!status.isPlaying)
                        if (videoDurationSeconds != null && videoDurationSeconds > 0 && !status.didJustFinish) {
                          setMarkerProgressStable((status.positionMillis ?? 0) / (videoDurationSeconds * 1000))
                        }
                        if (status.didJustFinish) {
                          setIsTrimPlaying(false)
                        }
                      }
                      if (!status.isLoaded && 'error' in status && status.error) {
                        console.log('[Technique] Thumbnail video error', status.error)
                      }
                    }}
                    onError={(err) => {
                      console.log('[Technique] Thumbnail video onError', err)
                    }}
                  />
                ) : (
                  <View style={styles.step2ThumbnailPlaceholder}>
                    <FeatherIcon name="video" size={24} color={theme.mutedForegroundColor} />
                  </View>
                )}
              </View>
            </View>

            {/* Trim / marker UI placeholder */}
            <View style={styles.trimCard}>
              <Text style={styles.trimTitle}>Set impact of the ball</Text>
              <Text style={styles.trimSubtitle}>
                Drag the slider. The thumb marks the impact point, and the clip ends at that point.
              </Text>
              <View style={styles.trimControlsRow}>
                <TouchableOpacity style={styles.trimPlayButton} onPress={toggleTrimPlay} activeOpacity={0.8}>
                  <FeatherIcon name={isTrimPlaying ? 'pause' : 'play'} size={16} color="#fff" />
                  <Text style={styles.trimPlayButtonText}>{isTrimPlaying ? 'Pause' : 'Play'}</Text>
                </TouchableOpacity>
                <Text style={styles.trimTimeText}>
                  {formatTimeFromMs(currentTrimMs)} / {formatTimeFromMs((videoDurationSeconds ?? 0) * 1000)}
                </Text>
              </View>
              {videoDurationSeconds != null && videoDurationSeconds > 0 && (
                <Text style={styles.trimRangeText}>
                  Selected clip: {formatTimeFromMs(getClipRangeFromProgress(markerProgress).startMs)} -{' '}
                  {formatTimeFromMs(getClipRangeFromProgress(markerProgress).endMs)}
                </Text>
              )}
              <View
                style={styles.trimTimeline}
                onLayout={e => setTrimTrackWidth(e.nativeEvent.layout.width)}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={() => {
                  isScrubbingRef.current = true
                  setIsTrimPlaying(false)
                  if (trimVideoRef.current) {
                    void trimVideoRef.current.setStatusAsync({ shouldPlay: false })
                  }
                }}
                onResponderMove={e => {
                  if (!trimTrackWidth) return
                  const x = e.nativeEvent.locationX
                  const p = snapProgress(x / trimTrackWidth)
                  setMarkerProgressStable(p)
                  void seekTrimToProgress(p)
                }}
                onResponderRelease={e => {
                  if (!trimTrackWidth) return
                  const x = e.nativeEvent.locationX
                  const p = snapProgress(x / trimTrackWidth)
                  setMarkerProgressStable(p)
                  void seekTrimToProgress(p)
                  // Let one final seek settle before allowing playback updates to drive UI again.
                  setTimeout(() => {
                    isScrubbingRef.current = false
                  }, 80)
                }}
                onResponderTerminate={() => {
                  isScrubbingRef.current = false
                }}
              >
                <View style={styles.trimTrack} />
                {trimTrackWidth > 0 && (
                  <View
                    style={[
                      styles.trimTrackRange,
                      {
                        left: getClipRangeFromProgress(markerProgress).startMs / ((videoDurationSeconds ?? 1) * 1000) * trimTrackWidth,
                        width:
                          (getClipRangeFromProgress(markerProgress).endMs - getClipRangeFromProgress(markerProgress).startMs) /
                          ((videoDurationSeconds ?? 1) * 1000) *
                          trimTrackWidth,
                      },
                    ]}
                  />
                )}
                {trimTrackWidth > 0 && (
                  <View style={[styles.trimTrackActive, { width: markerProgress * trimTrackWidth }]} />
                )}
                {trimTrackWidth > 0 && (
                  <View
                    style={[
                      styles.trimHandle,
                      { left: markerProgress * trimTrackWidth - styles.trimHandle.width / 2 },
                    ]}
                  />
                )}
              </View>
              <View style={styles.frameTicksRow}>
                {Array.from({ length: FRAME_SNAP_POINTS }).map((_, i) => (
                  <View key={`tick-${i}`} style={styles.frameTick} />
                ))}
              </View>
              <TouchableOpacity style={styles.setClipButton} onPress={addClipAtCurrentMarker} activeOpacity={0.9}>
                <Text style={styles.setClipButtonText}>Set Clip</Text>
                <Ionicons name="lock-closed-outline" size={16} color="#0A1120" />
              </TouchableOpacity>
              {clips.length > 0 && (
                <View style={styles.clipsList}>
                  {clips.map((clip, idx) => (
                    <View key={clip.id} style={styles.clipRow}>
                      <Text style={styles.clipText}>
                        Clip {idx + 1}: {formatTimeFromMs(clip.startMs)} - {formatTimeFromMs(clip.endMs)}
                      </Text>
                      <TouchableOpacity onPress={() => removeClip(clip.id)} hitSlop={8}>
                        <FeatherIcon name="x-circle" size={18} color="rgba(255,255,255,0.75)" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.trimHint}>You can refine this later in future versions.</Text>
            </View>

            <TouchableOpacity
              style={styles.analyseButton}
              onPress={() => {
                if (analysisReady) {
                  setStep(5)
                  return
                }
                void runAnalysis(undefined, { navigateOnDone: true, resetState: false })
              }}
              activeOpacity={0.9}
              disabled={!uploadedVideoId || analysisLoading || clips.length === 0}
            >
              <LinearGradient
                colors={['#0022FF', '#00BBFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.analyseButtonInner}
              >
                {analysisLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.analyseButtonText}>Analyzing your technique…</Text>
                  </>
                ) : analysisReady ? (
                  <>
                    <Text style={styles.analyseButtonText}>View Results</Text>
                    <FeatherIcon name="arrow-right" size={20} color="#fff" />
                  </>
                ) : (
                  <>
                    <Text style={styles.analyseButtonText}>Analyse Videos</Text>
                    <FeatherIcon name="arrow-right" size={20} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            {clips.length === 0 && (
              <Text style={styles.addClipRequiredText}>Set at least one clip before analyzing.</Text>
            )}
          </View>
        )}

        {step === 5 && (
          <View style={styles.step2}>
            {/* Centered video thumbnail with gradient border */}
            <View style={styles.step2ThumbnailContainer}>
              <View style={styles.step2ThumbnailWrap}>
                <Svg width={THUMB_SIZE} height={THUMB_SIZE} style={StyleSheet.absoluteFill}>
                  <Defs>
                      <SvgLinearGradient id="thumbStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                        {GRADIENT_COLORS.map((color, i) => (
                          <Stop key={`${color}-${i}`} offset={GRADIENT_STOPS[i]} stopColor={color} />
                        ))}
                      </SvgLinearGradient>
                  </Defs>
                  <Rect
                    x={1}
                    y={1}
                    width={THUMB_SIZE - 2}
                    height={THUMB_SIZE - 2}
                    rx={8}
                    ry={8}
                    fill="#000"
                    stroke="url(#thumbStroke)"
                    strokeWidth={2}
                  />
                </Svg>
                {uploadedVideoUrl ? (
                  <Video
                    source={{ uri: uploadedVideoUrl }}
                    style={styles.step2ThumbnailVideo}
                      resizeMode={ResizeMode.COVER}
                    shouldPlay={false}
                    isMuted
                    onPlaybackStatusUpdate={(status) => {
                      if (status.isLoaded && typeof status.durationMillis === 'number' && videoDurationSeconds == null) {
                        setVideoDurationSeconds(Math.round(status.durationMillis / 1000))
                      }
                      if (!status.isLoaded && 'error' in status && status.error) {
                        console.log('[Technique] Thumbnail video error', status.error)
                      }
                    }}
                    onError={(err) => {
                      console.log('[Technique] Thumbnail video onError', err)
                    }}
                  />
                ) : (
                  <View style={styles.step2ThumbnailPlaceholder}>
                    <FeatherIcon name="video" size={24} color={theme.mutedForegroundColor} />
                  </View>
                )}
              </View>

              {score != null && (
                <View style={styles.scoreCircleWrap}>
                  <Svg
                    width={(SCORE_RADIUS + SCORE_STROKE) * 2}
                    height={(SCORE_RADIUS + SCORE_STROKE) * 2}
                    style={styles.scoreCircleSvg}
                  >
                    <G rotation="-90" originX={(SCORE_RADIUS + SCORE_STROKE)} originY={(SCORE_RADIUS + SCORE_STROKE)}>
                      <Circle
                        cx={SCORE_RADIUS + SCORE_STROKE}
                        cy={SCORE_RADIUS + SCORE_STROKE}
                        r={SCORE_RADIUS}
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth={SCORE_STROKE}
                        fill="transparent"
                      />
                      <Circle
                        cx={SCORE_RADIUS + SCORE_STROKE}
                        cy={SCORE_RADIUS + SCORE_STROKE}
                        r={SCORE_RADIUS}
                        stroke="#005CFF"
                        strokeWidth={SCORE_STROKE}
                        strokeLinecap="round"
                        strokeDasharray={scoreCirc}
                        strokeDashoffset={scoreCirc * (1 - scoreProgress)}
                        fill="transparent"
                      />
                    </G>
                  </Svg>
                  <View style={styles.scoreCircleCenter}>
                    <Text style={styles.scoreCircleLabel}>Your score</Text>
                    <Text style={styles.scoreCircleValue}>{score}</Text>
                  </View>
                </View>
              )}
            </View>

            {analysisError || analysisJson ? (
              <View style={styles.step3}>
                <View style={styles.placeholderCard}>
                  {analysisError ? (
                    <Text style={styles.placeholderHint}>{analysisError}</Text>
                  ) : (
                    <>
                      {/* Technique Rating accordion */}
                      {aiAnalysis?.en && (
                        <View style={styles.accordionCard}>
                          <TouchableOpacity
                            style={styles.accordionHeader}
                            activeOpacity={0.8}
                            onPress={() => setRatingOpen(!ratingOpen)}
                          >
                            <View>
                              <Text style={styles.accordionTitle}>Technique Rating</Text>
                              <Text style={styles.accordionSubtitle}>
                                {aiAnalysis.rating
                                  ? String(aiAnalysis.rating).replace('_', ' ').toUpperCase()
                                  : '—'}
                              </Text>
                            </View>
                            <View style={styles.accordionRight}>
                              <Text style={styles.accordionScoreText}>
                                {typeof aiAnalysis.score === 'number' ? aiAnalysis.score : '–'}
                              </Text>
                              <View style={styles.accordionIconChip}>
                                <FeatherIcon name="activity" size={14} color="#FFFFFF" />
                              </View>
                              <Ionicons
                                name={ratingOpen ? 'chevron-up' : 'chevron-down'}
                                size={18}
                                color={theme.mutedForegroundColor}
                              />
                            </View>
                          </TouchableOpacity>
                          {ratingOpen && (
                            <View style={styles.accordionBody}>
                              <Text style={styles.ratingText}>{aiAnalysis.en.diagnosis}</Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Observations accordion */}
                      {aiAnalysis?.en && Array.isArray(aiAnalysis.en.observations) && (
                        <View style={styles.accordionCard}>
                          <TouchableOpacity
                            style={styles.accordionHeader}
                            activeOpacity={0.8}
                            onPress={() => setObservationsOpen(!observationsOpen)}
                          >
                            <View>
                              <Text style={styles.accordionTitle}>Observations</Text>
                              <Text style={styles.accordionSubtitle}>
                                {aiAnalysis.en.observations.length} points
                              </Text>
                            </View>
                            <View style={styles.accordionRight}>
                              <View style={styles.accordionIconChip}>
                                <FeatherIcon name="eye" size={14} color="#FFFFFF" />
                              </View>
                              <Ionicons
                                name={observationsOpen ? 'chevron-up' : 'chevron-down'}
                                size={18}
                                color={theme.mutedForegroundColor}
                              />
                            </View>
                          </TouchableOpacity>
                          {observationsOpen && (
                            <View style={styles.accordionBody}>
                              {aiAnalysis.en.observations.map((obs: string, idx: number) => (
                                <View key={idx} style={styles.bulletRow}>
                                  <Text style={styles.bulletDot}>•</Text>
                                  <Text style={styles.bulletText}>{obs}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}

                      {/* Recommendations accordion */}
                      {aiAnalysis?.en && Array.isArray(aiAnalysis.en.recommendations) && (
                        <View style={styles.accordionCard}>
                          <TouchableOpacity
                            style={styles.accordionHeader}
                            activeOpacity={0.8}
                            onPress={() => setRecommendationsOpen(!recommendationsOpen)}
                          >
                            <View>
                              <Text style={styles.accordionTitle}>Recommendations</Text>
                              <Text style={styles.accordionSubtitle}>
                                {aiAnalysis.en.recommendations.length} drills
                              </Text>
                            </View>
                            <View style={styles.accordionRight}>
                              <View style={styles.accordionIconChip}>
                                <FeatherIcon name="check-circle" size={14} color="#FFFFFF" />
                              </View>
                              <Ionicons
                                name={recommendationsOpen ? 'chevron-up' : 'chevron-down'}
                                size={18}
                                color={theme.mutedForegroundColor}
                              />
                            </View>
                          </TouchableOpacity>
                          {recommendationsOpen && (
                            <View style={styles.accordionBody}>
                              {aiAnalysis.en.recommendations.map(
                                (rec: string, idx: number) => (
                                  <View key={idx} style={styles.bulletRow}>
                                    <Text style={styles.bulletDot}>•</Text>
                                    <Text style={styles.bulletText}>{rec}</Text>
                                  </View>
                                )
                              )}
                            </View>
                          )}
                        </View>
                      )}

                      {/* Fallback text if no AI analysis */}
                      {!aiAnalysis && (
                        <Text style={[styles.placeholderHint, { marginTop: 8 }]}>
                          {analysisJson?.feedbackText ||
                            'Analysis results and drills will appear here.'}
                        </Text>
                      )}

                      {/* Video playback card under accordions */}
                      {uploadedVideoUrl && (
                        <View style={styles.videoCard}>
                          <View style={styles.videoCardHeader}>
                            <View>
                              <Text style={styles.videoCardEyebrow}>Live clip</Text>
                              <Text style={styles.videoCardTitle}>Play the analyzed video</Text>
                            </View>
                            <View style={styles.accordionRight}>
                              <View style={styles.accordionIconChip}>
                                <FeatherIcon name="play" size={14} color="#FFFFFF" />
                              </View>
                            </View>
                          </View>
                          <View style={styles.videoCardPlayerWrap}>
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => {
                                if (mainVideoRef.current) {
                                  mainVideoRef.current.playAsync().catch((err) => {
                                    console.log('[Technique] playAsync error', err)
                                  })
                                }
                              }}
                            >
                              <Video
                                ref={mainVideoRef}
                                source={{ uri: uploadedVideoUrl }}
                                style={styles.videoCardPlayer}
                                resizeMode={ResizeMode.CONTAIN}
                                shouldPlay={false}
                                useNativeControls
                                onError={(err) => {
                                  console.log('[Technique] Main video onError', err)
                                }}
                                onPlaybackStatusUpdate={(status) => {
                                  if (!status.isLoaded && status.error) {
                                    console.log('[Technique] Main video status error', status.error)
                                  }
                                }}
                              />
                            </TouchableOpacity>
                          </View>
                          {aiAnalysis?.en?.recommendations && (
                            <View style={{ marginTop: 12 }}>
                              <Text style={styles.placeholderHint}>
                                Focus on these points while you re‑watch:
                              </Text>
                              {aiAnalysis.en.recommendations.slice(0, 3).map(
                                (rec: string, idx: number) => (
                                  <View key={idx} style={styles.bulletRow}>
                                    <Text style={styles.bulletDot}>•</Text>
                                    <Text style={styles.bulletText}>{rec}</Text>
                                  </View>
                                )
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.startOverButton}
                  onPress={() => {
                    setUploadedVideoUrl(null)
                    setUploadedVideoId(null)
                    setVideoDurationSeconds(null)
                    setAnalysisId(null)
                    setAnalysisJson(null)
                    setAnalysisError(null)
                    setStep(1)
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.startOverButtonText}>Start over</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.backgroundColor },
    progressSection: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 8,
    },
    progressWrap: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    progressSegment: {
      flex: 1,
      height: PROGRESS_HEIGHT,
      borderRadius: PROGRESS_HEIGHT / 2,
      backgroundColor: theme.borderColor,
    },
    stepTitle: { fontFamily: theme.semiBoldFont, fontSize: 13, color: theme.textColor, marginBottom: 4 },
    progressWrapIntro: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 16,
      marginBottom: 8,
      alignSelf: 'stretch',
    },
    stepContent: { flex: 1 },
    stepContentInner: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
    profileCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: 'rgba(0, 102, 255, 0.4)',
      backgroundColor: 'rgba(7, 16, 46, 0.9)',
      padding: 14,
      gap: 10,
    },
    profileTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 22,
      color: '#FFFFFF',
    },
    profileSubtitle: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: 'rgba(255,255,255,0.72)',
      marginTop: -4,
    },
    profileChoiceRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
    },
    profileChoicePill: {
      flex: 1,
      minHeight: 40,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(0, 134, 255, 0.35)',
      backgroundColor: 'rgba(0, 34, 120, 0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    profileChoicePillActive: {
      backgroundColor: '#FFFFFF',
      borderColor: '#FFFFFF',
    },
    profileChoiceText: {
      fontFamily: theme.mediumFont,
      fontSize: 13,
      color: '#73A8FF',
    },
    profileChoiceTextActive: {
      color: '#062063',
    },
    courtWrap: {
      marginTop: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(0, 134, 255, 0.3)',
      backgroundColor: 'rgba(0, 20, 64, 0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      minHeight: 230,
    },
    courtImage: {
      width: 120,
      height: 210,
    },
    courtBall: {
      position: 'absolute',
      width: 24,
      height: 24,
      bottom: 24,
    },
    levelList: {
      marginTop: 4,
      gap: 8,
    },
    levelOption: {
      minHeight: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(0, 120, 255, 0.4)',
      backgroundColor: 'rgba(3, 23, 90, 0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    levelOptionActive: {
      borderColor: '#00BBFF',
      backgroundColor: 'rgba(0, 108, 255, 0.35)',
    },
    levelOptionText: {
      fontFamily: theme.mediumFont,
      color: '#79AFFF',
      fontSize: 13,
    },
    levelOptionTextActive: {
      color: '#FFFFFF',
    },
    rankOrgWrap: {
      marginTop: 4,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    rankOrgChip: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(0, 120, 255, 0.45)',
      backgroundColor: 'rgba(2, 26, 92, 0.45)',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    rankOrgChipActive: {
      borderColor: '#00BBFF',
      backgroundColor: 'rgba(0, 94, 255, 0.38)',
    },
    rankOrgChipText: {
      fontFamily: theme.mediumFont,
      color: '#79AFFF',
      fontSize: 12,
    },
    rankOrgChipTextActive: {
      color: '#FFFFFF',
    },
    rankInput: {
      marginTop: 10,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(0, 120, 255, 0.4)',
      backgroundColor: 'rgba(2, 26, 92, 0.45)',
      color: '#FFFFFF',
      paddingHorizontal: 12,
      fontFamily: theme.regularFont,
      fontSize: 13,
    },
    profileNextButton: {
      marginTop: 10,
      borderRadius: 999,
      overflow: 'hidden',
    },
    profileNextButtonInner: {
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
    },
    profileNextButtonText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: '#FFFFFF',
    },
    step1: { flex: 1, minHeight: 260 },
    frameWrap: { alignItems: 'center', marginTop: 0 },
    frameOuter: { position: 'relative', borderRadius: FRAME_RADIUS + STROKE_WIDTH, overflow: 'hidden' },
    frameInner: {
      position: 'absolute',
      left: STROKE_WIDTH,
      top: STROKE_WIDTH,
      right: STROKE_WIDTH,
      bottom: STROKE_WIDTH,
      borderRadius: FRAME_RADIUS - 2,
      overflow: 'hidden',
      padding: 12,
      justifyContent: 'space-between',
    },
    videoPreview: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 120,
    },
    videoPreviewText: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: 'rgba(255,255,255,0.6)',
      marginTop: 8,
    },
    frameActions: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 12,
    },
    frameActionsSpacer: { flex: 1 },
    recordButton: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: '#C62828',
      alignItems: 'center',
      justifyContent: 'center',
    },
    recordButtonInner: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#C62828',
    },
    galleryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: '#005CFF',
      marginLeft: 16,
      marginTop: 4,
    },
    galleryButtonText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 12,
      color: '#fff',
    },
    primaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 18,
      paddingHorizontal: 24,
      borderRadius: 14,
      backgroundColor: '#E85D04',
    },
    primaryActionText: { fontFamily: theme.semiBoldFont, fontSize: 17, color: '#fff' },
    secondaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    secondaryActionText: { fontFamily: theme.semiBoldFont, fontSize: 16, color: theme.textColor },
    uploadProgressWrap: { alignItems: 'center', paddingVertical: 32 },
    uploadProgressText: { fontFamily: theme.mediumFont, fontSize: 16, color: theme.textColor, marginTop: 16, marginBottom: 12 },
    progressBarBg: { height: 8, width: '100%', backgroundColor: theme.borderColor, borderRadius: 4, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: '#E85D04', borderRadius: 4 },
    step2: { flex: 1, gap: 20, minHeight: 260 },
    step2ThumbnailContainer: {
      marginTop: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    step2ThumbnailWrap: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: 10,
      overflow: 'hidden',
    },
    step2ThumbnailVideo: {
      position: 'absolute',
      left: 2,
      top: 2,
      right: 2,
      bottom: 2,
      borderRadius: 8,
    },
    step2ThumbnailPlaceholder: {
      position: 'absolute',
      left: 2,
      top: 2,
      right: 2,
      bottom: 2,
      borderRadius: 8,
      backgroundColor: '#000',
      alignItems: 'center',
      justifyContent: 'center',
    },
    step2InstructionMain: {
      fontFamily: theme.semiBoldFont,
      fontSize: 17,
      color: theme.textColor,
      marginTop: 6,
      textAlign: 'center',
    },
    step2InstructionSub: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: theme.mutedForegroundColor,
      marginTop: 4,
      textAlign: 'center',
    },
    step2AnalyzingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: 4,
    },
    step2AnalyzingText: {
      fontFamily: theme.mediumFont,
      fontSize: 14,
      color: theme.textColor,
    },
    step1AnalyzingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: 16,
    },
    step1AnalyzingText: {
      fontFamily: theme.mediumFont,
      fontSize: 14,
      color: theme.textColor,
    },
    step2MaxLengthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      alignSelf: 'center',
    },
    step2MaxLengthText: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: theme.mutedForegroundColor,
    },
    step2Divider: {
      height: 1,
      backgroundColor: theme.borderColor,
      marginTop: 16,
      width: '100%',
    },
    step2ScrollBarWrap: {
      marginTop: 16,
      width: '100%',
      height: 128,
      position: 'relative',
    },
    step2ScrollBarImage: {
      width: '100%',
      height: 128,
    },
    step2ScrollBoxRow: {
      position: 'absolute',
      left: 12,
      right: 12,
      top: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    step2ScrollBox: {
      width: 36,
      height: 80,
      backgroundColor: 'rgba(255,255,255,0.25)',
      borderRadius: 4,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.4)',
    },
    analyseButton: {
      borderRadius: 14,
      overflow: 'hidden',
      marginTop: 24,
    },
    analyseButtonInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 14,
    },
    analyseButtonText: { fontFamily: theme.semiBoldFont, fontSize: 17, color: '#fff' },
    step3: { flex: 1, gap: 24, minHeight: 260 },
    placeholderCard: {
      flex: 1,
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      paddingVertical: 16,
      paddingHorizontal: 0,
      borderRadius: 0,
      borderWidth: 0,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
    },
    placeholderTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 18,
      color: theme.textColor,
      marginTop: 16,
      marginBottom: 8,
      textAlign: 'left',
      alignSelf: 'flex-start',
    },
    placeholderHint: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: theme.mutedForegroundColor,
      textAlign: 'left',
      marginTop: 2,
    },
    nextButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 14,
      backgroundColor: '#7B2CBF',
      marginTop: 20,
    },
    nextButtonText: { fontFamily: theme.semiBoldFont, fontSize: 17, color: '#fff' },
    continueButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 14,
      backgroundColor: '#7B2CBF',
    },
    continueButtonText: { fontFamily: theme.semiBoldFont, fontSize: 17, color: '#fff' },
    startOverButton: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 24 },
    startOverButtonText: { fontFamily: theme.mediumFont, fontSize: 16, color: theme.mutedForegroundColor },
    accordionCard: {
      width: '100%',
      marginTop: 12,
      borderRadius: 16,
      backgroundColor: '#0E1830',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      overflow: 'hidden',
    },
    accordionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 8,
    },
    accordionTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: theme.textColor,
    },
    accordionSubtitle: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: theme.mutedForegroundColor,
      marginTop: 2,
    },
    accordionBody: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    accordionScoreText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 22,
      color: '#3C3EF6',
      marginRight: 4,
    },
    accordionRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    accordionIconChip: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#0022FF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    videoCard: {
      width: '100%',
      marginTop: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      padding: 14,
      backgroundColor: '#0E1830',
    },
    videoCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    videoCardEyebrow: {
      fontFamily: theme.regularFont,
      fontSize: 11,
      color: theme.mutedForegroundColor,
      marginBottom: 2,
    },
    videoCardTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: theme.textColor,
    },
    videoCardPlayerWrap: {
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    videoCardPlayer: {
      width: '100%',
      height: 200,
      backgroundColor: '#000',
    },
    scoreCircleWrap: {
      marginTop: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scoreCircleSvg: {
      position: 'relative',
    },
    scoreCircleCenter: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    scoreCircleLabel: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: theme.mutedForegroundColor,
      marginBottom: 4,
    },
    scoreCircleValue: {
      fontFamily: theme.semiBoldFont,
      fontSize: 28,
      color: theme.textColor,
    },
    trimCard: {
      width: '100%',
      marginTop: 24,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      backgroundColor: '#0E1830',
      padding: 16,
    },
    trimTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: theme.textColor,
      marginBottom: 4,
    },
    trimSubtitle: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: theme.mutedForegroundColor,
      marginBottom: 16,
    },
    trimControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    trimPlayButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: 'rgba(0, 92, 255, 0.35)',
      borderWidth: 1,
      borderColor: 'rgba(0, 187, 255, 0.45)',
    },
    trimPlayButtonText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 12,
      color: '#fff',
    },
    trimTimeText: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: theme.mutedForegroundColor,
    },
    trimRangeText: {
      fontFamily: theme.mediumFont,
      fontSize: 12,
      color: theme.textColor,
      marginBottom: 10,
    },
    trimTimeline: {
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      overflow: 'hidden',
      paddingHorizontal: 4,
    },
    trimTrack: {
      width: '100%',
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    trimTrackRange: {
      position: 'absolute',
      top: 20,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.95)',
    },
    trimTrackActive: {
      position: 'absolute',
      left: 0,
      top: 20,
      height: 4,
      borderRadius: 2,
      backgroundColor: '#00BBFF',
      opacity: 0.9,
    },
    frameTicksRow: {
      marginTop: 10,
      marginBottom: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 2,
    },
    frameTick: {
      width: 2,
      height: 10,
      borderRadius: 1,
      backgroundColor: 'rgba(255,255,255,0.28)',
    },
    setClipButton: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#fff',
      borderRadius: 22,
      paddingHorizontal: 22,
      paddingVertical: 10,
      marginBottom: 12,
    },
    setClipButtonText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      color: '#0A1120',
    },
    clipsList: {
      marginBottom: 6,
      gap: 8,
    },
    clipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      backgroundColor: 'rgba(0,0,0,0.25)',
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    clipText: {
      fontFamily: theme.mediumFont,
      fontSize: 12,
      color: theme.textColor,
    },
    trimHandle: {
      position: 'absolute',
      width: 18,
      height: 18,
      borderRadius: 9,
      top: 13,
      backgroundColor: '#fff',
      borderWidth: 2,
      borderColor: '#00BBFF',
    },
    trimHint: {
      fontFamily: theme.regularFont,
      fontSize: 11,
      color: theme.mutedForegroundColor,
      marginTop: 10,
    },
    addClipRequiredText: {
      marginTop: 8,
      textAlign: 'center',
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: theme.mutedForegroundColor,
    },
    heroTitlePrefix: {
      fontFamily: theme.semiBoldFont,
      fontSize: 32,
      color: theme.textColor,
      textAlign: 'center',
    },
    heroTitleTechnique: {
      fontFamily: theme.semiBoldFont,
      fontSize: 44,
      textAlign: 'center',
      marginBottom: 12,
    },
    heroTitleMask: {
      marginTop: 2,
      marginBottom: 8,
    },
    heroSubtitle: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: theme.mutedForegroundColor,
      marginBottom: 20,
      textAlign: 'center',
    },
    heroTitleTechniqueWeb: {
      fontFamily: theme.semiBoldFont,
      fontSize: 44,
      textAlign: 'center',
      marginBottom: 12,
      color: '#00BBFF',
    },
    introCardPrimaryOuter: {
      borderRadius: 22,
      marginTop: 20,
      marginBottom: 12,
      overflow: 'hidden',
      alignSelf: 'stretch',
    },
    introCardPrimary: {
      borderRadius: 22,
      paddingHorizontal: 20,
      paddingVertical: 18,
      minHeight: 150,
      justifyContent: 'space-between',
    },
    introCard: {
      borderRadius: 18,
      padding: 16,
      marginTop: 12,
      backgroundColor: 'rgba(0, 15, 60, 0.9)',
      minHeight: 120,
      justifyContent: 'space-between',
      alignSelf: 'stretch',
    },
    introCardStepLabel: {
      fontFamily: theme.mediumFont,
      fontSize: 12,
      color: theme.mutedForegroundColor,
      marginBottom: 4,
    },
    introCardTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 18,
      color: '#EAF4FF',
      marginBottom: 4,
    },
    introCardBody: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: theme.mutedForegroundColor,
    },
    introCardRowTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    introCardRowBottom: {
      marginTop: 12,
    },
    introCardIconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.8)',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    heroGlow: {
      position: 'absolute',
      top: -80,
      left: -40,
      right: -40,
      height: 320,
      borderRadius: 0,
      overflow: 'visible',
      zIndex: -10,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 4,
    },
    bulletDot: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: '#00BBFF',
      marginRight: 6,
      marginTop: 1,
    },
    bulletText: {
      flex: 1,
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: theme.textColor,
    },
    ratingText: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: theme.textColor,
      textAlign: 'left',
      marginTop: 2,
    },
  })
}
