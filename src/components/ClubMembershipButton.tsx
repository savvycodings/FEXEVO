import React, { useContext, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import {
  acceptClubInvite,
  cancelJoinRequest,
  declineClubInvite,
  leaveClub,
  requestToJoinClub,
  setMainClub,
  type MyClubMembership,
} from '../lib/clubsApi'
import { PRIMARY_GLOW, UI } from './ui'

type Sheet = 'requested' | 'member' | 'confirmLeave' | null

/**
 * Full-width membership pill on the club page: Join club / Requested / Accept invite (+ Decline)
 * / Member, matching the viewer's record. "Requested" and "Member" open a small sheet (a Modal,
 * so it behaves the same on web and native). Disabled while a call runs; on failure the state
 * stays as it was and an error is shown.
 */
export function ClubMembershipButton({
  clubId,
  clubName,
  membership,
  onChange,
}: {
  clubId: string
  clubName: string
  membership: MyClubMembership
  /** New record state, plus the club's fresh member count when the server sent one. */
  onChange: (next: MyClubMembership, memberCount?: number) => void
}) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [sheet, setSheet] = useState<Sheet>(null)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setFailed(false)
    try {
      await fn()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const join = () =>
    run(async () => {
      const r = await requestToJoinClub(clubId)
      onChange({ state: r.state, id: r.membership?.id ?? null, isMain: r.isMain }, r.memberCount)
    })

  const accept = () =>
    run(async () => {
      if (!membership.id) return
      const r = await acceptClubInvite(membership.id)
      onChange({ state: 'member', id: membership.id, isMain: r.isMain }, r.memberCount)
    })

  const decline = () =>
    run(async () => {
      if (!membership.id) return
      await declineClubInvite(membership.id)
      onChange({ state: 'none', id: null, isMain: false })
    })

  const cancel = () => {
    setSheet(null)
    void run(async () => {
      if (!membership.id) return
      await cancelJoinRequest(membership.id)
      onChange({ state: 'none', id: null, isMain: false })
    })
  }

  const makeMain = () => {
    setSheet(null)
    void run(async () => {
      const r = await setMainClub(clubId)
      onChange({ ...membership, isMain: true }, r.memberCount)
    })
  }

  const leave = () => {
    setSheet(null)
    void run(async () => {
      const r = await leaveClub(clubId)
      onChange({ state: 'none', id: null, isMain: false }, r.memberCount)
    })
  }

  const { state } = membership
  const primary = state === 'none' || state === 'invited'
  const label =
    state === 'none'
      ? t('clubMembership.joinClub')
      : state === 'requested'
        ? t('clubMembership.requested')
        : state === 'invited'
          ? t('clubMembership.acceptInvite')
          : t('clubMembership.member')
  const icon =
    state === 'none' ? 'add' : state === 'requested' ? 'time-outline' : state === 'invited' ? 'checkmark' : 'people'

  const onPress = () => {
    if (state === 'none') void join()
    else if (state === 'invited') void accept()
    else if (state === 'requested') setSheet('requested')
    else setSheet('member')
  }

  const font = { fontFamily: theme.mediumFont }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {state === 'invited' ? (
          <TouchableOpacity
            style={[styles.btn, styles.secondary, styles.outline]}
            onPress={() => void decline()}
            disabled={busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('clubMembership.decline')}
            testID="club-membership-decline"
          >
            <Text allowFontScaling={false} style={[styles.label, font]}>
              {t('clubMembership.decline')}
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.btn, styles.main, primary ? PRIMARY_GLOW : styles.outline, busy && styles.disabled]}
          onPress={onPress}
          disabled={busy}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: busy, busy }}
          testID={`club-membership-${state}`}
        >
          {primary ? (
            <LinearGradient
              colors={UI.gradient}
              locations={UI.gradientLocations}
              start={UI.gradientStart}
              end={UI.gradientEnd}
              style={[StyleSheet.absoluteFill, styles.fill]}
            />
          ) : null}
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name={icon} size={18} color="#FFFFFF" />
              <Text allowFontScaling={false} style={[styles.label, font]}>
                {label}
              </Text>
              {state === 'member' && membership.isMain ? (
                <View style={styles.mainTag} testID="club-membership-main-tag">
                  <Text allowFontScaling={false} style={[styles.mainTagText, font]}>
                    {t('clubMembership.mainClub')}
                  </Text>
                </View>
              ) : null}
              {state === 'member' || state === 'requested' ? (
                <Ionicons name="chevron-down" size={16} color={UI.textMuted} />
              ) : null}
            </>
          )}
        </TouchableOpacity>
      </View>
      {failed ? (
        <Text style={[styles.error, { fontFamily: theme.regularFont }]} testID="club-membership-error">
          {t('clubMembership.actionFailed')}
        </Text>
      ) : null}

      <Modal visible={sheet != null} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheet(null)} />
          <View style={styles.card}>
            {sheet === 'confirmLeave' ? (
              <>
                <Text style={[styles.title, { fontFamily: theme.semiBoldFont }]}>
                  {t('clubMembership.leaveTitle', { club: clubName })}
                </Text>
                <Text style={[styles.body, { fontFamily: theme.regularFont }]}>{t('clubMembership.leaveBody')}</Text>
                <View style={styles.modalRow}>
                  <TouchableOpacity style={[styles.modalBtn, styles.outline]} onPress={() => setSheet(null)}>
                    <Text style={[styles.label, font]}>{t('clubMembership.keep')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.danger]}
                    onPress={leave}
                    testID="club-membership-leave-confirm"
                  >
                    <Text style={[styles.label, font]}>{t('clubMembership.leaveConfirm')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : sheet === 'requested' ? (
              <>
                <Text style={[styles.title, { fontFamily: theme.semiBoldFont }]}>{t('clubMembership.cancelTitle')}</Text>
                <Text style={[styles.body, { fontFamily: theme.regularFont }]}>
                  {t('clubMembership.cancelBody', { club: clubName })}
                </Text>
                <View style={styles.modalRow}>
                  <TouchableOpacity style={[styles.modalBtn, styles.outline]} onPress={() => setSheet(null)}>
                    <Text style={[styles.label, font]}>{t('clubMembership.close')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.danger]}
                    onPress={cancel}
                    testID="club-membership-cancel-request"
                  >
                    <Text style={[styles.label, font]}>{t('clubMembership.cancelRequest')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.title, { fontFamily: theme.semiBoldFont }]}>{clubName}</Text>
                {!membership.isMain ? (
                  <TouchableOpacity
                    style={[styles.sheetBtn, styles.outline]}
                    onPress={makeMain}
                    testID="club-membership-make-main"
                  >
                    <Ionicons name="star-outline" size={18} color="#FFFFFF" />
                    <Text style={[styles.label, font]}>{t('clubMembership.makeMain')}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.sheetBtn, styles.outline]}
                  onPress={() => setSheet('confirmLeave')}
                  testID="club-membership-leave"
                >
                  <Ionicons name="exit-outline" size={18} color={UI.error} />
                  <Text style={[styles.label, font, { color: UI.error }]}>{t('clubMembership.leaveClub')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sheetClose} onPress={() => setSheet(null)}>
                  <Text style={[styles.closeText, font]}>{t('clubMembership.close')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18 },
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: UI.radiusPill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  main: { flex: 1 },
  secondary: { flexBasis: 110, flexGrow: 0 },
  outline: { borderWidth: 1, borderColor: UI.trackBorder, backgroundColor: UI.surface },
  disabled: { opacity: 0.7 },
  fill: { borderRadius: UI.radiusPill },
  label: { fontSize: 15, color: '#FFFFFF' },
  mainTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 184, 255, 0.18)',
  },
  mainTagText: { fontSize: 11, color: UI.accent },
  error: { marginTop: 6, fontSize: 13, color: UI.error, textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: UI.radiusCard,
    borderWidth: 1,
    borderColor: UI.cardBorder,
    backgroundColor: UI.cardBg,
    padding: 18,
    gap: 10,
  },
  title: { fontSize: 17, color: '#FFFFFF' },
  body: { fontSize: 14, lineHeight: 20, color: UI.textMuted },
  modalRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalBtn: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  danger: { backgroundColor: '#B3263A' },
  sheetBtn: {
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sheetClose: { height: 40, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 14, color: UI.textMuted },
})
