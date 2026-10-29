import React, { useContext, useMemo } from 'react'
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { GlowButton, SurfaceButton } from './ui'
import { ProLibraryGradientFrame } from './ProLibraryGradientFrame'

const MODAL_FILL = '#030A17'
const FRAME_OUTER_RADIUS = 28
const FRAME_STROKE = 2

type LogoutConfirmModalProps = {
  visible: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function LogoutConfirmModal({ visible, onCancel, onConfirm }: LogoutConfirmModalProps) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { width: winW } = useWindowDimensions()
  const styles = useMemo(() => getStyles(theme), [theme])
  const cardWidth = Math.min(340, Math.max(280, winW - 48))
  const innerRadius = Math.max(12, FRAME_OUTER_RADIUS - FRAME_STROKE)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onCancel}
          accessibilityLabel={t('profileSettingsUi.close')}
        />
        <View style={[styles.cardWrap, { width: cardWidth }]} pointerEvents="auto">
          <ProLibraryGradientFrame
            borderRadius={FRAME_OUTER_RADIUS}
            innerBorderRadius={innerRadius}
            strokeWidth={FRAME_STROKE}
            innerShadow={false}
            innerStyle={{ backgroundColor: MODAL_FILL }}
          >
            <View style={styles.content}>
              <Text allowFontScaling={false} style={styles.title}>
                {t('profileSettingsUi.logoutTitle')}
              </Text>
              <Text allowFontScaling={false} style={styles.message}>
                {t('profileSettingsUi.logoutMessage')}
              </Text>
              <View style={styles.actions}>
                <SurfaceButton
                  label={t('profileSettingsUi.logoutCancel')}
                  onPress={onCancel}
                  style={styles.actionButton}
                />
                <GlowButton
                  label={t('profileSettingsUi.logoutConfirm')}
                  onPress={onConfirm}
                  style={styles.actionButton}
                />
              </View>
            </View>
          </ProLibraryGradientFrame>
        </View>
      </View>
    </Modal>
  )
}

function getStyles(theme: { semiBoldFont?: string; regularFont?: string; mediumFont?: string }) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 8, 20, 0.78)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    backdrop: {
      zIndex: 0,
    },
    cardWrap: {
      maxWidth: '100%',
      zIndex: 1,
      elevation: 6,
    },
    content: {
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 24,
      alignItems: 'center',
    },
    title: {
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont,
      fontSize: 18,
      lineHeight: 22,
      textAlign: 'center',
    },
    message: {
      marginTop: 10,
      color: '#86A7D2',
      fontFamily: theme.regularFont,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    actions: {
      marginTop: 24,
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 12,
      width: '100%',
    },
    actionButton: {
      flex: 1,
    },
  })
}
