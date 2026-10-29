import React, { useEffect, useId, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import MaskedView from '@react-native-masked-view/masked-view'
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgLinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg'
import {
  COACH_EYES_IMAGE,
  COACH_ORB_ASPECT,
  COACH_ORB_IMAGES,
  type CoachOrbVariant,
} from '../lib/coachCharacter'
import {
  COACH_EMOTION_BEAT_MS,
  COACH_EMOTION_SOURCES,
  type CoachEmotion,
} from '../lib/coachEmotions'

/** Visible eye pair in the eyes asset; the rest of the 29.48 x 24.26 canvas is glow. */
const EYES_W = 12.44
const EYES_H = 7.22
const EYES_GLOW = 8.52

/**
 * Soft radial fade so square GIF canvases don't show hard corners.
 * Stays fully opaque through most of the orb, then a light feather at the rim.
 */
function SoftOrbMask({ size, solidUntil = 0.84 }: { size: number; solidUntil?: number }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="softOrb" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          <Stop offset={`${Math.round(solidUntil * 100)}%`} stopColor="#FFFFFF" stopOpacity="1" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width={size} height={size} fill="url(#softOrb)" />
    </Svg>
  )
}

function FeatheredEmotionGif({
  emotion,
  size,
  recyclingKey,
  solidUntil = 0.84,
  style,
}: {
  emotion: CoachEmotion
  size: number
  recyclingKey: string
  solidUntil?: number
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Animated.View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <MaskedView
        style={{ width: size, height: size }}
        maskElement={<SoftOrbMask size={size} solidUntil={solidUntil} />}
      >
        <Image
          source={COACH_EMOTION_SOURCES[emotion]}
          style={{ width: size, height: size }}
          contentFit="contain"
          recyclingKey={recyclingKey}
          autoplay
        />
      </MaskedView>
    </Animated.View>
  )
}

