import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av'
import { ThemeContext } from '../../context'
import { GlowButton, SELECTED_GLOW, UI } from '../../components/ui'
import { useContactJoints } from '../../lib/jointsApi'
import { landmarkVisOk, poseAngle } from '../../lib/poseJointAngles'
import { nearestPoseByFrame, type LandmarkPoint, type PoseFrameRow } from '../../lib/techniquePose'
import { getThumbnailAsync } from '../../lib/videoThumbnails'

export type MistakeId = 'elbow' | 'racket' | 'torso' | 'foot'
/** Everything the list can show. Wrist and knee only appear when measured off target or named by the coach. */
type ItemId = MistakeId | 'wrist' | 'knee'
type Severity = 'high' | 'medium' | 'ok'

type Mistake = {
  id: ItemId
  /** i18n suffix: analysis.mistake{key}, …Body, …Why, …Problem, …ProblemBody. */
  key: string
  words: string[]
  /** Fallback marker spot when there is no pose. */
  marker: { left: `${number}%`; top: `${number}%` }
}

const MISTAKES: Mistake[] = [
  { id: 'elbow', key: 'Elbow', words: ['elbow', 'codo'], marker: { left: '38%', top: '30%' } },
  { id: 'racket', key: 'Racket', words: ['racket', 'raqueta', 'pala'], marker: { left: '46%', top: '22%' } },
  { id: 'wrist', key: 'Wrist', words: ['wrist', 'muñeca'], marker: { left: '42%', top: '38%' } },
  { id: 'torso', key: 'Torso', words: ['torso', 'rotation', 'rotación'], marker: { left: '52%', top: '48%' } },
  { id: 'knee', key: 'Knee', words: ['knee', 'rodilla'], marker: { left: '50%', top: '62%' } },
  { id: 'foot', key: 'Foot', words: ['foot', 'feet', 'pie'], marker: { left: '44%', top: '74%' } },
]

const SEVERITY: Record<Severity, { color: string; tint: string; text: string }> = {
  high: { color: '#E5482B', tint: 'rgba(229, 72, 43, 0.22)', text: '#FF8A70' },
  medium: { color: '#E8A928', tint: 'rgba(232, 169, 40, 0.22)', text: '#F2C25A' },
  ok: { color: '#34C759', tint: 'rgba(52, 199, 89, 0.2)', text: '#6EE08F' },
}
/** Items nothing was measured or said about: no pill, blue badge. */
const NEUTRAL = { color: UI.accentStrong, tint: 'rgba(47, 107, 255, 0.2)', text: UI.accent }
const SEVERITY_ORDER: (Severity | null)[] = ['high', 'medium', null, 'ok']

type Props = {
  videoUri: string | null
  videoKey: string
  /** For the server's pro-matched joint ranges (wrist, knee). */
  analysisId?: string | null
  poseFrames?: PoseFrameRow[]
  totalFrames?: number | null
  errors: string[]
  elbowDeg: number | null
  torsoDeg: number | null
  onClose: () => void
  /** Opens the Magic Shot of this shot done right; without it the button replays the clip. */
  onSeeCorrect?: () => void
  /** Contact frame and fps, for the strip thumbnails and the elbow distance. */
  impactFrame?: number | null
  fps?: number | null
}

/** Stage height over width, from the design (770 × 540). */
const STAGE_ASPECT = 0.7
const OFF = '#FF7A6B'
const GOOD = '#34C759'
/** Assumed shoulder-to-hip length, to turn the elbow gap into centimetres. */
const TORSO_CM = 50
const ELBOW_GAP_MIN_CM = 15

/** Where each joint sits in assets/smart3d/body.webp (0–1), for the stat-card art. */
const BODY_ART = require('../../../assets/smart3d/body.webp')
const BODY_ART_AR = 844 / 1024
const ART_SPOT: Record<'elbow' | 'shoulder' | 'torso' | 'wrist' | 'knee', { x: number; y: number }> = {
  elbow: { x: 0.392, y: 0.386 },
  wrist: { x: 0.346, y: 0.498 },
  knee: { x: 0.402, y: 0.685 },
  shoulder: { x: 0.436, y: 0.279 },
  torso: { x: 0.5, y: 0.42 },
}

function JointArt({ spot, size = 64 }: { spot: keyof typeof ART_SPOT; size?: number }) {
  const w = size * 6.5
  const h = w * BODY_ART_AR
  const p = ART_SPOT[spot]
  return (
    <View style={{ width: size, height: size, overflow: 'hidden', borderRadius: 12 }}>
      <Image
        source={BODY_ART}
        style={{ position: 'absolute', width: w, height: h, left: size / 2 - p.x * w, top: size / 2 - p.y * h }}
      />
    </View>
  )
}

