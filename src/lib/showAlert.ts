import { Alert, Platform } from 'react-native'

/** Alert.alert on native; react-native-web's Alert is a no-op, so the web build uses window.alert. */
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    const w = globalThis as { alert?: (msg: string) => void }
    w.alert?.(message ? `${title}\n\n${message}` : title)
    return
  }
  Alert.alert(title, message)
}
