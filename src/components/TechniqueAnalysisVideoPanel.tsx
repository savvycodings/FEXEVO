import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
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
  computeTrunkLean,
  emaAngle,
  landmarkVisOk,
  ANKLE_JOINT_ANGLES,
  computeRacketTilt,
  HEAD_JOINT_ANGLES,
  OVERLAY_JOINT_ANGLES,
  RACKET_ANGLE_ID,
  TORSO_ANGLE_ID,
  WRIST_JOINT_ANGLES,
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
  naturalH: number | null,
  fit: 'fill' | 'cover' = 'fill'
): { x: number; y: number } | null {
  if (fit === 'cover' && naturalW != null && naturalH != null && naturalW > 0 && naturalH > 0) {
    const lm = landmarks[name]
    if (!lm || typeof lm.x !== 'number' || typeof lm.y !== 'number') return null
    const videoAR = naturalW / naturalH
    const boxAR = boxW / boxH
    const scale = videoAR > boxAR ? boxH / naturalH : boxW / naturalW
    const offsetX = videoAR > boxAR ? (boxW - naturalW * scale) / 2 : 0
    const offsetY = videoAR > boxAR ? 0 : (boxH - naturalH * scale) / 2
    return { x: lm.x * naturalW * scale + offsetX, y: lm.y * naturalH * scale + offsetY }
  }
  return projectLandmarkToOverlayPx(name, landmarks, boxW, boxH, naturalW, naturalH)
}

function coverNormRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  boxW: number,
  boxH: number,
  naturalW: number,
  naturalH: number
): { x: number; y: number; w: number; h: number } {
  const videoAR = naturalW / naturalH
  const boxAR = boxW / boxH
  const scale = videoAR > boxAR ? boxH / naturalH : boxW / naturalW
  const offsetX = videoAR > boxAR ? (boxW - naturalW * scale) / 2 : 0
  const offsetY = videoAR > boxAR ? 0 : (boxH - naturalH * scale) / 2
  const left = x1 * naturalW * scale + offsetX
  const top = y1 * naturalH * scale + offsetY
  const right = x2 * naturalW * scale + offsetX
  const bottom = y2 * naturalH * scale + offsetY
  return { x: left, y: top, w: right - left, h: bottom - top }
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
  highlightedLandmarks = [],
  overlayFit = 'fill',
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
  highlightedLandmarks?: readonly string[]
  overlayFit?: 'fill' | 'cover'
}) {
  const arcR = Math.max(10, Math.min(22, boxW * 0.035))
  const labelDist = arcR + 10
  const dotR = Math.max(3.2, Math.min(5.5, boxW * 0.012))

  return (
    <>
      {MEDIAPIPE_POSE_CONNECTIONS.map(([a, b]) => {
        const p1 = projectLmPx(a, landmarks, boxW, boxH, naturalW, naturalH, overlayFit)
        const p2 = projectLmPx(b, landmarks, boxW, boxH, naturalW, naturalH, overlayFit)
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
            const pt = projectLmPx(name, landmarks, boxW, boxH, naturalW, naturalH, overlayFit)
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

      {highlightedLandmarks.map((name) => {
        const pt = projectLmPx(name, landmarks, boxW, boxH, naturalW, naturalH, overlayFit)
        if (!pt) return null
        return (
          <React.Fragment key={`hi-${name}`}>
            <Circle
              cx={pt.x}
              cy={pt.y}
              r={dotR * 2.8}
              fill="rgba(36,84,255,0.35)"
              stroke="#FFFFFF"
              strokeWidth={2}
            />
            <Circle cx={pt.x} cy={pt.y} r={dotR * 1.2} fill="#FFFFFF" />
          </React.Fragment>
        )
      })}

      {showJointMetrics
        ? jointAngles.map((j) => {
            const arc = jointArcSvgPath(j.b, j.a, j.c, arcR)
            const labelAt = jointLabelOffset(j.b, j.a, j.c, labelDist)
            const degLabel = `${Math.round(j.deg)}°`
            return (
              <React.Fragment key={`ang-${j.id}`}>
                {j.kind === 'torso' || j.kind === 'racket' ? (
                  <>
                    <Line
                      x1={j.b.x}
                      y1={j.b.y}
                      x2={j.a.x}
                      y2={j.a.y}
                      stroke={j.color}
                      strokeWidth={1.4}
                      strokeDasharray="4 4"
                      strokeOpacity={0.8}
                    />
                    <Line x1={j.b.x} y1={j.b.y} x2={j.c.x} y2={j.c.y} stroke={j.color} strokeWidth={2} />
                  </>
                ) : null}
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

const MOTION_PATH_COLOR = '#00BBFF'

function pointsToPath(pts: { x: number; y: number }[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
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
  /**
   * When `showDetailedPoseOverlay`: `full` = Your Pose + Pose Corrected + overlay legend;
   * `poseCorrected` = Pose Corrected pill only (e.g. generated correction clip);
   * `none` = no pills above the frame.
   */
  detailedChrome?: 'full' | 'poseCorrected' | 'none'
  /** Override scrub-dot visibility. Default: shown unless stacked without `showScrubDotsInStacked`. */
  showScrubDots?: boolean
  /** Play/scrub strip under the frame. Off for the Smart Focus preview. */
  showPlaybackControls?: boolean
  /** Start playing as soon as the clip is ready. */
  autoPlay?: boolean
  /** Landmark names to ring on the player. Empty shows the skeleton only. */
  highlightedLandmarks?: readonly string[]
  /** Degree arcs on the skeleton. Defaults to `showDetailedPoseOverlay`. */
  showJointAngles?: boolean
  /**
   * Draw the frame this much taller than its aspect and cover-crop it.
   * 1 keeps the existing contain/stretch fit used by the Poses player.
   */
  coverScale?: number
  /**
   * Smart Focus: stay paused, open on `startFraction`, and scrub time by dragging
   * across the picture. A drag the width of the frame moves `scrubSpanMs`.
   */
  interactiveScrub?: boolean
  /** 0–1 position to show first. Contact frame for Smart Focus. */
  startFraction?: number | null
  /** How much time one full-width drag covers, in milliseconds. */
  scrubSpanMs?: number
  /** Scale the frame toward `highlightedLandmarks`. 1 leaves the picture as it is. */
  focusScale?: number
  /** Parent scroll lock while a sideways drag is moving through the clip. */
  onScrubbingChange?: (active: boolean) => void
  /**
   * Only draw these angle arcs (ids from poseJointAngles, plus wrist ids and `TORSO_ANGLE_ID`).
   * Unset draws the default overlay set.
   */
  jointAngleIds?: readonly string[]
  /** Trace this landmark across the clip: faint for the whole shot, bright up to the current frame. */
  motionPathLandmark?: string | null
  /** Jump to a 0–1 position. Change `key` to repeat a jump to the same spot. */
  seekTo?: { fraction: number; key: number } | null
  /** Clip pixel size when the player can't report it (expo-av on web often doesn't). */
  naturalSizeHint?: { w: number; h: number } | null
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
  detailedChrome = 'full',
  showScrubDots,
  showPlaybackControls = true,
  autoPlay = false,
  highlightedLandmarks,
  showJointAngles,
  coverScale = 1,
  interactiveScrub = false,
  startFraction = null,
  scrubSpanMs = 2000,
  focusScale = 1,
  onScrubbingChange,
  jointAngleIds,
  motionPathLandmark = null,
  seekTo = null,
  naturalSizeHint = null,
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
  const positionRef = useRef(0)
  const durationRef = useRef(0)
  const scrubbingRef = useRef(false)
  const startAppliedRef = useRef(false)
  const startFractionRef = useRef(startFraction)
  const scrubSpanRef = useRef(scrubSpanMs)
  const widthRef = useRef(width)
  const onScrubbingChangeRef = useRef(onScrubbingChange)
  const interactiveScrubRef = useRef(interactiveScrub)
  const pendingSeekRef = useRef<number | null>(null)
  const lastSeekAtRef = useRef(0)
  const userMovedRef = useRef(false)
  const scrubOriginRef = useRef(0)
  const zoomScale = useRef(new Animated.Value(1)).current
  const zoomX = useRef(new Animated.Value(0)).current
  const zoomY = useRef(new Animated.Value(0)).current
  startFractionRef.current = startFraction
  scrubSpanRef.current = scrubSpanMs
  widthRef.current = width
  onScrubbingChangeRef.current = onScrubbingChange
  interactiveScrubRef.current = interactiveScrub

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
        encoded: encodedNatural ?? naturalSizeHint,
        container: naturalSize ?? naturalSizeHint,
        orientation: videoOrientation,
      }),
    [encodedNatural, naturalSize, videoOrientation, naturalSizeHint]
  )

  const videoH = useMemo(() => {
    // Full width × encoded buffer aspect (what CONTAIN paints). No orientation tall-box.
    const scale = coverScale > 1 ? coverScale : 1
    if (paintSize.w > 0 && paintSize.h > 0) {
      return Math.max(1, Math.ceil(width * (paintSize.h / paintSize.w) * scale))
    }
    return Math.max(1, Math.ceil(width * (9 / 16) * scale))
  }, [width, paintSize, coverScale])
  const overlayFit = coverScale > 1 ? 'cover' : 'fill'

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
    if (poseFrames.length && !userMovedRef.current) {
      const startFrame =
        startFraction != null && totalVidFrames > 0 ? startFraction * totalVidFrames : 0
      const first = nearestPoseByFrame(poseFrames, startFrame) ?? poseFrames[0]!
      lastSnapFrameRef.current = first.frame
      setActivePose(first)
    }
  }, [videoKey, poseFrames, startFraction, totalVidFrames])

  useEffect(() => {
    startAppliedRef.current = false
    userMovedRef.current = false
  }, [videoKey])

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
    if (s.durationMillis && s.durationMillis > 0) durationRef.current = s.durationMillis
    if (
      interactiveScrubRef.current &&
      !startAppliedRef.current &&
      s.durationMillis &&
      s.durationMillis > 0
    ) {
      startAppliedRef.current = true
      const frac = startFractionRef.current
      const ms =
        frac == null
          ? 0
          : Math.min(s.durationMillis - 1, Math.max(0, frac * s.durationMillis))
      positionRef.current = ms
      void videoRef.current?.setPositionAsync(ms).catch(() => {})
      void videoRef.current?.pauseAsync().catch(() => {})
      return
    }
    if (scrubbingRef.current) return
    positionRef.current = s.positionMillis ?? positionRef.current
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

  const [scrubbing, setScrubbing] = useState(false)

  const pushScrub = useCallback((ms: number) => {
    const dur = durationRef.current
    if (dur <= 0) return
    const clamped = Math.max(0, Math.min(Math.max(0, dur - 16), ms))
    positionRef.current = clamped
    const frames = poseFramesRef.current
    const tf = totalFramesRef.current
    if (frames.length && tf > 0) {
      const nearest = nearestPoseByFrame(frames, (clamped / dur) * tf)
      if (nearest && nearest.frame !== lastSnapFrameRef.current) {
        lastSnapFrameRef.current = nearest.frame
        setActivePose(nearest)
      }
    }
    const now = Date.now()
    if (now - lastSeekAtRef.current < 32) {
      pendingSeekRef.current = clamped
      return
    }
    lastSeekAtRef.current = now
    pendingSeekRef.current = null
    void videoRef.current?.setPositionAsync(clamped).catch(() => {})
  }, [])

  const flushScrub = useCallback(() => {
    const pending = pendingSeekRef.current
    pendingSeekRef.current = null
    if (pending == null) return
    lastSeekAtRef.current = Date.now()
    void videoRef.current?.setPositionAsync(pending).catch(() => {})
  }, [])

  const scrubPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.15,
      onPanResponderTerminationRequest: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderGrant: () => {
        scrubOriginRef.current = positionRef.current
        userMovedRef.current = true
        scrubbingRef.current = true
        setScrubbing(true)
        onScrubbingChangeRef.current?.(true)
        void videoRef.current?.pauseAsync().catch(() => {})
      },
      onPanResponderMove: (_, g) => {
        const span = scrubSpanRef.current
        const w = Math.max(1, widthRef.current)
        pushScrub(scrubOriginRef.current + (g.dx / w) * span)
      },
      onPanResponderRelease: () => {
        flushScrub()
        scrubbingRef.current = false
        setScrubbing(false)
        onScrubbingChangeRef.current?.(false)
      },
      onPanResponderTerminate: () => {
        flushScrub()
        scrubbingRef.current = false
        setScrubbing(false)
        onScrubbingChangeRef.current?.(false)
      },
    })
  ).current

  const estimatedVideoFrame = useMemo(() => {
    if (scrubbing && activePose) return activePose.frame
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
  }, [playback, totalVidFrames, activePose, scrubbing])

  const landmarksForPoseOverlay = useMemo(() => {
    if (!activePose?.landmarks) return null
    return activePose.landmarks
  }, [activePose])

  const focusPoint = useMemo(() => {
    if (focusScale <= 1 || !highlightedLandmarks?.length || !landmarksForPoseOverlay) return null
    let sx = 0
    let sy = 0
    let n = 0
    for (const name of highlightedLandmarks) {
      const pt = projectLmPx(name, landmarksForPoseOverlay, width, videoH, paintSize.w, paintSize.h, overlayFit)
      if (!pt) continue
      sx += pt.x
      sy += pt.y
      n += 1
    }
    if (!n) return null
    return { x: sx / n, y: sy / n }
  }, [focusScale, highlightedLandmarks, landmarksForPoseOverlay, width, videoH, paintSize, overlayFit])

  const angleIdsKey = jointAngleIds ? jointAngleIds.join('|') : null
  const focusKey = highlightedLandmarks?.join('|') ?? ''
  const focusKeyRef = useRef(focusKey)
  useEffect(() => {
    if (!interactiveScrub) return
    const selecting = focusKeyRef.current !== focusKey
    focusKeyRef.current = focusKey
    const scale = focusPoint ? focusScale : 1
    // Pull the joint a little toward the middle while it grows, then spring back on deselect.
    const pull = 0.32
    const tx = focusPoint ? (focusPoint.x - width / 2) * (1 - pull - scale) : 0
    const ty = focusPoint ? (focusPoint.y - videoH / 2) * (1 - pull - scale) : 0
    const motion = selecting
      ? { useNativeDriver: true as const, speed: 18, bounciness: 5 }
      : null
    if (motion) {
      Animated.spring(zoomScale, { ...motion, toValue: scale }).start()
      Animated.spring(zoomX, { ...motion, toValue: tx }).start()
      Animated.spring(zoomY, { ...motion, toValue: ty }).start()
      return
    }
    Animated.timing(zoomScale, { toValue: scale, duration: 80, useNativeDriver: true }).start()
    Animated.timing(zoomX, { toValue: tx, duration: 80, useNativeDriver: true }).start()
    Animated.timing(zoomY, { toValue: ty, duration: 80, useNativeDriver: true }).start()
  }, [interactiveScrub, focusPoint, focusScale, focusKey, width, videoH, zoomScale, zoomX, zoomY])

  useEffect(() => {
    return () => {
      if (scrubbingRef.current) onScrubbingChangeRef.current?.(false)
    }
  }, [])

  useEffect(() => {
    if (!(showJointAngles ?? showDetailedPoseOverlay) || !landmarksForPoseOverlay) {
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
        paintSize.h,
        overlayFit
      )
    const wanted = angleIdsKey == null ? null : angleIdsKey.split('|')
    const defs = wanted
      ? [...OVERLAY_JOINT_ANGLES, ...WRIST_JOINT_ANGLES, ...HEAD_JOINT_ANGLES, ...ANKLE_JOINT_ANGLES].filter((d) =>
          wanted.includes(d.id)
        )
      : OVERLAY_JOINT_ANGLES
    const raw = computeOverlayJointAngles(getPx, landmarksForPoseOverlay, undefined, defs)
    if (wanted?.includes(TORSO_ANGLE_ID)) {
      const lean = computeTrunkLean(getPx, landmarksForPoseOverlay)
      if (lean) raw.push(lean)
    }
    for (const side of ['LEFT', 'RIGHT'] as const) {
      if (!wanted?.includes(`${RACKET_ANGLE_ID}_${side}`)) continue
      const tilt = computeRacketTilt(getPx, landmarksForPoseOverlay, side)
      if (tilt) raw.push(tilt)
    }
    const next = raw.map((j) => {
      const smoothed = emaAngle(angleEmaRef.current[j.id], j.deg)
      if (smoothed != null) angleEmaRef.current[j.id] = smoothed
      return { ...j, deg: smoothed ?? j.deg }
    })
    setJointAngles(next)
  }, [showDetailedPoseOverlay, showJointAngles, landmarksForPoseOverlay, width, videoH, paintSize, overlayFit, angleIdsKey])

  const motionPathPoints = useMemo(() => {
    if (!motionPathLandmark) return null
    const pts: { frame: number; x: number; y: number }[] = []
    for (const row of poseFrames) {
      if (!landmarkVisOk(row.landmarks[motionPathLandmark])) continue
      const p = projectLmPx(motionPathLandmark, row.landmarks, width, videoH, paintSize.w, paintSize.h, overlayFit)
      if (p) pts.push({ frame: row.frame, x: p.x, y: p.y })
    }
    return pts.length > 1 ? pts : null
  }, [motionPathLandmark, poseFrames, width, videoH, paintSize, overlayFit])

  const seekKey = seekTo?.key
  useEffect(() => {
    if (seekKey == null || !seekTo) return
    const dur = durationRef.current
    if (dur <= 0) return
    userMovedRef.current = true
    pushScrub(seekTo.fraction * dur)
    flushScrub()
    // Only a new key asks for a jump.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekKey])

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
    const rect = projectBboxToOverlayRect(rb, {
      videoW: width,
      videoH,
      encodedNatural,
      naturalSize: paintSize,
      rotate: shouldRotateLandmarks,
    })
    if (overlayFit !== 'cover' || !rb || paintSize.w <= 0 || paintSize.h <= 0) return rect
    let [x1, y1, x2, y2] = rb
    if (shouldRotateLandmarks) {
      const rx1 = Math.min(y1, y2)
      const rx2 = Math.max(y1, y2)
      const ry1 = Math.min(1 - x1, 1 - x2)
      const ry2 = Math.max(1 - x1, 1 - x2)
      x1 = rx1
      x2 = rx2
      y1 = ry1
      y2 = ry2
    }
    return coverNormRect(x1, y1, x2, y2, width, videoH, paintSize.w, paintSize.h)
  }, [
    estimatedVideoFrame,
    poseFrames,
    activePose,
    encodedNatural,
    paintSize,
    shouldRotateLandmarks,
    width,
    videoH,
    overlayFit,
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
    const rect = projectBboxToOverlayRect(bb, {
      videoW: width,
      videoH,
      encodedNatural,
      naturalSize: paintSize,
      rotate: shouldRotateLandmarks,
    })
    if (overlayFit !== 'cover' || !bb || paintSize.w <= 0 || paintSize.h <= 0) return rect
    let [x1, y1, x2, y2] = bb
    if (shouldRotateLandmarks) {
      const rx1 = Math.min(y1, y2)
      const rx2 = Math.max(y1, y2)
      const ry1 = Math.min(1 - x1, 1 - x2)
      const ry2 = Math.max(1 - x1, 1 - x2)
      x1 = rx1
      x2 = rx2
      y1 = ry1
      y2 = ry2
    }
    return coverNormRect(x1, y1, x2, y2, width, videoH, paintSize.w, paintSize.h)
  }, [
    estimatedVideoFrame,
    poseFrames,
    activePose,
    encodedNatural,
    paintSize,
    shouldRotateLandmarks,
    width,
    videoH,
    overlayFit,
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
        scrubCatch: { ...StyleSheet.absoluteFillObject, zIndex: 4 },
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
        poseCorrectedOnlyPill: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: '#041028',
          borderWidth: 1.5,
          borderColor: 'rgba(0, 255, 166, 0.55)',
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
  const showScrubDotsUi =
    typeof showScrubDots === 'boolean'
      ? showScrubDots
      : !stacked || showScrubDotsInStacked
  const useUniformSkeleton = skeletonColorMode === 'uniform' || showDetailedPoseOverlay
  const chromeMode = showDetailedPoseOverlay ? detailedChrome : 'none'

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
      highlightedLandmarks={highlightedLandmarks}
      overlayFit={overlayFit}
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

  const chromeAboveVideo =
    chromeMode === 'full' ? (
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
    ) : chromeMode === 'poseCorrected' ? (
      <View style={[styles.chromeRow, { justifyContent: 'flex-end' }]} pointerEvents="box-none">
        <View style={styles.poseCorrectedOnlyPill} accessibilityState={{ disabled: true }}>
          <Text allowFontScaling={false} style={styles.poseCorrectedLabel}>
            {t('technique.poseCorrectedPill')}
          </Text>
        </View>
      </View>
    ) : null

  const videoPlayer = (
    <View style={[styles.videoBox, { width, height: videoH, overflow: interactiveScrub ? 'hidden' : 'visible' }]}>
      <Animated.View
        style={
          interactiveScrub
            ? {
                width,
                height: videoH,
                transform: [{ scale: zoomScale }, { translateX: zoomX }, { translateY: zoomY }],
              }
            : { width, height: videoH }
        }
      >
      <Video
        key={videoKey}
        ref={videoRef}
        source={{ uri: videoUri }}
        style={{ width, height: videoH }}
        resizeMode={
          overlayFit === 'cover'
            ? ResizeMode.COVER
            : encodedNatural
              ? ResizeMode.STRETCH
              : ResizeMode.CONTAIN
        }
        useNativeControls={false}
        shouldPlay={autoPlay && !interactiveScrub}
        isMuted={autoPlay || interactiveScrub}
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
        {motionPathPoints ? (
          <>
            <Path
              d={pointsToPath(motionPathPoints)}
              fill="none"
              stroke={MOTION_PATH_COLOR}
              strokeOpacity={0.3}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d={pointsToPath(motionPathPoints.filter((p) => p.frame <= estimatedVideoFrame))}
              fill="none"
              stroke={MOTION_PATH_COLOR}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}
        {poseOverlaySvg}
        {detectionRects}
      </Svg>
      </Animated.View>
      {interactiveScrub ? <View style={styles.scrubCatch} {...scrubPan.panHandlers} /> : null}
    </View>
  )

  const framedVideo =
    (showDetailedPoseOverlay || stacked) && overlayFit !== 'cover' ? (
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
        {showPlaybackControls ? (
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
        ) : null}
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
