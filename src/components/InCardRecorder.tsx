import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native'
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera'
import Ionicons from '@expo/vector-icons/Ionicons'
import { TEST_IDS } from '../lib/testIds'
import { recorderStyles as styles, type InCardRecorderProps } from './inCardRecorderShared'

/**
 * Live camera preview that fills its box and starts recording as soon as the camera is ready
 * (the user already tapped Record before the shot stepper). The stop button ends the take.
 * Web uses `InCardRecorder.web.tsx` (MediaRecorder), since expo-camera can't record on web.
 */
export default function InCardRecorder({ style, maxDurationSec = 60, onRecorded, onUnavailable, onCancel }: InCardRecorderProps) {
  const cameraRef = useRef<CameraView>(null)
  const [camPerm, requestCamPerm] = useCameraPermissions()
  const [micPerm, requestMicPerm] = useMicrophonePermissions()
  const [ready, setReady] = useState(false)
  const [recording, setRecording] = useState(false)
  const requestedRef = useRef(false)
  const startedRef = useRef(false)
  const cancelledRef = useRef(false)
  const callbacks = useRef({ onRecorded, onUnavailable })
  callbacks.current = { onRecorded, onUnavailable }

  const cancel = () => {
    cancelledRef.current = true
    cameraRef.current?.stopRecording()
    onCancel()
  }

  useEffect(() => {
    if (!camPerm || !micPerm || requestedRef.current) return
    requestedRef.current = true
    ;(async () => {
      const cam = camPerm.granted ? camPerm : await requestCamPerm()
      const mic = micPerm.granted ? micPerm : await requestMicPerm()
      if (!cam.granted || !mic.granted) callbacks.current.onUnavailable('Camera or microphone permission denied')
    })()
  }, [camPerm, micPerm, requestCamPerm, requestMicPerm])

  useEffect(() => {
    if (!ready || startedRef.current || !cameraRef.current) return
    startedRef.current = true
    setRecording(true)
    cameraRef.current
      .recordAsync({ maxDuration: maxDurationSec })
      .then((video) => {
        setRecording(false)
        if (cancelledRef.current) return
        if (!video?.uri) return callbacks.current.onUnavailable('Recording produced no file')
        const isMov = /\.mov$/i.test(video.uri)
        callbacks.current.onRecorded(
          video.uri,
          isMov ? 'recording.mov' : 'recording.mp4',
          isMov ? 'video/quicktime' : 'video/mp4'
        )
      })
      .catch((err) => {
        setRecording(false)
        if (cancelledRef.current) return
        callbacks.current.onUnavailable(err instanceof Error ? err.message : 'Recording failed')
      })
  }, [ready, maxDurationSec])

  return (
    <View style={[styles.root, style]}>
      {camPerm?.granted && micPerm?.granted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="video"
          onCameraReady={() => setReady(true)}
          onMountError={(e) => callbacks.current.onUnavailable(e.message)}
        />
      ) : null}
      {!recording ? <ActivityIndicator style={styles.spinner} color="#fff" /> : null}
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={cancel}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Cancel recording"
        testID={TEST_IDS.techniqueCancelRecording}
      >
        <Ionicons name="close" size={24} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.stopButton}
        onPress={() => cameraRef.current?.stopRecording()}
        disabled={!recording}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Stop recording"
        testID={TEST_IDS.techniqueStopRecording}
      >
        <View style={styles.stopButtonInner} />
      </TouchableOpacity>
    </View>
  )
}
