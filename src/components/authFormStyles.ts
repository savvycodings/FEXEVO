import { StyleSheet } from 'react-native'

export const AUTH_INPUT_FOCUS_BORDER = 'rgba(0, 184, 255, 0.25)'
export const AUTH_INPUT_FOCUS_BORDER_WIDTH = 2
export const AUTH_INPUT_ERROR_BORDER_WIDTH = 1.5

export function createAuthFormStyles(theme: {
  regularFont: string
  mediumFont: string
  textColor: string
  placeholderTextColor: string
}) {
  return StyleSheet.create({
    input: {
      borderWidth: 0,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: theme.regularFont,
      color: theme.textColor,
      backgroundColor: '#0B1F57',
      marginBottom: 10,
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
      marginBottom: 10,
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
      minHeight: 48,
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
    errorText: {
      color: '#FF6B7A',
      fontSize: 12,
      fontFamily: theme.mediumFont,
      marginBottom: 10,
      marginTop: -2,
      paddingHorizontal: 4,
    },
  })
}
