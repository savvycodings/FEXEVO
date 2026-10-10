import { createNavigationContainerRef } from '@react-navigation/native'
import { Platform } from 'react-native'

/** Ref on the signed-in navigation container. */
export const appNavRef = createNavigationContainerRef()

/**
 * Web e2e builds only (EXPO_PUBLIC_E2E=1): exposes `window.__xevoNav` so the route smoke check
 * and specs can open any screen directly, including nested ones:
 *   __xevoNav.navigate('Main', { screen: 'Progress', params: { screen: 'DailyQuest' } })
 */
export function exposeE2eNav(): void {
  if (Platform.OS !== 'web' || process.env.EXPO_PUBLIC_E2E !== '1') return
  ;(globalThis as Record<string, unknown>).__xevoNav = {
    ready: () => appNavRef.isReady(),
    current: () => appNavRef.getCurrentRoute()?.name ?? null,
    navigate: (name: string, params?: object) =>
      (appNavRef.navigate as unknown as (n: string, p?: object) => void)(name, params),
  }
}
