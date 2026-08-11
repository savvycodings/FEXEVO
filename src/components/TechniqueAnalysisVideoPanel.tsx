import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Video, ResizeMode, type AVPlaybackStatus, type AVPlaybackStatusSuccess } from 'expo-av'
import Ionicons from '@expo/vector-icons/Ionicons'
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { ProLibraryGradientFrame } from './ProLibraryGradientFrame'
import { proLibraryChrome } from '../theme/proLibraryChrome'
import {
  MEDIAPIPE_POSE_CONNECTIONS,
  nearestPoseByFrame,
  nearestPoseWithRacket,
  nearestPoseWithBall,
  projectBboxToOverlayRect,
  poseSegmentColor,
  projectLandmarkToOverlayPx,
  containerSizeFromNatural,
  resolveDisplaySizeForVideo,
  type LandmarkPoint,
  type PoseFrameRow,
} from '../lib/techniquePose'
import {
  computeOverlayJointAngles,
  emaAngle,
  jointArcSvgPath,
  jointLabelOffset,
  JOINT_DOT_COLOR,
  OVERLAY_JOINT_DOT_NAMES,
  type ComputedJointAngle,
} from '../lib/poseJointAngles'
import {
  techniqueQualityTone,
  type TechniqueQuality,
  type TechniqueQualityInput,
} from '../lib/technique-quality'

const VA = {
  good: '#34C759',
  wrong: '#FF2D55',
}

const DETAILED_SKELETON = '#00B8FF'
const LEGEND_POSE = '#34C759'
const LEGEND_RACKET = '#FFD400'
const LEGEND_BALL = '#00E5FF'

const BALL_OVERLAY_MIN_CONF = Number(
  String(process.env.EXPO_PUBLIC_BALL_OVERLAY_MIN_CONF ?? '0.12')
)

/** Stacked layout: thicker pro-library gradient frame around the video than default `frameStrokeWidth`. */
const STACKED_VIDEO_GRADIENT_STROKE = 3

/** Activities shot-detail scrub — played + thumb fill (product accent). */
const SCRUB_TRACK_PLAYED = '#00B8FF'
const SCRUB_TRACK_REST = '#808080'

const SCRUB_DOTS_FALLBACK: { p: number; good: boolean }[] = [
  { p: 0.12, good: false },
  { p: 0.28, good: true },
  { p: 0.44, good: false },
  { p: 0.62, good: true },
  { p: 0.78, good: false },
]

function projectLmPx(
  name: string,
  landmarks: Record<string, LandmarkPoint>,
  boxW: number,
  boxH: number,
  naturalW: number | null,
  naturalH: number | null
): { x: number; y: number } | null {
  return projectLandmarkToOverlayPx(name, landmarks, boxW, boxH, naturalW, naturalH)
}

