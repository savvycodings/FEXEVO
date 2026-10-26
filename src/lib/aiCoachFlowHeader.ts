import { useSyncExternalStore } from 'react'

/** True while the AI Coach tab is past its home page (picker, upload, Set Clip, results). */
let active = false
const listeners = new Set<() => void>()

export function setAiCoachFlowActive(next: boolean) {
  if (next === active) return
  active = next
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** main.tsx swaps the logo header for the profile header while this is true. */
export function useAiCoachFlowActive(): boolean {
  return useSyncExternalStore(subscribe, () => active, () => active)
}
