import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { ProLibraryGradientFrame } from '../../components/ProLibraryGradientFrame'
import { LocalSvgAsset } from '../../components/LocalSvgAsset'
import { useTranslation } from 'react-i18next'

const COACH_PHOTO = require('../../../assets/mycoach/mycoachpfp.png')
const SHIELD_BADGE_SVG = require('../../../assets/mycoach/shieldmycoach.svg')
const UPLOAD_ICON_SVG = require('../../../assets/mycoach/uploadicon.svg')
const BADGE_W = 18
const BADGE_H = Math.round((BADGE_W * 22) / 17)
const UPLOAD_ICON_SIZE = 28

/** Gradient ring thickness (My Coach top cards); inner glow stays off for even edges. */
const FRAME_STROKE = 1.25
const FRAME_OUTER_R = 16
const FRAME_INNER_R = FRAME_OUTER_R - FRAME_STROKE
/** Same height for both top cards; kept modest so vertical padding isn’t excessive. */
const CARD_MIN_HEIGHT = 86

type Props = {
  coachName: string
  /** Defaults to translated "Your Coach" when omitted. */
  coachSubtitle?: string
  coachImageUri?: string | null
  fonts: { semiBoldFont: string; mediumFont: string; regularFont: string }
  onUploadedVideo?: (uri: string) => void
}

export function MyCoachCoachHero({
  coachName,
  coachSubtitle,
  coachImageUri,
  fonts,
  onUploadedVideo,
}: Props) {
  const { t } = useTranslation()
  async function onUploadPress() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(t('commonAlerts.permissionNeeded'), t('coachFlow.permissionPhotos'))
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    })
    if (result.canceled || !result.assets?.[0]?.uri) return
    const uri = result.assets[0].uri
    onUploadedVideo?.(uri)
    Alert.alert(t('coachFlow.videoSelected'), t('coachFlow.videoSelectedBody'), [
      { text: t('commonAlerts.ok') },
    ])
  }

  const frameCommon = {
    strokeWidth: FRAME_STROKE,
    borderRadius: FRAME_OUTER_R,
    innerBorderRadius: FRAME_INNER_R,
    innerShadow: false,
    stretchInner: true,
  } as const

  return (
    <View style={styles.row}>
      <ProLibraryGradientFrame style={styles.coachFrame} {...frameCommon}>
        <View style={styles.coachCardInner}>
          <View style={styles.avatarWrap}>
            {coachImageUri ? (
              <Image source={{ uri: coachImageUri }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <Image source={COACH_PHOTO} style={styles.avatar} resizeMode="cover" />
            )}
            <View style={styles.shieldBadge} pointerEvents="none">
              <LocalSvgAsset assetModule={SHIELD_BADGE_SVG} width={BADGE_W} height={BADGE_H} />
            </View>
          </View>
          <View style={styles.coachTextCol}>
            <Text allowFontScaling={false} style={[styles.coachSubtitle, { fontFamily: fonts.regularFont }]}>
              {coachSubtitle ?? t('myCoach.yourCoach')}
            </Text>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.coachName, { fontFamily: fonts.semiBoldFont }]}>
              {coachName}
            </Text>
            <Text allowFontScaling={false} style={[styles.premiumLabel, { fontFamily: fonts.mediumFont }]}>
              {t('myCoach.premiumCoach')}
            </Text>
          </View>
        </View>
      </ProLibraryGradientFrame>

      <ProLibraryGradientFrame style={styles.uploadFrame} {...frameCommon}>
        <TouchableOpacity style={styles.uploadInner} activeOpacity={0.85} onPress={onUploadPress}>
          <LocalSvgAsset assetModule={UPLOAD_ICON_SVG} width={UPLOAD_ICON_SIZE} height={UPLOAD_ICON_SIZE} />
          <View style={styles.uploadTextCol}>
            <Text allowFontScaling={false} style={[styles.uploadTitle, { fontFamily: fonts.mediumFont }]}>
              {t('myCoach.uploadTitle')}
            </Text>
            <Text allowFontScaling={false} style={[styles.uploadSubtitle, { fontFamily: fonts.regularFont }]}>
              {t('myCoach.uploadSubtitle')}
            </Text>
          </View>
        </TouchableOpacity>
      </ProLibraryGradientFrame>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginBottom: 14,
  },
  coachFrame: {
    flex: 1,
    minHeight: CARD_MIN_HEIGHT,
    alignSelf: 'stretch',
  },
  coachCardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  uploadFrame: {
    width: 108,
    minHeight: CARD_MIN_HEIGHT,
    alignSelf: 'stretch',
  },
  uploadInner: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  uploadTextCol: {
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(0, 187, 255, 0.6)',
  },
  shieldBadge: {
    position: 'absolute',
    right: -5,
    bottom: -3,
  },
  coachTextCol: {
    flex: 1,
    minWidth: 0,
  },
  coachSubtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    lineHeight: 14,
  },
  coachName: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 1,
    lineHeight: 19,
  },
  premiumLabel: {
    color: '#F5C542',
    fontSize: 10,
    marginTop: 3,
    letterSpacing: 0.5,
    lineHeight: 13,
  },
  uploadTitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  uploadSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 1,
    lineHeight: 13,
  },
})
