import {
  StyleSheet,
  View,
  TouchableHighlight,
  Image,
} from 'react-native'
import { useContext } from 'react'
import { ThemeContext, AppContext } from '../../src/context'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const LOGO_LEFT = require('../../assets/logo.png')
const PADDLE_ICON = require('../../assets/paddle.png')

const HEADER_HEIGHT = 44
const LOGO_HEIGHT = 24
const PADDLE_HEIGHT = 20
const HORIZONTAL_PADDING = 16

export function Header() {
  const insets = useSafeAreaInsets()
  const { theme } = useContext(ThemeContext)
  const { handlePresentModalPress } = useContext(AppContext)
  const styles = getStyles(theme, insets)

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Image
          source={LOGO_LEFT}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="xEVO Padel logo"
        />
      </View>
      <TouchableHighlight
        style={styles.rightButton}
        underlayColor="transparent"
        activeOpacity={0.6}
        onPress={handlePresentModalPress}
        accessibilityLabel="Open model options"
      >
        <Image
          source={PADDLE_ICON}
          style={styles.paddleIcon}
          resizeMode="contain"
          accessibilityLabel="Padel icon"
        />
      </TouchableHighlight>
    </View>
  )
}

function getStyles(theme: any, insets: { top: number; left: number; right: number }) {
  const horizontalPadding = Math.max(HORIZONTAL_PADDING, insets.left, insets.right)
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: HEADER_HEIGHT,
      paddingTop: Math.max(12, insets.top * 0.5),
      paddingBottom: 12,
      paddingLeft: horizontalPadding,
      paddingRight: horizontalPadding,
      backgroundColor: 'transparent',
      borderBottomWidth: 0,
      borderBottomColor: 'transparent',
      zIndex: 100,
      elevation: 10,
    },
    left: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    logo: {
      height: LOGO_HEIGHT,
      width: 95,
      maxWidth: '50%',
    },
    rightButton: {
      padding: 10,
      marginRight: -10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    paddleIcon: {
      height: PADDLE_HEIGHT,
      width: 51,
    },
  })
}