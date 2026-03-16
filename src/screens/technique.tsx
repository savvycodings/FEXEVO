import {
  View,
  Text,
  TouchableOpacity,
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
import { Video } from 'expo-av'
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

const PROGRESS_HEIGHT = 6
const STEP_SEGMENT_COLORS = ['#0022FF', '#005CFF', '#00BBFF'] // step 1, 2, 3 active
const STEP_TITLES = [
  'Upload or record your Padel video.',
  'Select frame of the video.',
  'Results of the analysis.',
]

export function Technique() {
  const { theme } = useContext(ThemeContext)
  const [step, setStep] = useState(1)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null)
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null)
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisJson, setAnalysisJson] = useState<any>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const mainVideoRef = useRef<Video | null>(null)
  const trimVideoRef = useRef<Video | null>(null)
  const [introMode, setIntroMode] = useState(true)
  const [ratingOpen, setRatingOpen] = useState(true)
  const [observationsOpen, setObservationsOpen] = useState(true)
  const [recommendationsOpen, setRecommendationsOpen] = useState(true)
  const [markerProgress, setMarkerProgress] = useState(0.5)
  const [trimTrackWidth, setTrimTrackWidth] = useState(0)
  const styles = getStyles(theme)
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

  const STEP2_MAX_LENGTH_SEC = 20

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

  function uploadVideo(uri: string, fileName: string, mimeType: string): Promise<void> {
    return new Promise(async (resolve) => {
      console.log('[Technique] Upload started', { fileName, mimeType })
      setUploading(true)
      setUploadProgress(0)
      const xhr = new XMLHttpRequest()
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
        }
      } else {
        // @ts-ignore - React Native FormData file
        formData.append('video', { uri, name: fileName, type: mimeType })
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100)
          setUploadProgress(pct)
          if (pct % 25 === 0 || pct === 100) console.log('[Technique] Upload progress', pct + '%')
        }
      })
      xhr.addEventListener('load', () => {
        setUploading(false)
        setUploadProgress(100)
        const status = xhr.status
        const responseText = xhr.responseText || '{}'
        console.log('[Technique] Upload response', { status, responseText: responseText.slice(0, 200) })
        if (status >= 200 && status < 300) {
          try {
            const data = JSON.parse(responseText)
            const url = data?.url
            const id = data?.id
            console.log('[Technique] Upload success', { id, url: url ? `${url.slice(0, 50)}...` : '' })
            if (url) {
              const absoluteUrl = url.startsWith('http') ? url : `${DOMAIN}${url}`
              setUploadedVideoUrl(absoluteUrl)
            }
            if (id) {
              setUploadedVideoId(id)
              console.log('[Technique] Stored uploadedVideoId', id)
              // After upload, move to step 2 (trim/marker screen)
              setStep(2)
            }
            resolve()
          } catch (err) {
            console.error('[Technique] Failed to parse response', err)
            resolve()
          }
        } else {
          console.error('[Technique] Upload failed with status', status)
          resolve()
        }
      })
      xhr.addEventListener('error', () => {
        setUploading(false)
        console.error('[Technique] Upload XHR error')
        resolve()
      })

      xhr.open('POST', `${DOMAIN}/technique/upload`)
      xhr.withCredentials = true
      xhr.setRequestHeader('Accept', 'application/json')
      xhr.send(formData)
    })
  }

  async function runAnalysis(forcedVideoId?: string) {
    const videoId = forcedVideoId ?? uploadedVideoId
    if (!videoId) {
      console.log('[Technique] No uploadedVideoId, cannot analyze')
      return
    }
    try {
      console.log('[Technique] Starting analysis for video', videoId)
      setAnalysisLoading(true)
      setAnalysisError(null)
      setAnalysisJson(null)

      const res = await fetch(`${DOMAIN}/technique/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ techniqueVideoId: videoId }),
      })
      const body = await res.json()
      console.log('[Technique] Analyze response', { status: res.status, body })
      if (!res.ok || !body.analysisId) {
        setAnalysisError(body?.error || 'Analyze failed')
        setAnalysisLoading(false)
        return
      }

      const id = body.analysisId as string
      setAnalysisId(id)
      setStep(2)

      // Poll for analysis result
      const pollStart = Date.now()
      let done = false
      while (!done && Date.now() - pollStart < 600000) {
        await new Promise(r => setTimeout(r, 3000))
        const pollRes = await fetch(`${DOMAIN}/technique/analysis/${id}`, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        const pollBody = await pollRes.json()
        console.log('[Technique] Analysis poll', { status: pollRes.status, body: pollBody })
        if (!pollRes.ok) {
          setAnalysisError(pollBody?.error || 'Failed to fetch analysis')
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
      if (done) {
        setStep(3)
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
            {[1, 2, 3].map((i) => (
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
            onPress={() => setIntroMode(false)}
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
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.progressSection}>
        <View style={styles.progressWrap}>
          {[1, 2, 3].map((i) => (
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
                          style={styles.chooseFileButton}
                          onPress={pickDocument}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.chooseFileText}>Choose File</Text>
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

        {step === 2 && (
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
                    resizeMode="cover"
                    shouldPlay={false}
                    isMuted
                    onPlaybackStatusUpdate={(e) => {
                      if (e.status?.isLoaded && typeof e.status.durationMillis === 'number' && videoDurationSeconds == null)
                        setVideoDurationSeconds(Math.round(e.status.durationMillis / 1000))
                      if (e.status?.isLoaded === false && e.status?.error) {
                        console.log('[Technique] Thumbnail video error', e.status.error)
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
                Drag the handle so the ball meets the racket in the center of the frame.
              </Text>
              <View
                style={styles.trimTimeline}
                onLayout={e => setTrimTrackWidth(e.nativeEvent.layout.width)}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderMove={async e => {
                  if (!trimTrackWidth) return
                  const x = e.nativeEvent.locationX
                  const p = Math.max(0, Math.min(1, x / trimTrackWidth))
                  setMarkerProgress(p)
                  if (trimVideoRef.current && videoDurationSeconds != null) {
                    const ms = videoDurationSeconds * 1000 * p
                    try {
                      await trimVideoRef.current.setStatusAsync({ positionMillis: ms })
                    } catch {
                      // ignore seek errors
                    }
                  }
                }}
                onResponderRelease={async e => {
                  if (!trimTrackWidth) return
                  const x = e.nativeEvent.locationX
                  const p = Math.max(0, Math.min(1, x / trimTrackWidth))
                  setMarkerProgress(p)
                  if (trimVideoRef.current && videoDurationSeconds != null) {
                    const ms = videoDurationSeconds * 1000 * p
                    try {
                      await trimVideoRef.current.setStatusAsync({ positionMillis: ms })
                    } catch {
                      // ignore seek errors
                    }
                  }
                }}
              >
                <View style={styles.trimTrack} />
                {trimTrackWidth > 0 && (
                  <View
                    style={[
                      styles.trimHandle,
                      { left: markerProgress * trimTrackWidth - styles.trimHandle.width / 2 },
                    ]}
                  />
                )}
              </View>
              <Text style={styles.trimHint}>You can refine this later in future versions.</Text>
            </View>

            <TouchableOpacity
              style={styles.analyseButton}
              onPress={() => runAnalysis()}
              activeOpacity={0.9}
              disabled={!uploadedVideoId || analysisLoading}
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
                ) : (
                  <>
                    <Text style={styles.analyseButtonText}>Analyse Videos</Text>
                    <FeatherIcon name="arrow-right" size={20} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
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
                    resizeMode="cover"
                    shouldPlay={false}
                    isMuted
                    onPlaybackStatusUpdate={(e) => {
                      if (e.status?.isLoaded && typeof e.status.durationMillis === 'number' && videoDurationSeconds == null)
                        setVideoDurationSeconds(Math.round(e.status.durationMillis / 1000))
                      if (e.status?.isLoaded === false && e.status?.error) {
                        console.log('[Technique] Thumbnail video error', e.status.error)
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
                                resizeMode="contain"
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
    chooseFileButton: {
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 24,
      backgroundColor: '#fff',
      marginLeft: 16,
    },
    chooseFileText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: '#000',
      flexShrink: 1,
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
    trimTimeline: {
      height: 60,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    trimTrack: {
      width: '80%',
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    trimHandle: {
      position: 'absolute',
      width: 6,
      height: 34,
      borderRadius: 3,
      backgroundColor: '#00BBFF',
    },
    trimHint: {
      fontFamily: theme.regularFont,
      fontSize: 11,
      color: theme.mutedForegroundColor,
      marginTop: 10,
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
      top: -100,
      left: -40,
      right: -40,
      height: 260,
      borderRadius: 260,
      overflow: 'hidden',
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
