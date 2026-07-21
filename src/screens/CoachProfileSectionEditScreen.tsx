import React, { useContext, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from '../context'
import { createCoachProfileSection } from '../lib/coachProfileSectionsApi'
import type { YouTabStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<YouTabStackParamList, 'CoachProfileSectionEdit'>

export function CoachProfileSectionEditScreen() {
  const navigation = useNavigation<Nav>()
  const insets = useSafeAreaInsets()
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])

  const [heading, setHeading] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  async function onSave() {
    const h = heading.trim()
    const t = body.trim()
    if (!h) {
      Alert.alert('Heading required', 'Add a short heading for this section.')
      return
    }
    if (!t) {
      Alert.alert('Text required', 'Add the paragraph text for this section.')
      return
    }
    if (saving) return
    setSaving(true)
    try {
      await createCoachProfileSection({ heading: h, body: t })
      navigation.goBack()
    } catch (e) {
      Alert.alert(
        'Could not save',
        e instanceof Error ? e.message : 'Please try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: Math.max(12, insets.top) }]}>
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={28} color="#86A7D2" />
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={() => void onSave()}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save"
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollInner, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Heading</Text>
        <TextInput
          style={styles.headingInput}
          value={heading}
          onChangeText={setHeading}
          placeholder="e.g. Perfil"
          placeholderTextColor="#4A6FA0"
          maxLength={120}
          autoCapitalize="sentences"
        />

        <Text style={[styles.label, styles.labelSpaced]}>Text</Text>
        <TextInput
          style={styles.bodyInput}
          value={body}
          onChangeText={setBody}
          placeholder="Write about yourself, achievements, coaching style…"
          placeholderTextColor="#4A6FA0"
          maxLength={8000}
          multiline
          textAlignVertical="top"
          autoCapitalize="sentences"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function getStyles(theme: {
  backgroundColor?: string
  mediumFont?: string
  regularFont?: string
  semiBoldFont?: string
}) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.backgroundColor ?? '#030A17',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    backLabel: {
      color: '#86A7D2',
      fontFamily: theme.regularFont ?? 'System',
      fontSize: 15,
    },
    saveBtn: {
      minWidth: 72,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#00B8FF',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    saveBtnDisabled: {
      opacity: 0.7,
    },
    saveBtnText: {
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont ?? theme.mediumFont ?? 'System',
      fontSize: 15,
    },
    scroll: {
      flex: 1,
    },
    scrollInner: {
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    label: {
      color: '#86A7D2',
      fontFamily: theme.mediumFont ?? 'System',
      fontSize: 13,
      marginBottom: 8,
    },
    labelSpaced: {
      marginTop: 20,
    },
    headingInput: {
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#0E2969',
      backgroundColor: '#041641',
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont ?? theme.mediumFont ?? 'System',
      fontSize: 20,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    bodyInput: {
      minHeight: 220,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#0E2969',
      backgroundColor: '#041641',
      color: '#86A7D2',
      fontFamily: theme.regularFont ?? 'System',
      fontSize: 15,
      lineHeight: 22,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
  })
}
