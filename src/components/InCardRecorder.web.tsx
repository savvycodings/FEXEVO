import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, TouchableOpacity, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { TEST_IDS } from '../lib/testIds'
import { recorderStyles as styles, type InCardRecorderProps } from './inCardRecorderShared'

/** The backend only accepts mp4/mov, so only MP4 recording is used (Chrome 126+, Safari). */
const MP4_TYPES = ['video/mp4;codecs=avc1,mp4a', 'video/mp4']

/** Web version of `InCardRecorder`: getUserMedia preview + MediaRecorder. */
export default function InCardRecorder({ style, maxDurationSec = 60, onRecorded, onUnavailable, onCancel }: InCardRecorderProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const [recording, setRecording] = useState(false)
  const callbacks = useRef({ onRecorded, onUnavailable })
  callbacks.current = { onRecorded, onUnavailable }
  const cancelledRef = useRef(false)

  const cancel = () => {
    cancelledRef.current = true
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    onCancel()
  }

  useEffect(() => {
    let stream: MediaStream | null = null
    let stopTimer: ReturnType<typeof setTimeout> | null = null
    let disposed = false

    ;(async () => {
      const mimeType =
        typeof MediaRecorder !== 'undefined' ? MP4_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) : undefined
      if (!mimeType || !navigator.mediaDevices?.getUserMedia) {
        return callbacks.current.onUnavailable('This browser cannot record MP4 video')
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: true,
        })
      } catch (err) {
        return callbacks.current.onUnavailable(err instanceof Error ? err.message : 'Camera unavailable')
      }
      if (disposed) return stream.getTracks().forEach((t) => t.stop())

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }

      const chunks: Blob[] = []
      const recorder = new MediaRecorder(stream, { mimeType })
      recorderRef.current = recorder
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      recorder.onstop = () => {
        stream?.getTracks().forEach((t) => t.stop())
        if (disposed || cancelledRef.current) return
        setRecording(false)
        const blob = new Blob(chunks, { type: 'video/mp4' })
        if (blob.size === 0) return callbacks.current.onUnavailable('Recording produced no data')
        callbacks.current.onRecorded(URL.createObjectURL(blob), 'recording.mp4', 'video/mp4')
      }
      recorder.start(1000)
      setRecording(true)
      stopTimer = setTimeout(() => recorder.state === 'recording' && recorder.stop(), maxDurationSec * 1000)
    })()

    return () => {
      disposed = true
      if (stopTimer) clearTimeout(stopTimer)
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [maxDurationSec])

  return (
    <View style={[styles.root, style]}>
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
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
        onPress={() => recorderRef.current?.state === 'recording' && recorderRef.current.stop()}
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
