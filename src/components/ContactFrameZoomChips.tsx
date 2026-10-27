import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { PG } from '../screens/progress/progressTheme'
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
  row: {
    flexDirection: 'row',
    padding: 3,
    gap: 2,
    borderRadius: 12,
    backgroundColor: '#0A1E5C',
    borderWidth: 1,
    borderColor: PG.border,
  },
  chip: { minWidth: 40, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 9, alignItems: 'center' },
  chipOn: { backgroundColor: '#2A88F4' },
  txt: { fontSize: 14, color: PG.labelBlue },
  txtOn: { color: '#FFFFFF' },
})