function PoseSkeletonOverlay({
  landmarks,
  boxW,
  boxH,
  naturalW,
  naturalH,
  goodColor,
  wrongColor,
  uniformStrokeColor,
  strokeWidth = 3,
  showJointMetrics = false,
  jointAngles = [],
}: {
  landmarks: Record<string, LandmarkPoint>
  boxW: number
  boxH: number
  naturalW: number | null
  naturalH: number | null
  goodColor: string
  wrongColor: string
  uniformStrokeColor?: string
  strokeWidth?: number
  showJointMetrics?: boolean
  jointAngles?: ComputedJointAngle[]
}) {
  const arcR = Math.max(10, Math.min(22, boxW * 0.035))
  const labelDist = arcR + 10
  const dotR = Math.max(3.2, Math.min(5.5, boxW * 0.012))

  return (
    <>
      {MEDIAPIPE_POSE_CONNECTIONS.map(([a, b]) => {
        const p1 = projectLmPx(a, landmarks, boxW, boxH, naturalW, naturalH)
        const p2 = projectLmPx(b, landmarks, boxW, boxH, naturalW, naturalH)
        if (!p1 || !p2) return null
        const stroke = uniformStrokeColor ?? poseSegmentColor(a, b, goodColor, wrongColor)
        return (
          <Line
            key={`${a}-${b}`}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )
      })}

      {showJointMetrics
        ? OVERLAY_JOINT_DOT_NAMES.map((name) => {
            const pt = projectLmPx(name, landmarks, boxW, boxH, naturalW, naturalH)
            if (!pt) return null
            const fill = JOINT_DOT_COLOR[name] ?? DETAILED_SKELETON
            return (
              <Circle
                key={`dot-${name}`}
                cx={pt.x}
                cy={pt.y}
                r={dotR}
                fill={fill}
                stroke="rgba(0,0,0,0.35)"
                strokeWidth={1}
              />
            )
          })
        : null}

      {showJointMetrics
        ? jointAngles.map((j) => {
            const arc = jointArcSvgPath(j.b, j.a, j.c, arcR)
            const labelAt = jointLabelOffset(j.b, j.a, j.c, labelDist)
            const degLabel = `${Math.round(j.deg)}°`
            return (
              <React.Fragment key={`ang-${j.id}`}>
                {arc ? (
                  <Path
                    d={arc}
                    fill="none"
                    stroke={j.color}
                    strokeWidth={1.6}
                    strokeOpacity={0.9}
                  />
                ) : null}
                <SvgText
                  x={labelAt.x}
                  y={labelAt.y + 4}
                  fill={j.color}
                  fontSize={Math.max(10, Math.min(13, boxW * 0.032))}
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {degLabel}
                </SvgText>
              </React.Fragment>
            )
          })
        : null}
    </>
  )
}

function sessionToTone(
  s: { score?: number | null; rating?: string | null } | null | undefined
): TechniqueQuality {
  if (s == null) return 'unknown'
  return techniqueQualityTone(s as TechniqueQualityInput)
}

export type TechniqueAnalysisVideoPanelProps = {
  videoUri: string
  /** `key` for Video remount (e.g. analysis id or path). */
  videoKey: string
  width: number
  poseFrames: PoseFrameRow[]
  totalVidFrames: number
  /**
   * When set, colors skeleton/ scrub dots from the same quality rules as Activities.
   * If omitted, `qualitySession` is used, or 'unknown' styling.
   */
  techniqueQuality?: TechniqueQuality
  qualitySession?: { score?: number | null; rating?: string | null } | null
  /** `looped` off for one-shot result playback (technique), on for Activities. */
  isLooping?: boolean
  showLegend?: boolean
  /**
   * `stacked` = video frame first, then play/progress + legend in separate #001435 blocks below (Activities shot detail).
   * `default` = original strip styling (technique flow).
   */
  playerLayout?: 'default' | 'stacked'
  /** Show Pose / Racket / Ball legend under stacked layout (AI Coach step 3 shows this by default). */
  showLegendInStacked?: boolean
  /** Quality scrub dots on stacked progress bar (matches AI Coach timeline). */
  showScrubDotsInStacked?: boolean
  /** Green arms / pink legs segment colors; `uniform` = single tone from session quality. */
  skeletonColorMode?: 'uniform' | 'segment'
  /**
   * Mock-aligned Poses UI: Your pose / Pose Corrected chrome, on-frame legend,
   * cyan skeleton, joint dots + included-degree arcs.
   */
  showDetailedPoseOverlay?: boolean
}

/**
 * Full-bleed analyzed clip with pose + YOLO racket/ball overlay, play/scrub, and optional legend.
 * Shared by Activities and Technique step 3.
 */
