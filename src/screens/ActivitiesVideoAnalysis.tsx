import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { ACTIVITIES_FAVORITES_STORAGE_KEY } from '../constants/activitiesFavorites'
import { DOMAIN } from '../../constants'
import { authClient } from '../lib/auth-client'
import { normalizePoseData, type PoseFrameRow, resolveTotalFrames } from '../lib/techniquePose'
import type { ActivitySession } from '../lib/activitySession'
import {
  storedAiBreakdownToPercent,
  storedAiConfidenceToPercent,
  storedAiScoreToPercent,
} from '../lib/techniqueScoreDisplay'
import { TechniqueAnalysisVideoPanel } from '../components/TechniqueAnalysisVideoPanel'
import { CoachAnalysisAccordions } from '../components/CoachAnalysisAccordions'
import { CoachStrengthFocusInsightCards } from '../components/CoachStrengthFocusInsightCards'
import { CorrectionImageWithLoader } from '../components/CorrectionImageWithLoader'
import { PhysicalMetricsSection } from '../components/physicalMetrics/PhysicalMetricsSection'
import { parsePhysicalMetricsFromAnalysis } from '../lib/physicalMetrics'
import {
  buildCoachInsightCardsContent,
  formatActivityShotTitle,
  shouldShowCoachInsightCards,
} from '../lib/coachInsightCards'
import {
  displayTrainShotTitle,
  humanShotLabelFromStoredMetrics,
} from '../lib/trainShotDisplay'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import { ProLibraryGradientFrame, ProLibraryGradientProgressBar } from '../components'
import { proLibraryChrome } from '../theme/proLibraryChrome'

const API_ROOT = DOMAIN.replace(/\/+$/, '')

const ACTIVITIES_STAR_SVG = require('../../assets/actiities/star.svg')
const ACTIVITIES_STAR_FILLED_SVG = require('../../assets/actiities/star-filled.svg')
/** Back chevron + favorites star outline (matches `star.svg` stroke). */
const NAV_ICON_TINT = '#86A7D2'

const VA = {
  accent: '#00B8FF',
  wrong: '#FF2D55',
  good: '#34C759',
  /** Filled card panels on this screen (mock). */
  card: '#001435',
  muted: 'rgba(255,255,255,0.55)',
  text: 'rgba(255,255,255,0.92)',
  barCyan: '#00B8FF',
  barAmber: '#F5A623',
  track: '#061428',
}

/** Screen gutters + card inset — aligned with product mock (~20–24px). */
const SCREEN_GUTTER = 22
function videoUri(path: string): string {
  if (path.startsWith('http')) return path
  return `${API_ROOT}${path}`
}

function formatTimeTag(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  const s = d.getSeconds()
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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

type CorrectionPair = { frame: number; originalImage: string; correctedImage: string }

type CorrectionCoachingSummary = {
  diagnosis?: string | null
  shot_context?: string | null
  actionable_corrections?: string[]
  recommendations?: string[]
}

function parseCorrectionContext(raw: unknown): {
  coaching: CorrectionCoachingSummary | null
  frameCount: number
  frameIndices: number[]
} {
  if (!raw || typeof raw !== 'object') return { coaching: null, frameCount: 0, frameIndices: [] }
  const r = raw as Record<string, unknown>
  const summary = r.coaching_summary as Record<string, unknown> | undefined
  const coaching: CorrectionCoachingSummary | null = summary
    ? {
        diagnosis: typeof summary.diagnosis === 'string' ? summary.diagnosis : null,
        shot_context: typeof summary.shot_context === 'string' ? summary.shot_context : null,
        actionable_corrections: Array.isArray(summary.actionable_corrections)
          ? summary.actionable_corrections.filter(
              (x): x is string => typeof x === 'string' && x.trim().length > 0
            )
          : [],
        recommendations: Array.isArray(summary.recommendations)
          ? summary.recommendations.filter(
              (x): x is string => typeof x === 'string' && x.trim().length > 0
            )
          : [],
      }
    : null
  const frameCount = typeof r.frame_count === 'number' ? r.frame_count : 0
  const frameIndices = Array.isArray(r.frame_indices)
    ? r.frame_indices.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
    : []
  return { coaching, frameCount, frameIndices }
}

/** LLM copy may live under `ai_analysis.en` or at the top level of `ai_analysis`. */
function aiAnalysisEnBlock(ai: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!ai) return undefined
  const en = ai.en
  if (en && typeof en === 'object' && !Array.isArray(en)) {
    return en as Record<string, unknown>
  }
  return ai
}

