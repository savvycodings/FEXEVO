import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  TouchableOpacity,
  Alert,
  type LayoutChangeEvent,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolate, runOnJS } from 'react-native-reanimated'
import Ionicons from '@expo/vector-icons/Ionicons'
import { LocalSvgAsset } from '../../components/LocalSvgAsset'
import type { MyCoachStudent } from './types'
import { MyCoachScoreRing } from './ScoreRing'

const SWIPE_MSG_SVG = require('../../../assets/mycoach/messegeicon.svg')
const SWIPE_VIDEO_SVG = require('../../../assets/mycoach/videocallicon.svg')
const SWIPE_PIN_SVG = require('../../../assets/mycoach/pinicon1.svg')
/** Native SVG ratios: 48×50, 54×49, 36×49 — scale to common height for the action strip. */
const SWIPE_ACTION_ICON_H = 48
const SWIPE_MSG_W = Math.round((48 / 50) * SWIPE_ACTION_ICON_H)
const SWIPE_VIDEO_W = Math.round((54 / 49) * SWIPE_ACTION_ICON_H)
const SWIPE_PIN_W = Math.round((36 / 49) * SWIPE_ACTION_ICON_H)

const SPRING_CFG = { damping: 22, stiffness: 220, mass: 0.8 } as const
const ACTION_BTN_WIDTH = 78
const ACTION_COUNT = 3
const ACTIONS_WIDTH = ACTION_BTN_WIDTH * ACTION_COUNT
const BAR_EDGE_WIDTH = 5
const BAR_EDGE_HEIGHT = 36
const BAR_EDGE_CENTER_OFFSET = BAR_EDGE_HEIGHT / 2

type ThemeFonts = {
  semiBoldFont: string
  regularFont: string
}

