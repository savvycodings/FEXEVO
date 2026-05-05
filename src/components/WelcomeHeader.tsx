import { StyleSheet, View, TouchableOpacity, Image } from 'react-native'
import { useContext } from 'react'
import { AppContext } from '../context'
import { HEADER_BELOW_CONTENT_GAP, PAGE_TOP_EXTRA_PADDING } from '../../constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const LOGO_RIGHT = require('../../assets/logo.png')

const HEADER_HEIGHT = 44
const HORIZONTAL_PADDING = 16

type WelcomeHeaderProps = {
  onLogoPress?: () => void
}

/**
 * Onboarding welcome only: same placement as `Header` (logo right, empty left) but **no**
 * linear gradient — fully transparent so the hero image shows true logo colours.
 */
export function WelcomeHeader({ onLogoPress }: WelcomeHeaderProps) {
  const insets = useSafeAreaInsets()
  const { handlePresentModalPress } = useContext(AppContext)
  const horizontalPadding = Math.max(HORIZONTAL_PADDING, insets.left, insets.right)

  return (
    <View
      style={[
        styles.row,
        {
          paddingTop: insets.top + PAGE_TOP_EXTRA_PADDING,
          paddingBottom: 8 + HEADER_BELOW_CONTENT_GAP,
          paddingLeft: horizontalPadding,
          paddingRight: horizontalPadding,
        },
      ]}
    >
      <View style={styles.leftEmptySlot} />
      <View style={styles.rightCluster}>
        <TouchableOpacity
          style={styles.rightButton}
          activeOpacity={0.6}
          onPress={onLogoPress ?? handlePresentModalPress}
          accessibilityLabel="Open home and app options"
        >
          <Image
            source={LOGO_RIGHT}
            style={styles.paddleIcon}
            resizeMode="contain"
            accessibilityLabel="xEVO logo"
          />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: HEADER_HEIGHT,
    backgroundColor: 'transparent',
    zIndex: 100,
    elevation: 0,
    shadowOpacity: 0,
  },
  leftEmptySlot: {
    width: 40,
    height: 40,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightButton: {
    padding: 10,
    marginRight: -10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paddleIcon: {
    height: 24,
    width: 95,
  },
})