/** Gap between the elbow and the shoulder–hip line, in cm, scaled by an assumed torso length. */
function elbowGapCm(row: PoseFrameRow | null, side: 'LEFT' | 'RIGHT', natW: number, natH: number): number | null {
  if (!row) return null
  const get = (n: string) => {
    const p = row.landmarks[n] as LandmarkPoint | undefined
    return landmarkVisOk(p) ? { x: p!.x * natW, y: p!.y * natH } : null
  }
  const sh = get(`${side}_SHOULDER`)
  const hip = get(`${side}_HIP`)
  const el = get(`${side}_ELBOW`)
  if (!sh || !hip || !el) return null
  const torso = Math.hypot(hip.x - sh.x, hip.y - sh.y)
  if (torso < 1) return null
  const cross = Math.abs((hip.x - sh.x) * (sh.y - el.y) - (sh.x - el.x) * (hip.y - sh.y))
  return (cross / torso / torso) * TORSO_CM
}

type Spot = { x: number; y: number } | null

/** Nudge markers that would overlap apart along the line between them, so every number stays readable. */
function spreadMarkers<K extends string>(spots: Record<K, Spot>): Record<K, Spot> {
  const keys = Object.keys(spots) as K[]
  const pts = keys.map((k) => (spots[k] ? { ...spots[k]! } : null))
  const min = MARKER + 4
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i]
        const b = pts[j]
        if (!a || !b) continue
        let dx = b.x - a.x
        let dy = b.y - a.y
        let d = Math.hypot(dx, dy)
        if (d >= min) continue
        if (d < 0.01) {
          dx = 1
          dy = 0
          d = 1
        }
        const push = (min - d) / 2
        a.x -= (dx / d) * push
        a.y -= (dy / d) * push
        b.x += (dx / d) * push
        b.y += (dy / d) * push
      }
    }
  }
  return Object.fromEntries(keys.map((k, i) => [k, pts[i]])) as Record<K, Spot>
}

function bodyCenter(row: PoseFrameRow | null): { x: number; y: number } {
  if (!row) return { x: 0.5, y: 0.5 }
  const pts = ['LEFT_HIP', 'RIGHT_HIP', 'LEFT_SHOULDER', 'RIGHT_SHOULDER']
    .map((n) => row.landmarks[n])
    .filter((p) => landmarkVisOk(p))
  if (!pts.length) return { x: 0.5, y: 0.5 }
  return {
    x: pts.reduce((a, p) => a + p!.x, 0) / pts.length,
    y: pts.reduce((a, p) => a + p!.y, 0) / pts.length,
  }
}

function racketSide(pose: PoseFrameRow): 'LEFT' | 'RIGHT' {
  if (pose.racket_hand === 'left') return 'LEFT'
  if (pose.racket_hand === 'right') return 'RIGHT'
  const box = normBox(pose.racket_bbox)
  const lw = pose.landmarks.LEFT_WRIST
  const rw = pose.landmarks.RIGHT_WRIST
  if (box && lw && rw) {
    const cx = (box[0] + box[2]) / 2
    return Math.abs(lw.x - cx) <= Math.abs(rw.x - cx) ? 'LEFT' : 'RIGHT'
  }
  return 'RIGHT'
}

function normBox(b: number[] | null | undefined): [number, number, number, number] | null {
  if (!b || b.length !== 4) return null
  const max = Math.max(b[0] ?? 0, b[1] ?? 0, b[2] ?? 0, b[3] ?? 0)
  const scale = max > 1.5 ? 10000 : 1
  const x1 = (b[0] ?? 0) / scale
  const y1 = (b[1] ?? 0) / scale
  const x2 = (b[2] ?? 0) / scale
  const y2 = (b[3] ?? 0) / scale
  if (![x1, y1, x2, y2].every((n) => Number.isFinite(n)) || x2 <= x1 || y2 <= y1) return null
  return [x1, y1, x2, y2]
}

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function matchError(errors: string[], words: string[]) {
  const hit = errors.find((line) => words.some((word) => line.toLowerCase().includes(word)))
  return hit?.trim() || null
}

