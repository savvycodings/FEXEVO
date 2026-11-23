import type { ReactNode } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
  type Edge,
} from 'react-native-safe-area-context'

const ALL_EDGES: readonly Edge[] = ['top', 'bottom', 'left', 'right']

type Props = {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  edges?: readonly Edge[]
}

/**
 * Safe-area shell for fullscreen video Modals.
 *
 * RN `Modal` opens a new native window where the root `SafeAreaProvider` can report
 * zero insets (back / close chrome then slides under the status bar). Re-providing
 * `initialWindowMetrics` keeps top/bottom insets reliable every time.
 */
export function FullscreenSafeArea({ children, style, edges = ALL_EDGES }: Props) {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SafeAreaView style={[styles.fill, style]} edges={edges as Edge[]}>
        {children}
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
