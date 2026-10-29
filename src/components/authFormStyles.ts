import { Platform, StyleSheet } from 'react-native'
import { UI } from './ui/tokens'

export const AUTH_INPUT_FOCUS_BORDER = UI.accent
export const AUTH_INPUT_FOCUS_BORDER_WIDTH = 1.5
export const AUTH_INPUT_ERROR_BORDER_WIDTH = 1.5
export const AUTH_ICON_COLOR = UI.accent

export function createAuthFormStyles(theme: {
  regularFont: string
  mediumFont: string
  textColor: string
  placeholderTextColor: string
}) {
  return StyleSheet.create({
    input: {
      borderWidth: 1,
      borderColor: UI.surfaceBorder,
      borderRadius: UI.radius,
      paddingHorizontal: 18,
      paddingVertical: 12,
      minHeight: UI.fieldHeight,
      fontSize: 15,
      fontFamily: theme.regularFont,
      color: theme.textColor,
      backgroundColor: UI.surface,
      marginBottom: 12,
    },
    inputFocused: {
      borderWidth: AUTH_INPUT_FOCUS_BORDER_WIDTH,
      borderColor: AUTH_INPUT_FOCUS_BORDER,
    },
    inputError: {
      borderWidth: AUTH_INPUT_ERROR_BORDER_WIDTH,
      borderColor: '#FF5A6A',
      backgroundColor: 'rgba(70, 12, 20, 0.35)',
      marginBottom: 6,
    },
    passwordWrap: {
      marginBottom: 12,
    },
    passwordField: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 0,
      paddingVertical: 0,
      paddingHorizontal: 0,
    },
    passwordInput: {
      flex: 1,
      borderWidth: 0,
      backgroundColor: 'transparent',
      marginBottom: 0,
      paddingVertical: 12,
      paddingLeft: 16,
      paddingRight: 8,
      minHeight: UI.fieldHeight - 2,
      fontSize: 15,
      fontFamily: theme.regularFont,
      color: theme.textColor,
    },
    iconField: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 0,
      paddingLeft: 18,
      paddingRight: 0,
    },
    leftIcon: {
      marginRight: 12,
    },
    iconInput: {
      flex: 1,
      minWidth: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
      paddingVertical: 12,
      paddingRight: 16,
      minHeight: UI.fieldHeight - 2,
      fontSize: 15,
      fontFamily: theme.regularFont,
      color: theme.textColor,
    },
    passwordToggle: {
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'stretch',
      paddingRight: 12,
      paddingLeft: 4,
      minWidth: 40,
    },
    /** Floating-label field: small label above the value, both inside the box. */
    floatField: {
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 18,
      minHeight: UI.fieldHeight + 2,
    },
    floatColumn: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
      paddingVertical: 8,
      paddingLeft: 18,
    },
    floatLabel: {
      fontSize: 12,
      fontFamily: theme.regularFont,
      color: UI.textMuted,
      marginBottom: 2,
    },
    floatInput: {
      borderWidth: 0,
      backgroundColor: 'transparent',
      margin: 0,
      padding: 0,
      minHeight: 22,
      /** No browser focus ring inside the box on web; the box border shows focus. */
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
      fontSize: 16,
      fontFamily: theme.regularFont,
      color: theme.textColor,
    },
    errorText: {
      color: UI.error,
      fontSize: 12,
      fontFamily: theme.mediumFont,
      marginBottom: 10,
      marginTop: -2,
      paddingHorizontal: 4,
    },
  })
}
