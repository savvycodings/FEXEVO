import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av'
import * as FileSystem from 'expo-file-system/legacy'
import { useTranslation } from 'react-i18next'
import {
  buildCoachTraceSteps,
  clipThumbnail,
  type CoachTrace,
  type TraceStep,
} from '../components/CoachThinkingTrace'
import {
  fetchCoachContext,
  fetchCoachSpeech,
  sendCoachChat,
  transcribeCoachAudio,
  type CoachChatTurn,
} from './coachCharacterApi'

const FIRST_STEP_MS = 450
const STEP_MS = 700
/** Longest the trace waits on the shot step for its frame before moving on. */
const CLIP_WAIT_MS = 4000

export type CoachChatMessage = CoachChatTurn & {
  id: string
  trace?: CoachTrace
  thinking?: boolean
  animate?: boolean
  viaVoice?: boolean
  audioUri?: string
  audioLoading?: boolean
}

export type CoachPlayback = { id: string | null; playing: boolean; positionMs: number; durationMs: number }
export type CoachMicState = 'idle' | 'recording' | 'transcribing'

const IDLE_PLAYBACK: CoachPlayback = { id: null, playing: false, positionMs: 0, durationMs: 0 }

let messageSeq = 0
const nextId = () => `m${++messageSeq}`
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Speaker playback — Android defaults to earpiece without playThroughEarpieceAndroid: false. */
async function setPlaybackAudioMode() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
  })
}

async function setRecordingAudioMode() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    // Recording uses the mic route; reset to speaker again in setPlaybackAudioMode after.
    playThroughEarpieceAndroid: Platform.OS === 'android',
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
  })
}

type Options = {
  analysisId: string | null
  /** Local or remote clip for the focused shot; the trace falls back to the server's video URL. */
  videoUri: string | null
  /** False while the assistant is hidden: playback and recording stop. */
  active: boolean
  onFirstMessage?: () => void
}

