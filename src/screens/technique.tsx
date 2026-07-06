import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  Alert,
  StatusBar,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useState, useContext, useRef, useEffect, useMemo, useCallback, useId } from 'react'
import { ThemeContext } from '../context'
import { useSessionData } from '../context/SessionDataContext'
import {
  ensureCorrectionNotificationPermission,
  notifyCorrectionImagesReady,
} from '../lib/correctionImageNotifications'
import { DOMAIN } from '../../constants'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
// expo-file-system v19 moved cacheDirectory/copyAsync/etc. to /legacy.
import * as FileSystem from 'expo-file-system/legacy'
import { Video, ResizeMode } from 'expo-av'
import { getThumbnailAsync } from 'expo-video-thumbnails'
import Ionicons from '@expo/vector-icons/Ionicons'
import FeatherIcon from '@expo/vector-icons/Feather'
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
  Circle,
  G,
  Path,
  ClipPath,
  Filter,
  FeGaussianBlur,
} from 'react-native-svg'
import { authClient } from '../lib/auth-client'
import { LinearGradient } from 'expo-linear-gradient'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import { LOADING_OVERLAY_SCRIM } from '../constants/loadingVideoFullscreen'
import {
  AICoachCoachReviewBanner,
  type AICoachAssignedCoach,
} from '../components/AICoachCoachReviewBanner'
import { hasProfileImage, profileImageToAbsoluteUri } from '../lib/defaultProfilePicture'
import { VideoFrameCarousel, normalizeThumbnailImageUri } from '../components/VideoFrameCarousel'
import { TrimClipPreview, type TrimClipPreviewHandle } from '../components/TrimClipPreview'
import { ProLibraryGradientFrame } from '../components/ProLibraryGradientFrame'
import { ProLibraryGradientProgressBar } from '../components'
import { proLibraryChrome } from '../theme/proLibraryChrome'
import { TechniqueAnalysisVideoPanel } from '../components/TechniqueAnalysisVideoPanel'
import { CorrectionRegenerateModal } from '../components/CorrectionRegenerateModal'
import { CorrectionImageWithLoader } from '../components/CorrectionImageWithLoader'
import { PhysicalMetricsSection } from '../components/physicalMetrics/PhysicalMetricsSection'
import { parsePhysicalMetricsFromAnalysis } from '../lib/physicalMetrics'
import { CoachStrengthFocusInsightCards } from '../components/CoachStrengthFocusInsightCards'
import { buildCoachInsightCardsContent } from '../lib/coachInsightCards'
import { normalizePoseData, resolveTotalFrames, type PoseFrameRow } from '../lib/techniquePose'
import {
  storedAiBreakdownToPercent,
  storedAiConfidenceToPercent,
  storedAiScoreToPercent,
} from '../lib/techniqueScoreDisplay'
import {
  clampClipRangeMs,
  MAX_ANALYZE_CLIP_MS,
  MIN_ANALYZE_CLIP_MS,
} from '../lib/techniqueClipLimits'
import { uploadTechniqueVideo } from '../lib/techniqueVideoUpload'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const HORIZONTAL_PADDING = 24
const FRAME_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2
const FRAME_ASPECT = 9 / 16
const FRAME_HEIGHT = FRAME_WIDTH / FRAME_ASPECT
/** Upload step: bar slightly narrower than the “Uploading your video” caption line. */
const UPLOAD_PROGRESS_TRACK_WIDTH = Math.min(200, Math.max(168, Math.round(FRAME_WIDTH * 0.56)))
const STROKE_WIDTH = 4
const FRAME_RADIUS = 24
const GRADIENT_COLORS = ['#0022FF', '#00BBFF', '#00BBFF', '#0022FF']
const GRADIENT_STOPS = ['0%', '30%', '70%', '100%']
const SCROLLUI_IMAGE = require('../../assets/scrollui.png')
const COURT_IMAGE = require('../../assets/court.png')
const BALL_IMAGE = require('../../assets/ball.png')
const HOWTO_RIGHT1_IMAGE = require('../../assets/howto/right1.png')
const HOWTO_RIGHT2_IMAGE = require('../../assets/howto/right2.png')
const HOWTO_X1_IMAGE = require('../../assets/howto/x1.png')
const HOWTO_X2_IMAGE = require('../../assets/howto/x2.png')
const LOADING_VIDEO_CLIP = require('../../assets/loadingvideo/loadingvideo.mp4')
const SCORE_3BARS_ICON = require('../../assets/afteranylize/3bars.svg')
const CATEGORY_ICON_TECHNIQUE = require('../../assets/afteranylize/technique.svg')
const CATEGORY_ICON_OUTCOME = require('../../assets/afteranylize/outcome.svg')
const CATEGORY_ICON_TACTICS = require('../../assets/afteranylize/tactics.svg')
const HOWTO_HIDE_KEY = 'technique_hide_howto_prompt'
const CHOOSE_FILE_ICON = require('../../assets/aicoach/choosefileicon.svg')
const UPLOADING_STEP_ICON = require('../../assets/actiities/uploading.svg')
const CORRECTION_MODE_ICON_GREY = '#6B7F9E'
const CORRECTION_MODE_ICON_ACTIVE = '#00BBFF'
/** Matches Summary Category / Level / Shot gradient ring */
const STEP3_CARD_GRADIENT_COLORS = [
  '#006EFF',
  'rgba(0, 110, 255, 0)',
  '#006EFF',
  'rgba(0, 110, 255, 0)',
] as const
const STEP3_CARD_GRADIENT_LOCATIONS = [0, 0.33, 0.66, 1] as const
/** Toggle to show dev pose actions again */
const SHOW_GENERATE_POSES_TEST = false
const SHOW_GENERATE_FAL_FLUX = false
/**
 * When true, show ComfyUI correction path (server must have COMFYUI_* env + reachable Comfy).
 * Baked in at build time (EAS `env` overrides `app/.env` for dev clients). Default off.
 */
const SHOW_COMFY_CORRECTIONS =
  String(process.env.EXPO_PUBLIC_SHOW_COMFY_CORRECTIONS ?? '')
    .trim()
    .toLowerCase() === 'true'
/**
 * Legacy correction providers (Gemini + fal.ai) — chips, retry buttons, and the
 * primary "Generate Corrected Poses" button (which historically routed to Gemini).
 * Default OFF so testing the Comfy/Qwen path is unambiguous: no silent fallbacks,
 * no buttons that route to third-party. Set `EXPO_PUBLIC_ENABLE_LEGACY_CORRECTIONS=true`
 * in `app/.env` to bring them back for A/B comparison.
 */
const SHOW_LEGACY_CORRECTIONS =
  process.env.EXPO_PUBLIC_ENABLE_LEGACY_CORRECTIONS === 'true'
/** Must stay in sync with `coachBannerSlot` (minHeight + vertical padding). */
const COACH_BANNER_SLOT_H = 96
const COACH_BANNER_SLOT_PADDING_V = 6 + 2
/**
 * Main tab bar already applies bottom safe area (`main.tsx` tabBarBottomPad = insets.bottom + 10).
 * Tab scene content sits above the bar — adding full `insets.bottom` again was double-counting and
 * left a large empty gap above the tab bar.
 */
const TAB_SCENE_SCROLL_BOTTOM_PAD = 20
/**
 * The bottom tab bar floats over the tab scene (other screens reserve `insets.bottom + 74`).
 * Step 1's frame must reserve the same so the box ends above the nav on every device.
 */
const FLOATING_NAV_RESERVE = 74
/** Step 1 upload box uses tighter side padding than other steps so it takes more width. */
const STEP1_HORIZONTAL_PADDING = 14
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
const FRAME_SNAP_POINTS = 31
const CAROUSEL_FRAMES_EVERY = 5
const CAROUSEL_FPS = 30
type TechniqueClip = {
  id: string
  startMs: number
  endMs: number
}

type RunAnalysisOptions = {
  navigateOnDone?: boolean
  resetState?: boolean
}

type HowToAction = 'record' | 'gallery'

type CorrectionModeIconProps = {
  color: string
  strokeOpacity?: number
}

function DragModeIcon({ color, strokeOpacity = 1 }: CorrectionModeIconProps) {
  return (
    <Svg width={26} height={26} viewBox="0 0 32 32" fill="none">
      <G clipPath="url(#drag_clip_a)">
        <Rect
          x={3}
          y={29.5}
          width={27}
          height={27}
          rx={8}
          transform="rotate(-90 3 29.5)"
          stroke={color}
          strokeOpacity={strokeOpacity}
        />
      </G>
      <Path
        d="M16 22L16 10"
        stroke={color}
        strokeOpacity={strokeOpacity}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="2 3"
      />
      <G clipPath="url(#drag_clip_b)">
        <Rect
          width={27}
          height={27}
          rx={8}
          transform="matrix(-4.37114e-08 -1 -1 4.37114e-08 29 29.5)"
          stroke={color}
          strokeOpacity={strokeOpacity}
          strokeWidth={3}
        />
      </G>
      <Defs>
        <ClipPath id="drag_clip_a">
          <Rect width={30} height={15} fill="white" transform="translate(1 31) rotate(-90)" />
        </ClipPath>
        <ClipPath id="drag_clip_b">
          <Rect width={30} height={15} fill="white" transform="matrix(-4.37114e-08 -1 -1 4.37114e-08 31 31)" />
        </ClipPath>
      </Defs>
    </Svg>
  )
}

/** Retrieval metrics on analysis — includes `shot_hypothesis` for this clip from embeddings/pose. */
type TechniqueRetrievalMetrics = {
  shot_hypothesis?: {
    stroke_label?: string | null
    stroke_preset?: string | null
    category?: string | null
    skill_level?: string | null
  }
}

/** `correctedImage`: API/data URIs (string), native `require()` id (number), or Expo/web `{ uri, width, height }` */
type CorrectionPairRow = {
  frame: number
  originalImage: string
  correctedImage: string | number | ImageSourcePropType
}

function isUsableCorrectionImageUri(uri: string): boolean {
  const u = typeof uri === 'string' ? uri.trim() : ''
  if (u.length < 12) return false
  return (
    u.startsWith('http://') ||
    u.startsWith('https://') ||
    u.startsWith('data:image/') ||
    u.startsWith('file:') ||
    u.startsWith('/uploads/')
  )
}

function isValidCorrectedSource(v: string | number | ImageSourcePropType): boolean {
  if (typeof v === 'number') return Number.isFinite(v) && v !== 0
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
    const uri = (v as { uri?: unknown }).uri
    return typeof uri === 'string' && uri.trim().length > 0
  }
  const s = typeof v === 'string' ? v.trim() : ''
  if (s.length === 0) return false
  if (isUsableCorrectionImageUri(s)) return true
  /** Webpack / Metro: `require('./x.png')` is often a string URL or path, not a number */
  if (s.startsWith('/') || s.startsWith('blob:')) return true
  if (/^https?:\/\//i.test(s)) return true
  if (/\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(s)) return true
  return false
}

/** URI string, Metro `require()` id, or `{ uri }` object from some bundlers — for `<Image source={…} />`. */
function toImageSource(uriOrModule: string | number | ImageSourcePropType): ImageSourcePropType {
  if (typeof uriOrModule === 'number') return uriOrModule
  if (typeof uriOrModule === 'object' && uriOrModule !== null && !Array.isArray(uriOrModule)) {
    const raw = uriOrModule as { uri?: string }
    if (typeof raw.uri === 'string') {
      const u = raw.uri
      if (typeof window !== 'undefined' && u.startsWith('/') && !u.startsWith('//')) {
        return { ...raw, uri: `${window.location.origin}${u}` } as ImageSourcePropType
      }
    }
    return uriOrModule as ImageSourcePropType
  }
  if (typeof uriOrModule !== 'string') {
    return uriOrModule as ImageSourcePropType
  }
  const s = uriOrModule.trim()
  if (s.startsWith('/uploads/')) {
    const base = DOMAIN.replace(/\/+$/, '')
    return { uri: `${base}${s}` }
  }
  if (s.startsWith('/') || /^https?:\/\//i.test(s) || s.startsWith('blob:')) {
    if (typeof window !== 'undefined' && s.startsWith('/') && !s.startsWith('//')) {
      return { uri: `${window.location.origin}${s}` }
    }
    return { uri: s }
  }
  return { uri: s }
}

/** Bundled test “corrected” frames — use `require()` ids so web/native both work (no `resolveAssetSource`). */
const TEST_CORRECTED_SOURCES = [
  require('../../assets/testimgegen/1.png'),
  require('../../assets/testimgegen/2.png'),
  require('../../assets/testimgegen/3.png'),
  require('../../assets/testimgegen/4.png'),
  require('../../assets/testimgegen/5.png'),
] as const

/** Drop failed generations (duplicate original, empty URL, or non-loadable URI) so we do not show blank thumbs. */
function filterValidCorrectionPairs(rows: CorrectionPairRow[]): CorrectionPairRow[] {
  return rows.filter((c) => {
    if (!isValidCorrectedSource(c.correctedImage)) return false
    if (!isUsableCorrectionImageUri(c.originalImage)) return false
    if (typeof c.correctedImage === 'string' && c.correctedImage === c.originalImage) return false
    return true
  })
}