export function TechniqueAnalysisVideoPanel({
  videoUri,
  videoKey,
  width,
  poseFrames,
  totalVidFrames,
  techniqueQuality: techniqueQualityProp,
  qualitySession,
  isLooping = true,
  showLegend = true,
  playerLayout = 'default',
  showLegendInStacked = false,
  showScrubDotsInStacked = false,
  skeletonColorMode = 'uniform',
  showDetailedPoseOverlay = false,
}: TechniqueAnalysisVideoPanelProps) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const videoRef = useRef<Video>(null)
  const naturalFromPlayerRef = useRef(false)
  const [playback, setPlayback] = useState<AVPlaybackStatusSuccess | null>(null)
  const [encodedNatural, setEncodedNatural] = useState<{ w: number; h: number } | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [videoOrientation, setVideoOrientation] = useState<'portrait' | 'landscape' | null>(
    null
  )
  const [activePose, setActivePose] = useState<PoseFrameRow | null>(null)
  const angleEmaRef = useRef<Record<string, number>>({})
  const [jointAngles, setJointAngles] = useState<ComputedJointAngle[]>([])

  const applyExpoVideoNaturalSize = useCallback(
    (ns: { width: number; height: number; orientation?: 'portrait' | 'landscape' } | null | undefined) => {
      if (!ns || ns.width <= 0 || ns.height <= 0) return
      naturalFromPlayerRef.current = true
      setEncodedNatural({ w: ns.width, h: ns.height })
      setVideoOrientation(ns.orientation ?? null)
      setNaturalSize(containerSizeFromNatural(ns))
    },
    []
  )

  const poseFramesRef = useRef(poseFrames)
  const totalFramesRef = useRef(totalVidFrames)
  const lastSnapFrameRef = useRef<number | null>(null)

  const techniqueQuality =
    techniqueQualityProp ?? sessionToTone(qualitySession ?? null)

  const skeletonUniformColor = useMemo(() => {
    if (showDetailedPoseOverlay) return DETAILED_SKELETON
    if (techniqueQuality === 'good') return VA.good
    if (techniqueQuality === 'bad') return VA.wrong
    return 'rgba(255,255,255,0.42)'
  }, [techniqueQuality, showDetailedPoseOverlay])

  const paintSize = useMemo(
    () =>
      resolveDisplaySizeForVideo({
        encoded: encodedNatural,
        container: naturalSize,
        orientation: videoOrientation,
      }),
    [encodedNatural, naturalSize, videoOrientation]
  )

  const videoH = useMemo(() => {
    // Full width × encoded buffer aspect (what CONTAIN paints). No orientation tall-box.
    if (paintSize.w > 0 && paintSize.h > 0) {
      return Math.max(1, Math.ceil(width * (paintSize.h / paintSize.w)))
    }
    return Math.max(1, Math.ceil(width * (9 / 16)))
  }, [width, paintSize])

  /** Landmarks / YOLO boxes live in OpenCV buffer space (= encoded). Never rotate for overlay. */
  const shouldRotateLandmarks = false

  const lineStrokeW = useMemo(
    () => Math.max(2.2, Math.min(4, Math.round(width / 110))),
    [width]
  )

  useEffect(() => {
    poseFramesRef.current = poseFrames
  }, [poseFrames])
  useEffect(() => {
    totalFramesRef.current = totalVidFrames
  }, [totalVidFrames])

  useEffect(() => {
    naturalFromPlayerRef.current = false
    lastSnapFrameRef.current = null
    angleEmaRef.current = {}
    setJointAngles([])
    setActivePose(null)
    setEncodedNatural(null)
    setNaturalSize(null)
    setVideoOrientation(null)
    if (poseFrames.length) {
      const first = nearestPoseByFrame(poseFrames, 0) ?? poseFrames[0]!
      lastSnapFrameRef.current = first.frame
      setActivePose(first)
    }
  }, [videoKey, poseFrames])

  useEffect(() => {
    if (!videoUri) return
    const id = setTimeout(() => {
      if (naturalFromPlayerRef.current) return
      void videoRef.current
        ?.getStatusAsync()
        .then((s) => {
          if (!s.isLoaded || naturalFromPlayerRef.current) return
          const ns = (s as AVPlaybackStatusSuccess & { naturalSize?: { width: number; height: number; orientation?: 'portrait' | 'landscape' } }).naturalSize
          if (ns && ns.width > 0 && ns.height > 0) applyExpoVideoNaturalSize(ns)
        })
        .catch(() => {})
    }, 500)
    return () => clearTimeout(id)
  }, [videoKey, videoUri, applyExpoVideoNaturalSize])

  const handlePlaybackStatus = useCallback((s: AVPlaybackStatus) => {
    if (!s.isLoaded) return
    const ext = s as AVPlaybackStatusSuccess & { naturalSize?: { width: number; height: number; orientation?: 'portrait' | 'landscape' } }
    if (ext.naturalSize && ext.naturalSize.width > 0 && ext.naturalSize.height > 0) {
      applyExpoVideoNaturalSize(ext.naturalSize)
    }
    setPlayback(s as AVPlaybackStatusSuccess)
    const frames = poseFramesRef.current
    const tf = totalFramesRef.current
    if (!frames.length || !s.durationMillis || s.durationMillis <= 0 || tf <= 0) return
    const pos = s.positionMillis ?? 0
    const est = (pos / s.durationMillis) * tf
    const nearest = nearestPoseByFrame(frames, est)
    if (nearest && nearest.frame !== lastSnapFrameRef.current) {
      lastSnapFrameRef.current = nearest.frame
      setActivePose(nearest)
    }
  }, [applyExpoVideoNaturalSize])

  const estimatedVideoFrame = useMemo(() => {
    if (
      !playback?.isLoaded ||
      !playback.durationMillis ||
      playback.durationMillis <= 0 ||
      totalVidFrames <= 0
    ) {
      return activePose?.frame ?? 0
    }
    const pos = playback.positionMillis ?? 0
    return (pos / playback.durationMillis) * totalVidFrames
  }, [playback, totalVidFrames, activePose?.frame])

  const landmarksForPoseOverlay = useMemo(() => {
    if (!activePose?.landmarks) return null
    return activePose.landmarks
  }, [activePose])

  useEffect(() => {
    if (!showDetailedPoseOverlay || !landmarksForPoseOverlay) {
      setJointAngles([])
      return
    }
    const getPx = (name: string) =>
      projectLmPx(
        name,
        landmarksForPoseOverlay,
        width,
        videoH,
        paintSize.w,
        paintSize.h
      )
    const raw = computeOverlayJointAngles(getPx, landmarksForPoseOverlay)
    const next = raw.map((j) => {
      const smoothed = emaAngle(angleEmaRef.current[j.id], j.deg)
      if (smoothed != null) angleEmaRef.current[j.id] = smoothed
      return { ...j, deg: smoothed ?? j.deg }
    })
    setJointAngles(next)
  }, [showDetailedPoseOverlay, landmarksForPoseOverlay, width, videoH, paintSize])

  const racketOverlayBox = useMemo(() => {
    const est = estimatedVideoFrame
    const withRacket =
      nearestPoseWithRacket(poseFrames, est) ||
      (activePose?.racket_bbox &&
      activePose.racket_bbox.length === 4 &&
      activePose.racket_bbox.every((n) => typeof n === 'number' && Number.isFinite(n))
        ? activePose
        : null)
    const rb = withRacket?.racket_bbox as [number, number, number, number] | null | undefined
    return projectBboxToOverlayRect(rb, {
      videoW: width,
      videoH,
      encodedNatural,
      naturalSize: paintSize,
      rotate: shouldRotateLandmarks,
    })
  }, [
    estimatedVideoFrame,
    poseFrames,
    activePose,
    encodedNatural,
    paintSize,
    shouldRotateLandmarks,
    width,
    videoH,
  ])

  const ballOverlayBox = useMemo(() => {
    const est = estimatedVideoFrame
    const withBall = nearestPoseWithBall(poseFrames, est, 45, BALL_OVERLAY_MIN_CONF)
    const fallback =
      activePose &&
      activePose.ball_bbox &&
      (typeof activePose.ball_conf !== 'number' ||
        !Number.isFinite(BALL_OVERLAY_MIN_CONF) ||
        activePose.ball_conf >= BALL_OVERLAY_MIN_CONF)
        ? activePose
        : null
    const src = withBall ?? fallback
    const bb = src?.ball_bbox as [number, number, number, number] | undefined
    return projectBboxToOverlayRect(bb, {
      videoW: width,
      videoH,
      encodedNatural,
      naturalSize: paintSize,
      rotate: shouldRotateLandmarks,
    })
  }, [
    estimatedVideoFrame,
    poseFrames,
    activePose,
    encodedNatural,
    paintSize,
    shouldRotateLandmarks,
    width,
    videoH,
  ])

  const scrubDots = useMemo(() => {
    if (!poseFrames.length || totalVidFrames <= 0) return SCRUB_DOTS_FALLBACK
    const maxDots = 8
    const step = Math.max(1, Math.ceil(poseFrames.length / maxDots))
    const dotGood = techniqueQuality === 'unknown' ? null : techniqueQuality === 'good'
    const out: { p: number; good: boolean }[] = []
    for (let i = 0; i < poseFrames.length; i += step) {
      const f = poseFrames[i]!
      const good = dotGood === null ? i % 2 === 0 : dotGood
      out.push({ p: Math.min(0.985, f.frame / totalVidFrames), good })
    }
    return out.length ? out : SCRUB_DOTS_FALLBACK
  }, [poseFrames, totalVidFrames, techniqueQuality])

  const durationMs = playback?.isLoaded && playback.durationMillis ? playback.durationMillis : 1
  const positionMs = playback?.isLoaded && playback.positionMillis != null ? playback.positionMillis : 0
  const progress = Math.min(1, Math.max(0, positionMs / durationMs))
  const isPlaying = playback?.isLoaded === true && playback.isPlaying === true

  const togglePlay = useCallback(async () => {
    const ref = videoRef.current
    if (!ref) return
    if (isPlaying) await ref.pauseAsync()
    else await ref.playAsync()
  }, [isPlaying])

  const stacked = playerLayout === 'stacked'

  const styles = useMemo(
    () =>
      StyleSheet.create({
        videoBlockOuter: { width: '100%', alignItems: 'center' },
        videoSection: { width: '100%', alignSelf: 'stretch', backgroundColor: '#000', overflow: 'visible' },
        videoSectionStackedTop: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          overflow: 'hidden',
        },
        videoSectionStackedFrameOuter: {
          width: '100%',
          backgroundColor: 'transparent',
        },
        videoShell: { width: '100%', backgroundColor: '#000', alignItems: 'center' },
        videoBox: { position: 'relative', overflow: 'visible', zIndex: 1 },
        overlaySvg: {
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 4,
          elevation: 8,
        },
        /** Pills sit above the framed video (not overlaid on the clip). */
        chromeRow: {
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 10,
          paddingHorizontal: 0,
        },
        yourPosePill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 9,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: '#041028',
          borderWidth: 1.5,
          borderColor: '#00B8FF',
          flexShrink: 0,
        },
        yourPoseDot: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: '#00B8FF',
        },
        yourPoseText: {
          fontFamily: theme.semiBoldFont,
          fontSize: 11,
          color: '#FFFFFF',
        },
        /** Long outer pill — left label + one nested legend pill (Pose / Racket / Ball). */
        poseCorrectedOuter: {
          flexGrow: 0,
          flexShrink: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 8,
          paddingLeft: 10,
          paddingRight: 4,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: '#041028',
          borderWidth: 1.5,
          borderColor: 'rgba(0, 255, 166, 0.55)',
        },
        poseCorrectedLabel: {
          fontFamily: theme.regularFont,
          fontSize: 11,
          color: 'rgba(200, 215, 230, 0.72)',
          flexShrink: 0,
        },
        /** Single inner pill holding all three legend items. */
        nestedLegendPill: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 9,
          paddingVertical: 5,
          borderRadius: 999,
          backgroundColor: 'rgba(0, 255, 166, 0.12)',
          flexShrink: 0,
        },
        nestedLegendItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        nestedLegendText: {
          fontFamily: theme.semiBoldFont,
          fontSize: 10,
          color: 'rgba(160, 185, 205, 0.9)',
        },
        overlayLegendDot: { width: 6, height: 6, borderRadius: 3 },
        detailedVideoFrame: {
          width,
          alignSelf: 'center',
          marginBottom: 2,
        },
        videoShellDetailed: {
          width,
          backgroundColor: '#000',
          alignItems: 'center',
        },
        controlsStrip: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'stretch',
          width: '100%',
          marginTop: 10,
          paddingHorizontal: 14,
          paddingVertical: 14,
          gap: 10,
          backgroundColor: 'rgba(5, 10, 24, 0.98)',
        },
        controlsStripDetailed: {
          marginTop: 10,
          paddingHorizontal: 4,
          paddingVertical: 8,
          backgroundColor: 'transparent',
        },
        controlsStripStacked: {
          marginTop: 10,
          paddingTop: 6,
          paddingBottom: 6,
          paddingHorizontal: 0,
          backgroundColor: 'transparent',
          alignSelf: 'stretch',
        },
        playHit: { padding: 4, flexShrink: 0 },
        trackWrap: { flex: 1, justifyContent: 'center', height: 28 },
        trackWrapStacked: {
          flex: 1,
          justifyContent: 'center',
          minHeight: 20,
        },
        trackBg: {
          height: 4,
          borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.22)',
          position: 'relative',
        },
        trackFill: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.35)',
        },
        scrubDot: {
          position: 'absolute',
          width: 8,
          height: 8,
          borderRadius: 4,
          top: -2,
          marginLeft: -4,
        },
        scrubThumb: {
          position: 'absolute',
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: '#fff',
          borderWidth: 2,
          borderColor: '#4A90E2',
          top: -5,
          marginLeft: -7,
        },
        trackBgStacked: {
          height: 6,
          borderRadius: 3,
          backgroundColor: SCRUB_TRACK_REST,
          overflow: 'visible',
        },
        trackFillStacked: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          borderTopLeftRadius: 3,
          borderBottomLeftRadius: 3,
          backgroundColor: SCRUB_TRACK_PLAYED,
        },
        scrubThumbStacked: {
          position: 'absolute',
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: SCRUB_TRACK_PLAYED,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          top: -4,
          marginLeft: -7,
        },
        overlayLegendRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 16,
          paddingHorizontal: 14,
          paddingBottom: 12,
          backgroundColor: 'rgba(5, 10, 24, 0.98)',
        },
        overlayLegendRowStacked: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 16,
          marginTop: 10,
          paddingHorizontal: 4,
          paddingBottom: 4,
          alignSelf: 'stretch',
        },
        overlayLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        overlayLegendText: {
          fontFamily: theme.regularFont,
          fontSize: 12,
          color: 'rgba(255,255,255,0.7)',
        },
      }),
    [theme.regularFont, theme.semiBoldFont, width]
  )

  const showLegendUi =
    showLegend && !showDetailedPoseOverlay && (!stacked || showLegendInStacked)
  const showScrubDotsUi = !stacked || showScrubDotsInStacked
  const useUniformSkeleton = skeletonColorMode === 'uniform' || showDetailedPoseOverlay

  const poseOverlaySvg = landmarksForPoseOverlay ? (
    <PoseSkeletonOverlay
      landmarks={landmarksForPoseOverlay}
      boxW={width}
      boxH={videoH}
      naturalW={paintSize.w}
      naturalH={paintSize.h}
      goodColor={VA.good}
      wrongColor={VA.wrong}
      uniformStrokeColor={useUniformSkeleton ? skeletonUniformColor : undefined}
      strokeWidth={lineStrokeW}
      showJointMetrics={showDetailedPoseOverlay}
      jointAngles={jointAngles}
    />
  ) : null

  const detectionRects = (
    <>
      {racketOverlayBox ? (
        <Rect
          x={racketOverlayBox.x}
          y={racketOverlayBox.y}
          width={racketOverlayBox.w}
          height={racketOverlayBox.h}
          fill="transparent"
          stroke={LEGEND_RACKET}
          strokeWidth={Math.max(2, lineStrokeW * 0.9)}
          strokeOpacity={1}
        />
      ) : null}
      {ballOverlayBox ? (
        <Rect
          x={ballOverlayBox.x}
          y={ballOverlayBox.y}
          width={ballOverlayBox.w}
          height={ballOverlayBox.h}
          fill="transparent"
          stroke={LEGEND_BALL}
          strokeWidth={Math.max(2, lineStrokeW * 0.75)}
          strokeOpacity={1}
        />
      ) : null}
    </>
  )

  const chromeAboveVideo = showDetailedPoseOverlay ? (
    <View style={styles.chromeRow} pointerEvents="box-none">
      <View style={styles.yourPosePill}>
        <View style={styles.yourPoseDot} />
        <Text allowFontScaling={false} style={styles.yourPoseText}>
          {t('technique.yourPosePill')}
        </Text>
      </View>
      <View style={styles.poseCorrectedOuter} accessibilityState={{ disabled: true }}>
        <Text allowFontScaling={false} style={styles.poseCorrectedLabel}>
          {t('technique.poseCorrectedPill')}
        </Text>
        <View style={styles.nestedLegendPill}>
          <View style={styles.nestedLegendItem}>
            <View style={[styles.overlayLegendDot, { backgroundColor: LEGEND_POSE }]} />
            <Text allowFontScaling={false} style={styles.nestedLegendText}>
              {t('technique.overlayLegendPose')}
            </Text>
          </View>
          <View style={styles.nestedLegendItem}>
            <View style={[styles.overlayLegendDot, { backgroundColor: LEGEND_RACKET }]} />
            <Text allowFontScaling={false} style={styles.nestedLegendText}>
              {t('technique.overlayLegendRacket')}
            </Text>
          </View>
          <View style={styles.nestedLegendItem}>
            <View style={[styles.overlayLegendDot, { backgroundColor: LEGEND_BALL }]} />
            <Text allowFontScaling={false} style={styles.nestedLegendText}>
              {t('technique.overlayLegendBall')}
            </Text>
          </View>
        </View>
      </View>
    </View>
  ) : null

  const videoPlayer = (
    <View style={[styles.videoBox, { width, height: videoH }]}>
      <Video
        key={videoKey}
        ref={videoRef}
        source={{ uri: videoUri }}
        style={{ width, height: videoH }}
        resizeMode={
          encodedNatural ? ResizeMode.STRETCH : ResizeMode.CONTAIN
        }
        useNativeControls={false}
        isLooping={isLooping}
        progressUpdateIntervalMillis={33}
        onLoad={(s) => {
          if (s.isLoaded) {
            const ext = s as AVPlaybackStatusSuccess & {
              naturalSize?: { width: number; height: number; orientation?: 'portrait' | 'landscape' }
            }
            if (ext.naturalSize && ext.naturalSize.width > 0 && ext.naturalSize.height > 0) {
              applyExpoVideoNaturalSize(ext.naturalSize)
            }
          }
        }}
        onReadyForDisplay={(e) => {
          applyExpoVideoNaturalSize(e.naturalSize)
        }}
        onPlaybackStatusUpdate={handlePlaybackStatus}
      />
      <Svg
        width={width}
        height={videoH}
        viewBox={`0 0 ${width} ${videoH}`}
        style={[styles.overlaySvg, { width, height: videoH }]}
        pointerEvents="none"
      >
        {poseOverlaySvg}
        {detectionRects}
      </Svg>
    </View>
  )

  const framedVideo =
    showDetailedPoseOverlay || stacked ? (
      <ProLibraryGradientFrame
        borderRadius={proLibraryChrome.radii.frameOuter}
        innerBorderRadius={proLibraryChrome.radii.frameInner}
        strokeWidth={
          showDetailedPoseOverlay
            ? Math.max(proLibraryChrome.frameStrokeWidth, 2)
            : STACKED_VIDEO_GRADIENT_STROKE
        }
        gradientVariant="accent"
        innerShadow={false}
        innerStyle={{ backgroundColor: '#000000', padding: 0, overflow: 'hidden' }}
        style={
          showDetailedPoseOverlay
            ? styles.detailedVideoFrame
            : ({ width: '100%' } as const)
        }
      >
        <View style={showDetailedPoseOverlay ? styles.videoShellDetailed : styles.videoShell}>
          {videoPlayer}
        </View>
      </ProLibraryGradientFrame>
    ) : (
      <View style={styles.videoShell}>{videoPlayer}</View>
    )

  const innerColumnStyle =
    stacked || showDetailedPoseOverlay
      ? ({ width, alignSelf: 'center' } as const)
      : ({ width: '100%' as const, alignSelf: 'stretch' as const })

  return (
    <View style={styles.videoBlockOuter} pointerEvents="box-none">
      <View style={innerColumnStyle} pointerEvents="box-none">
        {chromeAboveVideo}
        <View
          style={[
            styles.videoSection,
            (stacked || showDetailedPoseOverlay) && styles.videoSectionStackedFrameOuter,
          ]}
          pointerEvents="box-none"
        >
          {framedVideo}
        </View>
        <View
          style={[
            styles.controlsStrip,
            stacked && styles.controlsStripStacked,
            showDetailedPoseOverlay && styles.controlsStripDetailed,
          ]}
        >
          <TouchableOpacity style={styles.playHit} onPress={togglePlay} hitSlop={12}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={stacked ? 20 : 22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={stacked || showDetailedPoseOverlay ? styles.trackWrapStacked : styles.trackWrap}>
            <View
              style={[
                styles.trackBg,
                (stacked || showDetailedPoseOverlay) && styles.trackBgStacked,
              ]}
            >
              <View
                style={[
                  stacked || showDetailedPoseOverlay ? styles.trackFillStacked : styles.trackFill,
                  { width: `${progress * 100}%` },
                  (stacked || showDetailedPoseOverlay) &&
                    progress >= 0.998 && {
                      borderTopRightRadius: 3,
                      borderBottomRightRadius: 3,
                    },
                ]}
              />
              {showScrubDotsUi &&
                scrubDots.map((d, i) => (
                  <View
                    key={i}
                    style={[
                      styles.scrubDot,
                      {
                        left: `${d.p * 100}%`,
                        backgroundColor: d.good ? VA.good : VA.wrong,
                      },
                    ]}
                  />
                ))}
              <View
                style={[
                  stacked || showDetailedPoseOverlay
                    ? styles.scrubThumbStacked
                    : styles.scrubThumb,
                  { left: `${progress * 100}%` },
                ]}
              />
            </View>
          </View>
        </View>
        {showLegendUi ? (
          <View style={[styles.overlayLegendRow, stacked && styles.overlayLegendRowStacked]}>
            <View style={styles.overlayLegendItem}>
              <View
                style={[
                  styles.overlayLegendDot,
                  {
                    backgroundColor: useUniformSkeleton
                      ? skeletonUniformColor
                      : VA.good,
                  },
                ]}
              />
              <Text allowFontScaling={false} style={styles.overlayLegendText}>
                Pose
              </Text>
            </View>
            <View style={styles.overlayLegendItem}>
              <View style={[styles.overlayLegendDot, { backgroundColor: LEGEND_RACKET }]} />
              <Text allowFontScaling={false} style={styles.overlayLegendText}>
                Racket
              </Text>
            </View>
            <View style={styles.overlayLegendItem}>
              <View style={[styles.overlayLegendDot, { backgroundColor: LEGEND_BALL }]} />
              <Text allowFontScaling={false} style={styles.overlayLegendText}>
                Ball
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
}
