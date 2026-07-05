import {
  StyleSheet,
  View,
  TouchableOpacity,
  Image,
  Text,
} from 'react-native'
import { useContext } from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import { ThemeContext, AppContext } from '../../src/context'
import { HEADER_BELOW_CONTENT_GAP, PAGE_TOP_EXTRA_PADDING } from '../../constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LocalSvgAsset, prefetchSvgAssets } from './LocalSvgAsset'
import { profileImageSource } from '../lib/defaultProfilePicture'

const HEADER_MARK_SVG = require('../../assets/pro.svg')
const SETTINGS_ICON = require('../../assets/youpage/settingsicon.svg')
const SEARCH_ICON = require('../../assets/youpage/searchicon.svg')
const NOTI_ICON = require('../../assets/coachs/notiicon.svg')

prefetchSvgAssets([HEADER_MARK_SVG, SETTINGS_ICON, SEARCH_ICON, NOTI_ICON])

const HEADER_HEIGHT = 44
const HORIZONTAL_PADDING = 16
/** Bottom hairline under main app header (#0066FF @ 20% — not used on `WelcomeHeader`). */
const HEADER_BOTTOM_STROKE = 'rgba(0, 102, 255, 0.2)'

type HeaderProps = {
  /** Opens Pro subscription screen (top-right PRO badge). */
  onProPress?: () => void
  onLogoPress?: () => void
  onProfilePress?: () => void
  profileName?: string
  profileRank?: string
  profileImageUri?: string | null
  /** Opens profile settings (left of the Xevo logo when the logo is shown). */
  onSettingsPress?: () => void
  /** Notifications (immediately left of settings). */
  onNotificationsPress?: () => void
  /** Progress / You: show search instead of name + rank. */
  headerLeftMode?: 'profile' | 'search'
  onSearchPress?: () => void
  /** Pushed modals (e.g. settings): back control in the same 40pt slot as search — avoids a left-column layout jump. */
  onBackPress?: () => void
  /** No shadow/elevation — use when header floats over full-bleed imagery */
  flatOverlay?: boolean
}

export function Header({
  onProPress,
  onLogoPress,
  onProfilePress,
  profileName,
  profileRank,
  profileImageUri,
  onSettingsPress,
  onNotificationsPress,
  headerLeftMode = 'profile',
  onSearchPress,
  onBackPress,
  flatOverlay = false,
}: HeaderProps) {
  const insets = useSafeAreaInsets()
  const { theme } = useContext(ThemeContext)
  const { handlePresentModalPress } = useContext(AppContext)
  const styles = getStyles(theme, insets, flatOverlay)

  const leftSearch = headerLeftMode === 'search' && onSearchPress
  const bgBottom = theme.backgroundColor ?? '#030A17'

  return (
    <View style={styles.wrap}>
      <LinearGradient
        pointerEvents="none"
        colors={['#071D47', bgBottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.container}>
      {onBackPress ? (
        <View style={styles.leftProfileRow}>
          <TouchableOpacity
            style={styles.searchButton}
            activeOpacity={0.8}
            onPress={onBackPress}
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : leftSearch ? (
        <View style={styles.leftProfileRow}>
          <TouchableOpacity
            style={styles.searchButton}
            activeOpacity={0.8}
            onPress={onSearchPress}
            accessibilityLabel="Open invite"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <LocalSvgAsset assetModule={SEARCH_ICON} width={24} height={24} />
          </TouchableOpacity>
        </View>
      ) : onProfilePress ? (
        <View style={styles.leftProfileRow}>
          <TouchableOpacity
            style={styles.leftProfileButton}
            activeOpacity={0.8}
            onPress={onProfilePress}
            accessibilityLabel="Open profile"
          >
            <View style={styles.avatarWrap}>
              <Image
                source={profileImageSource(profileImageUri)}
                style={styles.avatarImage}
                resizeMode="cover"
              />
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
      <View style={styles.rightCluster}>
        {onNotificationsPress ? (
          <TouchableOpacity
            style={styles.notiButton}
            activeOpacity={0.75}
            onPress={onNotificationsPress}
            accessibilityLabel="Open notifications"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <LocalSvgAsset assetModule={NOTI_ICON} width={26} height={26} />
          </TouchableOpacity>
        ) : null}
        {onSettingsPress ? (
          <TouchableOpacity
            style={styles.settingsButton}
            activeOpacity={0.75}
            onPress={onSettingsPress}
            accessibilityLabel="Open settings"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <LocalSvgAsset assetModule={SETTINGS_ICON} width={26} height={26} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.rightButton}
          activeOpacity={0.6}
          onPress={onProPress ?? onLogoPress ?? handlePresentModalPress}
          accessibilityLabel="Open Pro subscription"
        >
          <LocalSvgAsset assetModule={HEADER_MARK_SVG} width={65} height={24} />
        </TouchableOpacity>
      </View>
      </View>
    </View>
  )
}

function getStyles(
  theme: any,
  insets: { top: number; left: number; right: number },
  flatOverlay: boolean
) {
  const horizontalPadding = Math.max(HORIZONTAL_PADDING, insets.left, insets.right)
  return StyleSheet.create({
    /** Full-bleed shell so `LinearGradient` covers status bar — padding lives on `container` only (RN absoluteFill ignores parent padding). */
    wrap: {
      position: 'relative',
      zIndex: 100,
      overflow: 'visible',
      borderBottomWidth: 1,
      borderBottomColor: HEADER_BOTTOM_STROKE,
      ...(flatOverlay
        ? {
            elevation: 0,
            shadowOpacity: 0,
            shadowRadius: 0,
            shadowOffset: { width: 0, height: 0 },
            shadowColor: 'transparent',
          }
        : { elevation: 10 }),
    },
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: HEADER_HEIGHT,
      /** Single modest gap under status bar (avoid +8 + PAGE_TOP_EXTRA — too tall on device builds). */
      paddingTop: insets.top + PAGE_TOP_EXTRA_PADDING,
      paddingBottom: 8 + HEADER_BELOW_CONTENT_GAP,
      paddingLeft: horizontalPadding,
      paddingRight: horizontalPadding,
      backgroundColor: 'transparent',
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
    searchButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
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
    rightCluster: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    notiButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: -2,
    },
    settingsButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 2,
      transform: [{ translateX: 8 }],
    },
    rightButton: {
      padding: 10,
      marginRight: -10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    /** Fallback only if `pro.svg` fails to resolve (asset load). */
    markFallback: {
      height: 24,
      width: 65,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
  })
}
