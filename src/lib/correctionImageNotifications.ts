import { Platform } from 'react-native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainStackParamList } from '../navigation/types'
import { navigateToActivityAnalysis } from './openActivityAnalysis'

type Nav = NativeStackNavigationProp<MainStackParamList>

type ExpoNotificationsModule = typeof import('expo-notifications')

let notificationsMod: ExpoNotificationsModule | null = null
let notificationsUnavailable = false
let handlerConfigured = false
let consumedColdStartNotification = false

function isNativeModuleError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /native module|ExpoPushToken|expopushtoken/i.test(msg)
}

async function loadNotifications(): Promise<ExpoNotificationsModule | null> {
  if (Platform.OS === 'web') return null
  if (notificationsUnavailable) return null
  if (notificationsMod) return notificationsMod
  try {
    const Notifications = await import('expo-notifications')
    if (!handlerConfigured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      })
      handlerConfigured = true
    }
    notificationsMod = Notifications
    return notificationsMod
  } catch (err) {
    notificationsUnavailable = true
    if (__DEV__) {
      console.warn(
        '[correctionImageNotifications] expo-notifications unavailable (rebuild dev client: npx expo run:android or run:ios)',
        isNativeModuleError(err) ? err : err
      )
    }
    return null
  }
}

export async function ensureCorrectionNotificationPermission(): Promise<boolean> {
  const Notifications = await loadNotifications()
  if (!Notifications) return false
  try {
    const existing = await Notifications.getPermissionsAsync()
    if (existing.status === 'granted') return true
    const next = await Notifications.requestPermissionsAsync()
    return next.status === 'granted'
  } catch (err) {
    if (isNativeModuleError(err)) notificationsUnavailable = true
    return false
  }
}

function analysisIdFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (d.kind !== 'correction_images_ready') return null
  const id = d.analysisId
  return typeof id === 'string' && id.trim().length > 0 ? id.trim() : null
}

/** Tap on device banner → Activities shot detail for that analysis. */
export function registerCorrectionNotificationDeepLink(navigation: Nav): () => void {
  let sub: { remove: () => void } | null = null
  let cancelled = false

  void (async () => {
    const Notifications = await loadNotifications()
    if (!Notifications || cancelled) return

    const openFromData = (data: unknown) => {
      const analysisId = analysisIdFromNotificationData(data)
      if (analysisId) navigateToActivityAnalysis(navigation, analysisId)
    }

    try {
      if (!consumedColdStartNotification) {
        const last = await Notifications.getLastNotificationResponseAsync()
        if (last) {
          consumedColdStartNotification = true
          openFromData(last.notification.request.content.data)
        }
      }
    } catch {
      /* ignore */
    }

    sub = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromData(response.notification.request.content.data)
    })
  })()

  return () => {
    cancelled = true
    sub?.remove()
  }
}

export async function notifyCorrectionImagesReady(opts: {
  analysisId: string
  frameCount: number
}): Promise<void> {
  const Notifications = await loadNotifications()
  if (!Notifications) return
  const granted = await ensureCorrectionNotificationPermission()
  if (!granted) return
  const n = Math.max(1, opts.frameCount)
  const title = 'Corrected images ready'
  const body =
    n === 1
      ? 'Your corrected pose image is ready in Activities.'
      : `Your ${n} corrected pose images are ready in Activities.`
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { kind: 'correction_images_ready', analysisId: opts.analysisId },
      },
      trigger: null,
    })
  } catch (err) {
    if (isNativeModuleError(err)) notificationsUnavailable = true
    if (__DEV__) {
      console.warn('[correctionImageNotifications] schedule failed', err)
    }
  }
}
