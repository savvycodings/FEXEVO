import React, { useCallback, useContext, useMemo, useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Share,
  type ImageSourcePropType,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import { authClient } from '../lib/auth-client'
import { DOMAIN } from '../../constants'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainStackParamList, MainTabParamList, MyCoachTabStackParamList } from '../navigation/types'
import { getMainStackNavigation } from '../lib/mainStackNavigation'
import { ThemeContext } from '../context'
import { useSessionData } from '../context/SessionDataContext'
import { vercel as defaultTheme } from '../theme'
import { LocalSvgAsset, prefetchSvgAssets } from '../components/LocalSvgAsset'
import { ProfileHeroScoreBlock } from '../components/ProfileHeroScoreBlock'
import { StaggerChildren, usePageFocusKey } from '../components/PageEntrance'
import { MyCoachCoachHero } from './myCoach/CoachHero'
import { MyCoachSwipeableStudentCard } from './myCoach/SwipeableStudentCard'
import type { MyCoachStudent } from './myCoach/types'
import {
  loadPinnedStudentIds,
  pinStudentId,
  savePinnedStudentIds,
  sortStudentsWithPins,
  unpinStudentId,
} from '../lib/coachPinnedStudents'
import { useTranslation } from 'react-i18next'

const FALLBACK_STUDENT_AVATAR = require('../../assets/coachs/img1.png')

type MyCoachScreenNav = CompositeNavigationProp<
  NativeStackNavigationProp<MyCoachTabStackParamList, 'MyCoachMain'>,
  BottomTabNavigationProp<MainTabParamList>
>

type ApiCoachStudent = {
  id: string
  name: string
  image: string | null
  username: string | null
  /** Coach-only roster field from user_profile; optional. */
  areaLocation?: string | null
  pendingCoachReviewId?: string | null
  coachStudentRole?: string | null
  currentWeekScore?: number | null
  lastWeekScore?: number | null
}

