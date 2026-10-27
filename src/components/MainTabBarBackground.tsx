import { View, StyleSheet, Platform } from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'

const STROKE = 'rgba(61, 139, 255, 0.55)'
const INNER_GLOW = 'rgba(0, 102, 255, 0.5)'
const BOTTOM_GLOW = 'rgba(0, 82, 255, 0.35)'
const SIDE_GLOW = 'rgba(0, 82, 255, 0.18)'

/**
 * expo-blur uses intensity 0–100. “Strong” frosted bar — tune if you want subtler blur.
 */
const BLUR_INTENSITY = 90

/**
 * Backdrop blur + blue glow along the top edge, bottom and sides + top stroke for the main bottom tab bar.
 */
export function MainTabBarBackground() {
  return (
    <View style={styles.root} pointerEvents="none">
      {Platform.OS === 'web' ? (
        <View style={[styles.fill, styles.webFallback]} />
      ) : (
        <BlurView intensity={BLUR_INTENSITY} tint="dark" style={styles.fill} />
      )}
      {/* Slight base tint so icons stay readable over blur */}
      <View style={[styles.fill, styles.tint]} />
      {/* Inner shadow / glow along top inside edge */}
      <LinearGradient
        colors={[INNER_GLOW, 'transparent']}
        locations={[0, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.innerGlow}
      />
      {/* Blue glow rising from the bottom */}
      <LinearGradient
        colors={['transparent', BOTTOM_GLOW]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.bottomGlow}
      />
      {/* Faint side vignettes */}
      <LinearGradient
        colors={[SIDE_GLOW, 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.side, styles.sideLeft]}
      />
      <LinearGradient
        colors={['transparent', SIDE_GLOW]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.side, styles.sideRight]}
      />
      {/* Stroke */}
      <View style={styles.stroke} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  webFallback: {
    backgroundColor: 'rgba(3, 10, 23, 0.82)',
  },
  tint: {
    backgroundColor: 'rgba(3, 10, 23, 0.28)',
  },
  innerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
  },
  bottomGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  side: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 40,
  },
  sideLeft: { left: 0 },
  sideRight: { right: 0 },
  stroke: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: STROKE,
  },
})
