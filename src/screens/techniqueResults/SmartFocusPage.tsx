import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

type Props = {
  visible: boolean
  children: ReactNode
}

/**
 * Smart Focus is the existing score view. The parent keeps analysis state and
 * passes the score tree in as children. Hiding the page leaves that tree mounted.
 */
export function SmartFocusPage({ visible, children }: Props) {
  return <View style={visible ? styles.shown : styles.hidden}>{children}</View>
}

const styles = StyleSheet.create({
  shown: { alignSelf: 'stretch', overflow: 'visible' },
  hidden: { display: 'none' },
})
