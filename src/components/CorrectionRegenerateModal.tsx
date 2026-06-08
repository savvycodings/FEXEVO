import React, { useContext, useMemo } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Feather from '@expo/vector-icons/Feather'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'

export type CorrectionRegenerateModalProps = {
  visible: boolean
  onClose: () => void
  coachingBullets: string[]
  message: string
  onChangeMessage: (text: string) => void
  onRegenerate: () => void
  loading?: boolean
}

export function CorrectionRegenerateModal({
  visible,
  onClose,
  coachingBullets,
  message,
  onChangeMessage,
  onRegenerate,
  loading = false,
}: CorrectionRegenerateModalProps) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => getStyles(theme), [theme])
  const canSubmit = message.trim().length > 0 && !loading

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <Feather name="refresh-cw" size={18} color="#00BBFF" />
            </View>
            <View style={styles.headerTextCol}>
              <Text allowFontScaling={false} style={styles.title}>
                {t('correctionModal.title')}
              </Text>
              <Text allowFontScaling={false} style={styles.subtitle}>
                {t('correctionModal.subtitle')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.8}>
              <Feather name="x" size={22} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollInner}
            keyboardShouldPersistTaps="handled"
            bottomOffset={24}
          >
            {coachingBullets.length > 0 ? (
              <View style={styles.bulletsBlock}>
                <Text allowFontScaling={false} style={styles.bulletsLabel}>
                  {t('correctionModal.currentRecs')}
                </Text>
                {coachingBullets.map((line, idx) => (
                  <View key={`${idx}-${line.slice(0, 20)}`} style={styles.bulletRow}>
                    <Text allowFontScaling={false} style={styles.bulletDot}>
                      •
                    </Text>
                    <Text allowFontScaling={false} style={styles.bulletText}>
                      {line}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Text allowFontScaling={false} style={styles.inputLabel}>
              {t('correctionModal.yourFeedback')}
            </Text>
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={onChangeMessage}
              placeholder={t('correctionModal.placeholder')}
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              textAlignVertical="top"
              editable={!loading}
            />
          </KeyboardAwareScrollView>

          <TouchableOpacity
            style={[styles.regenBtn, !canSubmit && styles.regenBtnDisabled]}
            onPress={onRegenerate}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Feather name="refresh-cw" size={16} color="#FFFFFF" />
                <Text allowFontScaling={false} style={styles.regenBtnText}>
                  {t('correctionModal.regenerate')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

function getStyles(theme: {
  semiBoldFont?: string
  regularFont?: string
  mediumFont?: string
}) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 8, 20, 0.72)',
      justifyContent: 'flex-end',
    },
    card: {
      backgroundColor: '#001435',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 18,
      paddingHorizontal: 18,
      maxHeight: '88%',
      borderWidth: 1,
      borderColor: 'rgba(0, 110, 255, 0.35)',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 12,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(0, 110, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTextCol: { flex: 1, minWidth: 0 },
    title: {
      fontFamily: theme.semiBoldFont,
      fontSize: 17,
      color: '#FFFFFF',
    },
    subtitle: {
      fontFamily: theme.regularFont,
      fontSize: 12,
      color: 'rgba(255,255,255,0.55)',
      marginTop: 4,
      lineHeight: 17,
    },
    scroll: { maxHeight: 360 },
    scrollInner: { paddingBottom: 8 },
    bulletsBlock: {
      marginBottom: 14,
      padding: 12,
      borderRadius: 12,
      backgroundColor: 'rgba(0, 20, 53, 0.85)',
      borderWidth: 1,
      borderColor: 'rgba(0, 110, 255, 0.2)',
    },
    bulletsLabel: {
      fontFamily: theme.mediumFont,
      fontSize: 12,
      color: '#00B8FF',
      marginBottom: 8,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 6,
    },
    bulletDot: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: '#00B8FF',
      lineHeight: 20,
    },
    bulletText: {
      flex: 1,
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: 'rgba(255,255,255,0.88)',
      lineHeight: 19,
    },
    inputLabel: {
      fontFamily: theme.mediumFont,
      fontSize: 13,
      color: 'rgba(255,255,255,0.75)',
      marginBottom: 8,
    },
    input: {
      minHeight: 100,
      maxHeight: 160,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(0, 110, 255, 0.35)',
      backgroundColor: 'rgba(0, 8, 20, 0.9)',
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: theme.regularFont,
      fontSize: 15,
      color: '#FFFFFF',
      lineHeight: 22,
    },
    regenBtn: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: '#006EFF',
    },
    regenBtnDisabled: {
      opacity: 0.45,
    },
    regenBtnText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: '#FFFFFF',
    },
  })
}
