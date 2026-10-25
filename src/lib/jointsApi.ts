import { useEffect, useState } from 'react'
import { authClient } from './auth-client'

export type ContactJoint = 'shoulder' | 'elbow' | 'wrist' | 'torso' | 'knee'
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

function toJoints(raw: unknown): ContactJoints | null {
  const body = ((raw as { data?: unknown })?.data ?? raw) as Record<string, unknown> | null
  const joints = body?.joints as ContactJoints['joints'] | undefined
  if (!body || !joints || typeof joints !== 'object' || !joints.elbow) return null
  return {
    shotLabel: typeof body.shotLabel === 'string' ? body.shotLabel : null,
    side: body.side === 'LEFT' ? 'LEFT' : 'RIGHT',
    hasPro: body.proSource != null,
    joints,
  }
}

/** Contact-frame joint angles for a saved shot; null until loaded or when the shot has no pose data. */
export function useContactJoints(analysisId: string | null | undefined): ContactJoints | null {
  const [state, setState] = useState<ContactJoints | null>(null)
  useEffect(() => {
    if (!analysisId) return
    let cancelled = false
    authClient
      .$fetch(`/technique/analysis/${analysisId}/joints`, { method: 'GET', headers: { Accept: 'application/json' } })
      .then((res) => {
        if (!cancelled) setState(toJoints(res))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [analysisId])
  return state
}