function parseCorrectionImages(raw: unknown): CorrectionPair[] {
  if (!Array.isArray(raw)) return []
  const out: CorrectionPair[] = []
  for (const item of raw) {
    const r = item as Record<string, unknown>
    const frame = typeof r.frame === 'number' ? r.frame : 0
    const o = typeof r.originalImage === 'string' ? r.originalImage.trim() : ''
    const c = typeof r.correctedImage === 'string' ? r.correctedImage.trim() : ''
    if (!isSafeImageUri(c)) continue
    out.push({
      frame,
      originalImage: o && isSafeImageUri(o) ? toDisplayImageUri(o) : '',
      correctedImage: toDisplayImageUri(c),
    })
  }
  return out
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

function toTitle(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}


function getStyles(theme: any) {
  const pad = SCREEN_GUTTER
  return StyleSheet.create({
    gradient: { flex: 1 },
    scroll: { flex: 1 },
    scrollInner: { paddingBottom: 36 },
    titleNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: pad,
      marginBottom: 12,
      gap: 8,
    },
    titleNavBack: {
      padding: 6,
      marginRight: 4,
    },
    titleNavCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 0,
    },
    shotTitleMain: {
      fontFamily: theme.boldFont ?? theme.semiBoldFont,
      fontSize: 20,
      color: '#FFFFFF',
      textAlign: 'center',
    },
    titleStarBtn: {
      padding: 6,
    },
    /** Wraps the video panel; radii are applied inside the panel for stacked layout. */
    videoShell: {
      marginHorizontal: pad,
      marginBottom: 18,
    },
    primaryMetricsCard: {
      marginHorizontal: pad,
      backgroundColor: VA.card,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'stretch',
      marginBottom: 14,
      paddingVertical: 18,
      paddingHorizontal: 8,
    },
    primaryHalf: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryDivider: {
      width: 1,
      backgroundColor: 'rgba(0, 110, 255, 0.5)' /* #006EFF 50% */,
      marginVertical: 4,
      alignSelf: 'stretch',
    },
    primaryBigRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 2,
    },
    primaryBigNum: {
      fontFamily: theme.boldFont ?? theme.semiBoldFont,
      fontSize: 28,
      color: '#FFFFFF',
      letterSpacing: -0.5,
    },
    primarySlash: {
      fontFamily: theme.mediumFont,
      fontSize: 16,
      color: '#86A7D2',
    },
    primaryLabel: {
      marginTop: 8,
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: 'rgba(255,255,255,0.55)',
    },
    confidenceHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 8,
    },
    confidenceCaption: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: 'rgba(255,255,255,0.55)',
    },
    breakdownFrameOuter: {
      marginHorizontal: pad,
      marginBottom: 14,
    },
    breakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    breakdownLabel: {
      width: 76,
      fontFamily: theme.mediumFont,
      fontSize: 14,
      color: 'rgba(255,255,255,0.92)',
    },
    breakdownBarGradient: {
      flex: 1,
      minWidth: 0,
      alignSelf: 'center',
    },
    breakdownScoreWrap: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 2,
      width: 72,
      justifyContent: 'flex-end',
    },
    breakdownScoreNum: {
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      color: '#FFFFFF',
    },
    insightCardsWrap: {
      marginHorizontal: pad,
      marginBottom: 14,
    },
    physicalMetricsWrap: {
      marginHorizontal: pad,
      marginBottom: 14,
      alignItems: 'center',
    },
    breakdownScoreDenom: {
      fontFamily: theme.regularFont,
      fontSize: 11,
      color: '#86A7D2',
    },
    extraCard: {
      marginHorizontal: pad,
      backgroundColor: VA.card,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 16,
      marginBottom: 14,
    },
    secondaryTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: '#FFFFFF',
      marginBottom: 10,
    },
    summarySectionTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: '#FFFFFF',
      marginBottom: 8,
    },
    correctionSubLabel: {
      fontFamily: theme.regularFont,
      fontSize: 11,
      color: 'rgba(255,255,255,0.45)',
      marginBottom: 8,
    },
    correctionPairBlock: {
      marginBottom: 18,
    },
    correctionFrameLabel: {
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: VA.accent,
      marginBottom: 8,
    },
    correctionPairRow: {
      flexDirection: 'row',
      gap: 10,
    },
    correctionPairCol: {
      flex: 1,
      minWidth: 0,
    },
    correctionPairColLabel: {
      fontFamily: theme.regularFont,
      fontSize: 11,
      color: VA.muted,
      marginBottom: 6,
    },
    correctionFrameImage: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 8,
      backgroundColor: '#000',
    },
    correctionsLoadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    commentDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(255,255,255,0.1)',
      marginVertical: 12,
    },
    commentHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    commentHeadLeft: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: VA.muted,
    },
    commentHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    timeText: {
      fontFamily: theme.mediumFont,
      fontSize: 13,
      color: 'rgba(255,255,255,0.85)',
    },
    commentBody: {
      fontFamily: theme.regularFont,
      fontSize: 15,
      color: VA.text,
      lineHeight: 22,
      flexShrink: 1,
    },
    aiSubTitle: {
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      color: VA.accent,
      marginTop: 10,
      marginBottom: 6,
    },
    aiBullet: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: VA.text,
      lineHeight: 20,
      marginBottom: 4,
      flexShrink: 1,
    },
    coachAnnWrap: {
      marginTop: 12,
      gap: 10,
    },
    coachAnnCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(0, 184, 255, 0.25)',
      backgroundColor: 'rgba(0, 20, 53, 0.95)',
      overflow: 'hidden',
    },
    coachAnnImage: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: '#000',
    },
    coachAnnMeta: {
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 4,
    },
    coachAnnTime: {
      fontFamily: theme.mediumFont,
      fontSize: 12,
      color: VA.accent,
    },
    coachAnnComment: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: 'rgba(255,255,255,0.9)',
      lineHeight: 18,
      paddingHorizontal: 10,
      paddingBottom: 10,
    },
  })
}

