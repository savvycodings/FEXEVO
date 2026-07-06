import React, { useContext, useMemo } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
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
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel={t('profileSettingsUi.close')} />
        <View style={[styles.cardWrap, { width: cardWidth }]} pointerEvents="box-none">
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
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onCancel}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text allowFontScaling={false} style={styles.cancelText}>
                    {t('profileSettingsUi.logoutCancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmOuter}
                  onPress={onConfirm}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <LinearGradient
                    colors={['#0022FF', '#00BBFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.confirmGradient}
                  >
                    <Text allowFontScaling={false} style={styles.confirmText}>
                      {t('profileSettingsUi.logoutConfirm')}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
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
    cardWrap: {
      maxWidth: '100%',
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
    cancelBtn: {
      flex: 1,
      minHeight: 54,
      borderRadius: 16,
      backgroundColor: '#041641',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: {
      color: '#00BBFF',
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
    },
    confirmOuter: {
      flex: 1,
      borderRadius: 16,
      overflow: 'hidden',
    },
    confirmGradient: {
      minHeight: 54,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmText: {
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
    },
  })
}