export function MyCoachSwipeableStudentCard({
  student,
  openId,
  onOpen,
  fonts,
  onOpenCoachReview,
  onOpenChat,
  viewerIsCoach,
  onMakeCoach,
}: {
  student: MyCoachStudent
  openId: string | null
  onOpen: (id: string | null) => void
  fonts: ThemeFonts
  /** When student has a pending coach video review, tap strip opens the editor. */
  onOpenCoachReview?: (reviewId: string) => void
  /** Swipe “Message” — private coach ↔ student thread. */
  onOpenChat?: (student: MyCoachStudent) => void
  viewerIsCoach?: boolean
  onMakeCoach?: (studentUserId: string) => void
}) {
  const translateX = useSharedValue(0)
  const startX = useSharedValue(0)
  const cardWidthSV = useSharedValue(0)
  const [cardWidth, setCardWidth] = useState(0)

  const isOpen = openId === student.id
  const threshold = Math.max(48, cardWidth * 0.35)

  useEffect(() => {
    if (!isOpen) {
      translateX.value = withSpring(0, SPRING_CFG)
    }
  }, [isOpen, translateX])

  const close = useCallback(() => onOpen(null), [onOpen])
  const open = useCallback(() => onOpen(student.id), [onOpen, student.id])

  const onSwipeAction = useCallback(
    (label: string) => {
      close()
      Alert.alert(label, `Action for ${student.name} — connect calls / pins here.`)
    },
    [close, student.name]
  )

  const onMessagePress = useCallback(() => {
    close()
    onOpenChat?.(student)
  }, [close, onOpenChat, student])

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart(() => {
      startX.value = translateX.value
    })
    .onUpdate((e) => {
      const next = startX.value + e.translationX
      translateX.value = Math.min(0, Math.max(-ACTIONS_WIDTH, next))
    })
    .onEnd((e) => {
      const shouldOpen = translateX.value < -threshold || e.velocityX < -500
      if (shouldOpen) {
        translateX.value = withSpring(-ACTIONS_WIDTH, SPRING_CFG)
        runOnJS(open)()
      } else {
        translateX.value = withSpring(0, SPRING_CFG)
        runOnJS(close)()
      }
    })

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  const actionsAnimStyle = useAnimatedStyle(() => {
    const progress = interpolate(-translateX.value, [0, ACTIONS_WIDTH], [0, 1])
    return {
      opacity: progress,
      transform: [{ scale: interpolate(progress, [0, 1], [0.85, 1]) }],
    }
  })

  const pinkLeftBarStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: cardWidthSV.value + translateX.value,
    top: '50%' as const,
    height: BAR_EDGE_HEIGHT,
    marginTop: -BAR_EDGE_CENTER_OFFSET,
    width: BAR_EDGE_WIDTH,
  }))

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    setCardWidth(w)
    cardWidthSV.value = w
  }

  const pendingReviewId = student.pendingCoachReviewId ?? null

  return (
    <View style={styles.swipeOuter} onLayout={handleLayout}>
      {pendingReviewId && onOpenCoachReview ? (
        <Pressable
          style={styles.reviewPill}
          onPress={() => onOpenCoachReview(pendingReviewId)}
          accessibilityLabel="Open coach video review"
        >
          <Ionicons name="videocam" size={14} color="#FFFFFF" />
          <Text allowFontScaling={false} style={[styles.reviewPillText, { fontFamily: fonts.semiBoldFont }]}>
            New video
          </Text>
        </Pressable>
      ) : null}
      <Animated.View style={[styles.actionsRow, actionsAnimStyle]}>
        <Animated.View style={pinkLeftBarStyle} pointerEvents="none">
          <View style={styles.pinkBarEdge} />
        </Animated.View>
        <View style={[styles.actionsStrip, { width: ACTIONS_WIDTH }]}>
          <Pressable
            style={styles.actionBtn}
            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
            onPress={onOpenChat ? onMessagePress : () => onSwipeAction('Message')}
          >
            <LocalSvgAsset assetModule={SWIPE_MSG_SVG} width={SWIPE_MSG_W} height={SWIPE_ACTION_ICON_H} />
          </Pressable>
          <Pressable
            style={styles.actionBtn}
            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
            onPress={() => onSwipeAction('Video call')}
          >
            <LocalSvgAsset assetModule={SWIPE_VIDEO_SVG} width={SWIPE_VIDEO_W} height={SWIPE_ACTION_ICON_H} />
          </Pressable>
          <Pressable
            style={styles.actionBtn}
            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
            onPress={() => onSwipeAction('Pin')}
          >
            <LocalSvgAsset assetModule={SWIPE_PIN_SVG} width={SWIPE_PIN_W} height={SWIPE_ACTION_ICON_H} />
          </Pressable>
        </View>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.studentCard, cardAnimStyle]}>
          <Image source={student.avatar} style={styles.studentAvatar} resizeMode="cover" />
          <View style={styles.studentInfo}>
            <Text allowFontScaling={false} style={[styles.studentName, { fontFamily: fonts.semiBoldFont }]}>
              {student.name}
            </Text>
            <Text allowFontScaling={false} style={[styles.studentLocation, { fontFamily: fonts.regularFont }]}>
              {student.location}
            </Text>
            {student.notiRow !== 'none' && (
              <View style={styles.studentNotiRow}>
                {student.notiRow === 'pin-msg-noti' && (
                  <>
                    <Ionicons name="pin" size={14} color="#64748B" />
                    <Ionicons name="chatbubble-outline" size={14} color="#64748B" />
                    <Ionicons name="notifications-outline" size={14} color="#64748B" />
                  </>
                )}
                {student.notiRow === 'noti-only' && (
                  <Ionicons name="notifications-outline" size={14} color="#64748B" />
                )}
                <Text allowFontScaling={false} style={[styles.studentVideo, { fontFamily: fonts.regularFont }]}>
                  New video
                </Text>
              </View>
            )}
            {viewerIsCoach && onMakeCoach && student.coachStudentRole !== 'coach' ? (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => onMakeCoach(student.id)}
                style={styles.makeCoachOuter}
                accessibilityLabel="Make this person a coach"
              >
                <LinearGradient
                  colors={['#0022FF', '#00BBFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.makeCoachInner}
                >
                  <Text allowFontScaling={false} style={[styles.makeCoachText, { fontFamily: fonts.semiBoldFont }]}>
                    Make coach
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}
          </View>
          <MyCoachScoreRing actualScore={student.actualScore} lastScore={student.lastScore} semiBoldFont={fonts.semiBoldFont} />
          <View style={styles.studentBarRightEdge} pointerEvents="none">
            <View style={styles.blueBarEdge} />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  swipeOuter: {
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  reviewPill: {
    position: 'absolute',
    right: 10,
    top: 8,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#1D4ED8',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.8)',
  },
  reviewPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    letterSpacing: 0.2,
  },
  actionsRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E94560',
  },
  actionsStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#E94560',
    overflow: 'hidden',
  },
  actionBtn: {
    width: ACTION_BTN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: 'transparent',
  },
  pinkBarEdge: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    backgroundColor: '#F472B6',
  },
  blueBarEdge: {
    width: '100%',
    height: '100%',
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: '#3B82F6',
  },
  studentBarRightEdge: {
    position: 'absolute',
    right: 4,
    top: '50%',
    height: BAR_EDGE_HEIGHT,
    marginTop: -BAR_EDGE_CENTER_OFFSET,
    width: BAR_EDGE_WIDTH,
    zIndex: 10,
    elevation: 4,
  },
  makeCoachOuter: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 12,
    overflow: 'hidden',
  },
  makeCoachInner: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  makeCoachText: {
    color: '#FFFFFF',
    fontSize: 11,
    letterSpacing: 0.2,
  },
  studentCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F3F6FB',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  studentAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#2AB4FF',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    color: '#111827',
    fontSize: 16,
  },
  studentLocation: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 1,
  },
  studentNotiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  studentVideo: {
    color: '#9AA2AF',
    fontSize: 13,
    marginLeft: 2,
  },
})
