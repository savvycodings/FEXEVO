import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { GestureDetector } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { GLOW_SURFACE, PrimaryFill, UI } from './ui'
import { type FrameView, useFrameZoomGesture, zoomedImageStyle } from './contactFrameZoom'
import { ZoomChips } from './ContactFrameZoomChips'

type Props = {
  /** Frame to open on. */
  initialIndex: number
  firstFrame: number
  lastFrame: number
  /** Width / height of the video picture. */
  aspect: number
  /** Decoded frame URI (from the grid's cache, decoding on demand). */
  getFrame: (index: number) => Promise<string>
  view: FrameView
  onViewChange: (v: FrameView) => void
  /** "Next": confirm `index` as the contact. */
  onUse: (index: number) => void
  onClose: () => void
  fonts: { regular?: string; medium?: string; semiBold?: string }
}

/** Design: 2px G2 border around the picture. */
const FRAME_BORDER = 2
const FRAME_RADIUS = 20
/**
 * Height taken by everything that isn't the picture: app header, tab bar, the chip row,
 * the frame stepper, Next and the gaps between them.
 */
const CHROME_H = 400

/**
 * The "Contact" step of Set Clip, shown in place of the Set Clip content (the app header and tab bar
 * stay): one frame with the shared zoom, ‹ › stepping through the trimmed clip, and Next to confirm it.
 */
export function ContactFrameViewer({
  initialIndex,
  firstFrame,
  lastFrame,
  aspect,
  getFrame,
  view,
  onViewChange,
  onUse,
  onClose,
  fonts,
}: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { height: winH } = useWindowDimensions()
  const [index, setIndex] = useState(initialIndex)
  const [uri, setUri] = useState<string | null>(null)
  const [boxW, setBoxW] = useState(0)

  useEffect(() => {
    let cancelled = false
    setUri(null)
    getFrame(index)
      .then((u) => !cancelled && setUri(u))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [index, getFrame])

  // Design: the frame is full content width; a tall picture is capped so Next stays on screen and covers the box.
  const maxH = Math.max(200, winH - insets.top - insets.bottom - CHROME_H)
  const innerW = Math.max(0, boxW - FRAME_BORDER * 2)
  const innerH = Math.min(maxH, innerW / aspect)
  const picW = Math.max(innerW, innerH * aspect)
  const picH = picW / aspect

  const gesture = useFrameZoomGesture({ view, onViewChange, width: picW, height: picH })

  return (
    <View style={styles.root} testID="contact-frame-viewer">
      <View style={styles.top}>
        <View style={styles.badge}>
          <Text allowFontScaling={false} style={[styles.badgeText, { fontFamily: fonts.medium }]}>
            {t('technique.contactLabel')}
          </Text>
        </View>
        <ZoomChips view={view} onViewChange={onViewChange} font={fonts.semiBold} testIDPrefix="contact-frame-viewer-zoom" />
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('technique.setClipScreen.closeViewer')}
          testID="contact-frame-viewer-close"
        >
          <Ionicons name="close" size={26} color="#86A7D2" />
        </TouchableOpacity>
      </View>

      <View style={styles.stage} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
        {innerW > 0 ? (
          <LinearGradient
            colors={UI.gradient}
            locations={UI.gradientLocations}
            start={UI.gradientStart}
            end={UI.gradientEnd}
            style={[styles.frame, { width: boxW, height: innerH + FRAME_BORDER * 2 }]}
          >
            <GestureDetector gesture={gesture}>
              <View style={[styles.picture, { width: innerW, height: innerH }]}>
                {uri ? (
                  <View
                    style={{ position: 'absolute', width: picW, height: picH, left: (innerW - picW) / 2, top: (innerH - picH) / 2 }}
                  >
                    <Image source={{ uri }} style={zoomedImageStyle(view, picW, picH)} resizeMode="stretch" />
                  </View>
                ) : (
                  <ActivityIndicator color={UI.accent} />
                )}
              </View>
            </GestureDetector>
          </LinearGradient>
        ) : null}
      </View>

      <View style={styles.stepRow}>
        <TouchableOpacity
          style={[styles.stepBtn, index <= firstFrame && styles.disabled]}
          onPress={() => setIndex((i) => Math.max(firstFrame, i - 1))}
          disabled={index <= firstFrame}
          accessibilityRole="button"
          accessibilityLabel={t('technique.setClipScreen.previousFrame')}
          testID="contact-frame-viewer-prev"
        >
          <Ionicons name="chevron-back" size={30} color="#86A7D2" />
        </TouchableOpacity>
        <Text allowFontScaling={false} style={[styles.frameText, { fontFamily: fonts.medium }]}>
          {t('technique.setClipScreen.frameN', { n: index })}
        </Text>
        <TouchableOpacity
          style={[styles.stepBtn, index >= lastFrame && styles.disabled]}
          onPress={() => setIndex((i) => Math.min(lastFrame, i + 1))}
          disabled={index >= lastFrame}
          accessibilityRole="button"
          accessibilityLabel={t('technique.setClipScreen.nextFrame')}
          testID="contact-frame-viewer-next"
        >
          <Ionicons name="chevron-forward" size={30} color="#86A7D2" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onUse(index)}
        accessibilityRole="button"
        testID="contact-frame-viewer-use"
        style={styles.useBtn}
      >
        <PrimaryFill radius={UI.btnRadius} />
        <Text allowFontScaling={false} style={[styles.useText, { fontFamily: fonts.semiBold }]}>
          {t('technique.setClipScreen.next')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: 20 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15 },
  badge: {
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 10,
    backgroundColor: '#4C8DF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 18, color: '#FFFFFF' },
  closeBtn: {
    width: 44,
    height: 44,
    /** Design: solid #041641, 1px #07256D, soft outer + inset blue glow. */
    borderRadius: 20,
    backgroundColor: '#041641',
    borderWidth: 1,
    borderColor: '#07256D',
    boxShadow: '0px 0px 15px 0px rgba(0, 72, 255, 0.25), 0px 0px 16px 0px rgba(0, 72, 255, 0.25) inset',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: { alignSelf: 'stretch' },
  frame: { borderRadius: FRAME_RADIUS, padding: FRAME_BORDER },
  picture: {
    overflow: 'hidden',
    borderRadius: FRAME_RADIUS - FRAME_BORDER,
    backgroundColor: '#0A1E5C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: {
    width: 54,
    height: 54,
    borderRadius: 20,
    ...GLOW_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
  frameText: { fontSize: 20, color: '#FFFFFF', textAlign: 'center' },
  useBtn: {
    height: UI.buttonHeight,
    borderRadius: UI.btnRadius,
    overflow: 'hidden',
    paddingHorizontal: UI.btnPaddingX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useText: { fontSize: 18, color: UI.btnPrimaryText },
})
