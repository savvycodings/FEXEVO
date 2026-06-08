import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Image,
  ActivityIndicator,
  StyleSheet,
  type ImageSourcePropType,
  type StyleProp,
  type ImageStyle,
  type ImageResizeMode,
} from 'react-native'

function sourceCacheKey(source: ImageSourcePropType): string {
  if (typeof source === 'number') return `asset-${source}`
  if (typeof source === 'object' && source !== null && !Array.isArray(source)) {
    const uri = (source as { uri?: unknown }).uri
    return typeof uri === 'string' ? uri : JSON.stringify(source)
  }
  return String(source)
}

export type CorrectionImageWithLoaderProps = {
  source: ImageSourcePropType
  style?: StyleProp<ImageStyle>
  resizeMode?: ImageResizeMode
  loaderColor?: string
  /** When false, image fades in without spinner (e.g. original frame). */
  showLoader?: boolean
}

/**
 * Remote correction frames can take a while; hide the bitmap until onLoad so a stale
 * or wrong cached frame is not mistaken for the generated image.
 */
export function CorrectionImageWithLoader({
  source,
  style,
  resizeMode = 'cover',
  loaderColor = '#00BBFF',
  showLoader = true,
}: CorrectionImageWithLoaderProps) {
  const cacheKey = useMemo(() => sourceCacheKey(source), [source])
  const isBundled = typeof source === 'number'
  const [loaded, setLoaded] = useState(isBundled)

  useEffect(() => {
    setLoaded(isBundled)
  }, [cacheKey, isBundled])

  const pending = showLoader && !loaded

  return (
    <View style={[style, styles.root]}>
      {pending ? (
        <View style={styles.loaderOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color={loaderColor} />
        </View>
      ) : null}
      <Image
        source={source}
        style={[StyleSheet.absoluteFill, loaded ? styles.imageVisible : styles.imageHidden]}
        resizeMode={resizeMode}
        onLoadStart={() => {
          if (!isBundled) setLoaded(false)
        }}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    backgroundColor: '#0A1330',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 8, 20, 0.88)',
    zIndex: 2,
  },
  imageVisible: {
    opacity: 1,
  },
  imageHidden: {
    opacity: 0,
  },
})
