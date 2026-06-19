import { useCallback, useEffect, useState } from 'react'
import {
  InteractionManager,
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { SvgXml } from 'react-native-svg'
import { Asset } from 'expo-asset'
import * as FileSystemLegacy from 'expo-file-system/legacy'

type LocalSvgAssetProps = {
  /** Metro `require('./file.svg')` module id */
  assetModule: number
  width: number
  height: number
  style?: StyleProp<ViewStyle>
  /** Replaces hex `fill="#..."` values in the SVG (e.g. selected tile icons). */
  fillColor?: string
  /** Replaces `stroke="..."` values in the SVG (e.g. disabled upload icon). */
  strokeColor?: string
}

const svgCache = new Map<number, string>()
const svgInflight = new Map<number, Promise<string | null>>()

function recolorSvgFill(xml: string, color: string): string {
  return xml.replace(/fill="(#[0-9A-Fa-f]{3,8})"/gi, `fill="${color}"`)
}

function recolorSvgStroke(xml: string, color: string): string {
  return xml.replace(/stroke="(#[0-9A-Fa-f]{3,8}|white)"/gi, `stroke="${color}"`)
}

function isValidSvg(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.includes('<svg') && trimmed.includes('</svg>')
}

async function readUriAsText(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri)
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
    return res.text()
  }

  try {
    return await FileSystemLegacy.readAsStringAsync(uri)
  } catch {
    const res = await fetch(uri)
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
    return res.text()
  }
}

async function loadSvgXml(assetModule: number, attempt = 0): Promise<string | null> {
  const cached = svgCache.get(assetModule)
  if (cached) return cached

  const inflight = svgInflight.get(assetModule)
  if (inflight) return inflight

  const task = (async () => {
    const maxAttempts = 3
    for (let i = attempt; i < maxAttempts; i++) {
      try {
        const asset = Asset.fromModule(assetModule)
        if (!asset.downloaded) {
          await asset.downloadAsync()
        }

        const candidates = [asset.localUri, asset.uri].filter(
          (uri): uri is string => typeof uri === 'string' && uri.length > 0
        )

        for (const uri of candidates) {
          try {
            const text = await readUriAsText(uri)
            if (isValidSvg(text)) {
              svgCache.set(assetModule, text)
              return text
            }
          } catch {
            // try next URI candidate
          }
        }
      } catch {
        // retry below
      }

      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 80 * (i + 1)))
      }
    }
    return null
  })()

  svgInflight.set(assetModule, task)
  try {
    return await task
  } finally {
    svgInflight.delete(assetModule)
  }
}

/** Warm the in-memory SVG cache (e.g. before a screen with many icons mounts). */
export function prefetchSvgAssets(modules: number[]): void {
  for (const mod of modules) {
    if (!svgCache.has(mod) && !svgInflight.has(mod)) {
      void loadSvgXml(mod)
    }
  }
}

/**
 * Renders a bundled SVG reliably on native + web. `SvgUri` + `Asset.fromModule().uri`
 * often shows nothing for larger / pattern-based SVGs; we load bytes and use `SvgXml`.
 */
export function LocalSvgAsset({
  assetModule,
  width,
  height,
  style,
  fillColor,
  strokeColor,
}: LocalSvgAssetProps) {
  const [xml, setXml] = useState<string | null>(() => svgCache.get(assetModule) ?? null)
  const [paintReady, setPaintReady] = useState(() => svgCache.has(assetModule))
  const [paintKey, setPaintKey] = useState(0)

  const applyXml = useCallback((text: string | null) => {
    if (!text) return
    setXml(text)
  }, [])

  useEffect(() => {
    let cancelled = false

    const cached = svgCache.get(assetModule)
    if (cached) {
      setXml(cached)
      setPaintReady(true)
      return
    }

    void loadSvgXml(assetModule).then((text) => {
      if (!cancelled && text) applyXml(text)
    })

    return () => {
      cancelled = true
    }
  }, [assetModule, applyXml])

  /** Retry once if the first load raced with asset bundling / focus transitions. */
  useEffect(() => {
    if (xml) return
    const retryId = setTimeout(() => {
      void loadSvgXml(assetModule).then((text) => {
        if (text) applyXml(text)
      })
    }, 400)
    return () => clearTimeout(retryId)
  }, [assetModule, xml, applyXml])

  useEffect(() => {
    if (!xml || paintReady) return

    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        setPaintReady(true)
        setPaintKey((k) => k + 1)
      })
    })
    return () => task.cancel()
  }, [xml, paintReady])

  const boxStyle = [{ width, height }, style]
  /** Android can flatten “leaf” views without a bitmap; SvgXml then disappears while layout stays tappable. */
  const noCollapse =
    Platform.OS === 'android'
      ? ({ collapsable: false, renderToHardwareTextureAndroid: true } as const)
      : {}

  let renderedXml = xml
  if (renderedXml && fillColor) renderedXml = recolorSvgFill(renderedXml, fillColor)
  if (renderedXml && strokeColor) renderedXml = recolorSvgStroke(renderedXml, strokeColor)

  if (!renderedXml || !paintReady) {
    return <View style={boxStyle} {...noCollapse} />
  }

  return (
    <View style={boxStyle} {...noCollapse}>
      <SvgXml key={`${assetModule}-${paintKey}`} xml={renderedXml} width={width} height={height} />
    </View>
  )
}