/** Conversation, thinking trace reveal, reply voice and hold-to-talk for the coach assistant. */
export function useCoachChat({ analysisId, videoUri, active, onFirstMessage }: Options) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language || 'en').slice(0, 2)

  const [messages, setMessages] = useState<CoachChatMessage[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [muted, setMuted] = useState(false)
  const [micState, setMicState] = useState<CoachMicState>('idle')
  const [notice, setNotice] = useState<string | null>(null)
  const [playback, setPlayback] = useState<CoachPlayback>(IDLE_PLAYBACK)

  const soundRef = useRef<{ sound: Audio.Sound; id: string } | null>(null)
  const audioFilesRef = useRef(new Set<string>())
  const recordingRef = useRef<Audio.Recording | null>(null)
  const holdingRef = useRef(false)
  const voiceDraftRef = useRef<string | null>(null)
  const messagesRef = useRef(messages)
  const mutedRef = useRef(muted)
  const sentAnyRef = useRef(false)
  const activeRef = useRef(active)
  const mountedRef = useRef(true)
  const autoPlaySeqRef = useRef(0)
  messagesRef.current = messages
  mutedRef.current = muted
  activeRef.current = active

  const updateMessage = useCallback((id: string, patch: Partial<CoachChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }, [])

  const stopPlayback = useCallback(async () => {
    autoPlaySeqRef.current += 1
    const cur = soundRef.current
    soundRef.current = null
    if (mountedRef.current) setPlayback(IDLE_PLAYBACK)
    if (cur) await cur.sound.unloadAsync().catch(() => {})
  }, [])

  const playMessage = useCallback(async (id: string) => {
    const uri = messagesRef.current.find((m) => m.id === id)?.audioUri
    if (!uri) return
    const prev = soundRef.current
    soundRef.current = null
    if (prev) await prev.sound.unloadAsync().catch(() => {})
    try {
      await setPlaybackAudioMode().catch(() => {})
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, volume: 1, progressUpdateIntervalMillis: 200 }
      )
      if (!mountedRef.current || !activeRef.current) {
        await sound.unloadAsync().catch(() => {})
        return
      }
      soundRef.current = { sound, id }
      sound.setOnPlaybackStatusUpdate((status) => {
        if (soundRef.current?.sound !== sound || !mountedRef.current) return
        if (!status.isLoaded) return
        if (status.didJustFinish) {
          soundRef.current = null
          setPlayback(IDLE_PLAYBACK)
          void sound.unloadAsync().catch(() => {})
          return
        }
        setPlayback({
          id,
          playing: status.isPlaying,
          positionMs: status.positionMillis,
          durationMs: status.durationMillis ?? 0,
        })
      })
      await sound.setVolumeAsync(1).catch(() => {})
      await sound.playAsync()
    } catch (e) {
      console.warn('[CoachAssistant] playback failed', e)
    }
  }, [])

  const togglePlay = useCallback(
    async (id: string) => {
      const cur = soundRef.current
      if (cur && cur.id === id) {
        const status = await cur.sound.getStatusAsync().catch(() => null)
        if (status?.isLoaded && status.isPlaying) await cur.sound.pauseAsync().catch(() => {})
        else await cur.sound.playAsync().catch(() => {})
        return
      }
      autoPlaySeqRef.current += 1
      await playMessage(id)
    },
    [playMessage]
  )

  const loadSpeech = useCallback(
    async (id: string, text: string) => {
      const seq = ++autoPlaySeqRef.current
      updateMessage(id, { audioLoading: true })
      const audio = await fetchCoachSpeech(text, lang)
      if (!mountedRef.current) return
      if (!audio) {
        updateMessage(id, { audioLoading: false })
        return
      }
      const ext = audio.mimeType.includes('mpeg') ? 'mp3' : 'wav'
      const uri = `${FileSystem.cacheDirectory}coach-reply-${id}-${Date.now()}.${ext}`
      try {
        await FileSystem.writeAsStringAsync(uri, audio.audioBase64, { encoding: FileSystem.EncodingType.Base64 })
      } catch (e) {
        console.warn('[CoachAssistant] voice write failed', e)
        if (mountedRef.current) updateMessage(id, { audioLoading: false })
        return
      }
      if (!mountedRef.current) {
        void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})
        return
      }
      audioFilesRef.current.add(uri)
      messagesRef.current = messagesRef.current.map((m) => (m.id === id ? { ...m, audioUri: uri } : m))
      updateMessage(id, { audioUri: uri, audioLoading: false })
      if (seq === autoPlaySeqRef.current && !mutedRef.current && activeRef.current) {
        void playMessage(id)
      }
    },
    [updateMessage, playMessage, lang]
  )

  const stopRecording = useCallback(async (): Promise<string | null> => {
    const rec = recordingRef.current
    recordingRef.current = null
    if (!rec) return null
    try {
      await rec.stopAndUnloadAsync()
    } catch {
      /* already stopped */
    }
    await setPlaybackAudioMode().catch(() => {})
    return rec.getURI()
  }, [])

  useEffect(() => {
    if (active) return
    holdingRef.current = false
    void stopPlayback()
    void stopRecording()
    setMicState('idle')
  }, [active, stopPlayback, stopRecording])

  useEffect(() => {
    mountedRef.current = true
    const files = audioFilesRef.current
    return () => {
      mountedRef.current = false
      holdingRef.current = false
      void stopPlayback()
      void stopRecording()
      files.forEach((uri) => void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}))
      files.clear()
    }
  }, [stopPlayback, stopRecording])

  useEffect(() => {
    if (muted) void stopPlayback()
  }, [muted, stopPlayback])

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim()
      if (!text || pending) return
      if (!sentAnyRef.current) {
        sentAnyRef.current = true
        onFirstMessage?.()
      }
      const viaVoice = voiceDraftRef.current != null && text.includes(voiceDraftRef.current)
      voiceDraftRef.current = null
      const startedAt = Date.now()
      const userMsg: CoachChatMessage = { id: nextId(), role: 'user', content: text, viaVoice }
      const coachId = nextId()
      const history = [...messagesRef.current, userMsg]
        .filter((m) => m.content.trim().length > 0)
        .map(({ role, content }) => ({ role, content }))
      const firstStep: TraceStep = {
        id: 'question',
        icon: 'chatbubble-ellipses-outline',
        label: t('coachCharacter.trace.question'),
        status: 'active',
      }
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: coachId, role: 'assistant', content: '', thinking: true, trace: { steps: [firstStep], durationMs: null } },
      ])
      setInput('')
      setNotice(null)
      setPending(true)

      const replyPromise = sendCoachChat(history, analysisId, lang).then(
        (reply) => ({ ok: true as const, reply }),
        (error: unknown) => ({ ok: false as const, error })
      )
      try {
        const ctx = await fetchCoachContext(text, analysisId, lang)
        const steps = buildCoachTraceSteps(t, ctx, videoUri, lang)
        const clipSteps = new Map<number, Promise<unknown>>()
        steps.forEach((s, i) => {
          if (s.content?.type === 'video') clipSteps.set(i, clipThumbnail(s.content.uri))
        })
        for (let i = 0; i < steps.length; i++) {
          if (!mountedRef.current) return
          updateMessage(coachId, {
            trace: {
              steps: steps.map((s, j) => ({ ...s, status: j < i ? 'complete' : j === i ? 'active' : 'pending' })),
              durationMs: null,
            },
          })
          if (i < steps.length - 1) {
            const minDelay = sleep(i === 0 ? FIRST_STEP_MS : STEP_MS)
            const clip = clipSteps.get(i)
            await (clip ? Promise.all([minDelay, Promise.race([clip, sleep(CLIP_WAIT_MS)])]) : minDelay)
          }
        }
        const result = await replyPromise
        if (!mountedRef.current) return
        if (!result.ok || !result.reply) {
          console.warn('[CoachAssistant] chat failed', result.ok ? 'empty reply' : result.error)
          setMessages((prev) => prev.filter((m) => m.id !== coachId))
          setNotice(t('coachCharacter.errorReply'))
          return
        }
        updateMessage(coachId, {
          content: result.reply,
          thinking: false,
          animate: true,
          trace: {
            steps: steps.map((s) => ({ ...s, status: 'complete' })),
            durationMs: Date.now() - startedAt,
          },
        })
        void loadSpeech(coachId, result.reply)
      } catch (e) {
        console.warn('[CoachAssistant] send failed', e)
        if (!mountedRef.current) return
        setMessages((prev) => prev.filter((m) => m.id !== coachId))
        setNotice(t('coachCharacter.errorReply'))
      } finally {
        if (mountedRef.current) setPending(false)
      }
    },
    [input, pending, analysisId, lang, videoUri, onFirstMessage, updateMessage, loadSpeech, t]
  )

  const startHold = useCallback(async () => {
    if (micState !== 'idle' || pending) return
    holdingRef.current = true
    setNotice(null)
    try {
      const perm = await Audio.requestPermissionsAsync()
      if (!perm.granted) {
        setNotice(t('coachCharacter.micPermission'))
        return
      }
      if (!holdingRef.current) return
      await stopPlayback()
      await setRecordingAudioMode()
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      recordingRef.current = recording
      if (!holdingRef.current) {
        await stopRecording()
        return
      }
      setMicState('recording')
    } catch (e) {
      console.warn('[CoachAssistant] record start failed', e)
      await stopRecording()
      setMicState('idle')
    }
  }, [micState, pending, stopPlayback, stopRecording, t])

  const endHold = useCallback(async () => {
    holdingRef.current = false
    if (!recordingRef.current) return
    setMicState('transcribing')
    const uri = await stopRecording()
    try {
      if (!uri) throw new Error('no recording')
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
      void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})
      const text = await transcribeCoachAudio(b64, lang)
      if (!text) throw new Error('empty transcript')
      voiceDraftRef.current = text
      setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
    } catch (e) {
      console.warn('[CoachAssistant] transcribe failed', e)
      setNotice(t('coachCharacter.errorTranscribe'))
    } finally {
      if (mountedRef.current) setMicState('idle')
    }
  }, [stopRecording, lang, t])

  return {
    messages,
    input,
    setInput,
    pending,
    muted,
    setMuted,
    micState,
    notice,
    playback,
    send,
    togglePlay,
    startHold,
    endHold,
  }
}
