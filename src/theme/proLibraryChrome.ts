import { Platform, type ViewStyle } from 'react-native'

/**
 * Shared “pro library” UI chrome: gradient frame + inner panel (matches View Results
 * category / level / shot rows in technique.tsx). Use with `ProLibraryGradientFrame`.
 */
export const proLibraryChrome = {
  radii: {
    frameOuter: 18,
    frameInner: 16,
    taxonomyChip: 22,
  },
  /** Padding between gradient stroke and inner fill (technique `retrievalMetaRowGradient`). */
  frameStrokeWidth: 1.5,
  gradientFrame: {
    colors: [
      '#006EFF',
      'rgba(0, 110, 255, 0)',
      '#006EFF',
      'rgba(0, 110, 255, 0)',
    ] as const,
    locations: [0, 0.33, 0.66, 1] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  /** Same diagonal sweep as `gradientFrame`, with product accent `#00B8FF` (e.g. stacked video border). */
  gradientFrameAccent: {
    colors: [
      '#00B8FF',
      'rgba(0, 184, 255, 0)',
      '#00B8FF',
      'rgba(0, 184, 255, 0)',
    ] as const,
    locations: [0, 0.33, 0.66, 1] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  innerPanelBackground: '#001435',
  /** technique `retrievalMetaLabel` */
  metaLabel: '#006FFF',
  accent: '#00B8FF',
  accentSoft: 'rgba(0, 184, 255, 0.35)',
  taxonomyChip: {
    inactiveBackground: '#0E1830',
    activeBackground: '#041641',
    inactiveBorder: 'rgba(0, 184, 255, 0.35)',
    activeBorder: '#00B8FF',
  },
} as const

/** Inner glow under the panel (technique `retrievalMetaRowInner`). */
export function proLibraryInnerPanelShadow(): ViewStyle {
  return (
    Platform.select({
      ios: {
        shadowColor: '#00BBFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      default: {},
    }) ?? {}
  )
}
