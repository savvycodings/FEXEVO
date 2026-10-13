import React, { useEffect, useRef } from 'react'
import { Animated, Easing, type ImageStyle, type StyleProp } from 'react-native'
import { View } from 'react-native'
import {
  COACH_EYES_IMAGE,
  COACH_ORB_ASPECT,
  COACH_ORB_IMAGES,
  type CoachOrbVariant,
} from '../lib/coachCharacter'

/** Visible eye pair in the eyes asset; the rest of the 29.48 x 24.26 canvas is glow. */
const EYES_W = 12.44
const EYES_H = 7.22
const EYES_GLOW = 8.52

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

/** Tab-bar orb: the ball (not the glow) is centered in the shared icon slot. */
export function CoachTabOrb({ ballSize = 28 }: { ballSize?: number }) {
  const k = ballSize / TAB_ORB_BALL.d
  const w = TAB_ORB_CANVAS.w * k
  const h = TAB_ORB_CANVAS.h * k
  const ballCenterY = (TAB_ORB_BALL.y + TAB_ORB_BALL.d / 2) * k
  return (
    <View style={{ width: TAB_ICON_SLOT.width, height: TAB_ICON_SLOT.height, overflow: 'visible' }}>
      <Animated.Image
        source={COACH_ORB_IMAGES.tab}
        style={{
          position: 'absolute',
          width: w,
          height: h,
          left: (TAB_ICON_SLOT.width - w) / 2,
          top: TAB_ICON_SLOT.height / 2 - ballCenterY,
        }}
        resizeMode="contain"
      />
    </View>
  )
}

type CoachCharacterAvatarProps = {
  /** Rendered height; width follows the asset's aspect ratio. */
  size: number
  variant?: CoachOrbVariant
  /** Gentle breathing while the coach is working on an answer. */
  thinking?: boolean
  style?: StyleProp<ImageStyle>
}

export function CoachCharacterAvatar({ size, variant = 'full', thinking = false, style }: CoachCharacterAvatarProps) {
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!thinking) {
      pulse.stopAnimation()
      pulse.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [thinking, pulse])

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] })
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] })

  return (
    <Animated.Image
      source={COACH_ORB_IMAGES[variant]}
      style={[
        { width: size * COACH_ORB_ASPECT[variant], height: size, transform: [{ scale }], opacity },
        style,
      ]}
      resizeMode="contain"
    />
  )
}
