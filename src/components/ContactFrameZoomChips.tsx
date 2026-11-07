import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { type FrameView, FRAME_VIEW_RESET, ZOOM_STEPS, clampView, nearestZoomStep } from './contactFrameZoom'

type Props = {
  view: FrameView
  onViewChange: (v: FrameView) => void
  font?: string
  testIDPrefix: string
}

/** 1× 2× 3× segmented control; going back to 1× re-centers. */
export function ZoomChips({ view, onViewChange, font, testIDPrefix }: Props) {
  const { t } = useTranslation()
  const active = nearestZoomStep(view.zoom)
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {ZOOM_STEPS.map((z) => {
        const on = z === active
        return (
          <TouchableOpacity
            key={z}
            onPress={() => onViewChange(z === 1 ? FRAME_VIEW_RESET : clampView({ ...view, zoom: z }))}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t('technique.setClipScreen.zoomLevel', { n: z })}
            testID={`${testIDPrefix}-${z}`}
          >
            <Text allowFontScaling={false} style={[styles.txt, on && styles.txtOn, { fontFamily: font }]}>
              {`${z}×`}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  /** Design: 42pt track, 4px padding, 1px #07256D rim, radius 10, 20px between steps, soft outer + inset glow. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    padding: 4,
    gap: 20,
    borderRadius: 10,
    backgroundColor: '#041641',
    borderWidth: 1,
    borderColor: '#07256D',
    boxShadow: '0px 0px 15px 0px rgba(0, 72, 255, 0.25), 0px 0px 16px 0px rgba(0, 72, 255, 0.25) inset',
  },
  chip: { minWidth: 34, height: 34, paddingHorizontal: 4, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  /** Active step: solid #3E88F1, radius 10. */
  chipOn: { backgroundColor: '#3E88F1' },
  /** Design: #3E88F1, Inter 600 16px (white on the active step). */
  txt: { fontSize: 16, color: '#3E88F1' },
  txtOn: { color: '#FFFFFF' },
})