/** Mistake ids, the ones the coach's error lines mention first, then the rest in the usual order. */
export function mistakeFocusOrder(errors: string[]): MistakeId[] {
  // Wrist drills live under racket, knee drills under foot.
  const focus = (id: ItemId): MistakeId => (id === 'wrist' ? 'racket' : id === 'knee' ? 'foot' : id)
  const all: MistakeId[] = ['elbow', 'racket', 'torso', 'foot']
  const hit = [...new Set(MISTAKES.filter((m) => matchError(errors, m.words)).map((m) => focus(m.id)))]
  return [...hit, ...all.filter((id) => !hit.includes(id))]
}

function rangeDiff(value: number, low: number, high: number) {
  if (value < low) return Math.round(value - low)
  if (value > high) return Math.round(value - high)
  return 0
}

type Stat = {
  label: string
  value: string
  color: string
  target: string
  diff: string
  diffOff: boolean
  art: keyof typeof ART_SPOT
}

type Item = {
  def: Mistake
  n: number
  severity: Severity | null
  /** Big number on the card, e.g. "32°"; null when nothing was measured. */
  value: string | null
  target: string | null
  matched: string | null
  /** Above the target range: picks the …High copy where there is one. */
  over: boolean
  stats: Stat[]
}

function severityOf(value: number | null, range: [number, number] | null, mentioned: boolean): Severity | null {
  if (value == null || !range) return mentioned ? 'high' : null
  const d = rangeDiff(value, range[0], range[1])
  if (d === 0) return mentioned ? 'medium' : 'ok'
  return mentioned || Math.abs(d) >= 15 ? 'high' : 'medium'
}

function colorsOf(severity: Severity | null) {
  return severity ? SEVERITY[severity] : NEUTRAL
}

