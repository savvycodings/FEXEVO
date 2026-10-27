import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LinearGradient } from 'expo-linear-gradient'
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { PG, glow } from '../screens/progress/progressTheme'
import { type FrameView, useFrameZoomGesture, zoomedImageStyle } from './contactFrameZoom'
import { ZoomChips } from './ContactFrameZoomChips'

type Props = {
  /** Frame to open on; null keeps the viewer closed. */
  openIndex: number | null
  contactFrame: number
  firstFrame: number
  lastFrame: number
  /** Width / height of the video picture. */
  aspect: number
  /** Decoded frame URI (from the grid's cache, decoding on demand). */
  getFrame: (index: number) => Promise<string>
  view: FrameView
  onViewChange: (v: FrameView) => void
  onUse: (index: number) => void
  onClose: () => void
  fonts: { regular?: string; medium?: string; semiBold?: string }
}

/** Space reserved above and below the picture for the header, stepper and button. */
const CHROME_H = 250

/**
 * Full-screen look at one contact frame, with the grid's shared zoom, ‹ › stepping through the
 * trimmed clip, and "Use this frame" to make it the contact.
 */
export function ContactFrameViewer({
  openIndex,
  contactFrame,
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
  const { width: winW, height: winH } = useWindowDimensions()
  const [index, setIndex] = useState(openIndex ?? contactFrame)
  const [uri, setUri] = useState<string | null>(null)

  useEffect(() => {
    if (openIndex != null) setIndex(openIndex)
  }, [openIndex])

  useEffect(() => {
    if (openIndex == null) return
    let cancelled = false
    setUri(null)
    getFrame(index)
      .then((u) => !cancelled && setUri(u))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [index, openIndex, getFrame])

  // Fit the picture in the space left after the controls, keeping its aspect.
  const maxW = winW - 32
  const maxH = Math.max(160, winH - insets.top - insets.bottom - CHROME_H)
  const boxW = Math.min(maxW, maxH * aspect)
  const boxH = boxW / aspect

  const gesture = useFrameZoomGesture({ view, onViewChange, width: boxW, height: boxH })

  const offset = index - contactFrame
  const label = offset === 0 ? t('technique.contactLabel') : offset > 0 ? `+${offset}` : `${offset}`

  return (
    <Modal visible={openIndex != null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root} testID="contact-frame-viewer">
        <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
          <View style={styles.badge}>
            <Text allowFontScaling={false} style={[styles.badgeText, { fontFamily: fonts.medium }]}>
              {label}
            </Text>
          </View>
          <ZoomChips view={view} onViewChange={onViewChange} font={fonts.medium} testIDPrefix="contact-frame-viewer-zoom" />
          <TouchableOpacity
            onPress={onClose}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('technique.setClipScreen.closeViewer')}
            testID="contact-frame-viewer-close"
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.stage}>
          <GestureDetector gesture={gesture}>
            <View style={[styles.picture, { width: boxW, height: boxH }]}>
              {uri ? (
                <Image source={{ uri }} style={zoomedImageStyle(view, boxW, boxH)} resizeMode="stretch" />
              ) : (
                <ActivityIndicator color={PG.labelBlue} />
              )}
            </View>
          </GestureDetector>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.stepRow}>
            <TouchableOpacity
              style={[styles.stepBtn, index <= firstFrame && styles.disabled]}
              onPress={() => setIndex((i) => Math.max(firstFrame, i - 1))}
              disabled={index <= firstFrame}
              accessibilityRole="button"
              accessibilityLabel={t('technique.setClipScreen.previousFrame')}
              testID="contact-frame-viewer-prev"
            >
              <Ionicons name="chevron-back" size={22} color={PG.labelBlue} />
            </TouchableOpacity>
            <Text allowFontScaling={false} style={[styles.frameText, { fontFamily: fonts.regular }]}>
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
              <Ionicons name="chevron-forward" size={22} color={PG.labelBlue} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onUse(index)}
            accessibilityRole="button"
            testID="contact-frame-viewer-use"
            style={[styles.useWrap, glow(14, 0.6)]}
          >
            <LinearGradient
              colors={['#5BB8FF', '#2C6BFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.useBtn}
            >
              <Text allowFontScaling={false} style={[styles.useText, { fontFamily: fonts.semiBold }]}>
                {t('technique.setClipScreen.useFrame')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020814' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#2A88F4' },
  badgeText: { fontSize: 14, color: '#FFFFFF' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  picture: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#0A1E5C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { paddingHorizontal: 16, gap: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A1E5C',
    borderWidth: 1.5,
    borderColor: PG.border,
  },
  disabled: { opacity: 0.35 },
  frameText: { fontSize: 14, color: PG.muted, minWidth: 90, textAlign: 'center' },
  useWrap: { borderRadius: 16 },
  useBtn: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  useText: { fontSize: 17, color: '#FFFFFF' },
})