function profileImageToAbsoluteUri(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http')) return trimmed
  const rel = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${DOMAIN.replace(/\/+$/, '')}${rel}`
}

function coachStudentAvatarSource(image: string | null): ImageSourcePropType {
  if (!image || typeof image !== 'string') return FALLBACK_STUDENT_AVATAR
  const base = DOMAIN.replace(/\/+$/, '')
  const trimmed = image.trim()
  if (!trimmed) return FALLBACK_STUDENT_AVATAR
  const rel = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const uri = trimmed.startsWith('http') ? trimmed : `${base}${rel}`
  return { uri }
}

const ADD_NEW_ICON_SVG = require('../../assets/mycoach/addnew.svg')
const YOU_SHARE_ICON = require('../../assets/youpage/shareicon.svg')
const MY_STUDENTS_SVGS = [
  ADD_NEW_ICON_SVG,
  YOU_SHARE_ICON,
  require('../../assets/mystudents/message.svg'),
  require('../../assets/mystudents/videocall.svg'),
  require('../../assets/mystudents/pin.svg'),
  require('../../assets/mystudents/pinicon.svg'),
] as const

prefetchSvgAssets([...MY_STUDENTS_SVGS])

/** Pill matches former addnewbutton.svg; plus uses addnew.svg (16×16). */
const ADD_NEW_BTN_OUTER_H = 60
const ADD_NEW_PILL_H = Math.round((38 / 72) * ADD_NEW_BTN_OUTER_H)
const ADD_NEW_PILL_MIN_W = Math.round((119 / 72) * ADD_NEW_BTN_OUTER_H)
const ADD_NEW_ICON_BOX = Math.max(18, Math.round((24 / 72) * ADD_NEW_BTN_OUTER_H))
const ADD_NEW_LABEL_SIZE = Math.max(14, Math.round((16 / 38) * ADD_NEW_PILL_H))
const ADD_NEW_BLUE = '#1F6CD0'
const ADD_NEW_RING = '#0E2969'

function AddNewStudentButtonPill({ mediumFont }: { mediumFont: string }) {
  const { t } = useTranslation()
  return (
    <View
      style={[
        styles.addNewPill,
        {
          height: ADD_NEW_PILL_H,
          borderRadius: ADD_NEW_PILL_H / 2,
          minWidth: ADD_NEW_PILL_MIN_W,
          paddingHorizontal: 12,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 4, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
            },
            android: { elevation: 6 },
          }),
        },
      ]}
    >
      <LocalSvgAsset assetModule={ADD_NEW_ICON_SVG} width={ADD_NEW_ICON_BOX} height={ADD_NEW_ICON_BOX} />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[
          styles.addNewLabel,
          {
            fontFamily: mediumFont,
            fontSize: ADD_NEW_LABEL_SIZE,
            lineHeight: Math.round(ADD_NEW_LABEL_SIZE * 1.25),
            color: ADD_NEW_BLUE,
          },
        ]}
      >
        {t('myCoach.addNew')}
      </Text>
    </View>
  )
}

const BG = '#030A17'

export function MyCoachScreen() {
  const { t } = useTranslation()
  const { theme: ctx } = useContext(ThemeContext)
  const theme = ctx?.backgroundColor != null ? ctx : defaultTheme
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<MyCoachScreenNav>()
  const focusKey = usePageFocusKey()
  const { onTabFocus, viewerIsCoach, profileRoleLoaded, profileName, overallPillarScore } = useSessionData()

  const [openStudentId, setOpenStudentId] = useState<string | null>(null)
  const [students, setStudents] = useState<MyCoachStudent[]>([])
  const [pinnedStudentIds, setPinnedStudentIds] = useState<string[]>([])
  const [studentsLoading, setStudentsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void loadPinnedStudentIds().then((ids) => {
      if (!cancelled) setPinnedStudentIds(ids)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const loadCoachStudents = useCallback(async () => {
    setStudentsLoading(true)
    try {
      const res = await authClient
        .$fetch('/profile/coach-students', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        .catch(() => null)
      const body = ((res as { data?: unknown })?.data ?? res) as {
        students?: ApiCoachStudent[]
        error?: string
      }
      if (!Array.isArray(body?.students)) {
        setStudents([])
        return
      }
      setStudents(
        body.students.map((s) => {
          const roleRaw = s.coachStudentRole
          const coachStudentRole =
            roleRaw === 'coach' || roleRaw === 'student' || roleRaw === 'none'
              ? roleRaw
              : 'none'
          const notiRow: MyCoachStudent['notiRow'] = s.pendingCoachReviewId ? 'noti-only' : 'none'
          const area = typeof s.areaLocation === 'string' ? s.areaLocation.trim() : ''
          const unameRaw = typeof s.username === 'string' ? s.username.trim() : ''
          const uname = unameRaw.length > 0 ? `@${unameRaw}` : ''
          return {
            id: s.id,
            name: s.name,
            location: area.length > 0 ? area : uname.length > 0 ? uname : '—',
            imageUri: profileImageToAbsoluteUri(s.image),
            actualScore:
              typeof s.currentWeekScore === 'number'
                ? Math.max(0, Math.min(100, Math.round(s.currentWeekScore)))
                : 0,
            lastScore:
              typeof s.lastWeekScore === 'number'
                ? Math.max(0, Math.min(100, Math.round(s.lastWeekScore)))
                : 0,
            avatar: coachStudentAvatarSource(s.image),
            notiRow,
            pendingCoachReviewId: s.pendingCoachReviewId ?? null,
            coachStudentRole,
          }
        })
      )
    } finally {
      setStudentsLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      onTabFocus()
      void loadCoachStudents()
    }, [loadCoachStudents, onTabFocus])
  )

  const fonts = useMemo(
    () => ({
      regularFont: theme.regularFont,
      mediumFont: theme.mediumFont,
      semiBoldFont: theme.semiBoldFont,
    }),
    [theme.regularFont, theme.mediumFont, theme.semiBoldFont]
  )

  const onVideoPicked = useCallback(
    (_uri: string) => {
      navigation.navigate('AICoach')
    },
    [navigation]
  )

  const onAddNewStudent = useCallback(() => {
    const stack = getMainStackNavigation(navigation)
    if (stack) {
      stack.navigate('CoachAddPeople')
      return
    }
    ;(navigation as NativeStackNavigationProp<MainStackParamList>).navigate('CoachAddPeople')
  }, [navigation])

  const onOpenCoachReview = useCallback(
    (reviewId: string) => {
      const stack = getMainStackNavigation(navigation)
      if (stack) {
        stack.navigate('CoachReviewEditor', { reviewId })
        return
      }
      ;(navigation as NativeStackNavigationProp<MainStackParamList>).navigate('CoachReviewEditor', {
        reviewId,
      })
    },
    [navigation]
  )

  const studentNavParams = useCallback(
    (student: MyCoachStudent) => ({
      peerUserId: student.id,
      peerName: student.name,
      peerLocation: student.location,
      actualScore: student.actualScore,
      lastScore: student.lastScore,
      peerImageUri: student.imageUri ?? null,
      pendingCoachReviewId: student.pendingCoachReviewId ?? null,
      showNewVideoBadge: student.notiRow !== 'none',
    }),
    []
  )

  const onOpenStudentProfile = useCallback(
    (student: MyCoachStudent) => {
      setOpenStudentId(null)
      navigation.navigate('StudentProfile', studentNavParams(student))
    },
    [navigation, studentNavParams]
  )

  const onOpenStudentChat = useCallback(
    (student: MyCoachStudent) => {
      setOpenStudentId(null)
      navigation.navigate('CoachStudentChat', {
        ...studentNavParams(student),
      })
    },
    [navigation, studentNavParams]
  )

  const onTogglePinStudent = useCallback((student: MyCoachStudent) => {
    setOpenStudentId(null)
    setPinnedStudentIds((prev) => {
      const isPinned = prev.includes(student.id)
      const next = isPinned ? unpinStudentId(prev, student.id) : pinStudentId(prev, student.id)
      void savePinnedStudentIds(next)
      return next
    })
  }, [])

  const pinnedIdSet = useMemo(() => new Set(pinnedStudentIds), [pinnedStudentIds])

  const displayStudents = useMemo(() => {
    const withPinFlag = students.map((student) => ({
      ...student,
      pinned: pinnedIdSet.has(student.id),
    }))
    return sortStudentsWithPins(withPinFlag, pinnedStudentIds)
  }, [students, pinnedIdSet, pinnedStudentIds])

  const onShareProfile = useCallback(async () => {
    try {
      const name = profileName?.trim() || 'Player'
      const score = overallPillarScore != null ? String(overallPillarScore) : '—'
      await Share.share({
        message: `${name} · Score ${score} on Xevo`,
      })
    } catch {
      /* dismissed */
    }
  }, [profileName, overallPillarScore])

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 28 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <StaggerChildren replayKey={focusKey}>
        {profileRoleLoaded && !viewerIsCoach ? (
          <MyCoachCoachHero coachName="David Blow" fonts={fonts} onUploadedVideo={onVideoPicked} />
        ) : null}

        <ProfileHeroScoreBlock
          horizontalPadding={20}
          premiumLabelNudgeUp={4}
          marginTop={22}
          youPageLayout
          onSharePress={() => void onShareProfile()}
          shareIconModule={YOU_SHARE_ICON}
          shareIconSize={28}
          shareAccessibilityLabel="Share profile"
        />

        <View style={styles.studentsBlock}>
          <View style={styles.studentsTitleRow}>
            <Text allowFontScaling={false} style={[styles.studentsTitle, { fontFamily: theme.regularFont }]}>
              {t('myCoach.students')}
            </Text>
            <TouchableOpacity
              onPress={onAddNewStudent}
              activeOpacity={0.85}
              style={styles.addNewTouch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t('myCoach.addNew')}
            >
              <AddNewStudentButtonPill mediumFont={theme.mediumFont} />
            </TouchableOpacity>
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2AB4FF' }]} />
              <Text allowFontScaling={false} style={[styles.legendText, { fontFamily: theme.regularFont }]}>
                {t('myCoach.actualScore')}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3D58FF' }]} />
              <Text allowFontScaling={false} style={[styles.legendText, { fontFamily: theme.regularFont }]}>
                {t('myCoach.lastScore')}
              </Text>
            </View>
          </View>
        </View>

        {studentsLoading ? (
          <ActivityIndicator color="#00BBFF" style={{ marginVertical: 20 }} />
        ) : displayStudents.length === 0 ? (
          <Text allowFontScaling={false} style={[styles.emptyStudents, { fontFamily: theme.regularFont }]}>
            {t('myCoach.noStudents')}
          </Text>
        ) : (
          displayStudents.map((student) => (
            <MyCoachSwipeableStudentCard
              key={student.id}
              student={student}
              openId={openStudentId}
              onOpen={setOpenStudentId}
              fonts={fonts}
              onOpenCoachReview={onOpenCoachReview}
              onOpenChat={onOpenStudentChat}
              onOpenProfile={onOpenStudentProfile}
              onTogglePin={onTogglePinStudent}
              viewerIsCoach={viewerIsCoach}
            />
          ))
        )}
        </StaggerChildren>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  emptyStudents: {
    marginTop: 8,
    marginBottom: 12,
    fontSize: 14,
    color: 'rgba(232,240,255,0.55)',
    textAlign: 'center',
  },
  studentsBlock: {
    marginBottom: 12,
  },
  studentsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  studentsTitle: {
    flex: 1,
    minWidth: 0,
    color: '#FFFFFF',
    fontSize: 28,
  },
  addNewTouch: {
    justifyContent: 'center',
    height: ADD_NEW_BTN_OUTER_H,
  },
  addNewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: ADD_NEW_RING,
    backgroundColor: 'transparent',
  },
  addNewLabel: {
    flexShrink: 1,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#8FA6CC',
    fontSize: 11,
  },
})
