import { useEffect, useState } from 'react'
import { authClient } from './auth-client'

export type ContactJoint = 'shoulder' | 'elbow' | 'wrist' | 'torso' | 'knee'
/** Joint-detail pages. `feet` / `racket` are client-only (pose-derived); the /joints API does not return them. */
export type DetailJoint = ContactJoint | 'feet' | 'racket'
export type JointStatus = 'good' | 'warn' | 'bad'
export type JointDirection =
  | 'match'
  | 'more_flexed'
  | 'more_extended'
  | 'arm_lower'
  | 'arm_higher'
  | 'leaning_more'
  | 'more_upright'

/** One joint at ball contact: the player vs the matched pro, from GET /technique/analysis/:id/joints. */
export type JointReading = {
  you: number | null
  pro: number | null
  idealMin: number | null
  idealMax: number | null
  deltaDeg: number | null
  status: JointStatus | null
  direction: JointDirection | null
  messageKey: string | null
}

export type ContactJoints = {
  shotLabel: string | null
  /** Racket side, MediaPipe naming. */
  side: 'LEFT' | 'RIGHT'
  hasPro: boolean
  joints: Record<ContactJoint, JointReading>
}

const CONTACT_KEYS: ContactJoint[] = ['shoulder', 'elbow', 'wrist', 'torso', 'knee']

function toJoints(raw: unknown): ContactJoints | null {
  // better-auth $fetch may return the body directly or wrap it as `{ data }`.
  const outer = raw as { data?: unknown; error?: unknown } | null
  if (outer && typeof outer === 'object' && outer.error && outer.data == null) return null
  const body = (outer?.data ?? raw) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') return null
  const joints = body.joints as ContactJoints['joints'] | undefined
  if (!joints || typeof joints !== 'object') return null
  // Accept a partial payload — requiring only elbow dropped valid wrist/torso/racket rows.
  const hasAny = CONTACT_KEYS.some((k) => joints[k] != null && typeof joints[k] === 'object')
  if (!hasAny) return null
  return {
    shotLabel: typeof body.shotLabel === 'string' ? body.shotLabel : null,
    side: body.side === 'LEFT' ? 'LEFT' : 'RIGHT',
    hasPro: body.proSource != null,
    joints,
  }
}

/** Contact-frame joint angles for a saved shot; null until loaded or when the shot has no pose data. */
export function useContactJoints(analysisId: string | null | undefined, reloadKey = 0): ContactJoints | null {
  const [state, setState] = useState<ContactJoints | null>(null)
  useEffect(() => {
    if (!analysisId) {
      setState(null)
      return
    }
    let cancelled = false
    setState(null)

    const load = async (attempt: number) => {
      try {
        const res = await authClient.$fetch(`/technique/analysis/${analysisId}/joints`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        if (cancelled) return
        const parsed = toJoints(res)
        if (parsed) {
          setState(parsed)
          return
        }
      } catch {
        // Network / 409 pose-not-ready — retry below.
      }
      // Pose can lag the analysis row on Android (ngrok); retry a few times before giving up.
      if (!cancelled && attempt < 4) {
        await new Promise((r) => setTimeout(r, 700 * (attempt + 1)))
        if (!cancelled) await load(attempt + 1)
      }
    }

    void load(0)
    return () => {
      cancelled = true
    }
  }, [analysisId, reloadKey])
  return state
}
