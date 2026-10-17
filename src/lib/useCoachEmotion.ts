import { useCallback, useEffect, useRef, useState } from 'react'
import {
  COACH_EMOTION_BEAT_MS,
  COACH_EMOTION_HOLD_MS,
  coachEmotionAfterSpeech,
  resolveCoachEmotion,
  type CoachEmotion,
} from './coachEmotions'

type Options = {
  /** Coach is waiting on a reply / trace. */
  thinking?: boolean
  /** Voice is currently playing. */
  speaking?: boolean
  /** Player is holding the mic / being heard. */
  listening?: boolean
  /** Bump to fire a one-shot (e.g. wink on entry). */
  entryToken?: number | string | null
  /** Emotion played when `entryToken` changes. Default wink. */
  entryEmotion?: Exclude<CoachEmotion, 'idle'>
  /** Latest coach reply text; used for a brief reaction after speech. */
  lastCoachText?: string | null
  /** Soft ambient winks while idle (chat pill). */
  idleLife?: boolean
}

/**
 * Chains mascot faces with human-ish beats:
 * entry wink → waiting → listen peek → thinking → talking → feedback reaction → waiting.
 */
export function useCoachEmotion({
  thinking = false,
  speaking = false,
  listening = false,
  entryToken = null,
  entryEmotion = 'wink',
  lastCoachText = null,
  idleLife = false,
}: Options) {
  const [oneShot, setOneShot] = useState<CoachEmotion | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const beatTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasSpeaking = useRef(false)
  const wasThinking = useRef(false)
  const lastEntry = useRef<number | string | null>(null)
  const lastReactedText = useRef<string | null>(null)

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    if (beatTimer.current) {
      clearTimeout(beatTimer.current)
      beatTimer.current = null
    }
  }, [])

  const playOneShot = useCallback(
    (emotion: Exclude<CoachEmotion, 'idle'>, holdMs?: number) => {
      clearHold()
      setOneShot(emotion)
      const hold = holdMs ?? COACH_EMOTION_HOLD_MS[emotion] ?? 1800
      holdTimer.current = setTimeout(() => {
        setOneShot(null)
        holdTimer.current = null
      }, hold)
    },
    [clearHold]
  )

  useEffect(() => {
    if (entryToken == null || entryToken === lastEntry.current) return
    lastEntry.current = entryToken
    playOneShot(entryEmotion)
  }, [entryToken, entryEmotion, playOneShot])

  // Brief curious peek when the player starts a turn (send / mic).
  useEffect(() => {
    if (thinking && !wasThinking.current && !speaking) {
      playOneShot('curious', COACH_EMOTION_BEAT_MS.listenPeek)
    }
    wasThinking.current = thinking
  }, [thinking, speaking, playOneShot])

  // After speech: one beat, then a reaction that fits the coach copy.
  useEffect(() => {
    if (wasSpeaking.current && !speaking && !thinking) {
      const text = lastCoachText
      if (text && text !== lastReactedText.current) {
        lastReactedText.current = text
        clearHold()
        beatTimer.current = setTimeout(() => {
          playOneShot(coachEmotionAfterSpeech(text))
        }, COACH_EMOTION_BEAT_MS.afterSpeech)
      }
    }
    wasSpeaking.current = speaking
  }, [speaking, thinking, lastCoachText, playOneShot, clearHold])

  // Soft life while waiting — an occasional wink, never during talk/think.
  useEffect(() => {
    if (!idleLife || thinking || speaking || listening || oneShot) return
    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      const wait =
        COACH_EMOTION_BEAT_MS.idleWinkMin +
        Math.floor(Math.random() * (COACH_EMOTION_BEAT_MS.idleWinkMax - COACH_EMOTION_BEAT_MS.idleWinkMin))
      timeout = setTimeout(() => {
        if (cancelled) return
        playOneShot('wink', 1400)
        // Next wink schedules after this one clears via the oneShot dependency cycle.
      }, wait)
    }

    schedule()
    return () => {
      cancelled = true
      if (timeout) clearTimeout(timeout)
    }
  }, [idleLife, thinking, speaking, listening, oneShot, playOneShot])

  useEffect(() => () => clearHold(), [clearHold])

  const emotion = resolveCoachEmotion({ speaking, thinking, listening, oneShot })

  return { emotion, playOneShot }
}
