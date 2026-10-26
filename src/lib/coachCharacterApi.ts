import { authClient } from './auth-client'
import { DOMAIN } from '../../constants'

export function resolveCoachVideoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (/^(https?|file|content):/i.test(url)) return url
  return `${DOMAIN.replace(/\/+$/, '')}${url.startsWith('/') ? url : `/${url}`}`
}

export type CoachChatTurn = { role: 'user' | 'assistant'; content: string }

export type CoachAnalysisFacts = {
  analysisId: string
  source: 'selected' | 'latest' | 'compare_current' | 'compare_prior'
  shotName: string | null
  /** Server-relative (`/technique/video/:id`) or absolute; resolve with `resolveCoachVideoUrl`. */
  videoUrl: string | null
  score: number | null
  rating: string | null
  breakdown: { technique: number | null; outcome: number | null; tactics: number | null }
  focusArea: string | null
  strengths: string[]
  corrections: string[]
  technicalErrors?: string[]
  observations?: string[]
  diagnosis?: string | null
  measuredMotion?: string[]
  citeOk?: boolean
  proReference?: {
    label: string
    skillLevel: string | null
    distance: number | null
    trainSampleId: string | null
  } | null
  vsProJoints?: string[]
  createdAt: string
}

export type CoachDayFacts = {
  count: number
  averageScore: number | null
  bestScore: number | null
  sessions: Array<{ analysisId: string; score: number | null; focusArea: string | null; createdAt: string }>
}

export type CoachCompareFacts = {
  shotQuery: string
  priorLabel: string
  current: CoachAnalysisFacts | null
  prior: CoachAnalysisFacts | null
  missing: 'none' | 'current' | 'prior' | 'both'
}

export type CoachHistoryFacts = {
  intent: string
  windowLabel: string
  shotQuery: string | null
  theme: string | null
  sessions: Array<{
    analysisId: string
    shotName: string | null
    score: number | null
    createdAt: string
  }>
  notes: string[]
}

export type CoachContext = {
  kind: 'analysis' | 'day' | 'compare' | 'history' | 'none'
  analysis: CoachAnalysisFacts | null
  day: CoachDayFacts | null
  compare?: CoachCompareFacts | null
  history?: CoachHistoryFacts | null
}

type FetchResult<T> = { data?: T | null; error?: { status?: number; message?: string } | null }

const CONTEXT_TIMEOUT_MS = 25_000
const CHAT_TIMEOUT_MS = 75_000

async function post<T>(path: string, body: unknown, timeoutMs?: number): Promise<T> {
  const res = (await authClient.$fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    timeout: timeoutMs,
  })) as FetchResult<T>
  if (res?.error || !res?.data) {
    const err = new Error(res?.error?.message || `Request failed: ${path}`) as Error & {
      status?: number
    }
    err.status = res?.error?.status
    throw err
  }
  return res.data
}

function normalizeCoachContext(raw: CoachContext | null | undefined): CoachContext {
  if (!raw || typeof raw !== 'object') {
    return { kind: 'none', analysis: null, day: null, compare: null, history: null }
  }
  const kind =
    raw.kind === 'analysis' ||
    raw.kind === 'day' ||
    raw.kind === 'compare' ||
    raw.kind === 'history' ||
    raw.kind === 'none'
      ? raw.kind
      : 'none'
  return {
    kind,
    analysis: raw.analysis ?? null,
    day: raw.day ?? null,
    compare: raw.compare ?? null,
    history: raw.history ?? null,
  }
}

export async function fetchCoachContext(
  message: string,
  analysisId: string | null | undefined,
  locale: string
): Promise<CoachContext> {
  try {
    const data = await post<CoachContext>('/coach-character/context', {
      message,
      analysisId: analysisId ?? undefined,
      locale,
    }, CONTEXT_TIMEOUT_MS)
    return normalizeCoachContext(data)
  } catch {
    return { kind: 'none', analysis: null, day: null, compare: null, history: null }
  }
}

export async function sendCoachChat(
  messages: CoachChatTurn[],
  analysisId: string | null | undefined,
  locale: string
): Promise<string> {
  const data = await post<{ reply?: string }>('/coach-character/chat', {
    messages,
    analysisId: analysisId ?? undefined,
    locale,
  }, CHAT_TIMEOUT_MS)
  return String(data.reply ?? '').trim()
}

/** Returns null when the voice instance is offline so callers stay text-only. */
export async function fetchCoachSpeech(
  text: string,
  locale?: string
): Promise<{ audioBase64: string; mimeType: string } | null> {
  try {
    const data = await post<{ audioBase64?: string; mimeType?: string }>('/coach-character/speech', {
      text,
      locale: locale || undefined,
    })
    if (!data.audioBase64) {
      console.warn('[CoachAssistant] speech response missing audioBase64')
      return null
    }
    return { audioBase64: data.audioBase64, mimeType: data.mimeType || 'audio/wav' }
  } catch (e) {
    console.warn('[CoachAssistant] speech request failed (voice offline or network)', e)
    return null
  }
}

export async function transcribeCoachAudio(audioBase64: string, language?: string): Promise<string> {
  const data = await post<{ text?: string }>('/coach-character/transcribe', { audioBase64, language })
  return String(data.text ?? '').trim()
}
