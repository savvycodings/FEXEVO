import React, { useCallback, useContext, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  useWindowDimensions,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
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
import { ThemeContext } from '../context'
import { vercel as defaultTheme } from '../theme'
import { getCachedProfile } from '../lib/profile-cache'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import { ShieldProportionalFrame } from '../components/ShieldProportionalFrame'
import { MyCoachCoachHero } from './myCoach/CoachHero'
import { MyCoachSwipeableStudentCard } from './myCoach/SwipeableStudentCard'
import type { MyCoachStudent } from './myCoach/types'

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
/** Pill matches former addnewbutton.svg; plus uses addnew.svg (16×16). */
const ADD_NEW_BTN_OUTER_H = 60
const ADD_NEW_PILL_H = Math.round((38 / 72) * ADD_NEW_BTN_OUTER_H)
const ADD_NEW_PILL_MIN_W = Math.round((119 / 72) * ADD_NEW_BTN_OUTER_H)
const ADD_NEW_ICON_BOX = Math.max(18, Math.round((24 / 72) * ADD_NEW_BTN_OUTER_H))
const ADD_NEW_LABEL_SIZE = Math.max(14, Math.round((16 / 38) * ADD_NEW_PILL_H))
const ADD_NEW_BLUE = '#1F6CD0'
const ADD_NEW_RING = '#0E2969'

function AddNewStudentButtonPill({ mediumFont }: { mediumFont: string }) {
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
        Add new
      </Text>
    </View>
  )
}

const BG = '#030A17'
const SCORE_BG = require('../../assets/aicoach/scorepng.png')
const SMALL_SHIELD_CAP_REF_WIN_W = 430

