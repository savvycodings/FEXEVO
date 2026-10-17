import type { ImageSourcePropType } from 'react-native'

/**
 * Curated coach faces from `assets/GIFEMOJI`.
 * `idle` is the waiting loop — never a still PNG in the chat pill.
 */
export type CoachEmotion =
  | 'idle'
  | 'wink'
  | 'thinking'
  | 'talking'
  | 'happy'
  | 'joy'
  | 'curious'

export const COACH_EMOTION_SOURCES: Record<CoachEmotion, ImageSourcePropType> = {
  idle: require('../../assets/GIFEMOJI/24-Waiting.gif'),
  wink: require('../../assets/GIFEMOJI/17-Winking-Face.gif'),
  thinking: require('../../assets/GIFEMOJI/24-Waiting.gif'),
  talking: require('../../assets/GIFEMOJI/6-Face-with-Open-Mouth.gif'),
  happy: require('../../assets/GIFEMOJI/15-Smiling-Face.gif'),
  joy: require('../../assets/GIFEMOJI/9-Face-with-Tears-of-Joy.gif'),
  curious: require('../../assets/GIFEMOJI/7-Face-with-Raised-Eyebrow.gif'),
}

/** How long a one-shot face stays up before settling back to waiting. */
export const COACH_EMOTION_HOLD_MS: Partial<Record<CoachEmotion, number>> = {
  wink: 1600,
  happy: 2400,
  joy: 2800,
  curious: 1400,
}

/** Soft beats between state changes so faces don't slam. */
export const COACH_EMOTION_BEAT_MS = {
  /** Pause after speech before the reaction face. */
  afterSpeech: 280,
  /** Crossfade between two GIFs. */
  crossfade: 300,
  /** Brief curious peek when the player starts talking / sends. */
  listenPeek: 900,
  /** Idle life: min/max gap between ambient winks while waiting. */
  idleWinkMin: 12000,
  idleWinkMax: 20000,
} as const

const POSITIVE_RE =
  /\b(great|nice|awesome|excellent|well done|good job|love|proud|strong|solid|perfect|amazing|impressive|beautiful|clean|well played)\b/i
const JOY_RE = /\b(love|amazing|fantastic|incredible|brilliant|nail(ed)? it|crush(ed)?)\b/i
const CURIOUS_RE =
  /\b(try|consider|maybe|could|might|next|focus on|work on|watch|notice|look at|pay attention)\b/i
const TOUGH_RE = /\b(fix|issue|wrong|miss|off|error|problem|leak|late|early|weak)\b/i

/**
 * Pick a reaction face from the coach reply — small beats of personality, not random spam.
 */
export function coachEmotionAfterSpeech(
  text: string | null | undefined
): Exclude<CoachEmotion, 'idle' | 'thinking' | 'talking'> {
  if (!text) return 'happy'
  if (JOY_RE.test(text) || (POSITIVE_RE.test(text) && !TOUGH_RE.test(text))) return 'joy'
  if (POSITIVE_RE.test(text)) return 'happy'
  if (CURIOUS_RE.test(text) || TOUGH_RE.test(text)) return 'curious'
  return 'happy'
}

/**
 * Resolve what the mascot should show right now.
 * Speech wins; brief one-shots (peek / reaction) sit above thinking so timing feels human.
 */
export function resolveCoachEmotion(opts: {
  speaking?: boolean
  thinking?: boolean
  listening?: boolean
  oneShot?: CoachEmotion | null
}): CoachEmotion {
  if (opts.speaking) return 'talking'
  if (opts.oneShot && opts.oneShot !== 'idle') return opts.oneShot
  if (opts.thinking) return 'thinking'
  if (opts.listening) return 'curious'
  return 'idle'
}
