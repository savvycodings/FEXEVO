import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ACTIVITIES_FAVORITES_STORAGE_KEY } from '../constants/activitiesFavorites'

/**
 * Favorite shots (analysis ids), kept on this device. One in-memory copy is shared by every screen
 * so starring a shot on its detail page shows up in the Activities list right away.
 */
let ids: Set<string> = new Set()
let loaded: Promise<void> | null = null
const listeners = new Set<(next: Set<string>) => void>()

function load(): Promise<void> {
  if (!loaded) {
    loaded = AsyncStorage.getItem(ACTIVITIES_FAVORITES_STORAGE_KEY)
      .then((raw) => {
        const parsed = raw ? JSON.parse(raw) : []
        if (Array.isArray(parsed)) ids = new Set(parsed.filter((x): x is string => typeof x === 'string'))
      })
      .catch(() => {
        /* missing or corrupt storage: start empty */
      })
      .then(() => listeners.forEach((fn) => fn(ids)))
  }
  return loaded
}

export async function toggleFavorite(analysisId: string): Promise<void> {
  await load()
  const next = new Set(ids)
  if (next.has(analysisId)) next.delete(analysisId)
  else next.add(analysisId)
  ids = next
  listeners.forEach((fn) => fn(ids))
  await AsyncStorage.setItem(ACTIVITIES_FAVORITES_STORAGE_KEY, JSON.stringify([...next])).catch(() => {})
}

export function useFavoriteIds() {
  const [current, setCurrent] = useState<Set<string>>(ids)
  useEffect(() => {
    listeners.add(setCurrent)
    void load()
    setCurrent(ids)
    return () => {
      listeners.delete(setCurrent)
    }
  }, [])
  const toggle = useCallback((analysisId: string) => void toggleFavorite(analysisId), [])
  return { favoriteIds: current, toggleFavorite: toggle }
}
