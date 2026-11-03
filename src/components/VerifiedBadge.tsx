import { StyleSheet, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'

const VERIFIED_BLUE = '#0084FF'

/** Verified coach mark (design): solid #0084FF circle with a white check. */
export function VerifiedBadge({ size = 20 }: { size?: number }) {
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityLabel="Verified"
    >
      <Ionicons name="checkmark-sharp" size={Math.round(size * 0.68)} color="#FFFFFF" />
    </View>
  )
}

const styles = StyleSheet.create({
  circle: { backgroundColor: VERIFIED_BLUE, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
})
