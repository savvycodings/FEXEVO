import React, { useEffect } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import type { StyleProp, ViewStyle } from 'react-native'
import { Platform } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

/**
 * Staggered "fly in" entrance used to make screens feel premium on load.
 * Each `EntranceView` fades + slides into place, delayed by its `index` so
 * components cascade according to their position on the page.
 */

export type EntranceDirection = 'up' | 'down'

const BASE_DELAY = 40
const STAGGER = 70
const FADE_DURATION = 460
const DEFAULT_DISTANCE = 30

const SPRING_CFG = {
  damping: 18,
  stiffness: 140,
  mass: 0.9,
} as const

type EntranceViewProps = {
  children: React.ReactNode
  /** Position in the cascade (0 = first). Higher values start later. */
  index?: number
  /** Direction the content travels from on the way in. */
  from?: EntranceDirection
  /** Travel distance in px before settling. */
  distance?: number
  /** Extra delay (ms) on top of the staggered delay. */
  delay?: number
  /**
   * When this value changes the animation replays from the start. Pair with
   * `usePageFocusKey()` to re-run the entrance every time a screen is focused.
   */
  replayKey?: number | string
  style?: StyleProp<ViewStyle>
}

export function EntranceView({
  children,
  index = 0,
  from = 'up',
  distance = DEFAULT_DISTANCE,
  delay = 0,
  replayKey,
  style,
}: EntranceViewProps) {
  const reducedMotion = useReducedMotion()
  const startOffset = from === 'up' ? distance : -distance

  const opacity = useSharedValue(reducedMotion ? 1 : 0)
  const translateY = useSharedValue(reducedMotion ? 0 : startOffset)

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 1
      translateY.value = 0
      return
    }

    const totalDelay = BASE_DELAY + index * STAGGER + delay

    cancelAnimation(opacity)
    cancelAnimation(translateY)
    opacity.value = 0
    translateY.value = startOffset

    opacity.value = withDelay(
      totalDelay,
      withTiming(1, { duration: FADE_DURATION, easing: Easing.out(Easing.cubic) })
    )
    translateY.value = withDelay(totalDelay, withSpring(0, SPRING_CFG))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey, reducedMotion, index, delay, startOffset])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  const androidCompositing =
    Platform.OS === 'android' ? ({ needsOffscreenAlphaCompositing: true } as const) : {}

  return (
    <Animated.View style={[style, animatedStyle, androidCompositing]}>{children}</Animated.View>
  )
}

type StaggerChildrenProps = {
  children: React.ReactNode
  /** Direction the content travels from on the way in. */
  from?: EntranceDirection
  /** Travel distance in px before settling. */
  distance?: number
  /** Stagger index to start counting from (useful when composing groups). */
  startIndex?: number
  /**
   * Replay trigger. Pair with `usePageFocusKey()` so the cascade re-runs each
   * time the screen is focused.
   */
  replayKey?: number | string
  /** When false, children render normally with no animation. */
  enabled?: boolean
}

/**
 * Wraps each direct child in an {@link EntranceView}, auto-assigning the stagger
 * index so a screen's top-level blocks cascade in on load. Drop it around the
 * content inside a ScrollView (or any column) to animate a whole page at once.
 */
export function StaggerChildren({
  children,
  from = 'up',
  distance,
  startIndex = 0,
  replayKey,
  enabled = true,
}: StaggerChildrenProps) {
  if (!enabled) return <>{children}</>

  const items = React.Children.toArray(children)
  return (
    <>
      {items.map((child, i) => (
        <EntranceView
          key={(React.isValidElement(child) && child.key) || `entrance-${i}`}
          index={startIndex + i}
          from={from}
          distance={distance}
          replayKey={replayKey}
        >
          {child}
        </EntranceView>
      ))}
    </>
  )
}

/**
 * Whole-page entrance wrapper. Used as a React Navigation `layout` so every
 * screen's content rises + fades in on focus, even screens that don't wire the
 * per-component cascade themselves.
 */
export function ScreenEntrance({
  children,
  from = 'up',
  distance = 22,
}: {
  children: React.ReactNode
  from?: EntranceDirection
  distance?: number
}) {
  const focusKey = usePageFocusKey()
  return (
    <EntranceView index={0} from={from} distance={distance} replayKey={focusKey} style={SCREEN_FILL}>
      {children}
    </EntranceView>
  )
}

const SCREEN_FILL = { flex: 1 } as const

/** React Navigation `layout` / `screenLayout` helper that applies {@link ScreenEntrance}. */
export function screenEntranceLayout(props: { children: React.ReactNode }) {
  return <ScreenEntrance>{props.children}</ScreenEntrance>
}

/**
 * Returns a key that increments each time the screen gains focus. Pass it to
 * `EntranceView`'s `replayKey` so the entrance animation replays on every visit
 * (useful for tab screens that stay mounted).
 */
export function usePageFocusKey(): number {
  const [key, setKey] = React.useState(0)
  useFocusEffect(
    React.useCallback(() => {
      setKey((k) => k + 1)
      return undefined
    }, [])
  )
  return key
}
