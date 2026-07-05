import { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
} from 'react-native'
import { ProLibraryGradientFrame } from './ProLibraryGradientFrame'
import { LocalSvgAsset } from './LocalSvgAsset'
import { titleMedium } from '../theme/typography'
import { useTranslation } from 'react-i18next'

import { DEFAULT_PROFILE_PICTURE, profileImageSource } from '../lib/defaultProfilePicture'

const SHIELD_BADGE_SVG = require('../../assets/mycoach/shieldmycoach.svg')
const AI_SWITCH_ON_SVG = require('../../assets/aiswitch/on.svg')
const AI_SWITCH_OFF_SVG = require('../../assets/aiswitch/off.svg')

const BADGE_W = 20
const BADGE_H = Math.round((BADGE_W * 22) / 17)
const AVATAR_SIZE = 58
const FRAME_STROKE = 1.25
const FRAME_OUTER_R = 16
const FRAME_INNER_R = FRAME_OUTER_R - FRAME_STROKE
const CARD_MIN_HEIGHT = 92

const frameCommon = {
  strokeWidth: FRAME_STROKE,
  borderRadius: FRAME_OUTER_R,
  innerBorderRadius: FRAME_INNER_R,
  innerShadow: false,
  stretchInner: true,
} as const

/** `assets/aiswitch/on.svg` / `off.svg` artboard size */
const AISWITCH = { w: 45, h: 24 } as const

export type AICoachCoachReviewBannerFonts = {
  semiBoldFont: string
  mediumFont: string
  regularFont: string
}

export type AICoachAssignedCoach = {
  name: string
  imageUri: string | null
}

type Props = {
  /** Parent only mounts this banner when the user has at least one linked coach. */
  assignedCoach: AICoachAssignedCoach
  sendVideoToCoach: boolean
  onSendVideoToCoachChange: (value: boolean) => void
  fonts: AICoachCoachReviewBannerFonts
  /** Disables interactions while main upload is in progress. */
  interactionBusy?: boolean
}

function SendToCoachToggle({
  value,
  disabled,
  onValueChange,
}: {
  value: boolean
  disabled: boolean
  onValueChange: (next: boolean) => void
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={({ pressed }) => [
        styles.togglePressable,
        {
          width: AISWITCH.w,
          height: AISWITCH.h,
          opacity: disabled ? 0.42 : pressed ? 0.88 : 1,
        },
      ]}
    >
      <LocalSvgAsset
        assetModule={value ? AI_SWITCH_ON_SVG : AI_SWITCH_OFF_SVG}
        width={AISWITCH.w}
        height={AISWITCH.h}
      />
    </Pressable>
  )
}

export function AICoachCoachReviewBanner({
  assignedCoach,
  sendVideoToCoach,
  onSendVideoToCoachChange,
  fonts,
  interactionBusy = false,
}: Props) {
  const { t } = useTranslation()
  const coachImageUri = assignedCoach.imageUri
  const [avatarSource, setAvatarSource] = useState(() => profileImageSource(coachImageUri))

  useEffect(() => {
    setAvatarSource(profileImageSource(coachImageUri))
  }, [coachImageUri])

  return (
    <ProLibraryGradientFrame style={[styles.bannerFrame, { minHeight: CARD_MIN_HEIGHT }]} {...frameCommon}>
      <View style={styles.cardInner}>
        <View style={styles.leftContent}>
          <View style={styles.avatarWrap}>
            <Image
              source={avatarSource}
              style={styles.avatar}
              resizeMode="cover"
              onError={() => setAvatarSource(DEFAULT_PROFILE_PICTURE)}
            />
            <View style={styles.shieldBadge} pointerEvents="none">
              <LocalSvgAsset assetModule={SHIELD_BADGE_SVG} width={BADGE_W} height={BADGE_H} />
            </View>
          </View>
          <View style={styles.coachTextCol}>
            <Text allowFontScaling={false} style={[styles.coachSubtitle, { fontFamily: fonts.regularFont }]}>
              {t('myCoach.yourCoach')}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.coachName, titleMedium(fonts.mediumFont)]}
            >
              {assignedCoach.name}
            </Text>
            <Text allowFontScaling={false} style={[styles.premiumLabel, { fontFamily: fonts.mediumFont }]}>
              {t('myCoach.premiumCoach')}
            </Text>
          </View>
        </View>

        <View style={styles.switchCol}>
          <View style={styles.switchLabelCol}>
            <Text
              allowFontScaling={false}
              style={[styles.switchLabel, { fontFamily: fonts.regularFont }]}
            >
              {t('coachBanner.sendVideoLine1')}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.switchLabel, { fontFamily: fonts.regularFont }]}
            >
              {t('coachBanner.sendVideoLine2')}
            </Text>
          </View>
          <View style={styles.toggleClip}>
            <SendToCoachToggle
              value={sendVideoToCoach}
              disabled={interactionBusy}
              onValueChange={onSendVideoToCoachChange}
            />
          </View>
        </View>
      </View>
    </ProLibraryGradientFrame>
  )
}

const styles = StyleSheet.create({
  bannerFrame: {
    width: '100%',
    marginBottom: 0,
  },
  cardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 10,
    /** Extra inset so the pill toggle never sits in the curved corner / anti-alias bleed zone */
    paddingRight: 18,
    minWidth: 0,
    overflow: 'hidden',
  },
  leftContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  /**
   * Horizontal label + toggle. Must shrink on narrow widths (`flexShrink: 1` + `minWidth: 0`),
   * otherwise the row overflows the gradient frame.
   */
  switchCol: {
    position: 'relative',
    zIndex: 2,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 0,
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '56%',
  },
  switchLabelCol: {
    alignItems: 'center',
  },
  toggleClip: {
    position: 'relative',
    zIndex: 1,
    width: AISWITCH.w,
    height: AISWITCH.h,
    flexShrink: 0,
  },
  togglePressable: {
    flexShrink: 0,
  },
  switchLabel: {
    color: 'rgba(232,240,255,0.55)',
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  shieldBadge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
  },
  coachTextCol: {
    flex: 1,
    minWidth: 0,
  },
  coachSubtitle: {
    color: '#006FFF',
    fontSize: 11,
    lineHeight: 14,
  },
  coachName: {
    color: '#FFFFFF',
    marginTop: 1,
  },
  premiumLabel: {
    color: '#F5C542',
    fontSize: 10,
    marginTop: 3,
    letterSpacing: 0.5,
    lineHeight: 13,
  },
})