export function BiggestMistakesView({
  videoUri,
  videoKey,
  analysisId = null,
  poseFrames,
  totalFrames,
  errors,
  elbowDeg,
  torsoDeg,
  onClose,
  onSeeCorrect,
  impactFrame = null,
  fps = null,
}: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const videoRef = useRef<Video>(null)
  const scrollRef = useRef<ScrollView>(null)
  const contact = useContactJoints(analysisId)
  /** Highlighted in the list. */
  const [selected, setSelected] = useState<ItemId | null>(null)
  /** Open in the detail screen. */
  const [openId, setOpenId] = useState<ItemId | null>(null)
  const [frameW, setFrameW] = useState(0)
  const [trackW, setTrackW] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [thumb, setThumb] = useState<string | null>(null)
  const frameH = frameW > 0 ? Math.round(frameW * STAGE_ASPECT) : 240
  const playProgress = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0
  const frameRate = fps && fps > 0 ? fps : 30
  const lastFrame = poseFrames?.length ? poseFrames.reduce((max, row) => Math.max(max, row.frame), 0) : 0
  const total = totalFrames && totalFrames > 1 ? totalFrames : lastFrame + 1
  const contactFrame = impactFrame ?? Math.round(lastFrame * 0.6)
  const contactPose = useMemo(
    () => (poseFrames?.length ? nearestPoseByFrame(poseFrames, contactFrame) : null),
    [poseFrames, contactFrame]
  )

  // Frame grab at contact: the strip thumbnail, and the clip's pixel size (expo-av on web doesn't report it).
  useEffect(() => {
    if (!videoUri) return
    let cancelled = false
    getThumbnailAsync(videoUri, { time: Math.round((contactFrame / frameRate) * 1000), quality: 0.6 })
      .then(({ uri, width, height }) => {
        if (cancelled) return
        setThumb(uri)
        if (width > 0 && height > 0) setNatural((prev) => prev ?? { w: width, h: height })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [videoUri, contactFrame, frameRate])

  const gapCm = useMemo(
    () => (contactPose && natural ? elbowGapCm(contactPose, racketSide(contactPose), natural.w, natural.h) : null),
    [contactPose, natural]
  )

  const items = useMemo<Item[]>(() => {
    const side = contactPose ? racketSide(contactPose) : 'RIGHT'
    const deg = (v: number) => `${Math.round(v)}°`
    const rangeText = (r: [number, number]) => t('analysis.mistakeTargetRange', { low: r[0], high: r[1] })
    const servedRange = (joint: 'wrist' | 'knee'): [number, number] | null => {
      const r = contact?.joints[joint]
      return r?.idealMin != null && r.idealMax != null ? [Math.round(r.idealMin), Math.round(r.idealMax)] : null
    }
    const angleStat = (label: string, v: number, r: [number, number], art: keyof typeof ART_SPOT): Stat => {
      const d = rangeDiff(v, r[0], r[1])
      return {
        label,
        value: deg(v),
        color: d === 0 ? GOOD : OFF,
        target: rangeText(r),
        diff: `${d > 0 ? '+' : ''}${d}°`,
        diffOff: d !== 0,
        art,
      }
    }
    const out: Omit<Item, 'n'>[] = []
    for (const def of MISTAKES) {
      const matched = matchError(errors, def.words)
      const mentioned = matched != null
      let v: number | null = null
      let range: [number, number] | null = null
      const stats: Stat[] = []
      if (def.id === 'elbow') {
        v = finite(elbowDeg) ?? finite(contact?.joints.elbow.you)
        range = [65, 95]
        if (v != null) stats.push(angleStat(t('analysis.elbowAngle'), v, range, 'elbow'))
        if (gapCm != null) {
          const d = gapCm < ELBOW_GAP_MIN_CM ? gapCm - ELBOW_GAP_MIN_CM : 0
          stats.push({
            label: t('analysis.mistakeDistance'),
            value: `${gapCm.toFixed(1)} cm`,
            color: UI.accent,
            target: t('analysis.mistakeDistanceTarget'),
            diff: `${d > 0 ? '+' : ''}${d.toFixed(1)} cm`,
            diffOff: d !== 0,
            art: 'shoulder',
          })
        }
      } else if (def.id === 'torso') {
        v = finite(torsoDeg)
        range = [20, 45]
        if (v != null) stats.push(angleStat(t('analysis.torsoRotation'), v, range, 'torso'))
      } else if (def.id === 'wrist' || def.id === 'knee') {
        v = finite(contact?.joints[def.id].you) ?? poseAngle(contactPose, def.id, side)
        range = servedRange(def.id)
        if (v != null && range) {
          stats.push(angleStat(t(`analysis.viewAnglesPage.reading.${def.id}`), v, range, def.id))
        }
        // Without a target we can't call it a mistake; show it only when the coach did.
        if (!range && !mentioned) continue
      } else if (!mentioned) {
        // Racket and feet aren't measured yet: listed only when the coach names them.
        continue
      }
      out.push({
        def,
        severity: severityOf(v, range, mentioned),
        value: v != null ? deg(v) : null,
        target: range ? rangeText(range) : null,
        matched,
        over: v != null && range != null && v > range[1],
        stats,
      })
    }
    out.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
    return out.map((item, i) => ({ ...item, n: i + 1 }))
  }, [errors, elbowDeg, torsoDeg, contact, contactPose, gapCm, t])

  const open = items.find((item) => item.def.id === openId) ?? null
  const highlight = open?.def.id ?? selected

  // Cover the stage by hand, centred on the player at contact. (expo-av's cover doesn't fill on web.)
  const clipAR = natural ? natural.h / natural.w : 16 / 9
  const panelW = frameW <= 0 ? 0 : clipAR >= STAGE_ASPECT ? frameW : frameH / clipAR
  const panelH = panelW * clipAR
  const center = useMemo(() => bodyCenter(contactPose), [contactPose])
  const offX = Math.max(-(panelW - frameW), Math.min(0, frameW / 2 - center.x * panelW))
  const offY = Math.max(-(panelH - frameH), Math.min(0, frameH / 2 - center.y * panelH))

  const markers = useMemo(() => {
    if (!poseFrames?.length || frameW <= 0 || duration <= 0) return null
    const pose = nearestPoseByFrame(poseFrames, Math.round((position / duration) * Math.max(0, total - 1)))
    if (!pose) return null
    const px = (x: number, y: number) => ({ x: x * panelW + offX, y: y * panelH + offY })
    const lm = (name: string) => {
      const p = pose.landmarks[name]
      if (!p || (p.visibility ?? 1) < 0.3) return null
      return px(p.x, p.y)
    }
    const box = normBox(pose.racket_bbox)
    const side = racketSide(pose)
    const mid = (names: string[]) => {
      const pts = names.map(lm).filter((p): p is { x: number; y: number } => p != null)
      if (!pts.length) return null
      return {
        x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
      }
    }
    const racket = box ? px((box[0] + box[2]) / 2, (box[1] + box[3]) / 2) : lm(`${side}_WRIST`)
    const leftFoot = lm('LEFT_ANKLE')
    const rightFoot = lm('RIGHT_ANKLE')
    const foot =
      leftFoot && rightFoot ? (leftFoot.y >= rightFoot.y ? leftFoot : rightFoot) : (leftFoot ?? rightFoot)
    return spreadMarkers<ItemId>({
      elbow: lm(`${side}_ELBOW`),
      racket,
      wrist: lm(`${side}_WRIST`),
      torso: mid(['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP']),
      knee: lm(`${side}_KNEE`),
      foot,
    })
  }, [poseFrames, total, position, duration, frameW, panelW, panelH, offX, offY])

  const back = () => {
    if (openId) {
      setOpenId(null)
      scrollRef.current?.scrollTo({ y: 0, animated: false })
    } else onClose()
  }
  const backRef = useRef(back)
  backRef.current = back
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      backRef.current()
      return true
    })
    return () => sub.remove()
  }, [])

  const openItem = (id: ItemId) => {
    setSelected(id)
    setOpenId(id)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }

  function onStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return
    setPosition(status.positionMillis)
    setDuration(status.durationMillis ?? 0)
    setPlaying(status.isPlaying)
  }

  function seekTrack(x: number) {
    if (duration <= 0 || trackW <= 0 || !Number.isFinite(x)) return
    const ms = Math.max(0, Math.min(duration, (x / trackW) * duration))
    setPosition(ms)
    void videoRef.current?.setPositionAsync(ms)
  }

  const contentW = frameW + 4
  const thumbW = contentW > 0 ? (contentW - STRIP_GAP * 3) / 4 : 80
  const openColors = colorsOf(open?.severity ?? null)
  const readout = open ? (open.stats[0] ?? null) : null

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.titleRow}>
        <Pressable
          testID="mistakes-back"
          accessibilityRole="button"
          accessibilityLabel={t('analysis.back')}
          hitSlop={12}
          onPress={back}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={28} color="#86A7D2" />
        </Pressable>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.title, { fontFamily: theme.boldFont ?? theme.semiBoldFont }]}
        >
          {open ? t(`analysis.mistake${open.def.key}`) : t('analysis.biggestMistakes')}
        </Text>
      </View>

      <View
        testID="mistakes-stage"
        style={[styles.frame, { height: frameH }]}
        onLayout={(event) => {
          const next = Math.floor(event.nativeEvent.layout.width) - 4
          setFrameW((prev) => (prev === next ? prev : next))
        }}
      >
        {videoUri && panelW > 0 ? (
          <Video
            key={videoKey}
            ref={videoRef}
            source={{ uri: videoUri }}
            style={{ position: 'absolute', left: offX, top: offY, width: panelW, height: panelH }}
            resizeMode={ResizeMode.STRETCH}
            onPlaybackStatusUpdate={onStatus}
            onReadyForDisplay={(event) => {
              const n = event?.naturalSize
              if (n?.width > 0 && n?.height > 0) setNatural({ w: n.width, h: n.height })
            }}
          />
        ) : null}
        {open
          ? readout || open.value ? (
              <View
                testID="mistake-readout"
                pointerEvents="none"
                style={[styles.readout, { borderColor: openColors.color, backgroundColor: 'rgba(40, 10, 8, 0.82)' }, open.severity !== 'high' && { backgroundColor: 'rgba(0, 20, 53, 0.85)' }]}
              >
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.readoutLabel, { fontFamily: theme.regularFont }]}>
                  {readout?.label ?? t(`analysis.mistake${open.def.key}`)}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[styles.readoutValue, { color: openColors.text, fontFamily: theme.mediumFont }]}
                >
                  {readout?.value ?? open.value}
                </Text>
              </View>
            ) : null
          : items.map((item) => {
              const spot = markers?.[item.def.id]
              return (
                <Pressable
                  key={item.def.id}
                  testID={`mistake-marker-${item.def.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={t(`analysis.mistake${item.def.key}`)}
                  onPress={() => setSelected(item.def.id)}
                  style={[
                    styles.marker,
                    spot
                      ? {
                          left: Math.max(4, Math.min(frameW - MARKER - 4, spot.x - MARKER / 2)),
                          // Stay clear of the play bar.
                          top: Math.max(4, Math.min(frameH - CONTROLS_H - MARKER, spot.y - MARKER / 2)),
                        }
                      : item.def.marker,
                    highlight === item.def.id && styles.markerOn,
                  ]}
                >
                  <View style={[styles.markerDot, { backgroundColor: colorsOf(item.severity).color }]}>
                    <Text allowFontScaling={false} style={[styles.markerNum, { fontFamily: theme.mediumFont }]}>
                      {item.n}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
        <Pressable
          style={styles.fullscreen}
          onPress={() => void videoRef.current?.presentFullscreenPlayer()}
          hitSlop={8}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="arrow-expand-all" size={16} color={UI.text} />
        </Pressable>
        <LinearGradient
          pointerEvents="box-none"
          colors={['rgba(20, 60, 200, 0)', 'rgba(20, 60, 200, 0.7)']}
          style={styles.controls}
        >
          <Pressable
            style={styles.play}
            accessibilityRole="button"
            onPress={() => {
              if (playing) void videoRef.current?.pauseAsync()
              else void videoRef.current?.playAsync()
            }}
          >
            <Ionicons name={playing ? 'pause' : 'play'} size={20} color={UI.text} style={playing ? null : styles.playIcon} />
          </Pressable>
          <View style={styles.trackHit} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
            <View style={styles.track}>
              <View style={[styles.trackFill, { width: `${playProgress * 100}%` }]} />
            </View>
            <View style={[styles.knob, { left: playProgress * Math.max(0, trackW - KNOB) }]} />
            <Pressable
              testID="mistakes-track"
              style={StyleSheet.absoluteFill}
              // Web clicks carry offsetX, not locationX.
              onPress={(e) => seekTrack(e.nativeEvent.locationX ?? (e.nativeEvent as { offsetX?: number }).offsetX ?? NaN)}
            />
          </View>
          <Text allowFontScaling={false} style={[styles.time, { fontFamily: theme.mediumFont }]}>
            {clock(position)}/{clock(duration)}
          </Text>
        </LinearGradient>
      </View>

      <ScrollView
        horizontal
        scrollEnabled={items.length > 4}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {items.map((item) => {
          const on = item.def.id === highlight
          return (
            <Pressable
              key={item.def.id}
              testID={`mistake-thumb-${item.def.id}`}
              style={[styles.thumbCol, { width: thumbW }, on && styles.thumbColOn]}
              onPress={() => (open ? openItem(item.def.id) : setSelected(item.def.id))}
            >
              <View style={[styles.thumb, on && styles.thumbOn, on && SELECTED_GLOW]}>
                {thumb ? <Image source={{ uri: thumb }} style={styles.thumbImg} resizeMode="cover" /> : null}
                <View style={[styles.thumbBadge, { backgroundColor: colorsOf(item.severity).color }]}>
                  <Text allowFontScaling={false} style={[styles.markerNum, { fontFamily: theme.mediumFont }]}>
                    {item.n}
                  </Text>
                </View>
              </View>
              <Text allowFontScaling={false} numberOfLines={2} style={[styles.thumbLabel, { fontFamily: theme.regularFont }]}>
                {t(`analysis.mistake${item.def.key}`)}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {open ? (
        <MistakeDetail item={open} />
      ) : (
        items.map((item) => (
          <MistakeCard
            key={item.def.id}
            item={item}
            on={item.def.id === selected}
            onPress={() => openItem(item.def.id)}
          />
        ))
      )}

      <GlowButton
        label={t('analysis.seeCorrectMovement')}
        onPress={onSeeCorrect ?? (() => void videoRef.current?.replayAsync())}
        testID="see-correct-movement"
        leadingIcon="play"
        arrow
      />
    </ScrollView>
  )
}

function finite(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) ? v : null
}

function SeverityPill({ severity, long = false }: { severity: Severity | null; long?: boolean }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  if (!severity) return null
  const c = SEVERITY[severity]
  const label = long
    ? t(severity === 'high' ? 'analysis.mistakeHighPriority' : severity === 'medium' ? 'analysis.mistakeMediumPriority' : 'analysis.mistakeOkPriority')
    : t(`analysis.mistakeSeverity.${severity}`)
  return (
    <View style={[styles.pill, { borderColor: c.color, backgroundColor: c.tint }]}>
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.pillText, { color: c.text, fontFamily: theme.regularFont }]}>
        {label}
      </Text>
    </View>
  )
}

function NumberBadge({ n, severity, size }: { n: number; severity: Severity | null; size: number }) {
  const { theme } = useContext(ThemeContext)
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colorsOf(severity).color },
      ]}
    >
      <Text allowFontScaling={false} style={[styles.badgeNum, { fontSize: size * 0.48, fontFamily: theme.mediumFont }]}>
        {n}
      </Text>
    </View>
  )
}

/** One row of the list: number, name, measured value against its target, severity. */
function MistakeCard({ item, on, onPress }: { item: Item; on: boolean; onPress: () => void }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const c = colorsOf(item.severity)
  return (
    <Pressable
      testID={`mistake-card-${item.def.id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, on && styles.cardOn]}
    >
      <NumberBadge n={item.n} severity={item.severity} size={40} />
      <View style={styles.cardCopy}>
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.cardTitle, { fontFamily: theme.regularFont }]}>
          {t(`analysis.mistake${item.def.key}`)}
        </Text>
        {item.value ? (
          <View style={styles.cardValueRow}>
            <Text allowFontScaling={false} style={[styles.cardValue, { color: c.text, fontFamily: theme.regularFont }]}>
              {item.value}
            </Text>
            {item.target ? (
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.cardTarget, { fontFamily: theme.regularFont }]}>
                {item.target}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text allowFontScaling={false} numberOfLines={2} style={[styles.cardNote, { fontFamily: theme.regularFont }]}>
            {item.matched ?? t(`analysis.mistake${item.def.key}Body`)}
          </Text>
        )}
      </View>
      <SeverityPill severity={item.severity} />
    </Pressable>
  )
}