/** The coach's eyes that lead each coach line; they blink while the coach is thinking. */
export function CoachEyes({ thinking = false, scale = 1 }: { thinking?: boolean; scale?: number }) {
  const blink = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (!thinking) {
      blink.stopAnimation()
      blink.setValue(1)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(blink, { toValue: 0.15, duration: 90, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 120, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [thinking, blink])
  const glow = EYES_GLOW * scale
  return (
    <View style={{ width: EYES_W * scale, height: EYES_H * scale }}>
      <Animated.Image
        source={COACH_EYES_IMAGE}
        style={{
          position: 'absolute',
          left: -glow,
          top: -glow,
          width: EYES_W * scale + glow * 2,
          height: EYES_H * scale + glow * 2,
          transform: [{ scaleY: blink }],
        }}
      />
    </View>
  )
}

/** Icon slot shared by every bottom-tab icon so labels sit on one baseline. */
export const TAB_ICON_SLOT = { width: 46, height: 30 } as const

/** Ball inside the 50.54 x 51.47 tab-orb canvas; the rest is glow and floor shadow. */
const TAB_ORB_CANVAS = { w: 50.5405, h: 51.4674 }
const TAB_ORB_BALL = { x: 7.21986, y: 5.74035, d: 36.1003 }

type CoachFaceProps = {
  size: number
  emotion?: CoachEmotion
  style?: StyleProp<ViewStyle | ImageStyle>
  faceAspect?: number
}

/**
 * Always a GIF — waiting loop by default, crossfades into expression faces.
 * No still PNG under the chat / score character.
 */
function CoachFace({ size, emotion = 'idle', style, faceAspect = 1 }: CoachFaceProps) {
  const width = size * faceAspect
  const [current, setCurrent] = useState<CoachEmotion>(emotion)
  const [outgoing, setOutgoing] = useState<CoachEmotion | null>(null)
  const incomingOp = useRef(new Animated.Value(1)).current
  const outgoingOp = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (emotion === current) return
    setOutgoing(current)
    setCurrent(emotion)
    incomingOp.setValue(0)
    outgoingOp.setValue(1)
    Animated.parallel([
      Animated.timing(incomingOp, {
        toValue: 1,
        duration: COACH_EMOTION_BEAT_MS.crossfade,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(outgoingOp, {
        toValue: 0,
        duration: COACH_EMOTION_BEAT_MS.crossfade,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setOutgoing(null)
    })
  }, [emotion, current, incomingOp, outgoingOp])

  return (
    <View style={[{ width, height: size }, style]}>
      {outgoing ? (
        <FeatheredEmotionGif
          emotion={outgoing}
          size={size}
          recyclingKey={`coach-out-${outgoing}`}
          style={{ position: 'absolute', opacity: outgoingOp }}
        />
      ) : null}
      <FeatheredEmotionGif
        emotion={current}
        size={size}
        recyclingKey={`coach-in-${current}`}
        style={{ position: 'absolute', opacity: incomingOp }}
      />
    </View>
  )
}

type CoachCharacterAvatarProps = {
  /** Rendered height; width follows the asset's aspect ratio. */
  size: number
  variant?: CoachOrbVariant
  /** Kept for call-site compat; waiting GIF already reads as “working”. */
  thinking?: boolean
  /** Active GIF face; idle = waiting loop. */
  emotion?: CoachEmotion
  style?: StyleProp<ViewStyle | ImageStyle>
}

export function CoachCharacterAvatar({
  size,
  variant = 'full',
  emotion = 'idle',
  style,
}: CoachCharacterAvatarProps) {
  return (
    <CoachFace size={size} emotion={emotion} style={style} faceAspect={COACH_ORB_ASPECT[variant]} />
  )
}

/** Tab-bar orb at its design size (36px ball, per Figma); still image only (no GIF faces). */
/**
 * Tab-bar ring around the orb: ball diameter, ring stroke and how far it rises above the other icons.
 * Lift 0 keeps the orb on the same line as the other icons, with ring + halo below the bar's top stroke.
 */
const TAB_ORB_RING = { ballD: 34, stroke: 2.5, gap: 1, lift: 0 } as const

export function CoachTabOrb({
  ballSize,
  ring = false,
}: {
  ballSize?: number
  /** Multicolor glowing ring + under-glow, used by the bottom tab bars. */
  ring?: boolean
}) {
  const d = ballSize ?? (ring ? TAB_ORB_RING.ballD : TAB_ORB_BALL.d)
  const k = d / TAB_ORB_BALL.d
  const w = TAB_ORB_CANVAS.w * k
  const h = TAB_ORB_CANVAS.h * k
  const ballCenterY = (TAB_ORB_BALL.y + TAB_ORB_BALL.d / 2) * k
  const ballCenterX = (TAB_ORB_BALL.x + TAB_ORB_BALL.d / 2) * k
  const lift = ring ? TAB_ORB_RING.lift : 0
  const cy = TAB_ICON_SLOT.height / 2 - lift
  const ringR = d / 2 + TAB_ORB_RING.gap + TAB_ORB_RING.stroke / 2
  // Halo fades out 3px past the ring, so the glow ends below the bar's top stroke (orb center sits 27px down).
  const box = (ringR + TAB_ORB_RING.stroke + 3) * 2
  // Per-instance ids: on web, SVG ids are document-wide, and the copy in a hidden tab bar would win.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const ids = { under: `tabOrbUnderGlow${uid}`, halo: `tabOrbHalo${uid}`, ring: `tabOrbRing${uid}` }
  return (
    <View style={{ width: TAB_ICON_SLOT.width, height: TAB_ICON_SLOT.height, overflow: 'visible' }}>
      {ring ? (
        <Svg
          pointerEvents="none"
          width={box}
          height={box}
          style={{ position: 'absolute', left: TAB_ICON_SLOT.width / 2 - box / 2, top: cy - box / 2 }}
        >
          <Defs>
            <RadialGradient id={ids.under} cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#1F6BFF" stopOpacity="0.75" />
              <Stop offset="1" stopColor="#1F6BFF" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={ids.halo} cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0.7" stopColor="#3D8BFF" stopOpacity="0.45" />
              <Stop offset="1" stopColor="#3D8BFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={box / 2} cy={box / 2} r={box / 2} fill={`url(#${ids.halo})`} />
          <Ellipse cx={box / 2} cy={box / 2 + ringR} rx={ringR * 0.9} ry={5} fill={`url(#${ids.under})`} />
        </Svg>
      ) : null}
      <Animated.Image
        source={COACH_ORB_IMAGES.tab}
        style={{
          position: 'absolute',
          width: w,
          height: h,
          left: TAB_ICON_SLOT.width / 2 - ballCenterX,
          top: cy - ballCenterY,
        }}
        resizeMode="contain"
      />
      {ring ? (
        <Svg
          pointerEvents="none"
          width={box}
          height={box}
          style={{ position: 'absolute', left: TAB_ICON_SLOT.width / 2 - box / 2, top: cy - box / 2 }}
        >
          <Defs>
            <SvgLinearGradient id={ids.ring} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#3DE0FF" />
              <Stop offset="0.3" stopColor="#FFFFFF" />
              <Stop offset="0.5" stopColor="#FFE45C" />
              <Stop offset="0.75" stopColor="#FF6FD8" />
              <Stop offset="1" stopColor="#7A5CFF" />
            </SvgLinearGradient>
          </Defs>
          <Circle
            cx={box / 2}
            cy={box / 2}
            r={ringR}
            stroke={`url(#${ids.ring})`}
            strokeWidth={TAB_ORB_RING.stroke}
            fill="none"
          />
        </Svg>
      ) : null}
    </View>
  )
}