export function MyCoachScreen() {
  const { theme: ctx } = useContext(ThemeContext)
  const theme = ctx?.backgroundColor != null ? ctx : defaultTheme
  const insets = useSafeAreaInsets()
  const { width: winW } = useWindowDimensions()
  const navigation = useNavigation<MyCoachScreenNav>()

  const rootStackNavigation = useCallback(
    () => navigation.getParent()?.getParent() as NativeStackNavigationProp<MainStackParamList> | undefined,
    [navigation]
  )

  const [openStudentId, setOpenStudentId] = useState<string | null>(null)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null)
  const [overallPillarScore, setOverallPillarScore] = useState<number | null>(null)
  const [students, setStudents] = useState<MyCoachStudent[]>([])
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [viewerIsCoach, setViewerIsCoach] = useState(false)

  const loadCoachOverallScore = useCallback(async () => {
    try {
      const res = await authClient
        .$fetch<{ categories?: { id: string; thisWeek: number }[] }>('/profile/rating-by-category', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        .catch(() => null)
      const body = ((res as { data?: unknown })?.data ?? res) as {
        categories?: { id: string; thisWeek: number }[]
      }
      const rows = Array.isArray(body?.categories) ? body.categories : []
      if (!rows.length) {
        setOverallPillarScore(null)
        return
      }
      const PILLAR_IDS = ['save_return', 'ground_strokes', 'net_play', 'defence_glass', 'overhead'] as const
      const values: number[] = []
      for (const id of PILLAR_IDS) {
        const row = rows.find((r) => r.id === id)
        if (typeof row?.thisWeek === 'number') {
          values.push(Math.round(Math.max(0, Math.min(100, Number(row.thisWeek) || 0))))
        }
      }
      if (!values.length) {
        setOverallPillarScore(null)
        return
      }
      const avg = Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
      setOverallPillarScore(avg)
    } catch {
      setOverallPillarScore(null)
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
      let mounted = true
      void getCachedProfile().then((cached) => {
        if (!mounted) return
        const n = cached?.user?.name?.trim()
        setProfileName(n && n.length > 0 ? n : null)
        setProfileImageUri(profileImageToAbsoluteUri(cached?.user?.image))
        const cr = cached?.profile?.coachStudentRole
        setViewerIsCoach(cr === 'coach')
      })
      void authClient.$fetch('/profile/me', { method: 'GET' }).then((res) => {
        if (!mounted) return
        const body = ((res as { data?: unknown })?.data ?? res) as {
          user?: { name?: string; image?: string | null }
          profile?: { coachStudentRole?: string }
        }
        const n = body?.user?.name?.trim()
        if (n) setProfileName(n)
        setProfileImageUri(profileImageToAbsoluteUri(body?.user?.image))
        setViewerIsCoach(body?.profile?.coachStudentRole === 'coach')
      })
      void loadCoachOverallScore()
      void loadCoachStudents()
      return () => {
        mounted = false
      }
    }, [loadCoachOverallScore, loadCoachStudents])
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
    rootStackNavigation()?.navigate('CoachAddPeople')
  }, [rootStackNavigation])

  const onOpenCoachReview = useCallback(
    (reviewId: string) => {
      rootStackNavigation()?.navigate('CoachReviewEditor', { reviewId })
    },
    [rootStackNavigation]
  )

  const onOpenStudentChat = useCallback(
    (student: MyCoachStudent) => {
      setOpenStudentId(null)
      navigation.navigate('CoachStudentChat', {
        peerUserId: student.id,
        peerName: student.name,
        peerLocation: student.location,
        actualScore: student.actualScore,
        lastScore: student.lastScore,
        peerImageUri: student.imageUri ?? null,
        pendingCoachReviewId: student.pendingCoachReviewId ?? null,
        showNewVideoBadge: student.notiRow !== 'none',
      })
    },
    [navigation]
  )

  const heroH = useMemo(() => Math.min(220, Math.max(160, winW * 0.42)), [winW])
  const shieldMaxW = useMemo(() => {
    const heroRowInnerW = winW - 40
    const approxColW = (heroRowInnerW - 10) / 2
    const current = Math.min(approxColW, winW * 0.44)
    const refHeroRowInnerW = SMALL_SHIELD_CAP_REF_WIN_W - 40
    const refApproxColW = (refHeroRowInnerW - 10) / 2
    const reference = Math.min(refApproxColW, SMALL_SHIELD_CAP_REF_WIN_W * 0.44)
    return Math.min(current, reference)
  }, [winW])
  const heroLayout = useMemo(
    () => ({
      shieldCol: { flex: 1, alignItems: 'center' as const, maxWidth: winW * 0.44 },
      scoreCol: { flex: 1, alignItems: 'center' as const, maxWidth: winW * 0.5 },
    }),
    [winW]
  )

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 28 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <MyCoachCoachHero coachName="David Blow" fonts={fonts} onUploadedVideo={onVideoPicked} />

        <View style={styles.heroRow}>
          <View style={heroLayout.shieldCol}>
            <View style={[styles.shieldSlot, { height: heroH }]}>
              <ShieldProportionalFrame
                maxWidth={shieldMaxW}
                maxHeight={heroH}
                variant="small"
                coachName={profileName?.trim() ?? ''}
                coachImageUri={profileImageUri}
                showName={false}
                showScore={false}
                showCrest={false}
                showFlag
                showPillarScores
              />
            </View>
          </View>
          <View style={heroLayout.scoreCol}>
            <View style={{ width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={SCORE_BG} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} resizeMode="contain" />
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', transform: [{ translateX: -5 }] }}>
                <View style={{ alignItems: 'center', marginTop: 10 }}>
                  <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: theme.semiBoldFont, fontSize: 13, color: '#FFFFFF', marginBottom: 1 }}>
                    {profileName ?? ''}
                  </Text>
                  <Text allowFontScaling={false} style={{ fontFamily: theme.mediumFont, fontSize: 10, color: '#00BBFF', letterSpacing: 0.5 }}>
                    Premium
                  </Text>
                </View>
                <View style={{ position: 'absolute', top: '50%', alignItems: 'center', transform: [{ translateY: -27 }] }}>
                  <Text allowFontScaling={false} style={{ fontFamily: theme.boldFont ?? theme.semiBoldFont, fontSize: 36, color: '#FFFFFF', lineHeight: 40 }}>
                    {overallPillarScore != null ? overallPillarScore : 54}
                  </Text>
                  <Text allowFontScaling={false} style={{ fontFamily: theme.regularFont, fontSize: 11, color: 'rgba(200,220,255,0.7)', marginTop: -1 }}>
                    Score
                  </Text>
                </View>
                <View style={{ position: 'absolute', bottom: 12, flexDirection: 'row', gap: 20 }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text allowFontScaling={false} style={{ fontFamily: theme.semiBoldFont, fontSize: 15, color: '#FFFFFF', lineHeight: 18 }}>0</Text>
                    <Text allowFontScaling={false} style={{ fontFamily: theme.regularFont, fontSize: 9, color: 'rgba(200,220,255,0.6)', marginTop: 1 }}>Following</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text allowFontScaling={false} style={{ fontFamily: theme.semiBoldFont, fontSize: 15, color: '#FFFFFF', lineHeight: 18 }}>0</Text>
                    <Text allowFontScaling={false} style={{ fontFamily: theme.regularFont, fontSize: 9, color: 'rgba(200,220,255,0.6)', marginTop: 1 }}>Followers</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.studentsBlock}>
          <View style={styles.studentsTitleRow}>
            <Text allowFontScaling={false} style={[styles.studentsTitle, { fontFamily: theme.regularFont }]}>
              Students
            </Text>
            <TouchableOpacity
              onPress={onAddNewStudent}
              activeOpacity={0.85}
              style={styles.addNewTouch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Add new"
            >
              <AddNewStudentButtonPill mediumFont={theme.mediumFont} />
            </TouchableOpacity>
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2AB4FF' }]} />
              <Text allowFontScaling={false} style={[styles.legendText, { fontFamily: theme.regularFont }]}>
                Actual Score
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3D58FF' }]} />
              <Text allowFontScaling={false} style={[styles.legendText, { fontFamily: theme.regularFont }]}>
                Last score
              </Text>
            </View>
          </View>
        </View>

        {studentsLoading ? (
          <ActivityIndicator color="#00BBFF" style={{ marginVertical: 20 }} />
        ) : students.length === 0 ? (
          <Text allowFontScaling={false} style={[styles.emptyStudents, { fontFamily: theme.regularFont }]}>
            No students yet. Tap Add new to add people from search.
          </Text>
        ) : (
          students.map((student) => (
            <MyCoachSwipeableStudentCard
              key={student.id}
              student={student}
              openId={openStudentId}
              onOpen={setOpenStudentId}
              fonts={fonts}
              onOpenCoachReview={onOpenCoachReview}
              onOpenChat={onOpenStudentChat}
              viewerIsCoach={viewerIsCoach}
            />
          ))
        )}
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
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 20,
  },
  shieldSlot: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreImg: {
    width: '100%',
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
