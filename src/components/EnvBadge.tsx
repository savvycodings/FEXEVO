import { Platform, StyleSheet, Text, View } from 'react-native'
import { DOMAIN } from '../../constants'

/**
 * Web-only badge naming the backend the app talks to (EXPO_PUBLIC_ENV_LABEL, e.g. "local" or
 * "production"), so a tester never mistakes production for the local test stack.
 */
export function EnvBadge() {
  const label = String(process.env.EXPO_PUBLIC_ENV_LABEL ?? '').trim()
  if (Platform.OS !== 'web' || !label) return null
  const prod = label.toLowerCase() === 'production'
  return (
    <View pointerEvents="none" style={[styles.badge, prod ? styles.prod : styles.local]} testID="env-badge">
      <Text style={styles.text}>{`${label} · ${DOMAIN.replace(/^https?:\/\//, '')}`}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    zIndex: 9999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    opacity: 0.85,
  },
  local: { backgroundColor: '#1f7a3a' },
  prod: { backgroundColor: '#b3261e' },
  text: { color: '#fff', fontSize: 10, fontWeight: '600' },
})
