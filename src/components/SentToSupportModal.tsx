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

type SentToSupportModalProps = {
  visible: boolean
  onDone: () => void
}

export function SentToSupportModal({ visible, onDone }: SentToSupportModalProps) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { width: winW } = useWindowDimensions()
  const styles = useMemo(() => getStyles(theme), [theme])
  const cardWidth = Math.min(340, Math.max(280, winW - 48))
  const innerRadius = Math.max(12, FRAME_OUTER_RADIUS - FRAME_STROKE)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDone}
          accessibilityLabel={t('common.done')}
        />
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
                {t('technique.sentToSupportTitle')}
              </Text>
              <Text allowFontScaling={false} style={styles.message}>
                {t('technique.sentToSupportMessage')}
              </Text>
              <TouchableOpacity
                style={styles.doneOuter}
                onPress={onDone}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={['#00BBFF', '#0022FF']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.doneGradient}
                >
                  <Text allowFontScaling={false} style={styles.doneText}>
                    {t('common.done')}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
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
    doneOuter: {
      marginTop: 24,
      width: '100%',
      borderRadius: 16,
      overflow: 'hidden',
    },
    doneGradient: {
      minHeight: 54,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    doneText: {
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
    },
  })
}
