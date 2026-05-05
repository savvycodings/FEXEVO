import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Video, ResizeMode, type AVPlaybackStatus, type AVPlaybackStatusSuccess } from 'expo-av'
import Ionicons from '@expo/vector-icons/Ionicons'
import Svg, { Line, Rect } from 'react-native-svg'
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
  projectLandmark,
  landmarkToContainPx,
  containerSizeFromNatural,
  landmarksNeedRotateForContainer,
  rotateLandmarksNormalized90CW,
  type LandmarkPoint,
  type PoseFrameRow,
} from '../lib/techniquePose'
import {
  techniqueQualityTone,
  type TechniqueQuality,
  type TechniqueQualityInput,
} from '../lib/technique-quality'
const VA = {
  good: '#34C759',
  wrong: '#FF2D55',
}

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

function PoseSkeletonLines({
  landmarks,
  boxW,
  boxH,
  naturalW,
  naturalH,
  goodColor,
  wrongColor,
  uniformStrokeColor,
  strokeWidth = 3,
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
}) {
  const hasNatural = naturalW != null && naturalH != null && naturalW > 0 && naturalH > 0
  return (
    <>
      {MEDIAPIPE_POSE_CONNECTIONS.map(([a, b]) => {
        const p1 = hasNatural
          ? landmarkToContainPx(a, landmarks, naturalW!, naturalH!, boxW, boxH)
          : projectLandmark(a, landmarks, boxW, boxH)
        const p2 = hasNatural
          ? landmarkToContainPx(b, landmarks, naturalW!, naturalH!, boxW, boxH)
          : projectLandmark(b, landmarks, boxW, boxH)
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
}: TechniqueAnalysisVideoPanelProps) {
  const { theme } = useContext(ThemeContext)
  const videoRef = useRef<Video>(null)
  const naturalFromPlayerRef = useRef(false)
  const [playback, setPlayback] = useState<AVPlaybackStatusSuccess | null>(null)
  const [encodedNatural, setEncodedNatural] = useState<{ w: number; h: number } | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [activePose, setActivePose] = useState<PoseFrameRow | null>(null)

  const applyExpoVideoNaturalSize = useCallback(
    (ns: { width: number; height: number; orientation?: 'portrait' | 'landscape' } | null | undefined) => {
      if (!ns || ns.width <= 0 || ns.height <= 0) return
      naturalFromPlayerRef.current = true
      setEncodedNatural({ w: ns.width, h: ns.height })
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
    if (techniqueQuality === 'good') return VA.good
    if (techniqueQuality === 'bad') return VA.wrong
    return 'rgba(255,255,255,0.42)'
  }, [techniqueQuality])

  const videoH = useMemo(() => {
    const arFromNatural =
      naturalSize && naturalSize.w > 0 && naturalSize.h > 0
        ? naturalSize.h / naturalSize.w
        : null
    const arFromEncoded =
      encodedNatural && encodedNatural.w > 0 && encodedNatural.h > 0
        ? encodedNatural.h / encodedNatural.w
        : null
    const ratio = arFromNatural ?? arFromEncoded ?? 9 / 16
    return Math.max(1, Math.ceil(width * ratio))
  }, [width, encodedNatural, naturalSize])

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
    setActivePose(null)
    setEncodedNatural(null)
    setNaturalSize(null)
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
    const lm = activePose.landmarks
    if (!encodedNatural || !naturalSize) return lm
    if (landmarksNeedRotateForContainer(encodedNatural, naturalSize)) {
      return rotateLandmarksNormalized90CW(lm)
    }
    return lm
  }, [activePose, encodedNatural, naturalSize])

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
    return projectBboxToOverlayRect(rb, { videoW: width, videoH, encodedNatural, naturalSize })
  }, [
    estimatedVideoFrame,
    poseFrames,
    activePose,
    encodedNatural,
    naturalSize,
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
    return projectBboxToOverlayRect(bb, { videoW: width, videoH, encodedNatural, naturalSize })
  }, [estimatedVideoFrame, poseFrames, activePose, encodedNatural, naturalSize, width, videoH])

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
        /** Only when stacked layout does not use ProLibraryGradientFrame (unused path). */
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
        videoBox: { position: 'relative', overflow: 'visible' },
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
        /** Reference: grey pill track, blue played segment, donut thumb (white ring + blue fill). */
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
        overlayLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        overlayLegendDot: { width: 8, height: 8, borderRadius: 4 },
        overlayLegendText: {
          fontFamily: theme.regularFont,
          fontSize: 12,
          color: 'rgba(255,255,255,0.7)',
        },
      }),
    [theme.regularFont]
  )

  /** Stacked shot UI: no Pose/Racket/Ball legend row. */
  const showLegendUi = showLegend && !stacked

  /** Stacked: fixed-width column so controls align to video edges but sit outside the black frame. */
  const innerColumnStyle = stacked
    ? ({ width, alignSelf: 'center' } as const)
    : ({ width: '100%' as const, alignSelf: 'stretch' as const })

  return (
    <View style={styles.videoBlockOuter} pointerEvents="box-none">
      <View style={innerColumnStyle} pointerEvents="box-none">
      <View
        style={[styles.videoSection, stacked ? styles.videoSectionStackedFrameOuter : undefined]}
        pointerEvents="box-none"
      >
        {stacked ? (
          <ProLibraryGradientFrame
            borderRadius={proLibraryChrome.radii.frameOuter}
            innerBorderRadius={proLibraryChrome.radii.frameInner}
            strokeWidth={STACKED_VIDEO_GRADIENT_STROKE}
            gradientVariant="accent"
            innerShadow={false}
            innerStyle={{ backgroundColor: '#000000', padding: 0, overflow: 'hidden' }}
            style={{ width: '100%' }}
          >
            <View style={styles.videoShell}>
              <View style={[styles.videoBox, { width, height: videoH }]}>
                <Video
                  key={videoKey}
                  ref={videoRef}
                  source={{ uri: videoUri }}
                  style={{ width, height: videoH }}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls={false}
                  isLooping={isLooping}
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
                  style={{ position: 'absolute', left: 0, top: 0, width, height: videoH }}
                  pointerEvents="none"
                >
                  {landmarksForPoseOverlay ? (
                    <PoseSkeletonLines
                      landmarks={landmarksForPoseOverlay}
                      boxW={width}
                      boxH={videoH}
                      naturalW={naturalSize?.w ?? null}
                      naturalH={naturalSize?.h ?? null}
                      goodColor={VA.good}
                      wrongColor={VA.wrong}
                      uniformStrokeColor={skeletonUniformColor}
                      strokeWidth={lineStrokeW}
                    />
                  ) : null}
                  {racketOverlayBox ? (
                    <Rect
                      x={racketOverlayBox.x}
                      y={racketOverlayBox.y}
                      width={racketOverlayBox.w}
                      height={racketOverlayBox.h}
                      fill="transparent"
                      stroke="#FFD400"
                      strokeWidth={Math.max(1.4, lineStrokeW * 0.75)}
                      strokeOpacity={0.95}
                    />
                  ) : null}
                  {ballOverlayBox ? (
                    <Rect
                      x={ballOverlayBox.x}
                      y={ballOverlayBox.y}
                      width={ballOverlayBox.w}
                      height={ballOverlayBox.h}
                      fill="transparent"
                      stroke="#00E5FF"
                      strokeWidth={Math.max(1.2, lineStrokeW * 0.6)}
                      strokeOpacity={0.95}
                    />
                  ) : null}
                </Svg>
              </View>
            </View>
          </ProLibraryGradientFrame>
        ) : (
          <>
            <View style={styles.videoShell}>
              <View style={[styles.videoBox, { width, height: videoH }]}>
                <Video
                  key={videoKey}
                  ref={videoRef}
                  source={{ uri: videoUri }}
                  style={{ width, height: videoH }}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls={false}
                  isLooping={isLooping}
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
                  style={{ position: 'absolute', left: 0, top: 0, width, height: videoH }}
                  pointerEvents="none"
                >
                  {landmarksForPoseOverlay ? (
                    <PoseSkeletonLines
                      landmarks={landmarksForPoseOverlay}
                      boxW={width}
                      boxH={videoH}
                      naturalW={naturalSize?.w ?? null}
                      naturalH={naturalSize?.h ?? null}
                      goodColor={VA.good}
                      wrongColor={VA.wrong}
                      uniformStrokeColor={skeletonUniformColor}
                      strokeWidth={lineStrokeW}
                    />
                  ) : null}
                  {racketOverlayBox ? (
                    <Rect
                      x={racketOverlayBox.x}
                      y={racketOverlayBox.y}
                      width={racketOverlayBox.w}
                      height={racketOverlayBox.h}
                      fill="transparent"
                      stroke="#FFD400"
                      strokeWidth={Math.max(1.4, lineStrokeW * 0.75)}
                      strokeOpacity={0.95}
                    />
                  ) : null}
                  {ballOverlayBox ? (
                    <Rect
                      x={ballOverlayBox.x}
                      y={ballOverlayBox.y}
                      width={ballOverlayBox.w}
                      height={ballOverlayBox.h}
                      fill="transparent"
                      stroke="#00E5FF"
                      strokeWidth={Math.max(1.2, lineStrokeW * 0.6)}
                      strokeOpacity={0.95}
                    />
                  ) : null}
                </Svg>
              </View>
            </View>
          </>
        )}
      </View>
      <View style={[styles.controlsStrip, stacked && styles.controlsStripStacked]}>
        <TouchableOpacity style={styles.playHit} onPress={togglePlay} hitSlop={12}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={stacked ? 20 : 22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={stacked ? styles.trackWrapStacked : styles.trackWrap}>
          <View style={[styles.trackBg, stacked && styles.trackBgStacked]}>
            <View
              style={[
                stacked ? styles.trackFillStacked : styles.trackFill,
                { width: `${progress * 100}%` },
                stacked &&
                  progress >= 0.998 && {
                    borderTopRightRadius: 3,
                    borderBottomRightRadius: 3,
                  },
              ]}
            />
            {!stacked &&
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
                stacked ? styles.scrubThumbStacked : styles.scrubThumb,
                { left: `${progress * 100}%` },
              ]}
            />
          </View>
        </View>
      </View>
      {showLegendUi ? (
        <View style={styles.overlayLegendRow}>
          <View style={styles.overlayLegendItem}>
            <View style={[styles.overlayLegendDot, { backgroundColor: skeletonUniformColor }]} />
            <Text allowFontScaling={false} style={styles.overlayLegendText}>
              Pose
            </Text>
          </View>
          <View style={styles.overlayLegendItem}>
            <View style={[styles.overlayLegendDot, { backgroundColor: '#FFD400' }]} />
            <Text allowFontScaling={false} style={styles.overlayLegendText}>
              Racket
            </Text>
          </View>
          <View style={styles.overlayLegendItem}>
            <View style={[styles.overlayLegendDot, { backgroundColor: '#00E5FF' }]} />
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
