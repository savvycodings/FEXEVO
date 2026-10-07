import React, { useContext, useMemo } from 'react'
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { LocalSvgAsset } from './LocalSvgAsset'
import { CAMERA_ANGLES, cameraAngleById, type CameraAngleId } from '../lib/cameraAngles'

const INFO_ICON = require('../../assets/angelvideo/modal/info.svg')

const CARD_FILL = '#041641'
const ACCENT = '#00B8FF'
const BUTTON_FILL = '#030A17'
const CARD_MAX_W = 350
const SIDE_PAD = 30
const BADGE_W = 85

type CameraAngleExampleModalProps = {
  visible: boolean
  angleId: CameraAngleId
  onChangeAngle: (id: CameraAngleId) => void
  onSelect: (id: CameraAngleId) => void
  onClose: () => void
}

export function CameraAngleExampleModal({
  visible,
  angleId,
  onChangeAngle,
  onSelect,
  onClose,
}: CameraAngleExampleModalProps) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { width: winW } = useWindowDimensions()
  const styles = useMemo(() => getStyles(theme), [theme])

  const cardW = Math.min(CARD_MAX_W, winW - 40)
  const angle = cameraAngleById(angleId)
  const badgeH = Math.round((BADGE_W * angle.tileHeight) / angle.tileWidth)

  const step = (delta: number) => {
    const i = CAMERA_ANGLES.findIndex((a) => a.id === angleId)
    const next = CAMERA_ANGLES[(i + delta + CAMERA_ANGLES.length) % CAMERA_ANGLES.length]!
    onChangeAngle(next.id)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t('profileSettingsUi.close')}
        />
        <View style={[styles.card, { width: cardW }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <LocalSvgAsset assetModule={INFO_ICON} width={27} height={27} />
              <Text allowFontScaling={false} style={styles.hint}>
                {t(angle.hintKey)}
              </Text>
            </View>
            <View style={[styles.badge, { height: badgeH + 4 }]}>
              <Image source={angle.tile} style={{ width: BADGE_W, height: badgeH }} resizeMode="cover" />
            </View>
          </View>

          <View style={styles.videoWrap}>
            <Video
              key={angle.id}
              source={angle.video}
              style={styles.video}
              resizeMode={ResizeMode.COVER}
              shouldPlay={visible}
              isLooping
              isMuted
            />
          </View>

          <View style={styles.footer}>
            <Text allowFontScaling={false} style={styles.caption}>
              {t(angle.labelKey)}
            </Text>
            <TouchableOpacity
              style={styles.button}
              activeOpacity={0.85}
              onPress={() => onSelect(angle.id)}
              accessibilityRole="button"
            >
              <Text allowFontScaling={false} style={styles.buttonText}>
                {t('studentProfile.viewModalContinue')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.arrows}>
          <TouchableOpacity
            onPress={() => step(-1)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={30} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => step(1)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
          >
            <Ionicons name="chevron-forward" size={30} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

function getStyles(theme: { mediumFont?: string }) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 8, 20, 0.78)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      backgroundColor: CARD_FILL,
      borderRadius: 20,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: SIDE_PAD,
      paddingVertical: 20,
      gap: 12,
    },
    headerText: {
      flex: 1,
      gap: 10,
      paddingTop: 4,
    },
    hint: {
      color: '#FFFFFF',
      fontFamily: theme.mediumFont,
      fontSize: 16,
      maxWidth: 160,
    },
    badge: {
      width: BADGE_W + 4,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: ACCENT,
      overflow: 'hidden',
    },
    videoWrap: {
      paddingHorizontal: SIDE_PAD,
    },
    video: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 10,
      overflow: 'hidden',
    },
    footer: {
      paddingHorizontal: SIDE_PAD,
      paddingTop: 10,
      paddingBottom: 20,
      gap: 20,
      alignItems: 'center',
    },
    caption: {
      color: ACCENT,
      fontFamily: theme.mediumFont,
      fontSize: 13,
      textAlign: 'center',
    },
    button: {
      width: '100%',
      height: 50,
      borderRadius: 15,
      backgroundColor: BUTTON_FILL,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: ACCENT,
      fontFamily: theme.mediumFont,
      fontSize: 16,
    },
    arrows: {
      marginTop: 20,
      width: 100,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
  })
}
