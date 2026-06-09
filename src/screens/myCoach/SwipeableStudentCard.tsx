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
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { LocalSvgAsset } from '../../components/LocalSvgAsset'
import type { MyCoachStudent } from './types'
import { MyCoachScoreRing } from './ScoreRing'

const SWIPE_MSG_SVG = require('../../../assets/mystudents/message.svg')
const SWIPE_VIDEO_SVG = require('../../../assets/mystudents/videocall.svg')
const SWIPE_PIN_SVG = require('../../../assets/mystudents/pin.svg')
const STUDENT_PIN_ICON = require('../../../assets/mystudents/pinicon.svg')
const SWIPE_ACTION_ICON_SIZE = 36

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

function SwipeActionCell({
  iconModule,
  label,
  onPress,
  regularFont,
}: {
  iconModule: number
  label: string
  onPress: () => void
  regularFont: string
}) {
  return (
    <Pressable style={styles.actionBtn} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} onPress={onPress}>
      <View style={styles.actionBtnInner}>
        <LocalSvgAsset assetModule={iconModule} width={SWIPE_ACTION_ICON_SIZE} height={SWIPE_ACTION_ICON_SIZE} />
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          style={[styles.actionLabel, { fontFamily: regularFont }]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  )
}

export function MyCoachSwipeableStudentCard({
  student,
  openId,
  onOpen,
  fonts,
  onOpenCoachReview,
  onOpenChat,
  onOpenProfile,
  onTogglePin,
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
  /** Tap avatar or name — student profile page. */
  onOpenProfile?: (student: MyCoachStudent) => void
  /** Swipe pin / unpin — toggles roster pin and card badge. */
  onTogglePin?: (student: MyCoachStudent) => void
  viewerIsCoach?: boolean
  onMakeCoach?: (studentUserId: string) => void
}) {
  const { t } = useTranslation()
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

  const onProfilePress = useCallback(() => {
    close()
    onOpenProfile?.(student)
  }, [close, onOpenProfile, student])

  const onPinPress = useCallback(() => {
    close()
    onTogglePin?.(student)
  }, [close, onTogglePin, student])

  const isPinned = student.pinned === true

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
      <View style={styles.actionsRow}>
        <Animated.View style={pinkLeftBarStyle} pointerEvents="none">
          <View style={styles.pinkBarEdge} />
        </Animated.View>
        <View style={[styles.actionsStrip, { width: ACTIONS_WIDTH }]}>
          <SwipeActionCell
            iconModule={SWIPE_MSG_SVG}
            label={t('myCoach.swipeMessage')}
            onPress={onOpenChat ? onMessagePress : () => onSwipeAction('Message')}
            regularFont={fonts.regularFont}
          />
          <SwipeActionCell
            iconModule={SWIPE_VIDEO_SVG}
            label={t('myCoach.swipeVideoCall')}
            onPress={() => onSwipeAction('Video call')}
            regularFont={fonts.regularFont}
          />
          <SwipeActionCell
            iconModule={SWIPE_PIN_SVG}
            label={isPinned ? t('myCoach.unpin') : t('myCoach.pin')}
            onPress={onTogglePin ? onPinPress : () => onSwipeAction('Pin')}
            regularFont={fonts.regularFont}
          />
        </View>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.studentCard, cardAnimStyle]}>
          <Pressable onPress={onOpenProfile ? onProfilePress : undefined} accessibilityRole="button">
            <Image source={student.avatar} style={styles.studentAvatar} resizeMode="cover" />
          </Pressable>
          <View style={styles.studentInfo}>
            <Pressable onPress={onOpenProfile ? onProfilePress : undefined} accessibilityRole="button">
              <Text allowFontScaling={false} style={[styles.studentName, { fontFamily: fonts.semiBoldFont }]}>
                {student.name}
              </Text>
            </Pressable>
            <Text allowFontScaling={false} style={[styles.studentLocation, { fontFamily: fonts.regularFont }]}>
              {student.location}
            </Text>
            {isPinned ? (
              <View style={styles.studentPinRow}>
                <LocalSvgAsset assetModule={STUDENT_PIN_ICON} width={12} height={12} />
              </View>
            ) : null}
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
          <View style={styles.studentTrailing}>
            <MyCoachScoreRing actualScore={student.actualScore} lastScore={student.lastScore} semiBoldFont={fonts.semiBoldFont} />
            <View style={styles.studentBarRightEdge} pointerEvents="none">
              <View style={styles.blueBarEdge} />
            </View>
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
    backgroundColor: '#E94560',
  },
  actionsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E94560',
  },
  actionBtn: {
    width: ACTION_BTN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: 'transparent',
  },
  actionBtnInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: ACTION_BTN_WIDTH - 8,
    includeFontPadding: false,
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
  studentTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    marginRight: -4,
  },
  studentBarRightEdge: {
    height: BAR_EDGE_HEIGHT,
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
  studentPinRow: {
    marginTop: 4,
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
