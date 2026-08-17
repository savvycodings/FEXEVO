import React, { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native'

const TICK_COUNT = 8

type Props = {
  size?: number
  color?: string
  style?: ViewStyle
}

/**
 * Segmented radial “dash” spinner (8 ticks with fading opacity), matching the
 * Analyzing chip art — not the platform ActivityIndicator ring.
 */
export function AnalyzingDashSpinner({
  size = 20,
  color = '#00B8FF',
  style,
}: Props) {
  const spin = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => {
      loop.stop()
      spin.setValue(0)
    }
  }, [spin])

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  const tickW = Math.max(2, Math.round(size * 0.12))
  const tickH = Math.max(5, Math.round(size * 0.32))

  return (
    <Animated.View
      style={[
        styles.wrap,
        { width: size, height: size, transform: [{ rotate }] },
        style,
      ]}
      accessibilityRole="progressbar"
    >
      {Array.from({ length: TICK_COUNT }, (_, i) => {
        const angle = (360 / TICK_COUNT) * i
        const opacity = 0.2 + (i / (TICK_COUNT - 1)) * 0.8
        return (
          <View
            key={i}
            style={[
              styles.spoke,
              {
                width: size,
                height: size,
                transform: [{ rotate: `${angle}deg` }],
              },
            ]}
          >
            <View
              style={{
                width: tickW,
                height: tickH,
                borderRadius: tickW,
                backgroundColor: color,
                opacity,
              }}
            />
          </View>
        )
      })}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spoke: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 1,
  },
})
