import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { authClient } from '../lib/auth-client'
import { getCachedProfile } from '../lib/profile-cache'
import { TAB_REFETCH_COOLDOWN_MS } from '../lib/tab-refetch-cooldown'
import {
  fetchGamificationState,
  type GamificationQuestRow,
  type GamificationState,
} from '../lib/gamificationApi'
import type { ActivitySession } from '../lib/activitySession'
import { DOMAIN } from '../../constants'

export type RatingCategoryRow = {
  id: string
  thisWeek: number
  lastWeek: number
  /** Completed analyses in current UTC week (Mon–Sun); from `/profile/rating-by-category`. */
  thisWeekCount?: number
  lastWeekCount?: number
}

function profileImageToAbsoluteUri(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http')) return trimmed
  const rel = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${DOMAIN.replace(/\/+$/, '')}${rel}`
}

function deriveOverallPillarScore(rows: RatingCategoryRow[]): number | null {
  const ids = ['save_return', 'ground_strokes', 'net_play', 'defence_glass', 'overhead'] as const
  const values = ids
    .map((id) => rows.find((r) => r.id === id)?.thisWeek)
    .filter((v): v is number => typeof v === 'number')
    .map((v) => Math.round(Math.max(0, Math.min(100, v))))
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null
}

type CoachStudentRole = 'none' | 'coach' | 'student'

type SessionDataContextValue = {
  activities: ActivitySession[]
  activitiesLoading: boolean
  activitiesError: string | null
  ratingCategories: RatingCategoryRow[] | null
  ratingLoading: boolean
  ratingError: string | null
  profileName: string | null
  profileImageUri: string | null
  /** Saved `profile.areaLocation` (country name or ISO code); drives the shield flag. */
  profileAreaLocation: string | null
  coachStudentRole: CoachStudentRole
  viewerIsCoach: boolean
  /** True after cache or `/profile/me` has resolved coach vs student role. */
  profileRoleLoaded: boolean
  overallPillarScore: number | null
  totalXp: number
  xpInLevel: number
  xpGoal: number
  playerLevel: number
  playerTier: string
  loginStreak: number
  claimedAchievementKeys: Set<string>
  claimableAchievementKeys: Set<string>
  dailyQuests: GamificationQuestRow[]
  weeklyQuests: GamificationQuestRow[]
  seasonQuests: GamificationQuestRow[]
  weeklyPeriodKey: string
  seasonPeriodKey: string
  gamificationLoading: boolean
  refreshGamification: () => Promise<void>
  /** When user focuses Activities / You / Progress — refreshes stale slices (cooldown). */
  onTabFocus: () => void
  /** After profile edit or when you need fresh server data. */
  invalidate: () => void
}

const SessionDataContext = createContext<SessionDataContextValue | null>(null)

export function useSessionData(): SessionDataContextValue {
  const v = useContext(SessionDataContext)
  if (!v) throw new Error('useSessionData must be used within SessionDataProvider')
  return v
}

export function SessionDataProvider({
  children,
  profileRefreshTick,
}: {
  children: ReactNode
  profileRefreshTick: number
}) {
  const [activities, setActivities] = useState<ActivitySession[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(true)
  const [activitiesError, setActivitiesError] = useState<string | null>(null)

  const [ratingCategories, setRatingCategories] = useState<RatingCategoryRow[] | null>(null)
  const [ratingLoading, setRatingLoading] = useState(true)
  const [ratingError, setRatingError] = useState<string | null>(null)

  const [profileName, setProfileName] = useState<string | null>(null)
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null)
  const [profileAreaLocation, setProfileAreaLocation] = useState<string | null>(null)
  const [coachStudentRole, setCoachStudentRole] = useState<CoachStudentRole>('none')
  const [profileRoleLoaded, setProfileRoleLoaded] = useState(false)
  const [overallPillarScore, setOverallPillarScore] = useState<number | null>(null)
  const [totalXp, setTotalXp] = useState(0)
  const [xpInLevel, setXpInLevel] = useState(0)
  const [xpGoal, setXpGoal] = useState(2500)
  const [playerLevel, setPlayerLevel] = useState(1)
  const [playerTier, setPlayerTier] = useState('Rookie')
  const [loginStreak, setLoginStreak] = useState(0)
  const [claimedAchievementKeys, setClaimedAchievementKeys] = useState<Set<string>>(
    () => new Set()
  )
  const [claimableAchievementKeys, setClaimableAchievementKeys] = useState<Set<string>>(
    () => new Set()
  )
  const [dailyQuests, setDailyQuests] = useState<GamificationQuestRow[]>([])
  const [weeklyQuests, setWeeklyQuests] = useState<GamificationQuestRow[]>([])
  const [seasonQuests, setSeasonQuests] = useState<GamificationQuestRow[]>([])
  const [weeklyPeriodKey, setWeeklyPeriodKey] = useState('')
  const [seasonPeriodKey, setSeasonPeriodKey] = useState('')
  const [gamificationLoading, setGamificationLoading] = useState(true)
  const viewerIsCoach = coachStudentRole === 'coach'

  const lastActivitiesOkAt = useRef(0)
  const lastRatingOkAt = useRef(0)
  const lastProfileOkAt = useRef(0)
  const lastGamificationOkAt = useRef(0)
  const activitiesCountRef = useRef(0)
  const bootstrapDone = useRef(false)
  const profileTickMounted = useRef(false)

  useEffect(() => {
    activitiesCountRef.current = activities.length
  }, [activities.length])

  const fetchActivities = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent && activitiesCountRef.current > 0)
    if (!silent) {
      setActivitiesError(null)
      setActivitiesLoading(true)
    }
    try {
      const res = await authClient
        .$fetch<{ items?: ActivitySession[]; error?: string }>('/technique/activities', { method: 'GET' })
        .catch((err) => ({ error: err?.message || 'Failed to load' } as { error: string }))
      const body: any = (res as any)?.data ?? res
      if (body?.error) {
        if (!silent) {
          setActivitiesError(String(body.error))
          setActivities([])
        }
      } else {
        setActivities(Array.isArray(body?.items) ? body.items : [])
        lastActivitiesOkAt.current = Date.now()
        if (silent) setActivitiesError(null)
      }
    } catch (e: any) {
      if (!silent) {
        setActivitiesError(e?.message || 'Failed to load activities')
        setActivities([])
      }
    } finally {
      if (!silent) setActivitiesLoading(false)
    }
  }, [])

  const fetchRating = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent && lastRatingOkAt.current > 0)
    if (!silent) {
      setRatingError(null)
      setRatingLoading(true)
    }
    try {
      const res = await authClient
        .$fetch<{ categories?: RatingCategoryRow[]; error?: string }>('/profile/rating-by-category', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        .catch((err) => ({ error: err?.message || 'Failed to load' } as { error: string }))
      const body: any = (res as any)?.data ?? res
      if (body?.error) {
        if (!silent) {
          setRatingError(String(body.error))
          setRatingCategories([])
        }
      } else if (Array.isArray(body?.categories)) {
        setRatingCategories(body.categories)
        setOverallPillarScore(deriveOverallPillarScore(body.categories))
        lastRatingOkAt.current = Date.now()
        if (silent) setRatingError(null)
      } else {
        setRatingCategories([])
        setOverallPillarScore(null)
        lastRatingOkAt.current = Date.now()
      }
    } catch (e: any) {
      if (!silent) {
        setRatingError(e?.message || 'Failed to load')
        setRatingCategories([])
      }
    } finally {
      if (!silent) setRatingLoading(false)
    }
  }, [])

  const applyGamificationState = useCallback((state: GamificationState) => {
    setTotalXp(state.totalXp)
    setXpInLevel(state.xpInLevel)
    setXpGoal(state.xpGoal)
    setPlayerLevel(state.level)
    setPlayerTier(state.tier)
    setLoginStreak(state.loginStreak)
    setClaimedAchievementKeys(new Set(state.achievements.map((a) => a.key)))
    setClaimableAchievementKeys(
      new Set((state.claimableAchievements ?? []).map((a) => a.key))
    )
    setDailyQuests(state.dailyQuests ?? [])
    setWeeklyQuests(state.weeklyQuests ?? [])
    setSeasonQuests(state.seasonQuests ?? [])
    setWeeklyPeriodKey(state.weeklyPeriodKey ?? '')
    setSeasonPeriodKey(state.seasonPeriodKey ?? '')
    lastGamificationOkAt.current = Date.now()
  }, [])

  const fetchGamification = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent && lastGamificationOkAt.current > 0)
    if (!silent) setGamificationLoading(true)
    try {
      const state = await fetchGamificationState()
      if (state) {
        applyGamificationState(state)
      }
    } finally {
      if (!silent) setGamificationLoading(false)
    }
  }, [applyGamificationState])

  const refreshGamification = useCallback(async () => {
    lastGamificationOkAt.current = 0
    await fetchGamification({ silent: false })
  }, [fetchGamification])

  const fetchProfile = useCallback(async () => {
    try {
      const res = await authClient.$fetch('/profile/me', { method: 'GET' }).catch(() => null)
      if (res == null) {
        // Do not advance cooldown — first call can run before auth is ready; tab focus will retry.
        return
      }
      const body = ((res as { data?: unknown })?.data ?? res) as {
        user?: { name?: string; image?: string | null }
        profile?: { areaLocation?: string | null; coachStudentRole?: string | null } | null
      }
      if (!body?.user) {
        return
      }
      const rawName = body.user.name
      const n = typeof rawName === 'string' ? rawName.trim() : ''
      if (n) setProfileName(n)
      setProfileImageUri(profileImageToAbsoluteUri(body.user.image))
      const area = body.profile?.areaLocation
      setProfileAreaLocation(typeof area === 'string' && area.trim() ? area.trim() : null)
      if (body.profile != null) {
        const cr = body.profile.coachStudentRole
        setCoachStudentRole(cr === 'coach' || cr === 'student' ? cr : 'none')
      }
      setProfileRoleLoaded(true)
      lastProfileOkAt.current = Date.now()
    } catch {
      /* keep previous */
    }
  }, [])

  const hydrateFromCache = useCallback(async () => {
    const cached = await getCachedProfile().catch(() => null)
    const rawCachedName = cached?.user?.name
    const n = typeof rawCachedName === 'string' ? rawCachedName.trim() : ''
    if (n) setProfileName(n)
    setProfileImageUri(profileImageToAbsoluteUri(cached?.user?.image))
    const area = cached?.profile?.areaLocation
    if (typeof area === 'string' && area.trim()) {
      setProfileAreaLocation(area.trim())
    }
    const cr = cached?.profile?.coachStudentRole
    if (cr === 'coach' || cr === 'student' || cr === 'none') {
      setCoachStudentRole(cr)
      setProfileRoleLoaded(true)
    }
  }, [])

  const invalidate = useCallback(() => {
    lastActivitiesOkAt.current = 0
    lastRatingOkAt.current = 0
    lastProfileOkAt.current = 0
    lastGamificationOkAt.current = 0
    void fetchActivities({ silent: false })
    void fetchRating({ silent: false })
    void fetchProfile()
    void fetchGamification({ silent: false })
  }, [fetchActivities, fetchRating, fetchProfile, fetchGamification])

  const onTabFocus = useCallback(() => {
    const now = Date.now()
    const needActivities =
      activitiesCountRef.current === 0 || now - lastActivitiesOkAt.current >= TAB_REFETCH_COOLDOWN_MS
    const needRating =
      lastRatingOkAt.current === 0 || now - lastRatingOkAt.current >= TAB_REFETCH_COOLDOWN_MS
    const profileCooldownOk =
      lastProfileOkAt.current === 0 || now - lastProfileOkAt.current >= TAB_REFETCH_COOLDOWN_MS
    const gamificationCooldownOk =
      lastGamificationOkAt.current === 0 ||
      now - lastGamificationOkAt.current >= TAB_REFETCH_COOLDOWN_MS

    if (needActivities) {
      void fetchActivities({ silent: activitiesCountRef.current > 0 })
    }
    if (needRating) {
      void fetchRating({ silent: lastRatingOkAt.current > 0 })
    }
    void hydrateFromCache()
    if (profileCooldownOk) {
      void fetchProfile()
    }
    if (gamificationCooldownOk) {
      void fetchGamification({ silent: lastGamificationOkAt.current > 0 })
    }
  }, [fetchActivities, fetchRating, fetchProfile, fetchGamification, hydrateFromCache])

  useEffect(() => {
    if (bootstrapDone.current) return
    bootstrapDone.current = true
    void hydrateFromCache()
    void fetchActivities({ silent: false })
    void fetchRating({ silent: false })
    void fetchProfile()
    void fetchGamification({ silent: false })
  }, [fetchActivities, fetchRating, fetchProfile, fetchGamification, hydrateFromCache])

  useEffect(() => {
    if (!profileTickMounted.current) {
      profileTickMounted.current = true
      return
    }
    invalidate()
  }, [profileRefreshTick, invalidate])

  const value = useMemo(
    () => ({
      activities,
      activitiesLoading,
      activitiesError,
      ratingCategories,
      ratingLoading,
      ratingError,
      profileName,
      profileImageUri,
      profileAreaLocation,
      coachStudentRole,
      viewerIsCoach,
      profileRoleLoaded,
      overallPillarScore,
      totalXp,
      xpInLevel,
      xpGoal,
      playerLevel,
      playerTier,
      loginStreak,
      claimedAchievementKeys,
      claimableAchievementKeys,
      dailyQuests,
      weeklyQuests,
      seasonQuests,
      weeklyPeriodKey,
      seasonPeriodKey,
      gamificationLoading,
      refreshGamification,
      onTabFocus,
      invalidate,
    }),
    [
      activities,
      activitiesLoading,
      activitiesError,
      ratingCategories,
      ratingLoading,
      ratingError,
      profileName,
      profileImageUri,
      profileAreaLocation,
      coachStudentRole,
      viewerIsCoach,
      profileRoleLoaded,
      overallPillarScore,
      totalXp,
      xpInLevel,
      xpGoal,
      playerLevel,
      playerTier,
      loginStreak,
      claimedAchievementKeys,
      claimableAchievementKeys,
      dailyQuests,
      weeklyQuests,
      seasonQuests,
      weeklyPeriodKey,
      seasonPeriodKey,
      gamificationLoading,
      refreshGamification,
      onTabFocus,
      invalidate,
    ]
  )

  return <SessionDataContext.Provider value={value}>{children}</SessionDataContext.Provider>
}
