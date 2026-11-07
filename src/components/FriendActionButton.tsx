import React, { useCallback, useContext, useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { authClient } from '../lib/auth-client'
import {
  acceptRequest,
  cancelRequest,
  fetchRelationship,
  sendFriendRequest,
  unfriend,
  type RelationshipStatus,
} from '../lib/friendsApi'
import { SECONDARY_BUTTON, UI } from './ui'
import { ProfileActionButton } from './profile/ProfileActions'

type Confirm = 'cancel' | 'remove' | null

/**
 * Friend button on a player's profile: Add friend / Requested / Accept / Friends, matching how
 * you're connected. Hidden on your own profile and until the relationship has loaded.
 */
export function FriendActionButton({ userId, name }: { userId: string; name: string }) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const { data: session } = authClient.useSession()
  const viewerId = (session as { user?: { id?: string } } | null)?.user?.id ?? null
  const isSelf = viewerId != null && viewerId === userId

  const [status, setStatus] = useState<RelationshipStatus | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)

  const load = useCallback(async () => {
    try {
      const rel = await fetchRelationship(userId)
      setStatus(rel.status)
      setRequestId(rel.requestId)
    } catch {
      setStatus(null)
    }
  }, [userId])

  useEffect(() => {
    if (!isSelf) void load()
  }, [isSelf, load])

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true)
      setFailed(false)
      try {
        await fn()
      } catch {
        setFailed(true)
      } finally {
        await load()
        setBusy(false)
      }
    },
    [load],
  )

  if (isSelf || viewerId == null || status == null) return null

  const onPress = () => {
    if (status === 'none') void run(async () => void (await sendFriendRequest(userId)))
    else if (status === 'incoming_pending' && requestId) void run(() => acceptRequest(requestId))
    else if (status === 'outgoing_pending') setConfirm('cancel')
    else if (status === 'friends') setConfirm('remove')
  }

  const onConfirm = () => {
    const kind = confirm
    setConfirm(null)
    if (kind === 'cancel' && requestId) void run(() => cancelRequest(requestId))
    if (kind === 'remove') void run(() => unfriend(userId))
  }

  const primary = status === 'none' || status === 'incoming_pending'
  const label =
    status === 'none'
      ? t('friends.addFriend')
      : status === 'outgoing_pending'
        ? t('friends.requested')
        : status === 'incoming_pending'
          ? t('friends.accept')
          : t('friends.friends')
  const icon: 'person-add' | 'time-outline' | 'checkmark' | 'people' =
    status === 'none'
      ? 'person-add'
      : status === 'outgoing_pending'
        ? 'time-outline'
        : status === 'incoming_pending'
          ? 'checkmark'
          : 'people'

  return (
    <View style={styles.wrap}>
      <ProfileActionButton
        label={label}
        icon={icon}
        variant={primary ? 'primary' : 'outline'}
        onPress={onPress}
        loading={busy}
        accessibilityLabel={label}
        testID={`friend-action-${status}`}
      />
      {failed ? <Text style={[styles.error, { fontFamily: theme.regularFont }]}>{t('friends.actionFailed')}</Text> : null}

      <Modal visible={confirm != null} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setConfirm(null)} />
          <View style={styles.card}>
            <Text style={[styles.title, { fontFamily: theme.semiBoldFont }]}>
              {confirm === 'remove' ? t('friends.removeTitle') : t('friends.cancelTitle')}
            </Text>
            <Text style={[styles.body, { fontFamily: theme.regularFont }]}>
              {confirm === 'remove' ? t('friends.removeBody', { name }) : t('friends.cancelBody', { name })}
            </Text>
            <View style={styles.row}>
              <TouchableOpacity style={[styles.modalBtn, styles.btnOutline]} onPress={() => setConfirm(null)}>
                <Text style={[styles.label, { fontFamily: theme.mediumFont }]}>{t('friends.keep')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.danger]}
                onPress={onConfirm}
                testID="friend-action-confirm"
              >
                <Text style={[styles.label, { fontFamily: theme.mediumFont }]}>
                  {confirm === 'remove' ? t('friends.removeConfirm') : t('friends.cancelConfirm')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  /** Sits in a ProfileActionRow; the error line shows under the button. */
  wrap: {},
  btnOutline: SECONDARY_BUTTON,
  label: { fontSize: 15, color: '#FFFFFF' },
  error: { marginTop: 6, fontSize: 13, color: UI.error },
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
  row: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalBtn: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  danger: { backgroundColor: '#B3263A' },
})
