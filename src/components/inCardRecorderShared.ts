import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'

export type InCardRecorderProps = {
  style?: StyleProp<ViewStyle>
  /** Seconds; recording stops on its own after this. */
  maxDurationSec?: number
  onRecorded: (uri: string, fileName: string, mimeType: string) => void
  /** Camera can't be used here (permission denied, no recording support) — caller falls back to the system picker. */
  onUnavailable: (reason: string) => void
  /** Close button: discard the take and go back. */
  onCancel: () => void
}

export const recorderStyles = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: '#000', justifyContent: 'center' },
  spinner: { alignSelf: 'center' },
  cancelButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(4,10,28,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(40,80,150,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButtonInner: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#E53935',
  },
})
