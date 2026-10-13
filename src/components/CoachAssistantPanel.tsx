import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { CoachCharacterAvatar, CoachEyes } from './CoachCharacterAvatar'
import { CoachClipCard, CoachThinkingTrace } from './CoachThinkingTrace'
import { COACH_CLOSE_IMAGE, COACH_MIC_IMAGE } from '../lib/coachCharacter'
import { useCoachChat, type CoachChatMessage, type CoachPlayback } from '../lib/useCoachChat'

const SURFACE = '#030A17'
const USER_PILL = '#022360'
const BRAND_BLUE = '#0059FF'
const LINK_BLUE = '#006FFF'
const ACCENT = '#00B8FF'
const TYPE_TICK_MS = 16
const TYPE_TOTAL_MS = 1100

const displayText = (s: string) => s.replace(/<[a-z]+>\s*/gi, '').trim()

function formatMs(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function TypewriterText({ text, animate }: { text: string; animate: boolean }) {
  const [shown, setShown] = useState(animate ? 0 : text.length)
  useEffect(() => {
    if (!animate) {
      setShown(text.length)
      return
    }
    const step = Math.max(1, Math.ceil(text.length / (TYPE_TOTAL_MS / TYPE_TICK_MS)))
    const id = setInterval(() => {
      setShown((n) => {
        const next = Math.min(text.length, n + step)
        if (next >= text.length) clearInterval(id)
        return next
      })
    }, TYPE_TICK_MS)
    return () => clearInterval(id)
  }, [text, animate])
  return <Text style={styles.coachText}>{text.slice(0, shown)}</Text>
}

function VoiceControl({
  loading,
  playback,
  onToggle,
  preparingLabel,
}: {
  loading: boolean
  playback: CoachPlayback | null
  onToggle: () => void
  preparingLabel: string
}) {
  if (loading) {
    return (
      <View style={styles.voice}>
        <ActivityIndicator size="small" color={ACCENT} />
        <Text allowFontScaling={false} style={styles.voiceTime}>
          {preparingLabel}
        </Text>
      </View>
    )
  }
  const playing = playback?.playing ?? false
  const progress = playback && playback.durationMs > 0 ? playback.positionMs / playback.durationMs : 0
  return (
    <Pressable style={styles.voice} onPress={onToggle} hitSlop={6}>
      <View style={styles.voicePlay}>
        <Ionicons name={playing ? 'pause' : 'play'} size={12} color="#FFFFFF" />
      </View>
      <View style={styles.voiceTrack}>
        <View style={[styles.voiceFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <Text allowFontScaling={false} style={styles.voiceTime}>
        {playback && playback.durationMs > 0
          ? `${formatMs(playback.positionMs)} / ${formatMs(playback.durationMs)}`
          : '0:00'}
      </Text>
    </Pressable>
  )
}

function MicPulse({ active }: { active: boolean }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!active) {
      v.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true })
    )
    loop.start()
    return () => loop.stop()
  }, [active, v])
  if (!active) return null
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.micPulse,
        {
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
        },
      ]}
    />
  )
}

function CoachLine({ children, thinking = false }: { children: React.ReactNode; thinking?: boolean }) {
  return (
    <View style={styles.coachLine}>
      <View style={styles.coachEyes}>
        <CoachEyes thinking={thinking} />
      </View>
      <View style={styles.coachLineBody}>{children}</View>
    </View>
  )
}

/** Once the reply is in, the clip the coach looked at stays visible under the collapsed trace. */
function ShotAttachment({ message }: { message: CoachChatMessage }) {
  const step = message.trace?.steps.find((s) => s.id === 'video')
  if (!step || step.content?.type !== 'video') return null
  return (
    <View style={styles.attachment}>
      <CoachLine>
        <Text style={styles.coachText}>
          {step.label}
          {step.detail ? <Text style={styles.coachMuted}>{`  ${step.detail}`}</Text> : null}
        </Text>
      </CoachLine>
      <CoachClipCard uri={step.content.uri} />
    </View>
  )
}

type CoachAssistantPanelProps = {
  visible: boolean
  analysisId: string | null
  videoUri: string | null
  /** Opened from a shot: show the conversation panel right away instead of the idle pill. */
  startExpanded: boolean
  onClose: () => void
  onFirstMessage?: () => void
}

