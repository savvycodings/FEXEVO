import { useEffect, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import { authClient } from './auth-client'

/** Shared unread state for the header bell dot — `NotificationsScreen` keeps it in sync as items load / get read. */
let unreadIds = new Set<string>()
const listeners = new Set<() => void>()
let inFlight: Promise<void> | null = null

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getHasUnread() {
  return unreadIds.size > 0
}

/** Replace unread state from a `/profile/notifications` list. */
export function setUnreadFromNotifications(list: { id: string; readAt: string | null }[]) {
  unreadIds = new Set(list.filter((n) => !n.readAt).map((n) => n.id))
  emit()
}

export function markNotificationReadLocally(id: string) {
  if (!unreadIds.has(id)) return
  unreadIds = new Set(unreadIds)
  unreadIds.delete(id)
  emit()
}

export function refreshUnreadNotifications(): Promise<void> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const res = await authClient
        .$fetch('/profile/notifications', { method: 'GET', headers: { Accept: 'application/json' } })
        .catch(() => null)
      const body = ((res as { data?: unknown })?.data ?? res) as {
        notifications?: { id: string; readAt: string | null }[]
      }
      // Leave the current state alone on a failed request rather than flashing the dot off.
      if (Array.isArray(body?.notifications)) setUnreadFromNotifications(body.notifications)
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

/** True when at least one notification is unread. Refreshes on mount and when the app returns to foreground. */
export function useHasUnreadNotifications(enabled = true): boolean {
  useEffect(() => {
    if (!enabled) return
    void refreshUnreadNotifications()
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshUnreadNotifications()
    })
    return () => sub.remove()
  }, [enabled])
  return useSyncExternalStore(subscribe, getHasUnread, getHasUnread)
}