/** The open mistake: what it is, the numbers, what goes wrong and why it matters. */
function MistakeDetail({ item }: { item: Item }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const k = item.def.key
  /** Copy for the direction the value is off, falling back to the default line. */
  const copy = (suffix: string) => {
    const base = t(`analysis.mistake${k}${suffix}`)
    return item.over ? t(`analysis.mistake${k}${suffix}High`, { defaultValue: base }) : base
  }
  return (
    <>
      <View testID={`mistake-detail-${item.def.id}`} style={styles.detail}>
        <View style={styles.detailHead}>
          <NumberBadge n={item.n} severity={item.severity} size={40} />
          <View style={styles.detailCopy}>
            <View style={styles.detailTitleRow}>
              <Text allowFontScaling={false} style={[styles.detailTitle, { fontFamily: theme.regularFont }]}>
                {t(`analysis.mistake${k}`)}
              </Text>
              <SeverityPill severity={item.severity} long />
            </View>
            <Text allowFontScaling={false} style={[styles.detailBody, { fontFamily: theme.regularFont }]}>
              {copy('Body')}
            </Text>
          </View>
        </View>
        {item.stats.length > 0 ? (
          <View style={styles.statRow}>
            {item.stats.map((stat) => (
              <View key={stat.label} style={styles.statCard}>
                <View style={styles.statCopy}>
                  <Text allowFontScaling={false} numberOfLines={2} style={[styles.statLabel, { fontFamily: theme.regularFont }]}>
                    {stat.label}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                    // adjustsFontSizeToFit does nothing on web; long values ("21.9 cm") step down by hand.
                    style={[styles.statValue, { color: stat.color, fontFamily: theme.mediumFont }, stat.value.length > 5 && styles.statValueLong]}
                  >
                    {stat.value}
                  </Text>
                  <Text allowFontScaling={false} style={[styles.statMeta, { fontFamily: theme.regularFont }]}>
                    {stat.target}
                  </Text>
                  <Text allowFontScaling={false} style={[styles.statMeta, { fontFamily: theme.regularFont }]}>
                    {t('analysis.mistakeDiffLabel')}
                    <Text style={{ color: stat.diffOff ? OFF : GOOD }}>{stat.diff}</Text>
                  </Text>
                </View>
                <JointArt spot={stat.art} size={item.stats.length > 1 ? 44 : 64} />
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.why}>
        <View style={[styles.whyIcon, { backgroundColor: SEVERITY.high.color }]}>
          <Ionicons name="close-circle-outline" size={24} color={UI.text} />
        </View>
        <View style={styles.whyCopy}>
          <Text allowFontScaling={false} style={[styles.whyTitle, { fontFamily: theme.regularFont }]}>
            {copy('Problem')}
          </Text>
          <Text allowFontScaling={false} style={[styles.whyBody, { fontFamily: theme.regularFont }]}>
            {item.matched ?? copy('ProblemBody')}
          </Text>
        </View>
      </View>

      <View style={styles.why}>
        <View style={styles.whyIcon}>
          <Ionicons name="bulb-outline" size={20} color={UI.accent} />
        </View>
        <View style={styles.whyCopy}>
          <Text allowFontScaling={false} style={[styles.whyTitle, { fontFamily: theme.regularFont }]}>
            {t('analysis.mistakeWhy')}
          </Text>
          <Text allowFontScaling={false} style={[styles.whyBody, { fontFamily: theme.regularFont }]}>
            {copy('Why')}
          </Text>
        </View>
      </View>
    </>
  )
}

const STRIP_GAP = 6

const MARKER = 30
const CONTROLS_H = 58
const KNOB = 16

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { padding: 2 },
  title: { color: UI.text, fontSize: 24, flex: 1 },
  frame: {
    borderRadius: UI.radiusCard,
    borderWidth: 2,
    borderColor: '#1F4BFF',
    overflow: 'hidden',
    backgroundColor: UI.cardBg,
  },
  marker: { position: 'absolute' },
  markerOn: { transform: [{ scale: 1.12 }] },
  markerDot: {
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerNum: { color: UI.text, fontSize: 14 },
  fullscreen: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 20, 53, 0.75)',
    borderWidth: 1.5,
    borderColor: UI.text,
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.cardBg,
    borderWidth: 2,
    borderColor: UI.text,
  },
  playIcon: { marginLeft: 2 },
  trackHit: { flex: 1, alignSelf: 'stretch', minWidth: 40, justifyContent: 'center' },
  track: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: UI.accentStrong, overflow: 'hidden' },
  trackFill: { height: 6, borderRadius: 3, backgroundColor: UI.text },
  knob: {
    position: 'absolute',
    top: '50%',
    marginTop: -KNOB / 2,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: UI.text,
  },
  time: { color: UI.text, fontSize: 13, minWidth: 62, textAlign: 'right' },
  readout: {
    position: 'absolute',
    left: 12,
    top: '32%',
    minWidth: 120,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  readoutLabel: { color: UI.text, fontSize: 13 },
  readoutValue: { fontSize: 28, lineHeight: 34 },
  strip: { flexDirection: 'row', gap: STRIP_GAP },
  thumbCol: { gap: 6, alignItems: 'center', borderRadius: 10, paddingBottom: 6 },
  thumbColOn: { backgroundColor: UI.surface },
  thumb: {
    alignSelf: 'stretch',
    aspectRatio: 1.25,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: UI.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbOn: { borderColor: UI.accent },
  thumbImg: { width: '100%', height: '100%' },
  thumbBadge: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLabel: { color: UI.text, fontSize: 11, lineHeight: 14, textAlign: 'center', letterSpacing: -0.2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: UI.radiusCard,
    borderWidth: 2,
    borderColor: '#1F3FC0',
    backgroundColor: '#050B1F',
    paddingHorizontal: 12,
    paddingVertical: 10,
    boxShadow: 'inset 0px 0px 14px rgba(47, 107, 255, 0.35)',
  },
  cardOn: { borderColor: UI.accent },
  cardCopy: { flex: 1, gap: 0 },
  cardTitle: { color: UI.text, fontSize: 17 },
  cardValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  cardValue: { fontSize: 26, lineHeight: 32 },
  cardTarget: { color: UI.text, fontSize: 12, flexShrink: 1 },
  cardNote: { color: UI.textMuted, fontSize: 12, lineHeight: 16, marginTop: 2 },
  pill: { borderRadius: UI.radiusPill, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 5 },
  pillText: { fontSize: 13 },
  badge: { alignItems: 'center', justifyContent: 'center' },
  badgeNum: { color: UI.text },
  detail: {
    borderRadius: UI.radiusCard,
    borderWidth: 1,
    borderColor: UI.trackBorder,
    paddingTop: 12,
    gap: 12,
    overflow: 'hidden',
  },
  detailHead: { flexDirection: 'row', gap: 12, paddingHorizontal: 10 },
  detailCopy: { flex: 1, gap: 4 },
  detailTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, minHeight: 40 },
  detailTitle: { color: UI.text, fontSize: 18, flex: 1, paddingTop: 6 },
  detailBody: { color: UI.textMuted, fontSize: 13, lineHeight: 17 },
  statRow: { flexDirection: 'row', gap: 6 },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: UI.radiusCard,
    borderWidth: 1,
    borderColor: UI.trackBorder,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 8,
  },
  statCopy: { flex: 1, gap: 1 },
  statLabel: { color: UI.text, fontSize: 12 },
  statValue: { fontSize: 26, lineHeight: 32 },
  statValueLong: { fontSize: 20 },
  statMeta: { color: UI.text, fontSize: 11, lineHeight: 14 },
  why: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: UI.radiusCard,
    borderWidth: 1,
    borderColor: UI.trackBorder,
    padding: 12,
  },
  whyIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.surface,
  },
  whyCopy: { flex: 1, gap: 4 },
  whyTitle: { color: UI.text, fontSize: 18 },
  whyBody: { color: UI.textMuted, fontSize: 13, lineHeight: 18 },
})