export function ActivitiesVideoAnalysis({
  session,
  onBack,
}: {
  session: ActivitySession
  onBack: () => void
}) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const { width: winW } = useWindowDimensions()
  /** Video width: screen minus mock gutters (video sits in `videoShell`). */
  const videoW = useMemo(() => Math.max(160, Math.floor(winW - 2 * SCREEN_GUTTER)), [winW])

  const [poseFrames, setPoseFrames] = useState<PoseFrameRow[]>([])
  const [totalVidFrames, setTotalVidFrames] = useState(1)
  /** From `metrics.ai_analysis` after fetch — aligns pose colors with written feedback. */
  const [aiSnapshot, setAiSnapshot] = useState<{
    rating: string | null
    scorePercent: number | null
    techniqueScore: number | null
    outcomeScore: number | null
    tacticsScore: number | null
    confidenceScore: number | null
    confidenceBand: string | null
    uncertaintyPlusMinus: number | null
    physicalMetrics: ReturnType<typeof parsePhysicalMetricsFromAnalysis>
  } | null>(null)
  const [fullFeedbackText, setFullFeedbackText] = useState<string | null>(null)
  const [aiSections, setAiSections] = useState<{
    diagnosis: string | null
    shotContext: string | null
    strengths: string[]
    technicalErrors: string[]
    actionableCorrections: string[]
    recommendations: string[]
    strokeLabel: string | null
    strokePreset: string | null
    strokePresetId: string | null
    primaryTrainCategory: string | null
    category: string | null
    level: string | null
  } | null>(null)
  const [correctionGemini, setCorrectionGemini] = useState<CorrectionPair[]>([])
  const [correctionFal, setCorrectionFal] = useState<CorrectionPair[]>([])
  const [correctionCoaching, setCorrectionCoaching] = useState<CorrectionCoachingSummary | null>(
    null
  )
  const [activeCorrection, setActiveCorrection] = useState(0)
  const [correctionsLoading, setCorrectionsLoading] = useState(false)
  const [hasCorrectionImagesFlag, setHasCorrectionImagesFlag] = useState(false)

  const [isFavorite, setIsFavorite] = useState(false)

  const styles = useMemo(() => getStyles(theme), [theme])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(ACTIVITIES_FAVORITES_STORAGE_KEY)
        if (cancel) return
        const parsed = raw ? JSON.parse(raw) : []
        setIsFavorite(Array.isArray(parsed) && parsed.includes(session.analysisId))
      } catch {
        setIsFavorite(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [session.analysisId])

  const toggleFavorite = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(ACTIVITIES_FAVORITES_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      const list: string[] = Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === 'string')
        : []
      const next = new Set(list)
      if (next.has(session.analysisId)) {
        next.delete(session.analysisId)
        setIsFavorite(false)
      } else {
        next.add(session.analysisId)
        setIsFavorite(true)
      }
      await AsyncStorage.setItem(ACTIVITIES_FAVORITES_STORAGE_KEY, JSON.stringify([...next]))
    } catch {
      /* ignore */
    }
  }, [session.analysisId])

  useEffect(() => {
    let cancelled = false
    setPoseFrames([])
    setAiSnapshot(null)
    setFullFeedbackText(null)
    setAiSections(null)
    setCorrectionGemini([])
    setCorrectionFal([])
    setCorrectionCoaching(null)
    setActiveCorrection(0)
    setCorrectionsLoading(false)
    setHasCorrectionImagesFlag(false)
    setTotalVidFrames(1)
    ;(async () => {
      try {
        const [res, overlayRes] = await Promise.all([
          authClient
            .$fetch(`/technique/analysis/${session.analysisId}`, { method: 'GET' })
            .catch(() => null),
          authClient
            .$fetch(`/technique/analysis/${session.analysisId}/pose-overlay`, { method: 'GET' })
            .catch(() => null),
        ])
        const body: any = (res as any)?.data ?? res
        const overlayBody: any = (overlayRes as any)?.data ?? overlayRes
        if (cancelled || body?.error) return
        const metrics = body?.metrics as Record<string, unknown> | undefined
        const overlayMetrics = {
          total_frames: overlayBody?.total_frames,
          analyzed_frames: overlayBody?.analyzed_frames,
          video_duration_ms: overlayBody?.video_duration_ms,
        } as Record<string, unknown>
        const ai = metrics?.ai_analysis as Record<string, unknown> | undefined
        const en = aiAnalysisEnBlock(ai)
        const retrievalBlock = metrics?.retrieval as Record<string, unknown> | undefined
        const shotHyp = retrievalBlock?.shot_hypothesis as Record<string, unknown> | undefined
        const rating = typeof ai?.rating === 'string' ? ai.rating : null
        const scorePercent = storedAiScoreToPercent(ai as Record<string, unknown>)
        const breakdown = storedAiBreakdownToPercent(ai as Record<string, unknown>)
        const confidence = storedAiConfidenceToPercent(ai as Record<string, unknown>)
        const rows = normalizePoseData(overlayBody?.pose_data ?? metrics?.pose_data)
        const tf = resolveTotalFrames(
          { ...overlayMetrics, ...metrics },
          rows
        )
        if (cancelled) return
        setFullFeedbackText(
          typeof body?.feedbackText === 'string' && body.feedbackText.trim().length > 0
            ? body.feedbackText.trim()
            : null
        )
        const strengthsRaw = Array.isArray(en?.strengths)
          ? en.strengths.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          : Array.isArray(en?.observations)
            ? en.observations.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            : []
        const actionableRaw = Array.isArray(en?.actionable_corrections)
          ? en.actionable_corrections.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          : []
        const recommendationsRaw = Array.isArray(en?.recommendations)
          ? en.recommendations.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          : []
        const humanShotLabel =
          humanShotLabelFromStoredMetrics(metrics) ??
          (typeof shotHyp?.stroke_label === 'string' && shotHyp.stroke_label.trim()
            ? shotHyp.stroke_label.trim()
            : null)
        setAiSections({
          diagnosis:
            typeof en?.diagnosis === 'string'
              ? en.diagnosis
              : typeof ai?.diagnosis === 'string'
                ? ai.diagnosis
                : null,
          shotContext: typeof en?.shot_context === 'string' ? en.shot_context : null,
          strengths: strengthsRaw,
          technicalErrors: Array.isArray(en?.technical_errors)
            ? en.technical_errors.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            : [],
          actionableCorrections: actionableRaw,
          recommendations: recommendationsRaw,
          strokeLabel: humanShotLabel,
          strokePresetId:
            typeof shotHyp?.stroke_preset === 'string' ? shotHyp.stroke_preset.trim() : null,
          primaryTrainCategory:
            typeof ai?.primary_train_category === 'string'
              ? String(ai.primary_train_category).trim()
              : null,
          category: typeof shotHyp?.category === 'string' ? toTitle(shotHyp.category) : null,
          level: typeof shotHyp?.skill_level === 'string' ? toTitle(shotHyp.skill_level) : null,
        })
        setAiSnapshot({
          rating,
          scorePercent,
          techniqueScore: breakdown.technique,
          outcomeScore: breakdown.outcome,
          tacticsScore: breakdown.tactics,
          confidenceScore: confidence.score,
          confidenceBand: confidence.band,
          uncertaintyPlusMinus: confidence.uncertaintyPlusMinus,
          physicalMetrics: parsePhysicalMetricsFromAnalysis(ai),
        })
        setPoseFrames(rows)
        setTotalVidFrames(tf)
        const expectsCorrections = metrics?.has_correction_images === true
        setHasCorrectionImagesFlag(expectsCorrections)

        if (!expectsCorrections) return

        setCorrectionsLoading(true)
        const corrRes = await authClient
          .$fetch(`/technique/analysis/${session.analysisId}/correction-images`, {
            method: 'GET',
          })
          .catch(() => null)
        if (!cancelled) {
          const corrBody: any = (corrRes as any)?.data ?? corrRes
          const geminiParsed = parseCorrectionImages(corrBody?.correction_images)
          const falParsed = parseCorrectionImages(corrBody?.correction_images_fal)
          setCorrectionGemini(geminiParsed)
          setCorrectionFal(falParsed)
          const ctxParsed = parseCorrectionContext(corrBody?.correction_context)
          setCorrectionCoaching(ctxParsed.coaching)
          setActiveCorrection(0)
        }
      } catch {
        /* no pose overlay */
      } finally {
        if (!cancelled) setCorrectionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session.analysisId])

  const effectiveSession = useMemo((): ActivitySession => {
    if (aiSnapshot === null) return session
    const scoreForSession =
      aiSnapshot.scorePercent ?? session.score ?? null
    return {
      ...session,
      rating: aiSnapshot.rating ?? session.rating ?? null,
      score: scoreForSession,
      techniqueScore: aiSnapshot.techniqueScore ?? session.techniqueScore ?? null,
      outcomeScore: aiSnapshot.outcomeScore ?? session.outcomeScore ?? null,
      tacticsScore: aiSnapshot.tacticsScore ?? session.tacticsScore ?? null,
      confidenceScore: aiSnapshot.confidenceScore ?? session.confidenceScore ?? null,
      confidenceBand: aiSnapshot.confidenceBand ?? session.confidenceBand ?? null,
      uncertaintyPlusMinus: aiSnapshot.uncertaintyPlusMinus ?? session.uncertaintyPlusMinus ?? null,
    }
  }, [session, aiSnapshot])

  const shotTitle = useMemo(
    () =>
      displayTrainShotTitle({
        strokeLabel: aiSections?.strokeLabel ?? session.shotLabel ?? null,
        strokeName: session.shotLabel ?? null,
        strokePreset: aiSections?.strokePresetId ?? null,
      }) ||
      formatActivityShotTitle({
        strokeLabel: aiSections?.strokeLabel ?? session.shotLabel ?? null,
        shotContext: aiSections?.shotContext ?? null,
        sessionLabel: session.shotLabel ?? null,
      }),
    [
      aiSections?.strokeLabel,
      aiSections?.shotContext,
      aiSections?.strokePresetId,
      session.shotLabel,
    ]
  )
  const created = useMemo(() => new Date(session.createdAt), [session.createdAt])
  const timeTag = formatTimeTag(created)

  const narrativeText = fullFeedbackText?.trim() || ''
  const notesExtra = useMemo(() => {
    const d = aiSections?.diagnosis?.trim() ?? ''
    if (!narrativeText) return ''
    if (d && narrativeText === d) return ''
    if (d && narrativeText.startsWith(d)) return narrativeText.slice(d.length).trim()
    return narrativeText
  }, [narrativeText, aiSections?.diagnosis])
  const hasNotesExtra = notesExtra.length > 0
  const hasAiStructured = Boolean(
    aiSections &&
      ((aiSections.diagnosis && aiSections.diagnosis.trim().length > 0) ||
        (aiSections.shotContext && aiSections.shotContext.trim().length > 0) ||
        aiSections.technicalErrors.length > 0 ||
        aiSections.strengths.length > 0 ||
        aiSections.actionableCorrections.length > 0 ||
        aiSections.recommendations.length > 0)
  )
  const coachInsightCards = useMemo(() => {
    if (!aiSections) return null
    const input = {
      strokeLabel: aiSections.strokeLabel,
      strokePreset: aiSections.strokePresetId,
      shotContext: aiSections.shotContext,
      primaryTrainCategory: aiSections.primaryTrainCategory,
      strengths: aiSections.strengths,
      actionableCorrections: aiSections.actionableCorrections,
      technicalErrors: aiSections.technicalErrors,
      diagnosis: aiSections.diagnosis,
    }
    if (!shouldShowCoachInsightCards(input)) return null
    return buildCoachInsightCardsContent(input)
  }, [aiSections])

  const accordionData = useMemo(() => {
    if (!aiSections) return null
    return {
      rating: effectiveSession.rating ?? null,
      score: effectiveSession.score ?? null,
      diagnosis: aiSections.diagnosis,
      shotContext: aiSections.shotContext,
      strengths: aiSections.strengths,
      technicalErrors: aiSections.technicalErrors,
      actionableCorrections: aiSections.actionableCorrections,
      recommendations: aiSections.recommendations,
    }
  }, [aiSections, effectiveSession.rating, effectiveSession.score])
  const correctionPairs =
    correctionGemini.length > 0 ? correctionGemini : correctionFal

  const proReferenceShot = aiSections?.strokeLabel?.trim() || null

  useEffect(() => {
    setActiveCorrection((prev) => {
      const n = correctionPairs.length
      if (n === 0) return 0
      return prev >= n ? n - 1 : prev
    })
  }, [correctionPairs.length])

  const showCorrectionsSection =
    hasCorrectionImagesFlag || correctionGemini.length > 0 || correctionFal.length > 0
  const showWrittenEmpty = aiSections != null && !hasAiStructured && !hasNotesExtra
  const coachFeedback = session.coachFeedbackText?.trim() ?? ''
  const coachAnnotations = useMemo(
    () => parseCoachAnnotations(session.coachMarksJson),
    [session.coachMarksJson]
  )
  const shotScoreWhole =
    typeof effectiveSession.score === 'number'
      ? Math.max(0, Math.min(100, Math.round(effectiveSession.score)))
      : null

  const confidencePct =
    typeof effectiveSession.confidenceScore === 'number'
      ? Math.max(0, Math.min(100, Math.round(effectiveSession.confidenceScore)))
      : null

  const showConfidenceInfo = useCallback(() => {
    const parts: string[] = []
    if (aiSnapshot?.confidenceBand)
      parts.push(t('analysis.confidenceBand', { band: aiSnapshot.confidenceBand }))
    if (aiSnapshot?.uncertaintyPlusMinus != null)
      parts.push(
        t('analysis.confidencePlusMinus', { points: aiSnapshot.uncertaintyPlusMinus })
      )
    Alert.alert(
      t('analysis.confidenceTitle'),
      parts.length > 0 ? parts.join('\n') : t('analysis.confidenceDefault')
    )
  }, [aiSnapshot, t])

  return (
    <View style={[styles.gradient, { backgroundColor: theme.backgroundColor }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          // Sits below the global <Header/> in main.tsx, which already pads insets.top.
          // Matches the Activities Shots home page (paddingTop: 8) so the back row has
          // the same top padding when you tap into a shot.
          { paddingBottom: 28 + insets.bottom, paddingTop: 8 },
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android' ? false : undefined}
      >
        <View style={styles.titleNavRow}>
          <TouchableOpacity
            style={styles.titleNavBack}
            onPress={onBack}
            activeOpacity={0.85}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('analysis.back')}
          >
            <Ionicons name="chevron-back" size={24} color={NAV_ICON_TINT} />
          </TouchableOpacity>
          <View style={styles.titleNavCenter}>
            <Text allowFontScaling={false} style={styles.shotTitleMain} numberOfLines={2}>
              {shotTitle}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.titleStarBtn}
            onPress={toggleFavorite}
            activeOpacity={0.85}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={
              isFavorite ? t('analysis.removeFavorite') : t('analysis.addFavorite')
            }
          >
            <LocalSvgAsset
              assetModule={isFavorite ? ACTIVITIES_STAR_FILLED_SVG : ACTIVITIES_STAR_SVG}
              width={24}
              height={24}
              style={{ opacity: isFavorite ? 1 : 0.55 }}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.videoShell}>
          <TechniqueAnalysisVideoPanel
            videoUri={videoUri(session.videoPath)}
            videoKey={session.analysisId}
            width={videoW}
            poseFrames={poseFrames}
            totalVidFrames={totalVidFrames}
            qualitySession={effectiveSession}
            isLooping
            playerLayout="default"
            showLegend
            skeletonColorMode="segment"
          />
        </View>

        <View style={styles.primaryMetricsCard}>
          <View style={styles.primaryHalf}>
            <View style={styles.primaryBigRow}>
              <Text allowFontScaling={false} style={styles.primaryBigNum}>
                {shotScoreWhole != null ? String(shotScoreWhole) : '—'}
              </Text>
              <Text allowFontScaling={false} style={styles.primarySlash}>
                /100
              </Text>
            </View>
            <Text allowFontScaling={false} style={styles.primaryLabel}>
              {t('analysis.shotScore')}
            </Text>
          </View>
          <View style={styles.primaryDivider} />
          <View style={styles.primaryHalf}>
            <View style={styles.primaryBigRow}>
              <Text allowFontScaling={false} style={styles.primaryBigNum}>
                {confidencePct != null ? String(confidencePct) : '—'}
              </Text>
              <Text allowFontScaling={false} style={styles.primaryBigNum}>
                %
              </Text>
            </View>
            <View style={styles.confidenceHeadRow}>
              <Text allowFontScaling={false} style={styles.confidenceCaption}>
                {t('analysis.confidence')}
              </Text>
              <TouchableOpacity onPress={showConfidenceInfo} hitSlop={10} activeOpacity={0.75}>
                <Ionicons name="information-circle-outline" size={18} color="rgba(255,255,255,0.55)" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ProLibraryGradientFrame
          borderRadius={16}
          innerBorderRadius={14}
          strokeWidth={proLibraryChrome.frameStrokeWidth}
          innerShadow={false}
          style={styles.breakdownFrameOuter}
          innerStyle={{
            backgroundColor: VA.card,
            paddingHorizontal: 16,
            paddingVertical: 18,
            gap: 22,
            flexDirection: 'column',
          }}
        >
          {[
            { label: t('activities.technique'), value: effectiveSession.techniqueScore },
            { label: t('activities.outcome'), value: effectiveSession.outcomeScore },
            { label: t('activities.tactics'), value: effectiveSession.tacticsScore },
          ].map((row) => {
            const value =
              typeof row.value === 'number'
                ? Math.max(0, Math.min(100, Math.round(row.value)))
                : null
            const pct = value ?? 0
            const fill = VA.accent
            return (
              <View key={row.label} style={styles.breakdownRow}>
                <Text allowFontScaling={false} style={styles.breakdownLabel}>
                  {row.label}
                </Text>
                <ProLibraryGradientProgressBar
                  progress={pct}
                  fillColor={fill}
                  trackColor={VA.track}
                  height={10}
                  strokeWidth={2.5}
                  outerBorderRadius={8}
                  innerBorderRadius={6}
                  fillBorderRadius={4}
                  style={styles.breakdownBarGradient}
                />
                <View style={styles.breakdownScoreWrap}>
                  <Text allowFontScaling={false} style={styles.breakdownScoreNum}>
                    {value != null ? String(value) : '—'}
                  </Text>
                  <Text allowFontScaling={false} style={styles.breakdownScoreDenom}>
                    /100
                  </Text>
                </View>
              </View>
            )
          })}
        </ProLibraryGradientFrame>

        {aiSnapshot?.physicalMetrics ? (
          <View style={styles.physicalMetricsWrap}>
            <PhysicalMetricsSection
              metrics={aiSnapshot.physicalMetrics}
              contentWidth={videoW}
              accentColor={VA.accent}
              trackColor={VA.track}
            />
          </View>
        ) : null}

        {coachInsightCards ? (
          <View style={styles.insightCardsWrap}>
            <CoachStrengthFocusInsightCards content={coachInsightCards} />
          </View>
        ) : null}

        {(accordionData != null || hasNotesExtra || showWrittenEmpty) && (
          <View style={styles.extraCard}>
            <Text allowFontScaling={false} style={styles.secondaryTitle}>
              {t('analysis.aiCoachFeedback')}
            </Text>
            <Text allowFontScaling={false} style={styles.timeText}>
              {timeTag}
            </Text>
            {aiSections ? (
              <>
                <View style={styles.commentDivider} />
                <Text allowFontScaling={false} style={styles.aiSubTitle}>
                  {t('analysis.session')}
                </Text>
                <Text allowFontScaling={false} style={styles.commentBody}>
                  {t('analysis.stroke')}: {aiSections.strokeLabel || shotTitle}
                  {'\n'}
                  {t('analysis.category')}: {aiSections.category || '—'}
                  {'\n'}
                  {t('analysis.level')}: {aiSections.level || '—'}
                </Text>
              </>
            ) : null}
            {accordionData ? (
              <View style={{ marginTop: 14 }}>
                <CoachAnalysisAccordions data={accordionData} defaultExpanded />
              </View>
            ) : null}
            {hasNotesExtra ? (
              <>
                <Text allowFontScaling={false} style={styles.aiSubTitle}>
                  {t('analysis.fullCoachNotes')}
                </Text>
                <Text allowFontScaling={false} style={styles.commentBody}>
                  {notesExtra}
                </Text>
              </>
            ) : null}
            {showWrittenEmpty ? (
              <Text allowFontScaling={false} style={[styles.commentBody, { color: VA.muted }]}>
                {t('analysis.noWrittenSummary')}
              </Text>
            ) : null}
          </View>
        )}

        {showCorrectionsSection ? (
          <View style={styles.extraCard}>
            <Text allowFontScaling={false} style={styles.summarySectionTitle}>
              {t('analysis.correctedImages')}
            </Text>
            {correctionsLoading ? (
              <View style={styles.correctionsLoadingRow}>
                <ActivityIndicator color={VA.accent} size="small" />
              </View>
            ) : null}
            {!correctionsLoading &&
            correctionGemini.length === 0 &&
            correctionFal.length === 0 ? (
              <Text allowFontScaling={false} style={[styles.commentBody, { color: VA.muted }]}>
                {t('analysis.noCorrectedImages')}
              </Text>
            ) : null}
            {correctionCoaching?.diagnosis?.trim() ? (
              <>
                <Text allowFontScaling={false} style={styles.aiSubTitle}>
                  {t('analysis.coachSummary')}
                </Text>
                <Text allowFontScaling={false} style={styles.commentBody}>
                  {correctionCoaching.diagnosis.trim()}
                </Text>
              </>
            ) : null}
            {correctionCoaching?.recommendations &&
            correctionCoaching.recommendations.length > 0 ? (
              <>
                <Text allowFontScaling={false} style={styles.aiSubTitle}>
                  Image-gen recommendations
                </Text>
                {correctionCoaching.recommendations.map((line, idx) => (
                  <Text key={`corr-rec-${idx}`} allowFontScaling={false} style={styles.aiBullet}>
                    {'\u2022'} {line}
                  </Text>
                ))}
              </>
            ) : null}
            {correctionCoaching?.actionable_corrections &&
            correctionCoaching.actionable_corrections.length > 0 ? (
              <>
                <Text allowFontScaling={false} style={styles.aiSubTitle}>
                  Focus areas
                </Text>
                {correctionCoaching.actionable_corrections.map((line, idx) => (
                  <Text key={`corr-tip-${idx}`} allowFontScaling={false} style={styles.aiBullet}>
                    {'\u2022'} {line}
                  </Text>
                ))}
              </>
            ) : null}
            {!correctionsLoading && correctionPairs.length > 0 ? (
              <>
                {correctionPairs[activeCorrection] ? (
                  <View style={styles.correctionPairBlock}>
                    <View style={styles.correctionPairRow}>
                      <View style={styles.correctionPairCol}>
                        <Text allowFontScaling={false} style={styles.correctionPairColLabel}>
                          Original
                        </Text>
                        {correctionPairs[activeCorrection].originalImage ? (
                          <CorrectionImageWithLoader
                            source={{ uri: correctionPairs[activeCorrection].originalImage }}
                            style={styles.correctionFrameImage}
                            showLoader={false}
                          />
                        ) : (
                          <View style={styles.correctionFrameImage} />
                        )}
                      </View>
                      <View style={styles.correctionPairCol}>
                        <Text allowFontScaling={false} style={styles.correctionPairColLabel}>
                          Corrected
                        </Text>
                        <CorrectionImageWithLoader
                          source={{ uri: correctionPairs[activeCorrection].correctedImage }}
                          style={styles.correctionFrameImage}
                        />
                      </View>
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        {(coachFeedback.length > 0 || coachAnnotations.length > 0) && (
          <View style={styles.extraCard}>
            <View style={styles.commentHead}>
              <Text allowFontScaling={false} style={styles.commentHeadLeft}>
                {t('analysis.coachReview')}
              </Text>
              <View style={styles.commentHeadRight}>
                <Ionicons name="checkmark-circle" size={16} color={VA.good} />
                <Text allowFontScaling={false} style={styles.timeText}>
                  {session.coachReviewedAt
                    ? formatTimeTag(new Date(session.coachReviewedAt))
                    : 'Submitted'}
                </Text>
              </View>
            </View>
            {coachFeedback.length > 0 ? (
              <Text allowFontScaling={false} style={styles.commentBody}>
                {coachFeedback}
              </Text>
            ) : null}
            {coachAnnotations.length > 0 ? (
              <View style={styles.coachAnnWrap}>
                {coachAnnotations.map((ann, idx) => (
                  <View key={`${ann.timeMs}-${idx}`} style={styles.coachAnnCard}>
                    {ann.imageUri ? (
                      <Image source={{ uri: ann.imageUri }} style={styles.coachAnnImage} resizeMode="cover" />
                    ) : null}
                    <View style={styles.coachAnnMeta}>
                      <Text allowFontScaling={false} style={styles.coachAnnTime}>
                        Frame {Math.max(0, Math.floor(ann.timeMs / 1000))}s
                      </Text>
                    </View>
                    {ann.comment ? (
                      <Text allowFontScaling={false} style={styles.coachAnnComment}>
                        {ann.comment}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
