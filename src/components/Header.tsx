import {
  StyleSheet,
  View,
  TouchableOpacity,
  Image,
  Text,
} from 'react-native'
import { useContext } from 'react'
import { ThemeContext, AppContext } from '../../src/context'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'

const LOGO_RIGHT = require('../../assets/logo.png')

const HEADER_HEIGHT = 44
const HORIZONTAL_PADDING = 16

type HeaderProps = {
  onLogoPress?: () => void
  onProfilePress?: () => void
  profileName?: string
  profileRank?: string
  profileImageUri?: string | null
}

export function Header({
  onLogoPress,
  onProfilePress,
  profileName,
  profileRank,
  profileImageUri,
}: HeaderProps) {
  const insets = useSafeAreaInsets()
  const { theme } = useContext(ThemeContext)
  const { handlePresentModalPress } = useContext(AppContext)
  const styles = getStyles(theme, insets)

  return (
    <View style={styles.container}>
      {onProfilePress ? (
        <View style={styles.leftProfileRow}>
          <TouchableOpacity
            style={styles.leftProfileButton}
            activeOpacity={0.8}
            onPress={onProfilePress}
            accessibilityLabel="Open profile"
          >
            <View style={styles.avatarWrap}>
              {profileImageUri ? (
                <Image source={{ uri: profileImageUri }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <Ionicons name="person" size={16} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.profileTextWrap}>
              <Text numberOfLines={1} allowFontScaling={false} style={styles.profileNameText}>
                {profileName || 'Player'}
              </Text>
              <Text numberOfLines={1} allowFontScaling={false} style={styles.profileRankText}>
                {profileRank || 'No rank yet'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.leftEmptySlot} />
      )}
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
      // Keep header below status bar/notch on all devices.
      paddingTop: insets.top + 8,
      paddingBottom: 12,
      paddingLeft: horizontalPadding,
      paddingRight: horizontalPadding,
      backgroundColor: 'transparent',
      borderRadius: 0,
      overflow: 'visible',
      borderBottomWidth: 0,
      borderBottomColor: 'transparent',
      zIndex: 100,
      elevation: 10,
    },
    leftButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    leftProfileRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingRight: 8,
    },
    leftProfileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
      flexShrink: 1,
      gap: 8,
    },
    avatarWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0, 94, 255, 0.35)',
      borderWidth: 1,
      borderColor: 'rgba(0, 187, 255, 0.65)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: 36,
      height: 36,
    },
    profileTextWrap: {
      minWidth: 0,
      maxWidth: 130,
    },
    profileNameText: {
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      lineHeight: 16,
    },
    profileRankText: {
      color: '#00BBFF',
      fontFamily: theme.semiBoldFont,
      fontSize: 12,
      lineHeight: 14,
      marginTop: 2,
    },
    leftEmptySlot: {
      width: 40,
      height: 40,
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
}