function SideBySideModeIcon({ color, strokeOpacity = 1 }: CorrectionModeIconProps) {
  return (
    <Svg width={26} height={26} viewBox="0 0 30 31" fill="none">
      <Rect x={16.5781} y={10.5} width={9} height={9} rx={3} stroke={color} strokeOpacity={strokeOpacity} strokeWidth={2} />
      <Rect x={4.42188} y={10.5} width={9} height={9} rx={3} stroke={color} strokeOpacity={strokeOpacity} strokeWidth={2} />
      <Path
        d="M19.4211 29.5C22.1655 29.5 23.5378 29.5 24.6366 29.1C26.4785 28.4297 27.9297 26.9785 28.6 25.1366C29 24.0378 29 22.6655 29 19.9211M10.5789 29.5C7.83449 29.5 6.46225 29.5 5.36345 29.1C3.52141 28.4297 2.07038 26.9785 1.39993 25.1366C1 24.0378 1 22.6655 1 19.9211M10.5789 1.5C7.83449 1.5 6.46225 1.5 5.36345 1.89993C3.52141 2.57037 2.07038 4.02142 1.39993 5.86345C1 6.96226 1 8.33448 1 11.079M19.4211 1.5C22.1655 1.5 23.5378 1.5 24.6366 1.89993C26.4785 2.57037 27.9297 4.02142 28.6 5.86345C29 6.96226 29 8.33448 29 11.079"
        stroke={color}
        strokeOpacity={strokeOpacity}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function Technique() {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { invalidate: invalidateSessionData } = useSessionData()
  const { data: session } = authClient.useSession()
  const insets = useSafeAreaInsets()
  const { width: winW, height: winH } = useWindowDimensions()
  const [scrollBodyH, setScrollBodyH] = useState(0)
  /** Actual size of the step-1 frame container, measured directly to avoid a winH-derived estimate jump. */
  const [frameWrapSize, setFrameWrapSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [step, setStep] = useState(1)
  const [dominantHand, setDominantHand] = useState<'left' | 'right' | null>(null)
  const [courtSide, setCourtSide] = useState<'left' | 'right' | null>(null)
  const [hasRanking, setHasRanking] = useState<boolean | null>(null)
  const [level, setLevel] = useState<string | null>(null)
  const [rankingOrg, setRankingOrg] = useState<string | null>(null)
  const [rankingValue, setRankingValue] = useState('')
  const [uploading, setUploading] = useState(false)
  const [sendVideoToCoach, setSendVideoToCoach] = useState(false)
  const [assignedCoach, setAssignedCoach] = useState<AICoachAssignedCoach | null>(null)
  const [coachBannerLoaded, setCoachBannerLoaded] = useState(false)
  const coachFetchGeneration = useRef(0)
  const sessionUserIdRef = useRef<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null)
  const [localVideoUri, setLocalVideoUri] = useState<string | null>(null)
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null)
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisJson, setAnalysisJson] = useState<any>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const trimPreviewRef = useRef<TrimClipPreviewHandle | null>(null)
  /** Pixel dimensions from the trim preview `Video` — box height = f(width, aspect) so overlays stay aligned with decode geometry. */
  const [trimPreviewNaturalSize, setTrimPreviewNaturalSize] = useState<{ w: number; h: number } | null>(
    null
  )
  const [ratingOpen, setRatingOpen] = useState(false)
  const [strengthsOpen, setStrengthsOpen] = useState(false)
  const [technicalErrorsOpen, setTechnicalErrorsOpen] = useState(false)
  const [actionableOpen, setActionableOpen] = useState(false)
  const [markerProgress, setMarkerProgress] = useState(0.5)
  const [trimRange, setTrimRange] = useState<{ startMs: number; endMs: number }>({
    startMs: 0,
    endMs: 3000,
  })
  /** Same JPEG uri as the carousel center cell — updates when the slider moves. */
  const [step2CenterFrameUri, setStep2CenterFrameUri] = useState<string | null>(null)
  const [clips, setClips] = useState<TechniqueClip[]>([])
  const [geminiCorrectionImages, setGeminiCorrectionImages] = useState<CorrectionPairRow[]>([])
  const [falCorrectionImages, setFalCorrectionImages] = useState<CorrectionPairRow[]>([])
  const [comfyCorrectionImages, setComfyCorrectionImages] = useState<CorrectionPairRow[]>([])
  /** Which cached correction set to show (internal; no vendor labels in UI). */
  const [correctionImageSource, setCorrectionImageSource] = useState<
    'gemini' | 'fal' | 'comfy' | 'test'
  >('gemini')
  const [correctionsLoadingGemini, setCorrectionsLoadingGemini] = useState(false)
  const [correctionsLoadingFal, setCorrectionsLoadingFal] = useState(false)
  const [correctionsLoadingComfy, setCorrectionsLoadingComfy] = useState(false)
  const [correctionsLoadingTest, setCorrectionsLoadingTest] = useState(false)
  const [correctionsError, setCorrectionsError] = useState<string | null>(null)
  const [correctionsFalError, setCorrectionsFalError] = useState<string | null>(null)
  const [correctionsComfyError, setCorrectionsComfyError] = useState<string | null>(null)
  const [correctionsTestError, setCorrectionsTestError] = useState<string | null>(null)
  /** Server-extracted video frames paired with bundled testimgegen PNGs (no AI gen) */
  const [testPoseCorrectionImages, setTestPoseCorrectionImages] = useState<CorrectionPairRow[]>([])
  const [activeCorrection, setActiveCorrection] = useState(0)

  const visibleGeminiCorrectionImages = useMemo(
    () => filterValidCorrectionPairs(geminiCorrectionImages),
    [geminiCorrectionImages]
  )
  const visibleFalCorrectionImages = useMemo(
    () => filterValidCorrectionPairs(falCorrectionImages),
    [falCorrectionImages]
  )
  const visibleComfyCorrectionImages = useMemo(
    () => filterValidCorrectionPairs(comfyCorrectionImages),
    [comfyCorrectionImages]
  )

  const correctionImages =
    correctionImageSource === 'fal'
      ? visibleFalCorrectionImages
      : correctionImageSource === 'comfy'
        ? visibleComfyCorrectionImages
        : correctionImageSource === 'test'
          ? testPoseCorrectionImages
          : visibleGeminiCorrectionImages
  const correctionsLoading =
    correctionsLoadingGemini ||
    correctionsLoadingFal ||
    correctionsLoadingComfy ||
    correctionsLoadingTest

  const correctionProviderCount =
    (visibleGeminiCorrectionImages.length > 0 ? 1 : 0) +
    (visibleFalCorrectionImages.length > 0 ? 1 : 0) +
    (SHOW_COMFY_CORRECTIONS && visibleComfyCorrectionImages.length > 0 ? 1 : 0) +
    (testPoseCorrectionImages.length > 0 ? 1 : 0)
  const canShowCorrectionSourceChips =
    (SHOW_LEGACY_CORRECTIONS || SHOW_COMFY_CORRECTIONS) && correctionProviderCount >= 2

  const [compareSplit, setCompareSplit] = useState(0.5)
  const [correctionViewMode, setCorrectionViewMode] = useState<'sideBySide' | 'drag'>('drag')
  const [regenerateModalVisible, setRegenerateModalVisible] = useState(false)
  const [regenerateFeedbackMessage, setRegenerateFeedbackMessage] = useState('')
  const [compareCardLayout, setCompareCardLayout] = useState<{
    width: number
    height: number
  } | null>(null)
  const [showHowToModal, setShowHowToModal] = useState(false)
  const [hideHowToNextTime, setHideHowToNextTime] = useState(false)
  const [skipHowToModal, setSkipHowToModal] = useState(false)
  const [pendingHowToAction, setPendingHowToAction] = useState<HowToAction | null>(null)
  /** Measured size of the "How to upload" modal card so the SVG inner-glow matches the upload box. */
  const [howToCardSize, setHowToCardSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const styles = getStyles(theme)

  /**
   * Height of the `scrollBody` region (below the optional coach banner).
   * Before `onLayout`, we estimate from window size. That estimate must subtract the coach
   * banner when step 1 shows it — otherwise `step1FrameDims` thinks the upload panel is ~100px
   * taller than reality and the frame can sit under the banner (Android especially).
   */
  const effectiveScrollBodyH = useMemo(() => {
    if (scrollBodyH > 0) return scrollBodyH
    const coachReserve =
      step === 1 && assignedCoach ? COACH_BANNER_SLOT_H + COACH_BANNER_SLOT_PADDING_V + 8 : 0
    return Math.max(280, winH - insets.top - insets.bottom - 88 - coachReserve)
  }, [scrollBodyH, winH, insets.top, insets.bottom, step, assignedCoach])

  /** Upload panel: cap height so step 1 fits without scrolling when coach banner is shown. */
  const step1FrameMeasured = step === 1 && frameWrapSize.h > 0
  const step1FrameDims = useMemo(() => {
    if (step !== 1) {
      const maxW = winW - HORIZONTAL_PADDING * 2
      return { w: maxW, h: Math.max(320, maxW * 1.34) }
    }
    // Step 1 uses a tighter side padding so the upload box can take more width.
    const maxW = winW - STEP1_HORIZONTAL_PADDING * 2
    const idealH = maxW * 1.34
    // Once the frame container is measured, size the box to it exactly (device-independent,
    // no winH-derived estimate → no visible resize a beat after mount). Width stays maxW
    // (the container applies STEP1_HORIZONTAL_PADDING) so only the height comes from measurement.
    if (frameWrapSize.h > 0) {
      return { w: maxW, h: Math.max(300, frameWrapSize.h) }
    }
    const paddingTop = 12
    const paddingBottom = insets.bottom + FLOATING_NAV_RESERVE
    const belowFrame = 10
    const availH = effectiveScrollBodyH - paddingTop - paddingBottom - belowFrame
    const targetH = Math.max(idealH, availH - 8)
    const h = Math.max(300, Math.min(targetH, availH))
    return { w: maxW, h }
  }, [step, winW, effectiveScrollBodyH, insets.bottom, frameWrapSize.w, frameWrapSize.h])

  const isScrubbingRef = useRef(false)
  const [trimCarouselScrubbing, setTrimCarouselScrubbing] = useState(false)
  const trimRangeInitializedRef = useRef(false)
  const pendingSeekProgressRef = useRef<number | null>(null)
  const seekTrimRafRef = useRef<number | null>(null)
  const trimPreviewUri = localVideoUri ?? uploadedVideoUrl

  useEffect(() => {
    setStep2CenterFrameUri(null)
    setTrimPreviewNaturalSize(null)
    trimRangeInitializedRef.current = false
  }, [uploadedVideoUrl, localVideoUri])

  /**
   * Step 2 summary chip waited only on `VideoFrameCarousel` thumbnail extraction (sequential),
   * so it stayed on the spinner too long. Grab one JPEG immediately when duration is known;
   * carousel `onCenterFrameImageUriChange` still refines when strip thumbs land.
   */
  useEffect(() => {
    if (step !== 2 || !uploadedVideoUrl || videoDurationSeconds == null || videoDurationSeconds <= 0) return
    if (Platform.OS === 'web') return

    const rawUri = localVideoUri ?? uploadedVideoUrl
    let cancelled = false
    const durationMs = videoDurationSeconds * 1000
    const tMs = Math.min(
      Math.max(0, durationMs - 1),
      Math.round(durationMs * clamp01(markerProgress))
    )

    void (async () => {
      try {
        const { uri: thumb } = await getThumbnailAsync(rawUri, { time: tMs, quality: 0.82 })
        if (!cancelled && thumb) {
          setStep2CenterFrameUri(normalizeThumbnailImageUri(thumb))
        }
      } catch {
        try {
          const { uri: thumb } = await getThumbnailAsync(rawUri, { time: 0, quality: 0.82 })
          if (!cancelled && thumb) {
            setStep2CenterFrameUri(normalizeThumbnailImageUri(thumb))
          }
        } catch {
          /* strip extraction may still populate later */
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [step, uploadedVideoUrl, localVideoUri, videoDurationSeconds, markerProgress])

  /**
   * Trim-step preview: full width, height from aspect ratio but capped so portrait video
   * never grows taller than the viewport (uncapped height pushed the player off-screen).
   */
  const trimPreviewLayout = useMemo(() => {
    const maxW = Math.max(1, winW - HORIZONTAL_PADDING * 2)
    const maxH = Math.min(420, Math.max(220, Math.round(winH * 0.4)))
    if (!trimPreviewNaturalSize || trimPreviewNaturalSize.w <= 0 || trimPreviewNaturalSize.h <= 0) {
      return { height: Math.min(Math.round(maxW * (9 / 16)), maxH) }
    }
    const vw = trimPreviewNaturalSize.w
    const vh = trimPreviewNaturalSize.h
    const intrinsicH = maxW * (vh / vw)
    const height = Math.round(Math.min(Math.max(120, intrinsicH), maxH))
    return { height: Math.max(1, height) }
  }, [winW, winH, trimPreviewNaturalSize])

  const API_BASE = DOMAIN.replace(/\/+$/, '')
  const metrics = analysisJson?.metrics || null
  const retrieval = (metrics as { retrieval?: TechniqueRetrievalMetrics } | null)?.retrieval
  const aiAnalysis = metrics?.ai_analysis || null
  /** Overall 0–100 from `metrics.ai_analysis.score` after server GPT + v6.1.x calibration (see `techniqueRouter` / `scoreCalibration`). */
  const score =
    aiAnalysis != null
      ? storedAiScoreToPercent(aiAnalysis as Record<string, unknown>)
      : null
  const scoreBreakdown =
    aiAnalysis != null
      ? storedAiBreakdownToPercent(aiAnalysis as Record<string, unknown>)
      : { technique: null, outcome: null, tactics: null }
  const confidenceBreakdown =
    aiAnalysis != null
      ? storedAiConfidenceToPercent(aiAnalysis as Record<string, unknown>)
      : { score: null, band: null, uncertaintyPlusMinus: null }
  const SCORE_RADIUS = 70
  const SCORE_STROKE = 10
  const scoreRingPx = (SCORE_RADIUS + SCORE_STROKE) * 2
  const scoreCirc = 2 * Math.PI * SCORE_RADIUS
  const scoreProgress = score != null ? score / 100 : 0
  /** Stable unique id for SVG gradient url(#...) */
  const scoreRingGradientId = `scoreRingGrad_${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const enAnalysis = aiAnalysis?.en || null
  const strengthsList: string[] = Array.isArray(enAnalysis?.strengths)
    ? enAnalysis.strengths
    : Array.isArray(enAnalysis?.observations)
    ? enAnalysis.observations
    : []
  const technicalErrorsList: string[] = Array.isArray(enAnalysis?.technical_errors)
    ? enAnalysis.technical_errors
    : []
  const actionableCorrectionsList: string[] = Array.isArray(enAnalysis?.actionable_corrections)
    ? enAnalysis.actionable_corrections
    : Array.isArray(enAnalysis?.recommendations)
    ? enAnalysis.recommendations
    : []

  const physicalMetrics = useMemo(
    () => parsePhysicalMetricsFromAnalysis(aiAnalysis as Record<string, unknown> | null),
    [aiAnalysis]
  )

  const proReferenceShot = useMemo(() => {
    const label = retrieval?.shot_hypothesis?.stroke_label
    return typeof label === 'string' && label.trim() ? label.trim() : null
  }, [retrieval?.shot_hypothesis?.stroke_label])

  const currentTrimClip = useMemo(() => {
    if (videoDurationSeconds == null || videoDurationSeconds <= 0) return null
    const totalMs = Math.round(videoDurationSeconds * 1000)
    return clampClipRangeMs(trimRange.startMs, trimRange.endMs, totalMs)
  }, [videoDurationSeconds, trimRange.startMs, trimRange.endMs])

  const correctionRegenerateBullets = useMemo(() => {
    const items: string[] = []
    const pushUnique = (lines: string[] | undefined) => {
      if (!Array.isArray(lines)) return
      for (const line of lines) {
        const t = typeof line === 'string' ? line.trim() : ''
        if (t && !items.includes(t)) items.push(t)
      }
    }
    if (typeof enAnalysis?.diagnosis === 'string' && enAnalysis.diagnosis.trim()) {
      items.push(enAnalysis.diagnosis.trim())
    }
    pushUnique(actionableCorrectionsList)
    pushUnique(technicalErrorsList)
    return items.slice(0, 10)
  }, [enAnalysis?.diagnosis, actionableCorrectionsList, technicalErrorsList])

  const coachInsightCards = useMemo(
    () =>
      buildCoachInsightCardsContent({
        strokeLabel: retrieval?.shot_hypothesis?.stroke_label ?? null,
        strokePreset: retrieval?.shot_hypothesis?.stroke_preset ?? null,
        shotContext: typeof enAnalysis?.shot_context === 'string' ? enAnalysis.shot_context : null,
        primaryTrainCategory:
          aiAnalysis && typeof (aiAnalysis as Record<string, unknown>).primary_train_category === 'string'
            ? String((aiAnalysis as Record<string, unknown>).primary_train_category).trim()
            : null,
        strengths: strengthsList,
        observations: Array.isArray(enAnalysis?.observations) ? enAnalysis.observations : undefined,
        actionableCorrections: actionableCorrectionsList,
        technicalErrors: technicalErrorsList,
        diagnosis: typeof enAnalysis?.diagnosis === 'string' ? enAnalysis.diagnosis : null,
      }),
    [
      retrieval?.shot_hypothesis?.stroke_label,
      retrieval?.shot_hypothesis?.stroke_preset,
      enAnalysis?.shot_context,
      enAnalysis?.observations,
      enAnalysis?.diagnosis,
      aiAnalysis,
      strengthsList,
      actionableCorrectionsList,
      technicalErrorsList,
    ]
  )

  const step3PoseFrames: PoseFrameRow[] = useMemo(
    () => normalizePoseData(metrics?.pose_data),
    [metrics?.pose_data]
  )
  const step3TotalVidFrames = useMemo(
    () => resolveTotalFrames(metrics as Record<string, unknown> | null | undefined, step3PoseFrames),
    [metrics, step3PoseFrames]
  )
  const step3VideoWidth = useMemo(() => Math.max(200, winW - HORIZONTAL_PADDING * 2), [winW])
  const analysisReady =
    analysisJson?.status === 'completed' || analysisJson?.status === 'failed'
  const canContinueProfileStep1 = dominantHand != null && courtSide != null
  const canContinueProfileStep2 =
    hasRanking === false
      ? !!level
      : hasRanking === true
      ? !!rankingOrg && rankingValue.trim().length > 0
      : false

  useEffect(() => {
    let mounted = true
    AsyncStorage.getItem(HOWTO_HIDE_KEY)
      .then(value => {
        if (!mounted) return
        const shouldHide = value === '1'
        setSkipHowToModal(shouldHide)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  const loadStudentCoaches = useCallback(async () => {
    const generation = ++coachFetchGeneration.current
    try {
      const res = await authClient
        .$fetch('/profile/student-coaches', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        .catch((err) => ({ error: err?.message || 'Failed' }))

      if (generation !== coachFetchGeneration.current) return

      const raw = (res as { data?: unknown })?.data ?? res
      if (
        raw &&
        typeof raw === 'object' &&
        'error' in raw &&
        !Array.isArray((raw as { coaches?: unknown }).coaches)
      ) {
        setAssignedCoach(null)
        setSendVideoToCoach(false)
        setCoachBannerLoaded(true)
        return
      }

      const body = raw as {
        coaches?: Array<{ id: string; name: string; image: string | null }>
        error?: string
      }
      const list = body?.coaches
      if (!Array.isArray(list)) {
        setAssignedCoach(null)
        setSendVideoToCoach(false)
        setCoachBannerLoaded(true)
        return
      }
      if (list.length === 0) {
        setAssignedCoach(null)
        setSendVideoToCoach(false)
        setCoachBannerLoaded(true)
        return
      }
      const c = list[0]
      const name = typeof c.name === 'string' && c.name.trim() ? c.name.trim() : 'Coach'
      const absoluteImage = profileImageToAbsoluteUri(c.image)
      setAssignedCoach({
        name,
        imageUri: hasProfileImage(absoluteImage) ? absoluteImage : null,
      })
      setSendVideoToCoach(true)
      setCoachBannerLoaded(true)
    } catch {
      if (generation !== coachFetchGeneration.current) return
      setAssignedCoach(null)
      setSendVideoToCoach(false)
      setCoachBannerLoaded(true)
    }
  }, [])

  useEffect(() => {
    const userId = session?.user?.id ?? null
    if (userId === sessionUserIdRef.current) return
    sessionUserIdRef.current = userId
    coachFetchGeneration.current += 1
    setAssignedCoach(null)
    setSendVideoToCoach(false)
    setCoachBannerLoaded(false)
    if (userId) {
      void loadStudentCoaches()
    }
  }, [session?.user?.id, loadStudentCoaches])

  // Keep assigned coach banner in sync after roster changes made elsewhere (e.g. coach/admin links).
  useFocusEffect(
    useCallback(() => {
      void loadStudentCoaches()
    }, [loadStudentCoaches])
  )

  useEffect(() => {
    if (!analysisId || analysisJson?.status !== 'completed') return
    if (geminiCorrectionImages.length > 0) return
    if (analysisJson?.metrics?.has_correction_images !== true) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await authClient
          .$fetch<{
            correction_images?: Array<{
              frame: number
              originalImage: string
              correctedImage: string
            }>
            correction_images_fal?: Array<{
              frame: number
              originalImage: string
              correctedImage: string
            }>
            correction_images_comfy?: Array<{
              frame: number
              originalImage: string
              correctedImage: string
            }>
            correction_context?: unknown
            correction_context_fal?: unknown
            correction_context_comfy?: unknown
          }>(`/technique/analysis/${analysisId}/correction-images`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          })
          .catch(() => null)
        const body = ((res as { data?: unknown })?.data ?? res) as {
          correction_images?: Array<{
            frame: number
            originalImage: string
            correctedImage: string
          }>
          correction_images_fal?: Array<{
            frame: number
            originalImage: string
            correctedImage: string
          }>
          correction_images_comfy?: Array<{
            frame: number
            originalImage: string
            correctedImage: string
          }>
          correction_context?: unknown
          correction_context_fal?: unknown
          correction_context_comfy?: unknown
        } | null
        if (cancelled || !body) return
        if (Array.isArray(body.correction_images) && body.correction_images.length > 0) {
          setGeminiCorrectionImages(body.correction_images)
        }
        if (
          SHOW_LEGACY_CORRECTIONS &&
          Array.isArray(body.correction_images_fal) &&
          body.correction_images_fal.length > 0
        ) {
          setFalCorrectionImages(body.correction_images_fal)
        }
        if (
          SHOW_COMFY_CORRECTIONS &&
          Array.isArray(body.correction_images_comfy) &&
          body.correction_images_comfy.length > 0
        ) {
          setComfyCorrectionImages(body.correction_images_comfy)
        }
      } catch {
        /* cached corrections optional */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    analysisId,
    analysisJson?.status,
    analysisJson?.metrics?.has_correction_images,
    geminiCorrectionImages.length,
  ])

  useEffect(() => {
    setTestPoseCorrectionImages([])
    setCorrectionsTestError(null)
  }, [analysisId])

  useEffect(() => {
    if (!SHOW_COMFY_CORRECTIONS && correctionImageSource === 'comfy') {
      setCorrectionImageSource(
        visibleGeminiCorrectionImages.length > 0 ? 'gemini' : 'test'
      )
    }
  }, [correctionImageSource, visibleGeminiCorrectionImages.length])

  useEffect(() => {
    if (correctionProviderCount >= 2) {
      return
    }
    if (visibleGeminiCorrectionImages.length > 0) {
      setCorrectionImageSource('gemini')
    } else if (
      visibleFalCorrectionImages.length > 0 &&
      visibleGeminiCorrectionImages.length === 0 &&
      !SHOW_COMFY_CORRECTIONS
    ) {
      setCorrectionImageSource('fal')
    } else if (
      SHOW_COMFY_CORRECTIONS &&
      visibleComfyCorrectionImages.length > 0 &&
      visibleGeminiCorrectionImages.length === 0 &&
      visibleFalCorrectionImages.length === 0
    ) {
      setCorrectionImageSource('comfy')
    } else if (
      testPoseCorrectionImages.length > 0 &&
      visibleGeminiCorrectionImages.length === 0 &&
      visibleFalCorrectionImages.length === 0 &&
      visibleComfyCorrectionImages.length === 0
    ) {
      setCorrectionImageSource('test')
    }
  }, [
    correctionProviderCount,
    visibleGeminiCorrectionImages.length,
    visibleFalCorrectionImages.length,
    visibleComfyCorrectionImages.length,
    testPoseCorrectionImages.length,
  ])

  useEffect(() => {
    setActiveCorrection(0)
  }, [correctionImageSource])

  useEffect(() => {
    setActiveCorrection((prev) => {
      const n = correctionImages.length
      if (n === 0) return 0
      return prev >= n ? n - 1 : prev
    })
  }, [correctionImages.length])

  const STEP2_MAX_LENGTH_SEC = 20

  function clamp01(v: number) {
    return Math.max(0, Math.min(1, v))
  }

  function setMarkerProgressStable(next: number) {
    const p = clamp01(next)
    setMarkerProgress(prev => (Math.abs(prev - p) < 0.002 ? prev : p))
  }

  function formatTimeFromMs(ms: number) {
    const totalSec = Math.max(0, Math.floor(ms / 1000))
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  const applyTrimVideoSeek = useCallback(
    async (progress: number) => {
      if (videoDurationSeconds == null || videoDurationSeconds <= 0) return
      const totalMs = Math.round(videoDurationSeconds * 1000)
      const ms = Math.min(
        Math.max(0, Math.round(totalMs * clamp01(progress))),
        Math.max(0, totalMs - 1)
      )
      await trimPreviewRef.current?.seekMs(ms)
    },
    [videoDurationSeconds]
  )

  const seekTrimToProgress = useCallback(
    (progress: number) => {
      pendingSeekProgressRef.current = clamp01(progress)
      if (seekTrimRafRef.current != null) return
      seekTrimRafRef.current = requestAnimationFrame(() => {
        seekTrimRafRef.current = null
        const p = pendingSeekProgressRef.current
        pendingSeekProgressRef.current = null
        if (p == null) return
        void applyTrimVideoSeek(p)
      })
    },
    [applyTrimVideoSeek]
  )

  useEffect(
    () => () => {
      if (seekTrimRafRef.current != null) cancelAnimationFrame(seekTrimRafRef.current)
    },
    []
  )

  function addClipAtCurrentMarker() {
    if (videoDurationSeconds == null || videoDurationSeconds <= 0) return
    const totalMs = videoDurationSeconds * 1000
    const { startMs, endMs } = clampClipRangeMs(trimRange.startMs, trimRange.endMs, totalMs)
    const durationMs = endMs - startMs
    if (durationMs > MAX_ANALYZE_CLIP_MS) {
      Alert.alert(
        t('technique.clipTooLong'),
        t('technique.clipTooLongMsg', { seconds: MAX_ANALYZE_CLIP_MS / 1000 })
      )
      return
    }
    const nextClip: TechniqueClip = {
      id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      startMs,
      endMs,
    }
    setClips(prev => [...prev, nextClip])
  }

  function removeClip(id: string) {
    setClips(prev => prev.filter(c => c.id !== id))
  }

  const resetToNewVideo = useCallback(() => {
    setUploadedVideoUrl(null)
    setLocalVideoUri(null)
    setUploadedVideoId(null)
    setVideoDurationSeconds(null)
    setAnalysisId(null)
    setAnalysisJson(null)
    setAnalysisError(null)
    setGeminiCorrectionImages([])
    setFalCorrectionImages([])
    setComfyCorrectionImages([])
    setCorrectionsError(null)
    setCorrectionsFalError(null)
    setCorrectionsComfyError(null)
    setCorrectionsLoadingGemini(false)
    setCorrectionsLoadingFal(false)
    setCorrectionsLoadingComfy(false)
    setActiveCorrection(0)
    setCompareSplit(0.5)
    setCorrectionViewMode('drag')
    setStep2CenterFrameUri(null)
    setTrimRange({ startMs: 0, endMs: 3000 })
    trimRangeInitializedRef.current = false
    setStep(1)
  }, [])

  useEffect(() => {
    if (videoDurationSeconds == null || videoDurationSeconds <= 0) return
    const totalMs = videoDurationSeconds * 1000
    if (!trimRangeInitializedRef.current) {
      const windowMs = Math.min(MAX_ANALYZE_CLIP_MS, totalMs)
      const startMs = Math.max(0, totalMs - windowMs)
      const endMs = totalMs
      setTrimRange({ startMs, endMs })
      const centerProgress = (startMs + endMs) / 2 / totalMs
      setMarkerProgressStable(centerProgress)
      trimRangeInitializedRef.current = true
      void applyTrimVideoSeek(centerProgress)
    }
  }, [videoDurationSeconds, applyTrimVideoSeek])

  const handleTrimPreviewPositionMs = useCallback(
    (positionMs: number) => {
      if (isScrubbingRef.current) return
      if (videoDurationSeconds == null || videoDurationSeconds <= 0) return
      const totalMs = videoDurationSeconds * 1000
      if (totalMs <= 0) return
      setMarkerProgressStable(positionMs / totalMs)
    },
    [videoDurationSeconds]
  )

  async function pickVideo() {
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

  function startHowToFlow(action: HowToAction) {
    if (skipHowToModal) {
      if (action === 'record') {
        void pickVideo()
      } else {
        void pickFromGallery()
      }
      return
    }
    setPendingHowToAction(action)
    setHideHowToNextTime(false)
    setShowHowToModal(true)
  }

  function closeHowToModal() {
    setShowHowToModal(false)
    setPendingHowToAction(null)
  }

  async function acceptHowToModal() {
    const action = pendingHowToAction
    setShowHowToModal(false)
    setPendingHowToAction(null)
    if (hideHowToNextTime) {
      setSkipHowToModal(true)
      await AsyncStorage.setItem(HOWTO_HIDE_KEY, '1').catch(() => {})
    }
    if (action === 'record') {
      await pickVideo()
    } else if (action === 'gallery') {
      await pickFromGallery()
    }
  }

  async function uploadVideo(uri: string, fileName: string, mimeType: string): Promise<void> {
    try {
      console.log('[Technique] Upload started', { fileName, mimeType, sendVideoToCoach })
      setUploading(true)
      setUploadProgress(0)
      setUploadError(null)
      console.log('[Technique] picker uri scheme', uri.slice(0, 24))
      setLocalVideoUri(uri)

      const data = await uploadTechniqueVideo({
        uri,
        fileName,
        mimeType,
        sendVideoToCoach,
        apiBase: API_BASE,
        onProgress: setUploadProgress,
      })

      console.log('[Technique] Upload success', {
        id: data.id,
        url: data.url ? `${data.url.slice(0, 50)}...` : '',
        sendVideoToCoach,
      })

      if (data.localUri) {
        setLocalVideoUri(data.localUri)
      }
      if (data.url) {
        const absoluteUrl = data.url.startsWith('http') ? data.url : `${API_BASE}${data.url}`
        setUploadedVideoUrl(absoluteUrl)
      }
      setUploadedVideoId(data.id)
      setClips([])
      setMarkerProgress(0.5)
      setAnalysisId(null)
      setAnalysisError(null)
      setAnalysisJson(null)
      setGeminiCorrectionImages([])
      setFalCorrectionImages([])
      setComfyCorrectionImages([])
      setCorrectionsError(null)
      setCorrectionsFalError(null)
      setCorrectionsComfyError(null)
      setActiveCorrection(0)
      setCompareSplit(0.5)
      setCorrectionViewMode('drag')
      setStep(2)
    } catch (err) {
      console.error('[Technique] Upload error', err)
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setUploadError(message)
      setUploadProgress(0)
    } finally {
      setUploading(false)
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
      const analyzeWallStart = Date.now()
      console.log('[Technique] Starting analysis for video', videoId, {
        note: 'POST /technique/analyze blocks until Modal + LLM + DB finish (often 2–6 min). Unsloth chat UI streams; this path does not yet.',
      })
      setAnalysisLoading(true)
      setAnalysisError(null)
      if (options.resetState ?? true) {
        setAnalysisJson(null)
        setGeminiCorrectionImages([])
        setFalCorrectionImages([])
        setComfyCorrectionImages([])
        setCorrectionsError(null)
        setCorrectionsFalError(null)
        setCorrectionsComfyError(null)
        setActiveCorrection(0)
        setCompareSplit(0.5)
        setCorrectionViewMode('drag')
      }

      const res = await authClient
        .$fetch<{ analysisId?: string; error?: string }>('/technique/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            techniqueVideoId: videoId,
            ...(currentTrimClip
              ? { clips: [currentTrimClip] }
              : clips.length > 0
                ? {
                    clips: clips.map((c) => {
                      const totalMs =
                        videoDurationSeconds != null && videoDurationSeconds > 0
                          ? Math.round(videoDurationSeconds * 1000)
                          : c.endMs
                      return clampClipRangeMs(c.startMs, c.endMs, totalMs)
                    }),
                  }
                : {}),
            ...(videoDurationSeconds != null && videoDurationSeconds > 0
              ? { videoDurationMs: Math.round(videoDurationSeconds * 1000) }
              : {}),
          }),
        })
        .catch((err) => ({ error: err?.message || 'Analyze failed' } as any))

      const analyzePostMs = Date.now() - analyzeWallStart
      const body = ((res as any)?.data ?? res) as { analysisId?: string; error?: string }
      console.log('[Technique] Analyze response', {
        status: (res as any)?.status ?? null,
        analyzePostMs,
        body,
      })

      const analysisId = (body as any)?.analysisId as string | undefined
      const errorMsg = (body as any)?.error as string | undefined

      if (!analysisId) {
        setAnalysisError(errorMsg || t('techniqueExtra.analyzeFailed'))
        setAnalysisLoading(false)
        return
      }

      const id = analysisId
      setAnalysisId(id)
      setStep(2)

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
        console.log('[Technique] Analysis poll', {
          status: (pollRes as any)?.status ?? null,
          elapsedMs: Date.now() - pollStart,
          analyzePostMs,
          body: {
            status: pollBody.status,
            hasAiScore: pollBody?.metrics?.ai_analysis?.score != null,
            feedbackPreview:
              typeof pollBody.feedbackText === 'string'
                ? pollBody.feedbackText.slice(0, 80)
                : null,
          },
        })

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
      console.log('[Technique] Analysis flow finished', {
        done,
        totalWallMs: Date.now() - analyzeWallStart,
        analyzePostMs,
      })
      if (done && (options.navigateOnDone ?? true)) {
        setStep(3)
      }
    } catch (err: any) {
      console.error('[Technique] runAnalysis error', err)
      setAnalysisError(err?.message || t('techniqueExtra.analyzeError'))
      setAnalysisLoading(false)
    }
  }

  async function generateCorrectionImages(opts?: {
    forceRegenerate?: boolean
    regenerationFeedback?: string
  }) {
    if (
      correctionsLoadingGemini ||
      correctionsLoadingFal ||
      correctionsLoadingComfy ||
      correctionsLoadingTest ||
      !analysisId
    )
      return
    try {
      setCorrectionsLoadingGemini(true)
      setCorrectionsError(null)
      void ensureCorrectionNotificationPermission()

      const savedFrameIndices = (() => {
        const ctx = (analysisJson?.metrics as { correction_context?: { frame_indices?: number[] } })
          ?.correction_context
        if (Array.isArray(ctx?.frame_indices) && ctx.frame_indices.length > 0) {
          return ctx.frame_indices
        }
        if (geminiCorrectionImages.length > 0) {
          return geminiCorrectionImages.map((c) => c.frame)
        }
        return undefined
      })()

      const res = await authClient
        .$fetch<{
          corrections?: Array<{ frame: number; originalImage: string; correctedImage: string }>
          correction_context?: unknown
          error?: string
        }>('/technique/correction-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            analysisId,
            imageProvider: 'gemini',
            ...(opts?.forceRegenerate ? { forceRegenerate: true } : {}),
            ...(opts?.forceRegenerate &&
            typeof opts.regenerationFeedback === 'string' &&
            opts.regenerationFeedback.trim()
              ? {
                  regenerationFeedback: {
                    message: opts.regenerationFeedback.trim(),
                  },
                }
              : {}),
            ...(opts?.forceRegenerate &&
            savedFrameIndices &&
            savedFrameIndices.length > 0
              ? { frameIndices: savedFrameIndices }
              : {}),
          }),
        })
        .catch((err) => ({ error: err?.message || 'Failed to generate corrections' } as any))

      const body = ((res as any)?.data ?? res) as {
        corrections?: Array<{ frame: number; originalImage: string; correctedImage: string }>
        correction_context?: unknown
        error?: unknown
      }

      if (body?.corrections && body.corrections.length > 0) {
        setGeminiCorrectionImages(body.corrections)
        setCorrectionImageSource('gemini')
        setActiveCorrection(0)
        setCompareSplit(0.5)
        setCorrectionViewMode('drag')
        if (opts?.forceRegenerate) {
          setRegenerateModalVisible(false)
          setRegenerateFeedbackMessage('')
        }
        void notifyCorrectionImagesReady({
          analysisId,
          frameCount: body.corrections.length,
        })
        invalidateSessionData()
        setAnalysisJson((prev: typeof analysisJson) =>
          prev?.metrics
            ? {
                ...prev,
                metrics: {
                  ...prev.metrics,
                  has_correction_images: true,
                  ...(body.correction_context != null
                    ? { correction_context: body.correction_context }
                    : {}),
                },
              }
            : prev
        )
      } else {
        const apiError = body?.error
        if (typeof apiError === 'string') {
          setCorrectionsError(apiError)
        } else if (
          apiError &&
          typeof apiError === 'object' &&
          typeof (apiError as any).message === 'string'
        ) {
          setCorrectionsError((apiError as any).message)
        } else {
          setCorrectionsError('No correction images returned')
        }
      }
    } catch (err: any) {
      console.error('[Technique] generateCorrectionImages error', err)
      if (typeof err?.message === 'string') {
        setCorrectionsError(err.message)
      } else if (typeof err?.error === 'string') {
        setCorrectionsError(err.error)
      } else {
        setCorrectionsError('Failed to generate corrections')
      }
    } finally {
      setCorrectionsLoadingGemini(false)
    }
  }

  async function generateFalCorrectionImages() {
    if (
      correctionsLoadingGemini ||
      correctionsLoadingFal ||
      correctionsLoadingComfy ||
      correctionsLoadingTest ||
      !analysisId
    )
      return
    try {
      setCorrectionsLoadingFal(true)
      setCorrectionsFalError(null)

      const res = await authClient
        .$fetch<{
          corrections?: Array<{ frame: number; originalImage: string; correctedImage: string }>
          error?: string
        }>('/technique/correction-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ analysisId, imageProvider: 'fal' }),
        })
        .catch((err) => ({ error: err?.message || 'Failed to generate fal corrections' } as any))

      const body = ((res as any)?.data ?? res) as {
        corrections?: Array<{ frame: number; originalImage: string; correctedImage: string }>
        correction_context?: unknown
        error?: unknown
      }

      if (body?.corrections && body.corrections.length > 0) {
        setFalCorrectionImages(body.corrections)
        setCorrectionImageSource('fal')
        setActiveCorrection(0)
        setCompareSplit(0.5)
        setCorrectionViewMode('drag')
      } else {
        const apiError = body?.error
        if (typeof apiError === 'string') {
          setCorrectionsFalError(apiError)
        } else if (
          apiError &&
          typeof apiError === 'object' &&
          typeof (apiError as any).message === 'string'
        ) {
          setCorrectionsFalError((apiError as any).message)
        } else {
          setCorrectionsFalError('No fal correction images returned')
        }
      }
    } catch (err: any) {
      console.error('[Technique] generateFalCorrectionImages error', err)
      if (typeof err?.message === 'string') {
        setCorrectionsFalError(err.message)
      } else if (typeof err?.error === 'string') {
        setCorrectionsFalError(err.error)
      } else {
        setCorrectionsFalError('Failed to generate fal corrections')
      }
    } finally {
      setCorrectionsLoadingFal(false)
    }
  }

  async function generateComfyCorrectionImages() {
    if (
      correctionsLoadingGemini ||
      correctionsLoadingFal ||
      correctionsLoadingComfy ||
      correctionsLoadingTest ||
      !analysisId
    )
      return
    try {
      setCorrectionsLoadingComfy(true)
      setCorrectionsComfyError(null)

      const res = await authClient
        .$fetch<{
          corrections?: Array<{ frame: number; originalImage: string; correctedImage: string }>
          error?: string
        }>('/technique/correction-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            analysisId,
            imageProvider: 'comfy',
            ...(typeof __DEV__ !== 'undefined' && __DEV__ ? { forceRegenerate: true } : {}),
          }),
        })
        .catch((err) => ({ error: err?.message || 'Failed to generate ComfyUI corrections' } as any))

      const body = ((res as any)?.data ?? res) as {
        corrections?: Array<{ frame: number; originalImage: string; correctedImage: string }>
        correction_context?: unknown
        error?: unknown
      }

      if (body?.corrections && body.corrections.length > 0) {
        setComfyCorrectionImages(body.corrections)
        setCorrectionImageSource('comfy')
        setActiveCorrection(0)
        setCompareSplit(0.5)
        setCorrectionViewMode('drag')
      } else {
        const apiError = body?.error
        if (typeof apiError === 'string') {
          setCorrectionsComfyError(apiError)
        } else if (
          apiError &&
          typeof apiError === 'object' &&
          typeof (apiError as any).message === 'string'
        ) {
          setCorrectionsComfyError((apiError as any).message)
        } else {
          setCorrectionsComfyError('No ComfyUI correction images returned')
        }
      }
    } catch (err: any) {
      console.error('[Technique] generateComfyCorrectionImages error', err)
      if (typeof err?.message === 'string') {
        setCorrectionsComfyError(err.message)
      } else if (typeof err?.error === 'string') {
        setCorrectionsComfyError(err.error)
      } else {
        setCorrectionsComfyError('Failed to generate ComfyUI corrections')
      }
    } finally {
      setCorrectionsLoadingComfy(false)
    }
  }

  async function generateTestPoseExtraction() {
    if (
      correctionsLoadingGemini ||
      correctionsLoadingFal ||
      correctionsLoadingComfy ||
      correctionsLoadingTest ||
      !analysisId
    )
      return
    try {
      setCorrectionsLoadingTest(true)
      setCorrectionsTestError(null)

      const res = await authClient
        .$fetch<{
          frames?: Array<{ frame: number; originalImage: string }>
          error?: string
        }>('/technique/correction-test-frames', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ analysisId }),
        })
        .catch((err) => ({ error: err?.message || 'Failed to extract test frames' } as any))

      const body = ((res as any)?.data ?? res) as {
        frames?: Array<{ frame: number; originalImage: string }>
        error?: unknown
      }

      const rawFrames = body?.frames
      if (!Array.isArray(rawFrames) || rawFrames.length === 0) {
        const apiError = body?.error
        if (typeof apiError === 'string') {
          setCorrectionsTestError(apiError)
        } else if (
          apiError &&
          typeof apiError === 'object' &&
          typeof (apiError as any).message === 'string'
        ) {
          setCorrectionsTestError((apiError as any).message)
        } else {
          setCorrectionsTestError('No frames extracted')
        }
        return
      }

      const pairs: CorrectionPairRow[] = []
      const n = Math.min(rawFrames.length, TEST_CORRECTED_SOURCES.length)
      for (let i = 0; i < n; i++) {
        const fr = rawFrames[i]
        if (!fr || typeof fr.originalImage !== 'string') continue
        pairs.push({
          frame: fr.frame,
          originalImage: fr.originalImage.trim(),
          correctedImage: TEST_CORRECTED_SOURCES[i]!,
        })
      }

      let valid = filterValidCorrectionPairs(pairs)
      /** If validation was too strict (e.g. older URI rules), still show server + bundled pairs */
      if (valid.length === 0 && pairs.length > 0) {
        valid = pairs
      }
      if (valid.length === 0) {
        setCorrectionsTestError('Could not build test comparison pairs')
        return
      }

      setTestPoseCorrectionImages(valid)
      setCorrectionImageSource('test')
      setActiveCorrection(0)
      setCompareSplit(0.5)
      setCorrectionViewMode('drag')
    } catch (err: any) {
      console.error('[Technique] generateTestPoseExtraction error', err)
      if (typeof err?.message === 'string') {
        setCorrectionsTestError(err.message)
      } else if (typeof err?.error === 'string') {
        setCorrectionsTestError(err.error)
      } else {
        setCorrectionsTestError('Failed to extract test frames')
      }
    } finally {
      setCorrectionsLoadingTest(false)
    }
  }

  return (
    <View style={styles.container}>
      {/*
        In-tab overlay (not Modal / body portal): fills the tab scene only — below Header, above bottom tab bar.
        Matches Expo / React Navigation layout so the nav bar stays visible and usable after analysis.
      */}
      {analysisLoading ? (
        <View
          style={[styles.analysisLoadingOverlay, { padding: 0, margin: 0 }]}
          pointerEvents="auto"
        >
          <Video
            source={LOADING_VIDEO_CLIP}
            style={styles.analysisLoadingVideoCover}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            isMuted
          />
        </View>
      ) : null}
      {step === 1 && coachBannerLoaded && assignedCoach ? (
        <View style={styles.coachBannerSlot}>
          <AICoachCoachReviewBanner
            assignedCoach={assignedCoach}
            fonts={{
              semiBoldFont: theme.semiBoldFont,
              mediumFont: theme.mediumFont,
              regularFont: theme.regularFont,
            }}
            sendVideoToCoach={sendVideoToCoach}
            onSendVideoToCoachChange={setSendVideoToCoach}
            interactionBusy={uploading}
          />
        </View>
      ) : null}
      <View style={styles.scrollBody} onLayout={(e) => setScrollBodyH(e.nativeEvent.layout.height)}>
        {step === 2 ? (
          <KeyboardAwareScrollView
            style={styles.stepContent}
            contentContainerStyle={[
              styles.stepContentInner,
              { paddingBottom: TAB_SCENE_SCROLL_BOTTOM_PAD + 16 },
            ]}
            bounces
            nestedScrollEnabled
            directionalLockEnabled
            scrollEnabled={!trimCarouselScrubbing}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            bottomOffset={insets.bottom + 12}
          >
            <View style={styles.step2}>
                <View style={styles.step2VideoSummaryCard}>
                  <View style={styles.step2VideoSummaryTextCol}>
                    <Text allowFontScaling={false} style={styles.step2VideoSummaryInstruction}>
                      Set the impact of the ball with the white line
                    </Text>
                  </View>
                  <View style={styles.step2SummaryThumbOuter}>
                    <Svg width={48} height={48} style={StyleSheet.absoluteFill}>
                      <Defs>
                        <SvgLinearGradient id="step2SummaryThumbStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                          {GRADIENT_COLORS.map((color, i) => (
                            <Stop key={`s2thumb-${color}-${i}`} offset={GRADIENT_STOPS[i]} stopColor={color} />
                          ))}
                        </SvgLinearGradient>
                      </Defs>
                      <Rect
                        x={2}
                        y={2}
                        width={44}
                        height={44}
                        rx={9}
                        ry={9}
                        fill="#041641"
                        stroke="url(#step2SummaryThumbStroke)"
                        strokeWidth={3}
                      />
                    </Svg>
                    <View style={styles.step2SummaryThumbInner}>
                      {step2CenterFrameUri ? (
                        <Image
                          source={{ uri: normalizeThumbnailImageUri(step2CenterFrameUri) }}
                          style={styles.step2SummaryVideo}
                          resizeMode="cover"
                          fadeDuration={0}
                          onError={(e) => {
                            console.log('[Technique] step2 preview Image error', e.nativeEvent?.error)
                          }}
                        />
                      ) : uploadedVideoUrl ? (
                        <View style={[styles.step2SummaryVideo, styles.step2SummaryThumbLoading]}>
                          <ActivityIndicator color="#1657CF" />
                        </View>
                      ) : (
                        <View style={styles.step2SummaryThumbPlaceholder}>
                          <FeatherIcon name="video" size={16} color={theme.mutedForegroundColor} />
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {trimPreviewUri ? (
                  <TrimClipPreview
                    ref={trimPreviewRef}
                    videoUri={trimPreviewUri}
                    height={trimPreviewLayout.height}
                    selectionStartMs={trimRange.startMs}
                    selectionEndMs={trimRange.endMs}
                    style={styles.trimImpactPreviewOuter}
                    onNaturalSize={(ns) => {
                      setTrimPreviewNaturalSize((prev) =>
                        prev?.w === ns.w && prev?.h === ns.h ? prev : ns
                      )
                    }}
                    onDurationMs={(durationMs) => {
                      const sec = Math.round(durationMs / 1000)
                      setVideoDurationSeconds((prev) => (prev === sec ? prev : sec))
                    }}
                    onPositionMsChange={handleTrimPreviewPositionMs}
                  />
                ) : null}

                <View style={styles.trimCard}>
                  {uploadedVideoUrl != null ? (
                    videoDurationSeconds != null && videoDurationSeconds > 0 ? (
                      <VideoFrameCarousel
                        videoUri={localVideoUri ?? uploadedVideoUrl}
                        durationMs={videoDurationSeconds * 1000}
                        durationSec={videoDurationSeconds}
                        progress={markerProgress}
                        onProgressChange={(p) => {
                          const next = clamp01(p)
                          setMarkerProgressStable(next)
                          void seekTrimToProgress(next)
                        }}
                        framesEvery={CAROUSEL_FRAMES_EVERY}
                        videoFps={CAROUSEL_FPS}
                        maxFrames={60}
                        trimStartMs={trimRange.startMs}
                        trimEndMs={trimRange.endMs}
                        minClipDurationMs={MIN_ANALYZE_CLIP_MS}
                        maxClipDurationMs={MAX_ANALYZE_CLIP_MS}
                        onTrimChange={({ startMs, endMs }) => {
                          void trimPreviewRef.current?.pause()
                          if (videoDurationSeconds == null || videoDurationSeconds <= 0) {
                            setTrimRange({ startMs, endMs })
                            return
                          }
                          const totalMs = videoDurationSeconds * 1000
                          setTrimRange(clampClipRangeMs(startMs, endMs, totalMs))
                        }}
                        onScrubStart={() => {
                          isScrubbingRef.current = true
                          setTrimCarouselScrubbing(true)
                          void trimPreviewRef.current?.pause()
                        }}
                        onScrubEnd={() => {
                          const p =
                            pendingSeekProgressRef.current != null
                              ? pendingSeekProgressRef.current
                              : markerProgress
                          void applyTrimVideoSeek(p)
                          setTimeout(() => {
                            isScrubbingRef.current = false
                            setTrimCarouselScrubbing(false)
                          }, 120)
                        }}
                        onCenterFrameImageUriChange={setStep2CenterFrameUri}
                      />
                    ) : (
                      <View style={styles.step2CarouselLoading}>
                        <ActivityIndicator size="small" color="#2AB4FF" />
                        <Text allowFontScaling={false} style={styles.step2CarouselLoadingText}>
                          Loading video duration…
                        </Text>
                      </View>
                    )
                  ) : null}

                  {currentTrimClip ? (
                    <Text allowFontScaling={false} style={styles.trimRangeText}>
                      Analysis uses the blue handles: {formatTimeFromMs(currentTrimClip.startMs)} –{' '}
                      {formatTimeFromMs(currentTrimClip.endMs)} (
                      {((currentTrimClip.endMs - currentTrimClip.startMs) / 1000).toFixed(1)}s, max{' '}
                      {MAX_ANALYZE_CLIP_MS / 1000}s)
                    </Text>
                  ) : null}

                  <View style={styles.setClipControlRow}>
                    <TouchableOpacity
                      style={[styles.step2TrimTrashBtn, clips.length === 0 && styles.step2TrimTrashBtnDisabled]}
                      onPress={() => setClips([])}
                      activeOpacity={0.85}
                      disabled={clips.length === 0}
                      accessibilityRole="button"
                      accessibilityLabel={t('techniqueExtra.clearAllClips')}
                    >
                      <FeatherIcon name="trash-2" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.setClipButton} onPress={addClipAtCurrentMarker} activeOpacity={0.9}>
                      <Text style={styles.setClipButtonText}>{t('technique.setClip')}</Text>
                    </TouchableOpacity>
                  </View>
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
                </View>
              <View style={styles.step2BottomBar}>
                <View style={styles.step2BottomBarHalf}>
                  <TouchableOpacity
                    style={[styles.step2TryNewVideoBtn, styles.step2BottomBarBtnFill]}
                    onPress={resetToNewVideo}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={t('techniqueExtra.tryNewVideo')}
                  >
                    <Text style={styles.step2TryNewVideoText} numberOfLines={2}>
                      Try a new video
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.step2BottomBarHalf}>
                  <TouchableOpacity
                    style={[styles.analyseButton, styles.step2BottomBarBtnFill]}
                    onPress={() => {
                      if (analysisReady) {
                        setStep(3)
                        return
                      }
                      void runAnalysis(undefined, { navigateOnDone: true, resetState: false })
                    }}
                    activeOpacity={0.9}
                    disabled={
                      !uploadedVideoId ||
                      analysisLoading ||
                      currentTrimClip == null ||
                      currentTrimClip.endMs <= currentTrimClip.startMs
                    }
                  >
                    <LinearGradient
                      colors={['#4B2CFF', '#00B4FF']}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.analyseButtonInner}
                    >
                      {analysisLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : analysisReady ? (
                        <>
                          <Text style={styles.analyseButtonText} numberOfLines={1}>
                            View Results
                          </Text>
                          <FeatherIcon name="arrow-right" size={20} color="#fff" />
                        </>
                      ) : (
                        <Text style={styles.analyseButtonText} numberOfLines={2}>
                          Analyse Video
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAwareScrollView>
        ) : (
        <ScrollView
          style={styles.stepContent}
          contentContainerStyle={[
            styles.stepContentInner,
            step === 1
              ? {
                  paddingBottom: insets.bottom + FLOATING_NAV_RESERVE,
                  paddingHorizontal: STEP1_HORIZONTAL_PADDING,
                }
              : { paddingBottom: TAB_SCENE_SCROLL_BOTTOM_PAD },
            step === 1 && uploading && scrollBodyH > 0 ? { minHeight: scrollBodyH } : null,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {false && (
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
              <View style={styles.courtImageArea}>
                <Image source={COURT_IMAGE} style={styles.courtImage} resizeMode="contain" />
                {courtSide && (
                  <Image
                    source={BALL_IMAGE}
                    style={[
                      styles.courtBall,
                      courtSide === 'left' ? styles.courtBallLeft : styles.courtBallRight,
                    ]}
                    resizeMode="contain"
                  />
                )}
              </View>
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

        {false && (
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
                  placeholder={t('profileSetup.ratingPlaceholder')}
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
                <Text style={styles.profileNextButtonText}>{t('techniqueExtra.goToUpload')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {step === 1 && (
          <View style={styles.step1}>
            {uploading ? (
              <View style={styles.uploadProgressWrap}>
                <LocalSvgAsset assetModule={UPLOADING_STEP_ICON} width={56} height={56} />
                <View style={styles.uploadProgressBarTrack}>
                  <View
                    style={[
                      styles.uploadProgressBarFill,
                      {
                        width: `${Math.max(0, Math.min(100, uploadProgress))}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ) : (
              <View
                style={styles.frameWrap}
                onLayout={(e) => {
                  const { width, height } = e.nativeEvent.layout
                  setFrameWrapSize((prev) =>
                    Math.abs(prev.w - width) > 1 || Math.abs(prev.h - height) > 1
                      ? { w: width, h: height }
                      : prev
                  )
                }}
              >
                {!step1FrameMeasured ? (
                  // Pre-measure: plain background-colored box at the fallback size (no glow/border),
                  // so there's no "estimate then snap" flicker — the framed box only paints at its
                  // final measured size.
                  <View
                    style={{
                      width: step1FrameDims.w,
                      height: step1FrameDims.h,
                      backgroundColor: theme.backgroundColor,
                    }}
                  />
                ) : (
                <View
                  style={[
                    styles.frameOuter,
                    {
                      width: step1FrameDims.w,
                      height: step1FrameDims.h,
                      backgroundColor: theme.backgroundColor,
                    },
                  ]}
                >
                  <Svg width={step1FrameDims.w} height={step1FrameDims.h} style={StyleSheet.absoluteFill}>
                    <Defs>
                      <SvgLinearGradient
                        id="frameStroke"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2={step1FrameDims.h}
                        gradientUnits="userSpaceOnUse"
                      >
                        <Stop offset="0" stopColor="#0066FF" stopOpacity={0} />
                        <Stop offset="1" stopColor="#0066FF" stopOpacity={0.25} />
                      </SvgLinearGradient>
                      <Filter id="insetGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <FeGaussianBlur in="SourceGraphic" stdDeviation={20} />
                      </Filter>
                    </Defs>
                    {/* transparent fill — bg comes from the View behind */}
                    <Rect
                      x={1}
                      y={1}
                      width={step1FrameDims.w - 2}
                      height={step1FrameDims.h - 2}
                      rx={FRAME_RADIUS}
                      ry={FRAME_RADIUS}
                      fill="transparent"
                    />
                    {/* inset glow — blurred blue rect clipped to the panel edges */}
                    <Rect
                      x={1}
                      y={1}
                      width={step1FrameDims.w - 2}
                      height={step1FrameDims.h - 2}
                      rx={FRAME_RADIUS}
                      ry={FRAME_RADIUS}
                      fill="none"
                      stroke="#0066FF"
                      strokeWidth={40}
                      strokeOpacity={0.25}
                      filter="url(#insetGlow)"
                    />
                    {/* gradient border on top */}
                    <Rect
                      x={1}
                      y={1}
                      width={step1FrameDims.w - 2}
                      height={step1FrameDims.h - 2}
                      rx={FRAME_RADIUS}
                      ry={FRAME_RADIUS}
                      fill="none"
                      stroke="url(#frameStroke)"
                      strokeWidth={2}
                    />
                  </Svg>
                  <View style={styles.frameInner}>
                    <View style={styles.uploadSection}>
                      <Text style={styles.uploadTitle}>{t('technique.uploadTitle')}</Text>
                      <LocalSvgAsset
                        assetModule={CHOOSE_FILE_ICON}
                        width={Math.min(130, Math.round(step1FrameDims.w * 0.42))}
                        height={Math.min(130, Math.round(step1FrameDims.w * 0.42))}
                      />
                      <TouchableOpacity
                        style={styles.chooseFileBtn}
                        onPress={() => startHowToFlow('gallery')}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.chooseFileBtnText}>{t('technique.chooseFile')}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.recordSection}>
                      <Text style={styles.recordLabel}>{t('techniqueExtra.recordNewVideo')}</Text>
                      <TouchableOpacity
                        style={styles.recordButton}
                        onPress={() => startHowToFlow('record')}
                        activeOpacity={0.85}
                      >
                        <View style={styles.recordButtonInner} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                )}
              </View>
            )}
          </View>
        )}

        {step === 3 && (
          <View style={styles.step2}>
            {score != null && (
              <View style={styles.step3ScoreHero}>
                <Text allowFontScaling={false} style={styles.step3AiCoachTitle}>
                  AI Coach
                </Text>
                <View style={styles.step3ScoreHeroRow}>
                  <View style={styles.step3ScoreTextCol}>
                    <Text allowFontScaling={false} style={styles.step3ScoreLabel}>
                      Overall Score
                    </Text>
                    <Text allowFontScaling={false} style={styles.step3ScoreValue}>
                      {score}
                      <Text style={styles.step3ScoreOutOf}> /100</Text>
                    </Text>
                    <Text allowFontScaling={false} style={styles.step3EncouragePrimary}>
                      Good progress!
                    </Text>
                    <Text allowFontScaling={false} style={styles.step3EncourageSecondary}>
                      Keep it up.
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.scoreCircleWrap,
                      {
                        width: scoreRingPx,
                        height: scoreRingPx,
                      },
                    ]}
                  >
                  <Svg
                    width={scoreRingPx}
                    height={scoreRingPx}
                    style={styles.scoreCircleSvg}
                  >
                    <Defs>
                      {/*
                        Angular-style stroke: linear gradient on a diagonal through the ring,
                        with color stops at 22% (#00BBFF) and 50% (#0022FF), rotated for a sweep feel.
                      */}
                      <SvgLinearGradient
                        id={scoreRingGradientId}
                        x1={scoreRingPx}
                        y1={0}
                        x2={0}
                        y2={scoreRingPx}
                        gradientUnits="userSpaceOnUse"
                        gradientTransform={`rotate(-35 ${SCORE_RADIUS + SCORE_STROKE} ${SCORE_RADIUS + SCORE_STROKE})`}
                      >
                        <Stop offset="0%" stopColor="#00BBFF" />
                        <Stop offset="22%" stopColor="#00BBFF" />
                        <Stop offset="50%" stopColor="#0022FF" />
                        <Stop offset="100%" stopColor="#0022FF" />
                      </SvgLinearGradient>
                    </Defs>
                    <G transform={`rotate(-90 ${SCORE_RADIUS + SCORE_STROKE} ${SCORE_RADIUS + SCORE_STROKE})`}>
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
                        stroke={`url(#${scoreRingGradientId})`}
                        strokeWidth={SCORE_STROKE}
                        strokeLinecap="round"
                        strokeDasharray={scoreCirc}
                        strokeDashoffset={scoreCirc * (1 - scoreProgress)}
                        fill="transparent"
                      />
                    </G>
                  </Svg>
                  <View style={styles.scoreCircleCenter}>
                    <LocalSvgAsset assetModule={SCORE_3BARS_ICON} width={40} height={40} />
                  </View>
                </View>
                </View>
              </View>
            )}
            {score != null && (
              <LinearGradient
                colors={[...STEP3_CARD_GRADIENT_COLORS]}
                locations={[...STEP3_CARD_GRADIENT_LOCATIONS]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.scoreBreakdownGradientWrap}
              >
                <View style={styles.scoreBreakdownInner}>
                  {(
                    [
                      { label: t('activities.technique'), value: scoreBreakdown.technique, icon: CATEGORY_ICON_TECHNIQUE },
                      { label: t('activities.outcome'), value: scoreBreakdown.outcome, icon: CATEGORY_ICON_OUTCOME },
                      { label: t('activities.tactics'), value: scoreBreakdown.tactics, icon: CATEGORY_ICON_TACTICS },
                      /** Hidden row — keeps confidence wired; toggle `hide` to show again */
                      {
                        label: t('activities.confidence'),
                        value: confidenceBreakdown.score,
                        icon: CATEGORY_ICON_TECHNIQUE,
                        hide: true,
                      },
                    ] as const
                  )
                    .filter((row) => !('hide' in row && row.hide))
                    .map((row) => {
                      const v =
                        typeof row.value === 'number' ? Math.max(0, Math.min(100, row.value)) : null
                      return (
                        <View key={row.label} style={styles.scoreBreakdownRow}>
                          <View style={styles.scoreBreakdownIconWrap}>
                            <LocalSvgAsset assetModule={row.icon} width={48} height={48} />
                          </View>
                          <View style={styles.scoreBreakdownMidCol}>
                            <Text allowFontScaling={false} style={styles.scoreBreakdownLabel}>
                              {row.label}
                            </Text>
                            <ProLibraryGradientProgressBar
                              progress={v ?? 0}
                              fillColor="#00BBFF"
                              trackColor="#061428"
                              height={8}
                              strokeWidth={2}
                              outerBorderRadius={6}
                              innerBorderRadius={4}
                              fillBorderRadius={3}
                              style={styles.scoreBreakdownGradientBar}
                            />
                          </View>
                          <View style={styles.scoreBreakdownScoreCol}>
                            <Text allowFontScaling={false} style={styles.scoreBreakdownScoreMain}>
                              {v != null ? `${Math.round(v)}` : '—'}
                            </Text>
                            <Text allowFontScaling={false} style={styles.scoreBreakdownScoreDenom}>
                              /100
                            </Text>
                          </View>
                        </View>
                      )
                    })}
                </View>
              </LinearGradient>
            )}

            {analysisError || analysisJson ? (
              <View style={styles.step3}>
                <View style={styles.placeholderCard}>
                  {analysisError ? (
                    <Text style={styles.placeholderHint}>{analysisError}</Text>
                  ) : (
                    <>
                      {metrics && aiAnalysis?.en && physicalMetrics ? (
                        <View style={styles.poseGaugeSectionWrap}>
                          <PhysicalMetricsSection
                            metrics={physicalMetrics}
                            contentWidth={step3VideoWidth}
                          />
                        </View>
                      ) : null}

                      {uploadedVideoUrl && step3PoseFrames.length > 0 && (
                        <View style={styles.step3FullWidthBlock}>
                          <TechniqueAnalysisVideoPanel
                            videoUri={uploadedVideoUrl}
                            videoKey={analysisId ?? 'technique-step3'}
                            width={step3VideoWidth}
                            poseFrames={step3PoseFrames}
                            totalVidFrames={step3TotalVidFrames}
                            qualitySession={{
                              rating: typeof aiAnalysis?.rating === 'string' ? aiAnalysis.rating : null,
                              score: score ?? null,
                            }}
                            isLooping
                          />
                        </View>
                      )}

                      {metrics && aiAnalysis?.en && (
                        <View style={styles.retrievalSectionWrap}>
                          <View style={styles.retrievalSectionInner}>
                            <CoachStrengthFocusInsightCards content={coachInsightCards} />
                          </View>
                        </View>
                      )}

                      {aiAnalysis?.en && (
                        <View style={styles.correctionSection}>
                          <View style={styles.correctionSectionTitleRow}>
                            <View style={styles.correctionTitleBlock}>
                              <View style={styles.correctionEyebrowRow}>
                                <Text style={styles.correctionSectionEyebrow}>{t('technique.poseCorrections')}</Text>
                                <View style={styles.correctionBetaPill}>
                                  <Text style={styles.correctionBetaPillText}>{t('common.beta')}</Text>
                                </View>
                              </View>
                            </View>
                            {(geminiCorrectionImages.length > 0 && !correctionsLoadingGemini) ||
                            correctionImages.length > 0 ? (
                              <View style={styles.correctionModeIcons}>
                                {geminiCorrectionImages.length > 0 && !correctionsLoadingGemini ? (
                                  <TouchableOpacity
                                    onPress={() => {
                                      setRegenerateFeedbackMessage('')
                                      setRegenerateModalVisible(true)
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    style={styles.correctionRegenCompactBtn}
                                    activeOpacity={0.85}
                                    disabled={correctionsLoadingGemini}
                                  >
                                    <FeatherIcon name="refresh-cw" size={14} color="#00BBFF" />
                                    <Text
                                      allowFontScaling={false}
                                      style={styles.correctionRegenCompactText}
                                    >
                                      {t('correctionModal.regenerate')}
                                    </Text>
                                  </TouchableOpacity>
                                ) : null}
                                {correctionImages.length > 0 ? (
                                  <>
                                <TouchableOpacity
                                  onPress={() => setCorrectionViewMode('sideBySide')}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  style={[
                                    styles.correctionModeIconWrap,
                                    correctionViewMode === 'sideBySide' && styles.correctionModeIconWrapActive,
                                  ]}
                                  activeOpacity={0.85}
                                >
                                  <SideBySideModeIcon
                                    color={
                                      correctionViewMode === 'sideBySide'
                                        ? CORRECTION_MODE_ICON_ACTIVE
                                        : CORRECTION_MODE_ICON_GREY
                                    }
                                    strokeOpacity={correctionViewMode === 'sideBySide' ? 1 : 0.65}
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => setCorrectionViewMode('drag')}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  style={[
                                    styles.correctionModeIconWrap,
                                    correctionViewMode === 'drag' && styles.correctionModeIconWrapActive,
                                  ]}
                                  activeOpacity={0.85}
                                >
                                  <DragModeIcon
                                    color={
                                      correctionViewMode === 'drag'
                                        ? CORRECTION_MODE_ICON_ACTIVE
                                        : CORRECTION_MODE_ICON_GREY
                                    }
                                    strokeOpacity={correctionViewMode === 'drag' ? 1 : 0.65}
                                  />
                                </TouchableOpacity>
                                  </>
                                ) : null}
                              </View>
                            ) : null}
                          </View>
                          <View style={styles.correctionSectionBody}>
                            {SHOW_GENERATE_POSES_TEST ? (
                              <TouchableOpacity
                                style={[styles.correctionGenerateButtonSecondary, { marginBottom: 12 }]}
                                onPress={generateTestPoseExtraction}
                                disabled={
                                  correctionsLoadingGemini ||
                                  correctionsLoadingFal ||
                                  correctionsLoadingComfy ||
                                  correctionsLoadingTest ||
                                  !analysisId
                                }
                                activeOpacity={0.9}
                              >
                                <View style={styles.correctionGenerateButtonSecondaryInner}>
                                  <FeatherIcon name="layers" size={16} color="#00BBFF" />
                                  <Text style={styles.correctionGenerateButtonSecondaryText}>
                                    Generate poses (test)
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            ) : null}

                            {canShowCorrectionSourceChips ? (
                              <View style={styles.correctionSourceRow}>
                                {(SHOW_LEGACY_CORRECTIONS ||
                                  visibleGeminiCorrectionImages.length > 0) && (
                                  <TouchableOpacity
                                    onPress={() => {
                                      if (visibleGeminiCorrectionImages.length > 0) {
                                        setCorrectionImageSource('gemini')
                                      }
                                    }}
                                    activeOpacity={0.85}
                                    disabled={visibleGeminiCorrectionImages.length === 0}
                                    style={[
                                      styles.correctionSourceChip,
                                      correctionImageSource === 'gemini' &&
                                        styles.correctionSourceChipActive,
                                      visibleGeminiCorrectionImages.length === 0 &&
                                        styles.correctionSourceChipDisabled,
                                    ]}
                                  >
                                    <Text style={styles.correctionSourceChipText}>Gemini</Text>
                                  </TouchableOpacity>
                                )}
                                {(SHOW_LEGACY_CORRECTIONS || visibleFalCorrectionImages.length > 0) && (
                                  <TouchableOpacity
                                    onPress={() => {
                                      if (visibleFalCorrectionImages.length > 0) {
                                        setCorrectionImageSource('fal')
                                      }
                                    }}
                                    activeOpacity={0.85}
                                    disabled={visibleFalCorrectionImages.length === 0}
                                    style={[
                                      styles.correctionSourceChip,
                                      correctionImageSource === 'fal' && styles.correctionSourceChipActive,
                                      visibleFalCorrectionImages.length === 0 &&
                                        styles.correctionSourceChipDisabled,
                                    ]}
                                  >
                                    <Text style={styles.correctionSourceChipText}>fal.ai</Text>
                                  </TouchableOpacity>
                                )}
                                {SHOW_COMFY_CORRECTIONS ? (
                                  <TouchableOpacity
                                    onPress={() => {
                                      if (visibleComfyCorrectionImages.length > 0) {
                                        setCorrectionImageSource('comfy')
                                      }
                                    }}
                                    activeOpacity={0.85}
                                    disabled={visibleComfyCorrectionImages.length === 0}
                                    style={[
                                      styles.correctionSourceChip,
                                      correctionImageSource === 'comfy' &&
                                        styles.correctionSourceChipActive,
                                      visibleComfyCorrectionImages.length === 0 &&
                                        styles.correctionSourceChipDisabled,
                                    ]}
                                  >
                                    <Text style={styles.correctionSourceChipText}>ComfyUI</Text>
                                  </TouchableOpacity>
                                ) : null}
                                <TouchableOpacity
                                  onPress={() => {
                                    if (testPoseCorrectionImages.length > 0) {
                                      setCorrectionImageSource('test')
                                    }
                                  }}
                                  activeOpacity={0.85}
                                  disabled={testPoseCorrectionImages.length === 0}
                                  style={[
                                    styles.correctionSourceChip,
                                    correctionImageSource === 'test' && styles.correctionSourceChipActive,
                                    testPoseCorrectionImages.length === 0 &&
                                      styles.correctionSourceChipDisabled,
                                  ]}
                                >
                                  <Text style={styles.correctionSourceChipText}>Test</Text>
                                </TouchableOpacity>
                              </View>
                            ) : null}

                            {correctionsTestError && (
                              <View style={{ marginBottom: 10 }}>
                                <Text style={[styles.placeholderHint, { color: '#FF6B6B' }]}>
                                  {correctionsTestError}
                                </Text>
                                <TouchableOpacity
                                  style={[styles.correctionGenerateButton, { marginTop: 8 }]}
                                  onPress={generateTestPoseExtraction}
                                  activeOpacity={0.9}
                                >
                                  <LinearGradient
                                    colors={['#0022FF', '#00BBFF']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.correctionGenerateButtonInner}
                                  >
                                    <Text style={styles.correctionGenerateButtonText}>
                                      Retry (test frames)
                                    </Text>
                                  </LinearGradient>
                                </TouchableOpacity>
                              </View>
                            )}

                            {correctionsLoadingTest && (
                              <View style={[styles.correctionLoadingWrap, { marginBottom: 10 }]}>
                                <ActivityIndicator size="small" color="#00BBFF" />
                                <Text style={styles.correctionLoadingText}>
                                  Extracting frames from video (test)…
                                </Text>
                              </View>
                            )}

                            {correctionsError && (
                              <View>
                                <Text style={[styles.placeholderHint, { color: '#FF6B6B' }]}>
                                  {correctionsError}
                                </Text>
                                <TouchableOpacity
                                  style={[styles.correctionGenerateButton, { marginTop: 8 }]}
                                  onPress={() => void generateCorrectionImages()}
                                  activeOpacity={0.9}
                                >
                                  <LinearGradient
                                    colors={['#0022FF', '#00BBFF']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.correctionGenerateButtonInner}
                                  >
                                    <Text style={styles.correctionGenerateButtonText}>{t('technique.retry')}</Text>
                                  </LinearGradient>
                                </TouchableOpacity>
                              </View>
                            )}

                            {correctionsLoadingGemini && (
                              <View style={styles.correctionLoadingWrap}>
                                <ActivityIndicator size="small" color="#00BBFF" />
                                <Text style={[styles.correctionLoadingText, { marginTop: 8 }]}>
                                  Generating corrected images…
                                </Text>
                                <Text style={[styles.correctionLoadingText, { fontSize: 11, marginTop: 4 }]}>
                                  This may take 30–60 seconds
                                </Text>
                              </View>
                            )}

                            {geminiCorrectionImages.length === 0 &&
                              !correctionsLoadingGemini &&
                              !correctionsError && (
                                <TouchableOpacity
                                  style={styles.correctionGenerateButton}
                                  onPress={() => void generateCorrectionImages()}
                                  activeOpacity={0.9}
                                >
                                  <LinearGradient
                                    colors={['#0022FF', '#00BBFF']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.correctionGenerateButtonInner}
                                  >
                                    <FeatherIcon name="zap" size={16} color="#fff" />
                                    <Text style={styles.correctionGenerateButtonText}>
                                      {t('technique.generateImages')}
                                    </Text>
                                  </LinearGradient>
                                </TouchableOpacity>
                              )}

                            {SHOW_LEGACY_CORRECTIONS && correctionsFalError && (
                              <View style={{ marginTop: 10 }}>
                                <Text style={[styles.placeholderHint, { color: '#FF6B6B' }]}>
                                  {correctionsFalError}
                                </Text>
                                <TouchableOpacity
                                  style={[styles.correctionGenerateButton, { marginTop: 8 }]}
                                  onPress={generateFalCorrectionImages}
                                  activeOpacity={0.9}
                                >
                                  <LinearGradient
                                    colors={['#0022FF', '#00BBFF']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.correctionGenerateButtonInner}
                                  >
                                    <Text style={styles.correctionGenerateButtonText}>Retry (fal.ai)</Text>
                                  </LinearGradient>
                                </TouchableOpacity>
                              </View>
                            )}

                            {SHOW_LEGACY_CORRECTIONS && correctionsLoadingFal && (
                              <View style={[styles.correctionLoadingWrap, { marginTop: 8 }]}>
                                <ActivityIndicator size="small" color="#00BBFF" />
                                <Text style={styles.correctionLoadingText}>
                                  Running fal.ai Flux img2img…
                                </Text>
                                <Text style={[styles.correctionLoadingText, { fontSize: 11, marginTop: 4 }]}>
                                  Often 1–3 minutes
                                </Text>
                              </View>
                            )}

                            {SHOW_GENERATE_FAL_FLUX &&
                              falCorrectionImages.length === 0 &&
                              !correctionsLoadingFal &&
                              !correctionsFalError && (
                                <TouchableOpacity
                                  style={styles.correctionGenerateButtonSecondary}
                                  onPress={generateFalCorrectionImages}
                                  activeOpacity={0.9}
                                >
                                  <View style={styles.correctionGenerateButtonSecondaryInner}>
                                    <FeatherIcon name="cpu" size={16} color="#00BBFF" />
                                    <Text style={styles.correctionGenerateButtonSecondaryText}>
                                      Generate with fal.ai (Flux)
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              )}

                            {SHOW_COMFY_CORRECTIONS && correctionsComfyError && (
                              <View style={{ marginTop: 10 }}>
                                <Text style={[styles.placeholderHint, { color: '#FF6B6B' }]}>
                                  {correctionsComfyError}
                                </Text>
                                <TouchableOpacity
                                  style={[styles.correctionGenerateButton, { marginTop: 8 }]}
                                  onPress={generateComfyCorrectionImages}
                                  activeOpacity={0.9}
                                >
                                  <LinearGradient
                                    colors={['#0022FF', '#00BBFF']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.correctionGenerateButtonInner}
                                  >
                                    <Text style={styles.correctionGenerateButtonText}>{t('technique.retry')}</Text>
                                  </LinearGradient>
                                </TouchableOpacity>
                              </View>
                            )}

                            {SHOW_COMFY_CORRECTIONS && correctionsLoadingComfy && (
                              <View style={[styles.correctionLoadingWrap, { marginTop: 8 }]}>
                                <ActivityIndicator size="small" color="#00BBFF" />
                                <Text style={styles.correctionLoadingText}>
                                  Generating corrected images…
                                </Text>
                                <Text style={[styles.correctionLoadingText, { fontSize: 11, marginTop: 4 }]}>
                                  GPU time varies (often 1–10 minutes)
                                </Text>
                              </View>
                            )}

                            {SHOW_COMFY_CORRECTIONS &&
                              comfyCorrectionImages.length === 0 &&
                              !correctionsLoadingComfy &&
                              !correctionsComfyError &&
                              (SHOW_LEGACY_CORRECTIONS ? (
                                <TouchableOpacity
                                  style={[styles.correctionGenerateButtonSecondary, { marginTop: 8 }]}
                                  onPress={generateComfyCorrectionImages}
                                  activeOpacity={0.9}
                                >
                                  <View style={styles.correctionGenerateButtonSecondaryInner}>
                                    <FeatherIcon name="cpu" size={16} color="#00BBFF" />
                                    <Text style={styles.correctionGenerateButtonSecondaryText}>
                                      Generate with ComfyUI (local)
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              ) : (
                                <TouchableOpacity
                                  style={styles.correctionGenerateButton}
                                  onPress={generateComfyCorrectionImages}
                                  activeOpacity={0.9}
                                >
                                  <LinearGradient
                                    colors={['#0022FF', '#00BBFF']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.correctionGenerateButtonInner}
                                  >
                                    <FeatherIcon name="zap" size={16} color="#fff" />
                                    <Text style={styles.correctionGenerateButtonText}>
                                      {t('technique.generateCorrectedPoses')}
                                    </Text>
                                  </LinearGradient>
                                </TouchableOpacity>
                              ))}

                            {correctionImages.length > 0 && (
                              <View style={styles.correctionCarousel}>
                                <View style={styles.correctionTabHeader}>
                                  <Text style={styles.correctionTabLabel}>{t('technique.current')}</Text>
                                  <Text style={[styles.correctionTabLabel, styles.correctionTabLabelRight]}>
                                    {t('technique.corrected')}
                                  </Text>
                                </View>

                                {correctionViewMode === 'sideBySide' ? (
                                  <View style={styles.correctionSideBySideRow}>
                                    <View style={styles.correctionSideBySideCol}>
                                      <CorrectionImageWithLoader
                                        key={`side-current-${correctionImages[activeCorrection].frame}`}
                                        source={toImageSource(correctionImages[activeCorrection].originalImage)}
                                        style={styles.correctionSideBySideImage}
                                        showLoader={false}
                                      />
                                    </View>
                                    <View style={styles.correctionSideBySideCol}>
                                      <CorrectionImageWithLoader
                                        key={`side-corrected-${correctionImages[activeCorrection].frame}`}
                                        source={toImageSource(correctionImages[activeCorrection].correctedImage)}
                                        style={styles.correctionSideBySideImage}
                                      />
                                    </View>
                                  </View>
                                ) : (
                                  <View
                                    style={styles.correctionCompareCard}
                                    onLayout={e => {
                                      const { width, height } = e.nativeEvent.layout
                                      if (width > 1 && height > 1) {
                                        setCompareCardLayout({ width, height })
                                      }
                                    }}
                                    onStartShouldSetResponder={() => true}
                                    onMoveShouldSetResponder={() => true}
                                    onResponderGrant={e => {
                                      const w = compareCardLayout?.width
                                      if (!w) return
                                      const split = clamp01(e.nativeEvent.locationX / w)
                                      setCompareSplit(split)
                                    }}
                                    onResponderMove={e => {
                                      const w = compareCardLayout?.width
                                      if (!w) return
                                      const split = clamp01(e.nativeEvent.locationX / w)
                                      setCompareSplit(split)
                                    }}
                                  >
                                    {compareCardLayout ? (
                                      <>
                                        <CorrectionImageWithLoader
                                          key={`corrected-main-${correctionImages[activeCorrection].frame}`}
                                          source={toImageSource(correctionImages[activeCorrection].correctedImage)}
                                          style={{
                                            position: 'absolute',
                                            left: 0,
                                            top: 0,
                                            width: compareCardLayout.width,
                                            height: compareCardLayout.height,
                                          }}
                                        />
                                        <View
                                          style={{
                                            position: 'absolute',
                                            left: 0,
                                            top: 0,
                                            bottom: 0,
                                            width: Math.max(0, compareSplit * compareCardLayout.width),
                                            overflow: 'hidden',
                                          }}
                                        >
                                          <CorrectionImageWithLoader
                                            key={`current-main-${correctionImages[activeCorrection].frame}`}
                                            source={toImageSource(correctionImages[activeCorrection].originalImage)}
                                            style={{
                                              position: 'absolute',
                                              left: 0,
                                              top: 0,
                                              width: compareCardLayout.width,
                                              height: compareCardLayout.height,
                                            }}
                                            showLoader={false}
                                          />
                                        </View>
                                        <View
                                          pointerEvents="none"
                                          style={[
                                            styles.correctionCompareSliderTrack,
                                            {
                                              left: compareSplit * compareCardLayout.width - 28,
                                            },
                                          ]}
                                        >
                                          <View style={styles.correctionCompareDividerLine} />
                                          <View style={styles.correctionCompareHandle}>
                                            <FeatherIcon name="chevron-left" size={16} color="#fff" />
                                            <FeatherIcon name="chevron-right" size={16} color="#fff" />
                                          </View>
                                        </View>
                                      </>
                                    ) : null}
                                  </View>
                                )}

                                <View style={styles.correctionThumbsWrap}>
                                  <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.correctionThumbsRow}
                                  >
                                    {correctionImages.map((c, idx) => (
                                      <TouchableOpacity
                                        key={`thumb-${c.frame}`}
                                        style={[
                                          styles.correctionThumbWrap,
                                          idx === activeCorrection && styles.correctionThumbWrapActive,
                                        ]}
                                        onPress={() => {
                                          setActiveCorrection(idx)
                                          setCompareSplit(0.5)
                                        }}
                                        activeOpacity={0.85}
                                      >
                                        <CorrectionImageWithLoader
                                          source={toImageSource(c.correctedImage)}
                                          style={styles.correctionThumbImage}
                                        />
                                        {idx === activeCorrection && (
                                          <View style={styles.correctionThumbCheck}>
                                            <FeatherIcon name="check" size={11} color="#00122D" />
                                          </View>
                                        )}
                                      </TouchableOpacity>
                                    ))}
                                  </ScrollView>
                                  <Text style={styles.correctionCountText}>
                                    {correctionImages.length}{' '}
                                    {correctionImages.length === 1 ? 'Frame' : 'Frames'} corrected
                                  </Text>
                                </View>
                              </View>
                            )}
                          </View>
                        </View>
                      )}

                      {aiAnalysis?.en && (
                        <LinearGradient
                          colors={[...STEP3_CARD_GRADIENT_COLORS]}
                          locations={[...STEP3_CARD_GRADIENT_LOCATIONS]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.retrievalMetaRowGradient, styles.step3AccordionGradientWrap]}
                        >
                          <View style={styles.step3SummaryGradientFill}>
                            <TouchableOpacity
                              style={styles.accordionHeader}
                              activeOpacity={0.8}
                              onPress={() => setRatingOpen(!ratingOpen)}
                            >
                              <View>
                                <Text style={styles.accordionTitle}>{t('technique.techniqueRating')}</Text>
                                <Text style={styles.accordionSubtitle}>
                                  {aiAnalysis.rating
                                    ? String(aiAnalysis.rating).replace('_', ' ').toUpperCase()
                                    : '—'}
                                </Text>
                              </View>
                              <View style={styles.accordionRight}>
                                <Text style={styles.accordionScoreText}>{score ?? '–'}</Text>
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
                        </LinearGradient>
                      )}

                      {enAnalysis && Array.isArray(strengthsList) && strengthsList.length > 0 && (
                        <LinearGradient
                          colors={[...STEP3_CARD_GRADIENT_COLORS]}
                          locations={[...STEP3_CARD_GRADIENT_LOCATIONS]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.retrievalMetaRowGradient, styles.step3AccordionGradientWrap]}
                        >
                          <View style={styles.step3SummaryGradientFill}>
                            <TouchableOpacity
                              style={styles.accordionHeader}
                              activeOpacity={0.8}
                              onPress={() => setStrengthsOpen(!strengthsOpen)}
                            >
                              <View>
                                <Text style={styles.accordionTitle}>{t('technique.doneWell')}</Text>
                                <Text style={styles.accordionSubtitle}>
                                  {t('coachAccordions.strengthsCount', { count: strengthsList.length })}
                                </Text>
                              </View>
                              <View style={styles.accordionRight}>
                                <View style={styles.accordionIconChip}>
                                  <FeatherIcon name="eye" size={14} color="#FFFFFF" />
                                </View>
                                <Ionicons
                                  name={strengthsOpen ? 'chevron-up' : 'chevron-down'}
                                  size={18}
                                  color={theme.mutedForegroundColor}
                                />
                              </View>
                            </TouchableOpacity>
                            {strengthsOpen && (
                              <View style={styles.accordionBody}>
                                {strengthsList.map((obs: string, idx: number) => (
                                  <View key={idx} style={styles.bulletRow}>
                                    <Text style={styles.bulletDot}>•</Text>
                                    <Text style={styles.bulletText}>{obs}</Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        </LinearGradient>
                      )}

                      {enAnalysis &&
                        Array.isArray(technicalErrorsList) &&
                        technicalErrorsList.length > 0 && (
                        <LinearGradient
                          colors={[...STEP3_CARD_GRADIENT_COLORS]}
                          locations={[...STEP3_CARD_GRADIENT_LOCATIONS]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.retrievalMetaRowGradient, styles.step3AccordionGradientWrap]}
                        >
                          <View style={styles.step3SummaryGradientFill}>
                            <TouchableOpacity
                              style={styles.accordionHeader}
                              activeOpacity={0.8}
                              onPress={() => setTechnicalErrorsOpen(!technicalErrorsOpen)}
                            >
                              <View>
                                <Text style={styles.accordionTitle}>{t('technique.technicalErrors')}</Text>
                                <Text style={styles.accordionSubtitle}>
                                  {t('coachAccordions.issuesCount', { count: technicalErrorsList.length })}
                                </Text>
                              </View>
                              <View style={styles.accordionRight}>
                                <View style={styles.accordionIconChip}>
                                  <FeatherIcon name="alert-triangle" size={14} color="#FFFFFF" />
                                </View>
                                <Ionicons
                                  name={technicalErrorsOpen ? 'chevron-up' : 'chevron-down'}
                                  size={18}
                                  color={theme.mutedForegroundColor}
                                />
                              </View>
                            </TouchableOpacity>
                            {technicalErrorsOpen && (
                              <View style={styles.accordionBody}>
                                {technicalErrorsList.map(
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
                        </LinearGradient>
                        )}

                      {enAnalysis &&
                        Array.isArray(actionableCorrectionsList) &&
                        actionableCorrectionsList.length > 0 && (
                        <LinearGradient
                          colors={[...STEP3_CARD_GRADIENT_COLORS]}
                          locations={[...STEP3_CARD_GRADIENT_LOCATIONS]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.retrievalMetaRowGradient, styles.step3AccordionGradientWrap]}
                        >
                          <View style={styles.step3SummaryGradientFill}>
                            <TouchableOpacity
                              style={styles.accordionHeader}
                              activeOpacity={0.8}
                              onPress={() => setActionableOpen(!actionableOpen)}
                            >
                              <View>
                                <Text style={styles.accordionTitle}>{t('technique.actionableCorrections')}</Text>
                                <Text style={styles.accordionSubtitle}>
                                  {t('coachAccordions.cuesCount', { count: actionableCorrectionsList.length })}
                                </Text>
                              </View>
                              <View style={styles.accordionRight}>
                                <View style={styles.accordionIconChip}>
                                  <FeatherIcon name="check-circle" size={14} color="#FFFFFF" />
                                </View>
                                <Ionicons
                                  name={actionableOpen ? 'chevron-up' : 'chevron-down'}
                                  size={18}
                                  color={theme.mutedForegroundColor}
                                />
                              </View>
                            </TouchableOpacity>
                            {actionableOpen && (
                              <View style={styles.accordionBody}>
                                {actionableCorrectionsList.map(
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
                        </LinearGradient>
                      )}


                      {!aiAnalysis && (
                        <Text style={[styles.placeholderHint, { marginTop: 8 }]}>
                          {analysisJson?.feedbackText ||
                            'Analysis results and drills will appear here.'}
                        </Text>
                      )}
                    </>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.startOverButton}
                  onPress={resetToNewVideo}
                  activeOpacity={0.85}
                >
                  <Text style={styles.startOverButtonText}>{t('technique.startOver')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
        </ScrollView>
        )}
      </View>
      <Modal
        visible={showHowToModal}
        transparent
        animationType="fade"
        onRequestClose={closeHowToModal}
      >
        <View style={styles.howToOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={closeHowToModal}
            style={StyleSheet.absoluteFillObject}
          />
          <View
            style={styles.howToCard}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout
              setHowToCardSize((prev) =>
                prev.w === width && prev.h === height ? prev : { w: width, h: height }
              )
            }}
          >
            {/* Same inset-glow + gradient-border treatment as the Step 1 upload box (see `frameOuter`). */}
            {howToCardSize.w > 0 && howToCardSize.h > 0 ? (
              <Svg
                pointerEvents="none"
                width={howToCardSize.w}
                height={howToCardSize.h}
                style={StyleSheet.absoluteFill}
              >
                <Defs>
                  <SvgLinearGradient
                    id="howToFrameStroke"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2={howToCardSize.h}
                    gradientUnits="userSpaceOnUse"
                  >
                    <Stop offset="0" stopColor="#0066FF" stopOpacity={0} />
                    <Stop offset="1" stopColor="#0066FF" stopOpacity={0.25} />
                  </SvgLinearGradient>
                  <Filter id="howToInsetGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <FeGaussianBlur in="SourceGraphic" stdDeviation={20} />
                  </Filter>
                </Defs>
                {/* inset glow — blurred blue rect clipped to the panel edges */}
                <Rect
                  x={1}
                  y={1}
                  width={howToCardSize.w - 2}
                  height={howToCardSize.h - 2}
                  rx={28}
                  ry={28}
                  fill="none"
                  stroke="#0066FF"
                  strokeWidth={40}
                  strokeOpacity={0.25}
                  filter="url(#howToInsetGlow)"
                />
                {/* gradient border on top */}
                <Rect
                  x={1}
                  y={1}
                  width={howToCardSize.w - 2}
                  height={howToCardSize.h - 2}
                  rx={28}
                  ry={28}
                  fill="none"
                  stroke="url(#howToFrameStroke)"
                  strokeWidth={2}
                />
              </Svg>
            ) : null}
            <Text style={styles.howToTitle}>{t('technique.howToTitle')}</Text>
            <Text style={styles.howToSubtitle}>{t('technique.howToSubtitle')}</Text>
            <View style={styles.howToBadgeRow}>
              <View style={styles.howToBadgeCol}>
                <View style={[styles.howToBadgeCircle, styles.howToBadgeWrong]}>
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </View>
              </View>
              <View style={styles.howToBadgeCol}>
                <View style={[styles.howToBadgeCircle, styles.howToBadgeCorrect]}>
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                </View>
              </View>
            </View>
            <View style={styles.howToImagesRow}>
              <View style={styles.howToImagesCol}>
                <View style={[styles.howToImageWrap, styles.howToImageWrapWrong]}>
                  <Image source={HOWTO_X1_IMAGE} style={styles.howToImage} resizeMode="cover" />
                </View>
                <View style={[styles.howToImageWrap, styles.howToImageWrapWrong]}>
                  <Image source={HOWTO_X2_IMAGE} style={styles.howToImage} resizeMode="cover" />
                </View>
              </View>
              <View style={styles.howToImagesCol}>
                <View style={[styles.howToImageWrap, styles.howToImageWrapCorrect]}>
                  <Image
                    source={HOWTO_RIGHT1_IMAGE}
                    style={[styles.howToImage, styles.howToImageRightShift]}
                    resizeMode="cover"
                  />
                </View>
                <View style={[styles.howToImageWrap, styles.howToImageWrapCorrect]}>
                  <Image
                    source={HOWTO_RIGHT2_IMAGE}
                    style={[styles.howToImage, styles.howToImageRightShift]}
                    resizeMode="cover"
                  />
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.howToCheckboxRow}
              onPress={() => setHideHowToNextTime(prev => !prev)}
              activeOpacity={0.85}
            >
              <View style={[styles.howToCheckbox, hideHowToNextTime && styles.howToCheckboxChecked]}>
                {hideHowToNextTime && <Ionicons name="checkmark" size={14} color="#03112B" />}
              </View>
              <Text style={styles.howToCheckboxText}>{t('technique.hideHowTo')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={acceptHowToModal}
              style={styles.howToAcceptOuter}
            >
              <LinearGradient
                colors={['#00BBFF', '#0022FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.howToAcceptInner}
              >
                <Text style={styles.howToAcceptText}>{t('technique.accept')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <CorrectionRegenerateModal
        visible={regenerateModalVisible}
        onClose={() => {
          if (!correctionsLoadingGemini) {
            setRegenerateModalVisible(false)
          }
        }}
        coachingBullets={correctionRegenerateBullets}
        message={regenerateFeedbackMessage}
        onChangeMessage={setRegenerateFeedbackMessage}
        loading={correctionsLoadingGemini}
        onRegenerate={() =>
          void generateCorrectionImages({
            forceRegenerate: true,
            regenerationFeedback: regenerateFeedbackMessage,
          })
        }
      />
    </View>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.backgroundColor },
    coachBannerSlot: {
      minHeight: COACH_BANNER_SLOT_H,
      paddingHorizontal: HORIZONTAL_PADDING,
      paddingTop: 6,
      paddingBottom: 2,
      zIndex: 2,
      ...Platform.select({
        android: { elevation: 3 },
        default: {},
      }),
    },
    /** Fills tab area below optional coach banner; measured for responsive upload / thumb sizing. */
    scrollBody: {
      flex: 1,
      minHeight: 0,
      zIndex: 0,
      ...Platform.select({
        android: { elevation: 0 },
        default: {},
      }),
    },
    stepContent: { flex: 1 },
    stepContentInner: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12 },
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
    courtImageArea: {
      width: 120,
      height: 210,
      position: 'relative',
      overflow: 'hidden',
    },
    courtImage: {
      width: 120,
      height: 210,
    },
    courtBall: {
      position: 'absolute',
      width: 24,
      height: 24,
      bottom: 20,
    },
    courtBallLeft: {
      left: 12,
    },
    courtBallRight: {
      right: 12,
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
    step1: { flex: 1, minHeight: 0, width: '100%', alignSelf: 'stretch' },
    frameWrap: { alignItems: 'center', marginTop: 0, flex: 1, justifyContent: 'flex-start' },
    frameOuter: { position: 'relative', borderRadius: FRAME_RADIUS + STROKE_WIDTH, overflow: 'hidden' },
    frameInner: {
      position: 'absolute',
      left: 2,
      top: 2,
      right: 2,
      bottom: 2,
      borderRadius: FRAME_RADIUS - 1,
      overflow: 'hidden',
      paddingBottom: 28,
      paddingHorizontal: 24,
    },
    uploadSection: {
      flex: 1,
      width: '100%',
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    uploadTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 17,
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 20,
    },
    chooseFileBtn: {
      backgroundColor: '#FFFFFF',
      borderRadius: 24,
      paddingVertical: 10,
      paddingHorizontal: 24,
      marginTop: 20,
      alignSelf: 'center',
      maxWidth: '100%',
      alignItems: 'center',
    },
    chooseFileBtnText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: '#0A1628',
    },
    reviewVideoBtn: {
      marginTop: 10,
      borderRadius: 18,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: 'rgba(0, 187, 255, 0.55)',
      backgroundColor: 'rgba(0, 102, 255, 0.12)',
    },
    reviewVideoBtnDisabled: {
      opacity: 0.45,
    },
    reviewVideoBtnText: {
      fontFamily: theme.mediumFont,
      fontSize: 13,
      textAlign: 'center',
      color: '#8FD7FF',
    },
    uploadReviewBtn: {
      marginTop: 8,
      borderRadius: 18,
      paddingVertical: 8,
      paddingHorizontal: 16,
      backgroundColor: 'rgba(0, 187, 255, 0.15)',
    },
    uploadReviewBtnText: {
      fontFamily: theme.mediumFont,
      fontSize: 13,
      textAlign: 'center',
      color: '#00BBFF',
    },
    annotationsSection: {
      marginTop: 20,
      gap: 12,
    },
    annotationsTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: '#FFFFFF',
      marginBottom: 2,
    },
    annotationCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(0,102,255,0.3)',
      backgroundColor: 'rgba(0,20,64,0.45)',
      overflow: 'hidden',
    },
    annotationImage: {
      width: '100%',
      aspectRatio: 9 / 16,
      backgroundColor: '#000',
    },
    annotationComment: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: '#FFFFFF',
      paddingHorizontal: 12,
      paddingTop: 10,
    },
    annotationMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    annotationTime: {
      fontFamily: theme.regularFont,
      fontSize: 11,
      color: 'rgba(200,220,255,0.5)',
    },
    recordSection: {
      alignItems: 'center',
      marginBottom: 6,
    },
    recordLabel: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: 'rgba(200,220,255,0.6)',
      textAlign: 'center',
      marginBottom: 16,
    },
    recordButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    recordButtonInner: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#E53935',
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
    uploadProgressWrap: {
      flex: 1,
      width: '100%',
      minHeight: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
      gap: 12,
    },
    uploadProgressBarTrack: {
      width: UPLOAD_PROGRESS_TRACK_WIDTH,
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    uploadProgressBarFill: {
      height: '100%',
      minWidth: 0,
      borderRadius: 4,
      backgroundColor: '#00BBFF',
    },
    step2: { position: 'relative' as const, flexShrink: 1, gap: 20, minHeight: 0 },
    /** Step 2: scroll region + pinned actions above tab bar */
    step2SplitRoot: {
      flex: 1,
      minHeight: 0,
      flexDirection: 'column' as const,
    },
    step2BottomBar: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 8,
      paddingTop: 6,
    },
    step2BottomBarHalf: {
      flex: 1,
      flexBasis: 0,
      minWidth: 0,
    },
    /** Fill half column: equal width + height for Try new / Analyse. */
    step2BottomBarBtnFill: {
      flex: 1,
      alignSelf: 'stretch',
      width: '100%',
      minHeight: 52,
    },
    step2ThumbnailContainer: {
      marginTop: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    step3ScoreHero: {
      marginTop: 4,
      flexDirection: 'column',
      alignItems: 'stretch',
      width: '100%',
      paddingHorizontal: 0,
    },
    step3ScoreHeroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      gap: 12,
    },
    step3ScoreTextCol: {
      flex: 1,
      alignItems: 'flex-start',
      justifyContent: 'center',
      alignSelf: 'stretch',
      minWidth: 0,
      gap: 2,
    },
    step3AiCoachTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 34,
      lineHeight: 40,
      color: theme.textColor,
      letterSpacing: -0.4,
      marginBottom: 12,
      width: '100%',
    },
    step3ScoreLabel: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: '#86A7D2',
      marginBottom: 0,
    },
    step3ScoreValue: {
      fontFamily: theme.boldFont ?? theme.semiBoldFont,
      fontSize: 56,
      lineHeight: 60,
      color: theme.textColor,
      letterSpacing: -0.8,
      marginTop: 2,
      marginBottom: 3,
    },
    step3ScoreOutOf: {
      fontFamily: theme.mediumFont,
      fontSize: 24,
      color: '#86A7D2',
    },
    step3EncouragePrimary: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: '#00B8FF',
      marginTop: 1,
    },
    step3EncourageSecondary: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: '#86A7D2',
      marginTop: 2,
    },
    /** Same bottom margin as `step2VideoSummaryCard` so gap-to-carousel matches gap-to-video. */
    trimImpactPreviewOuter: {
      width: '100%',
      marginBottom: 4,
    },
    trimImpactPreviewFrame: {
      flex: 1,
      width: '100%',
    },
    trimImpactPreviewFrameInner: {
      backgroundColor: '#000000',
      padding: 0,
      overflow: 'hidden',
    },
    trimImpactPreviewMediaStack: {
      flex: 1,
      width: '100%',
      minHeight: 0,
      position: 'relative',
      backgroundColor: '#000000',
    },
    trimImpactPreviewVideo: {
      ...StyleSheet.absoluteFillObject,
    },
    trimImpactPreviewFrameOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#000000',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    step2VideoSummaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
      paddingVertical: 20,
      paddingHorizontal: 16,
      borderRadius: 18,
      borderWidth: 0,
      backgroundColor: '#041641',
      marginTop: 4,
      // Match marginTop so the banner has the same gap above and below
      // (gap below was 14, which read as too much padding before the video preview).
      marginBottom: 4,
    },
    step2VideoSummaryTextCol: {
      flex: 1,
      minWidth: 0,
    },
    step2VideoSummaryInstruction: {
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      lineHeight: 22,
      color: '#FFFFFF',
      letterSpacing: 0.1,
    },
    step2SummaryThumbOuter: {
      position: 'relative' as const,
      width: 48,
      height: 48,
      borderRadius: 10,
      overflow: 'hidden',
    },
    step2SummaryThumbInner: {
      position: 'absolute',
      left: 3,
      top: 3,
      right: 3,
      bottom: 3,
      borderRadius: 6,
      overflow: 'hidden',
    },
    step2SummaryThumbLoading: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#041641',
    },
    step2SummaryVideo: {
      width: '100%',
      height: '100%',
    },
    step2SummaryThumbPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#041641',
    },
    step2CarouselLoading: {
      width: '100%',
      minHeight: 120,
      borderRadius: 18,
      borderWidth: 0,
      backgroundColor: 'rgba(5, 15, 51, 0.35)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginBottom: 8,
    },
    step2CarouselLoadingText: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: 'rgba(232,240,255,0.75)',
    },
    step2RulerBlock: {
      marginTop: 4,
      marginBottom: 4,
    },
    step2RulerTimesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
      marginBottom: 4,
      paddingHorizontal: 2,
    },
    step2RulerTime: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 11,
      color: 'rgba(232,240,255,0.85)',
    },
    step2RulerTimeCenter: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12,
      color: '#E8F0FF',
    },
    step2TryNewVideoBtn: {
      borderRadius: 14,
      borderWidth: 0,
      backgroundColor: '#041641',
      paddingVertical: 15,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    step2TryNewVideoText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      color: '#00B8FF',
      textAlign: 'center',
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
      marginTop: 0,
    },
    analyseButtonInner: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: 14,
      minHeight: 52,
    },
    analyseButtonText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 17,
      color: '#fff',
      textAlign: 'center',
    },
    step3: { flexShrink: 1, gap: 24, minHeight: 0, marginTop: -22 },
    /** Match accordion row width: no extra horizontal inset beyond `stepContentInner` */
    step3FullWidthBlock: {
      width: '100%',
      alignSelf: 'stretch',
      paddingTop: 8,
      paddingBottom: 4,
    },
    placeholderCard: {
      flex: 1,
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      paddingTop: 0,
      paddingBottom: 16,
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
    retrievalSectionWrap: {
      width: '100%',
      alignSelf: 'stretch',
      marginTop: 0,
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderRadius: 0,
      overflow: 'visible',
    },
    poseGaugeSectionWrap: {
      width: '100%',
      alignSelf: 'stretch',
      marginTop: -10,
      marginBottom: 6,
      alignItems: 'center',
    },
    retrievalSectionInner: {
      width: '100%',
      paddingVertical: 14,
    },
    retrievalSectionTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 17,
      color: theme.textColor,
    },
    retrievalCardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 2,
    },
    retrievalHeaderTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    retrievalSubtitleUnderTitle: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      lineHeight: 18,
      color: '#6B8CAD',
      marginTop: 6,
    },
    retrievalHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexShrink: 0,
      paddingTop: 2,
    },
    retrievalBookmarkChip: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#00BBFF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#00BBFF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.45,
      shadowRadius: 8,
      elevation: 4,
    },
    retrievalMetaStack: {
      marginTop: 16,
      gap: 12,
    },
    retrievalMetaRowGradient: {
      borderRadius: 18,
      padding: 1.5,
      overflow: 'hidden',
    },
    retrievalMetaRowInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: 16,
      backgroundColor: '#001435',
      shadowColor: '#00BBFF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 2,
    },
    retrievalMetaIconWrap: {
      width: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retrievalMetaTextCol: {
      flex: 1,
      minWidth: 0,
    },
    retrievalMetaLabel: {
      fontFamily: theme.mediumFont,
      fontSize: 12,
      letterSpacing: 0.3,
      color: '#006FFF',
      textTransform: 'none' as const,
      marginBottom: 6,
    },
    retrievalMetaValue: {
      fontFamily: theme.semiBoldFont,
      fontSize: 17,
      lineHeight: 22,
      color: '#FFFFFF',
    },
    /** Inner fill inside STEP3_CARD gradient ring — matches retrievalMetaRowInner */
    step3SummaryGradientFill: {
      width: '100%',
      borderRadius: 16,
      backgroundColor: '#001435',
      overflow: 'hidden',
      shadowColor: '#00BBFF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 2,
    },
    step3AccordionGradientWrap: {
      width: '100%',
      marginTop: 12,
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
    scoreCircleWrap: {
      position: 'relative' as const,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    scoreCircleSvg: {
      position: 'relative',
    },
    scoreCircleCenter: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /** Same gradient ring treatment as Summary / Category rows (`retrievalMetaRowGradient`). */
    scoreBreakdownGradientWrap: {
      marginTop: -8,
      marginBottom: 0,
      borderRadius: 20,
      padding: 1.5,
      overflow: 'hidden',
    },
    scoreBreakdownInner: {
      borderRadius: 18,
      backgroundColor: '#001435',
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 18,
    },
    scoreBreakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    scoreBreakdownIconWrap: {
      width: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scoreBreakdownMidCol: {
      flex: 1,
      minWidth: 0,
      gap: 8,
    },
    scoreBreakdownLabel: {
      fontFamily: theme.mediumFont,
      fontSize: 17,
      color: '#FFFFFF',
    },
    scoreBreakdownGradientBar: {
      width: '100%',
      flex: 0,
      alignSelf: 'stretch',
    },
    scoreBreakdownScoreCol: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      minWidth: 56,
    },
    scoreBreakdownScoreMain: {
      fontFamily: theme.boldFont ?? theme.semiBoldFont,
      fontSize: 24,
      color: '#FFFFFF',
      lineHeight: 28,
    },
    scoreBreakdownScoreDenom: {
      fontFamily: theme.mediumFont,
      fontSize: 17,
      color: '#86A7D2',
      marginTop: 1,
    },
    trimCard: {
      width: '100%',
      marginTop: 0,
      borderRadius: 0,
      borderWidth: 0,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: 4,
      overflow: 'visible',
    },
    setClipControlRow: {
      marginTop: 2,
      marginBottom: 6,
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    step2TrimTrashBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#006EFF',
    },
    step2TrimTrashBtnDisabled: {
      opacity: 0.35,
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
      marginBottom: 10,
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
    frameTickMajor: {
      width: 2,
      height: 14,
      borderRadius: 1,
      backgroundColor: 'rgba(255,255,255,0.48)',
    },
    setClipButton: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: 24,
      paddingHorizontal: 26,
      paddingVertical: 12,
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
    /**
     * Tab-scene fullscreen: `absoluteFill` within Technique’s `flex:1` root (between header & tab bar).
     * High z-index above scroll/cards; elevation on Android for stacking within the scene.
     */
    analysisLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 100000,
      backgroundColor: LOADING_OVERLAY_SCRIM,
      overflow: 'hidden',
      padding: 0,
      margin: 0,
      ...Platform.select({
        android: { elevation: 24 },
        default: {},
      }),
    },
    /** Edge-to-edge in tab scene; COVER removes CONTAIN letterboxing band above the tab bar. */
    analysisLoadingVideoCover: {
      ...StyleSheet.absoluteFillObject,
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
    correctionGenerateButton: {
      borderRadius: 14,
      overflow: 'hidden',
      marginTop: 4,
    },
    correctionGenerateButtonInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 14,
    },
    correctionGenerateButtonText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: '#fff',
    },
    correctionSourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
      flexWrap: 'wrap',
    },
    correctionSourceChip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(0, 187, 255, 0.35)',
      backgroundColor: 'rgba(0, 34, 255, 0.08)',
    },
    correctionSourceChipActive: {
      borderColor: '#00BBFF',
      backgroundColor: 'rgba(0, 187, 255, 0.18)',
    },
    correctionSourceChipDisabled: {
      opacity: 0.42,
    },
    correctionSourceChipText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: theme.textColor,
    },
    correctionGenerateButtonSecondary: {
      borderRadius: 14,
      overflow: 'hidden',
      marginTop: 10,
      borderWidth: 1,
      borderColor: 'rgba(0, 187, 255, 0.45)',
    },
    correctionGenerateButtonSecondaryInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 14,
      backgroundColor: 'rgba(0, 34, 255, 0.12)',
    },
    correctionGenerateButtonSecondaryText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: '#00BBFF',
    },
    correctionLoadingWrap: {
      alignItems: 'center',
      paddingVertical: 20,
      gap: 8,
    },
    correctionLoadingText: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: theme.mutedForegroundColor,
      textAlign: 'center',
    },
    correctionSection: {
      width: '100%',
      marginTop: 0,
      marginBottom: 12,
      paddingHorizontal: 0,
    },
    correctionSectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      width: '100%',
    },
    correctionTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    correctionEyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    correctionSectionEyebrow: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: theme.textColor,
    },
    correctionBetaPill: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(0, 187, 255, 0.55)',
      backgroundColor: 'transparent',
    },
    correctionBetaPillText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 11,
      color: '#00BBFF',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    correctionSectionTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: theme.textColor,
      marginBottom: 0,
      flexShrink: 1,
    },
    correctionModeIcons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    correctionRegenCompactBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(0, 187, 255, 0.35)',
      backgroundColor: 'rgba(0, 110, 255, 0.12)',
      marginRight: 2,
    },
    correctionRegenCompactText: {
      fontFamily: theme.mediumFont,
      fontSize: 12,
      color: '#00BBFF',
    },
    correctionModeIconWrap: {
      padding: 6,
      borderRadius: 10,
    },
    correctionModeIconWrapActive: {
      backgroundColor: 'rgba(0, 187, 255, 0.14)',
    },
    correctionSectionBody: {
      width: '100%',
    },
    correctionCarousel: {
      marginTop: 0,
    },
    correctionTabHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      paddingHorizontal: 32,
      paddingVertical: 15,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: 'rgba(22, 103, 201, 0.28)',
      backgroundColor: '#0A1A45',
    },
    correctionTabLabel: {
      fontFamily: theme.semiBoldFont,
      fontSize: 18,
      color: '#8CB0E2',
    },
    correctionTabLabelRight: {
      color: '#EAF4FF',
    },
    correctionCompareCard: {
      width: '100%',
      aspectRatio: 9 / 14,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: '#000',
      position: 'relative',
    },
    correctionSideBySideRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 8,
      width: '100%',
    },
    correctionSideBySideCol: {
      flex: 1,
      aspectRatio: 9 / 14,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: '#000',
    },
    correctionSideBySideImage: {
      width: '100%',
      height: '100%',
    },
    correctionCompareSliderTrack: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 56,
      alignItems: 'center',
      zIndex: 3,
    },
    correctionCompareDividerLine: {
      position: 'absolute',
      top: 0,
      bottom: 30,
      width: 3,
      left: 26.5,
      backgroundColor: '#00BBFF',
      shadowColor: '#00BBFF',
      shadowOpacity: 0.45,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
    },
    correctionCompareHandle: {
      position: 'absolute',
      bottom: 14,
      left: 0,
      width: 56,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#00BBFF',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 0,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
    },
    correctionThumbsWrap: {
      marginTop: 14,
      width: '100%',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      backgroundColor: '#0A1635',
      paddingVertical: 14,
    },
    correctionThumbsRow: {
      flexDirection: 'row',
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
    },
    correctionThumbWrap: {
      width: 58,
      height: 58,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      backgroundColor: '#000',
      position: 'relative',
    },
    correctionThumbWrapActive: {
      borderColor: '#00BBFF',
      borderWidth: 2,
    },
    correctionThumbImage: {
      width: '100%',
      height: '100%',
    },
    correctionThumbCheck: {
      position: 'absolute',
      right: 3,
      top: 3,
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#00BBFF',
    },
    correctionCountText: {
      marginTop: 10,
      textAlign: 'center',
      fontFamily: theme.semiBoldFont,
      fontSize: 12,
      color: '#EAF4FF',
      letterSpacing: 0.2,
    },
    howToOverlay: {
      flex: 1,
      backgroundColor: 'rgba(1, 7, 25, 0.78)',
      justifyContent: 'flex-end',
      paddingHorizontal: 18,
      paddingBottom: 12,
    },
    howToCard: {
      borderRadius: 28,
      backgroundColor: '#030A17',
      paddingHorizontal: 16,
      paddingVertical: 18,
      alignSelf: 'center',
      width: '100%',
      maxWidth: 380,
      // Inset glow + gradient border are drawn as an SVG overlay (matches the AI Coach
      // Step 1 upload box). `overflow: 'hidden'` clips the blurred stroke to the card edges.
      overflow: 'hidden',
    },
    howToTitle: {
      textAlign: 'center',
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont,
      fontSize: 20,
      lineHeight: 24,
    },
    howToSubtitle: {
      marginTop: 6,
      textAlign: 'center',
      color: '#86A7D2',
      fontFamily: theme.regularFont,
      fontSize: 13,
      lineHeight: 17,
      paddingHorizontal: 10,
    },
    howToBadgeRow: {
      marginTop: 12,
      flexDirection: 'row',
      gap: 8,
      alignSelf: 'center',
      width: '88%',
    },
    /** Mirrors `howToImagesCol` width so each badge centers above its image column. */
    howToBadgeCol: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    howToBadgeCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    howToBadgeWrong: {
      backgroundColor: '#D90E27',
    },
    howToBadgeCorrect: {
      backgroundColor: '#10B8FF',
    },
    howToImagesRow: {
      marginTop: 10,
      flexDirection: 'row',
      gap: 8,
      alignSelf: 'center',
      width: '88%',
    },
    howToImagesCol: {
      flex: 1,
      gap: 8,
    },
    howToImageWrap: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: '#0A1330',
    },
    howToImageWrapWrong: {
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    howToImageWrapCorrect: {
      borderWidth: 2,
      borderColor: '#00BBFF',
    },
    howToImage: {
      width: '100%',
      height: '100%',
      // Crop in tighter on the subject without changing the surrounding layout.
      // `cover` already fills the wrap; the extra scale just zooms further in.
      transform: [{ scale: 1.2 }],
    },
    /**
     * Shifts the right-column photos UP within their wraps so the bottom of the source
     * (the "SIDE ✓" caption baked into the image) ends up visible. Wraps stay the same
     * size/position — only the image content slides.
     */
    howToImageRightShift: {
      transform: [{ scale: 1.2 }, { translateY: -12 }],
    },
    howToCheckboxRow: {
      // Match the 88% side margins used by the images + badges above.
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      alignSelf: 'center',
      width: '88%',
      paddingVertical: 10,
    },
    howToCheckbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#00BBFF',
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    howToCheckboxChecked: {
      backgroundColor: '#00BBFF',
    },
    howToCheckboxText: {
      color: 'rgba(235, 246, 255, 0.92)',
      fontFamily: theme.mediumFont,
      fontSize: 15,
    },
    howToAcceptOuter: {
      // Same 88% side margins as the imagery + checkbox above.
      marginTop: 4,
      borderRadius: 22,
      overflow: 'hidden',
      alignSelf: 'center',
      width: '88%',
    },
    howToAcceptInner: {
      minHeight: 56,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    howToAcceptText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 20,
      lineHeight: 24,
      color: '#FFFFFF',
    },
  })
}
