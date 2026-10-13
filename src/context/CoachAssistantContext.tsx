import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { BackHandler, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CoachAssistantPanel } from '../components/CoachAssistantPanel'

type AssistantFocus = { analysisId: string | null; videoUri: string | null }

type OpenOptions = { analysisId?: string | null; videoUri?: string | null }

type CoachAssistantValue = {
  open: boolean
  /** Shot the current conversation is about (null: the player's latest shot). */
  focusAnalysisId: string | null
  /** True once the player has sent a message in the current conversation. */
  hasChatted: boolean
  openAssistant: (opts?: OpenOptions) => void
  closeAssistant: () => void
  /** The app header reports its height so the overlay starts right under it. */
  reportHeaderHeight: (height: number) => void
}

const NOOP_VALUE: CoachAssistantValue = {
  open: false,
  focusAnalysisId: null,
  hasChatted: false,
  openAssistant: () => {},
  closeAssistant: () => {},
  reportHeaderHeight: () => {},
}

const CoachAssistantContext = createContext<CoachAssistantValue>(NOOP_VALUE)

export function useCoachAssistant(): CoachAssistantValue {
  return useContext(CoachAssistantContext)
}

/** Same formula as both tab bars (`main.tsx` tab options and `MainTabBarChrome`). */
function tabBarHeightFor(bottomInset: number): number {
  return 66 + bottomInset + 10
}

export function CoachAssistantProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState<AssistantFocus>({ analysisId: null, videoUri: null })
  const [sessionKey, setSessionKey] = useState(0)
  const [startExpanded, setStartExpanded] = useState(false)
  const [hasChatted, setHasChatted] = useState(false)
  const [headerHeight, setHeaderHeight] = useState(0)

  const focusRef = useRef(focus)
  focusRef.current = focus

  const openAssistant = useCallback((opts?: OpenOptions) => {
    const analysisId = opts?.analysisId ?? null
    if (analysisId) {
      const prev = focusRef.current
      if (prev.analysisId === analysisId) {
        setFocus({ analysisId, videoUri: opts?.videoUri ?? prev.videoUri })
      } else {
        setFocus({ analysisId, videoUri: opts?.videoUri ?? null })
        setSessionKey((k) => k + 1)
        setHasChatted(false)
      }
      setStartExpanded(true)
    }
    setOpen(true)
  }, [])

  const closeAssistant = useCallback(() => setOpen(false), [])

  const reportHeaderHeight = useCallback((height: number) => {
    setHeaderHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height))
  }, [])

  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(false)
      return true
    })
    return () => sub.remove()
  }, [open])

  const onFirstMessage = useCallback(() => setHasChatted(true), [])

  const value = useMemo<CoachAssistantValue>(
    () => ({
      open,
      focusAnalysisId: focus.analysisId,
      hasChatted,
      openAssistant,
      closeAssistant,
      reportHeaderHeight,
    }),
    [open, focus.analysisId, hasChatted, openAssistant, closeAssistant, reportHeaderHeight]
  )

  return (
    <CoachAssistantContext.Provider value={value}>
      {children}
      <View
        pointerEvents={open ? 'box-none' : 'none'}
        style={[
          styles.layer,
          { top: headerHeight || insets.top + 64, bottom: tabBarHeightFor(insets.bottom) },
          !open && styles.hidden,
        ]}
      >
        <CoachAssistantPanel
          key={sessionKey}
          visible={open}
          analysisId={focus.analysisId}
          videoUri={focus.videoUri}
          startExpanded={startExpanded}
          onClose={closeAssistant}
          onFirstMessage={onFirstMessage}
        />
      </View>
    </CoachAssistantContext.Provider>
  )
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 50,
    elevation: 50,
  },
  hidden: {
    display: 'none',
  },
})