export function CoachAssistantPanel({
  visible,
  analysisId,
  videoUri,
  startExpanded,
  onClose,
  onFirstMessage,
}: CoachAssistantPanelProps) {
  const { t } = useTranslation()
  const chat = useCoachChat({ analysisId, videoUri, active: visible, onFirstMessage })
  const { messages, input, setInput, pending, muted, setMuted, micState, notice, playback } = chat
  const scrollRef = useRef<ScrollView>(null)
  const inputRef = useRef<TextInput>(null)

  const expanded = startExpanded || messages.length > 0
  const suggestions = useMemo(
    () => [t('coachCharacter.suggest.shot'), t('coachCharacter.suggest.fix'), t('coachCharacter.suggest.today')],
    [t]
  )
  const thinkingLabel = t('coachCharacter.trace.thinking')
  const doneLabel = useCallback((s: number) => t('coachCharacter.trace.thoughtFor', { count: s }), [t])
  const canSend = input.trim().length > 0 && !pending && micState === 'idle'

  useEffect(() => {
    if (!visible) inputRef.current?.blur()
  }, [visible])

  const status =
    notice ??
    (micState === 'recording'
      ? t('coachCharacter.listening')
      : micState === 'transcribing'
        ? t('coachCharacter.transcribing')
        : null)

  return (
    <View style={[StyleSheet.absoluteFill, !visible && styles.hidden]} pointerEvents={visible ? 'auto' : 'none'}>
      {expanded ? (
        <View style={[StyleSheet.absoluteFill, styles.solidBackdrop]} />
      ) : (
        <Pressable
          style={[StyleSheet.absoluteFill, styles.dimBackdrop]}
          onPress={onClose}
          accessibilityLabel={t('profileSettingsUi.close')}
        />
      )}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={styles.column} pointerEvents="box-none">
          {expanded ? (
            <View style={styles.panel}>
              <LinearGradient
                colors={['rgba(0,72,255,0)', 'rgba(0,72,255,0.1)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.panelHeader}
              >
                <Text allowFontScaling={false} style={styles.welcome} numberOfLines={1}>
                  {t('coachCharacter.welcome')}
                </Text>
                <View style={styles.headerActions}>
                  <Pressable
                    onPress={() => setMuted((m) => !m)}
                    hitSlop={10}
                    style={styles.headerBtn}
                    accessibilityLabel={muted ? t('coachCharacter.unmute') : t('coachCharacter.mute')}
                  >
                    <Ionicons name={muted ? 'volume-mute-outline' : 'volume-high-outline'} size={16} color="#0048FF" />
                  </Pressable>
                  <Pressable
                    onPress={onClose}
                    hitSlop={10}
                    style={styles.headerBtn}
                    accessibilityLabel={t('profileSettingsUi.close')}
                  >
                    <Image source={COACH_CLOSE_IMAGE} style={styles.closeIcon} />
                  </Pressable>
                </View>
              </LinearGradient>

              <ScrollView
                ref={scrollRef}
                style={styles.flex}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              >
                {messages.length === 0 ? (
                  <>
                    <CoachLine>
                      <Text style={styles.coachText}>{t('coachCharacter.greeting')}</Text>
                    </CoachLine>
                    <View style={styles.suggestionsInline}>
                      {suggestions.map((s) => (
                        <Pressable key={s} style={styles.userPill} onPress={() => void chat.send(s)}>
                          <Text allowFontScaling={false} style={styles.userText}>
                            {s}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}
                {messages.map((m) =>
                  m.role === 'user' ? (
                    <View key={m.id} style={styles.userRow}>
                      <View style={styles.userPill}>
                        {m.viaVoice ? (
                          <View style={styles.voiceTag}>
                            <Ionicons name="mic" size={11} color={ACCENT} />
                            <Text allowFontScaling={false} style={styles.voiceTagText}>
                              {t('coachCharacter.transcribed')}
                            </Text>
                          </View>
                        ) : null}
                        <Text style={styles.userText}>{m.content}</Text>
                      </View>
                    </View>
                  ) : (
                    <View key={m.id} style={styles.coachBlock}>
                      {m.trace ? (
                        <CoachThinkingTrace
                          trace={m.trace}
                          thinking={!!m.thinking}
                          thinkingLabel={thinkingLabel}
                          doneLabel={doneLabel}
                        />
                      ) : null}
                      {!m.thinking ? <ShotAttachment message={m} /> : null}
                      {m.content ? (
                        <CoachLine>
                          <TypewriterText text={displayText(m.content)} animate={!!m.animate} />
                          {m.audioLoading || m.audioUri ? (
                            <VoiceControl
                              loading={!!m.audioLoading}
                              playback={playback.id === m.id ? playback : null}
                              onToggle={() => void chat.togglePlay(m.id)}
                              preparingLabel={t('coachCharacter.preparingVoice')}
                            />
                          ) : null}
                        </CoachLine>
                      ) : null}
                    </View>
                  )
                )}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.idleSpacer} pointerEvents="box-none">
              <View style={styles.suggestionsIdle}>
                {suggestions.map((s) => (
                  <Pressable key={s} style={styles.userPill} onPress={() => void chat.send(s)}>
                    <Text allowFontScaling={false} style={styles.userText}>
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {status ? (
            <Text allowFontScaling={false} style={styles.status}>
              {status}
            </Text>
          ) : null}

          <View style={styles.pill}>
            <CoachCharacterAvatar size={47.58} variant="pill" thinking={pending} style={styles.pillOrb} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={t('coachCharacter.placeholder')}
              placeholderTextColor={BRAND_BLUE}
              returnKeyType="send"
              submitBehavior="submit"
              onSubmitEditing={() => void chat.send()}
              editable={micState === 'idle'}
              multiline={false}
            />
            {canSend ? (
              <Pressable
                onPress={() => void chat.send()}
                hitSlop={10}
                style={styles.pillAction}
                accessibilityLabel={t('coachCharacter.send')}
              >
                <Ionicons name="arrow-up-circle" size={30} color={BRAND_BLUE} />
              </Pressable>
            ) : (
              <View style={styles.pillAction}>
                <MicPulse active={micState === 'recording'} />
                <Pressable
                  onPressIn={() => void chat.startHold()}
                  onPressOut={() => void chat.endHold()}
                  hitSlop={12}
                  disabled={pending}
                  accessibilityLabel={t('coachCharacter.holdToTalk')}
                >
                  {micState === 'transcribing' ? (
                    <ActivityIndicator size="small" color={ACCENT} />
                  ) : (
                    <Image source={COACH_MIC_IMAGE} style={styles.micIcon} />
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
  dimBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  solidBackdrop: {
    backgroundColor: SURFACE,
  },
  column: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 30,
    gap: 10,
  },
  idleSpacer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
  },
  panel: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 30,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingVertical: 24,
  },
  welcome: {
    flexShrink: 1,
    color: LINK_BLUE,
    fontSize: 11,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    width: 10,
    height: 10,
  },
  listContent: {
    paddingHorizontal: 30,
    paddingVertical: 20,
    gap: 14,
  },
  userRow: {
    alignItems: 'flex-end',
  },
  userPill: {
    maxWidth: '85%',
    backgroundColor: USER_PILL,
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  voiceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  voiceTagText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '600',
  },
  coachBlock: {
    gap: 10,
    paddingRight: 20,
  },
  coachLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  coachEyes: {
    paddingTop: 5,
  },
  coachLineBody: {
    flex: 1,
  },
  coachText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  coachMuted: {
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '400',
  },
  attachment: {
    gap: 2,
  },
  suggestionsInline: {
    alignItems: 'flex-end',
    gap: 8,
  },
  suggestionsIdle: {
    alignItems: 'flex-end',
    gap: 8,
  },
  voice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  voicePlay: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: USER_PILL,
  },
  voiceTrack: {
    flex: 1,
    maxWidth: 140,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(0,111,255,0.25)',
    overflow: 'hidden',
  },
  voiceFill: {
    height: '100%',
    backgroundColor: LINK_BLUE,
  },
  voiceTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  status: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  pill: {
    marginHorizontal: 20,
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 10,
    paddingRight: 20,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: BRAND_BLUE,
    backgroundColor: SURFACE,
    boxShadow: '0px 0px 30px 0px rgba(0,72,255,0.75)',
  },
  pillOrb: {
    margin: -2.13,
  },
  input: {
    flex: 1,
    height: 43,
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 0,
  },
  pillAction: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIcon: {
    width: 24,
    height: 24,
  },
  micPulse: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5484D',
  },
})
