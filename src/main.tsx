import { useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { StyleSheet, View, Text, Platform, useWindowDimensions } from 'react-native'
import {
  Technique,
  Profile,
  ProfileSettingsScreen,
  AdminHub,
  AdminTrain,
  AdminFalLora,
  AdminAccuracy,
  ActivitiesScreen,
  MyCoachScreen,
  ProgressScreen,
  DailyQuestScreen,
  AllAchievementsScreen,
  NotificationsScreen,
  ProScreen,
  CoachAddPeopleScreen,
  CoachStudentChatScreen,
  StudentProfileScreen,
  CoachReviewEditorScreen,
  StudentCoachReviewScreen,
  AdminMembersScreen,
  InviteFriendScreen,
  ClubDetailScreen,
  CoachDetailScreen,
} from './screens'
import { AchievementDetailScreen } from './screens/AchievementDetailScreen'
import { Header } from './components'
import { MainTabBarBackground } from './components/MainTabBarBackground'
import {
  NavIconAICoach,
  NavIconActivities,
  NavIconMyCoach,
  NavIconMyStudents,
  NavIconProgress,
  NavIconYou,
} from './components/NavTabIcons'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ThemeContext } from './context'
import { vercel as defaultTheme } from './theme'
import { authClient } from './lib/auth-client'
import { DOMAIN } from '../constants'
import { registerCorrectionNotificationDeepLink } from './lib/correctionImageNotifications'
import { getCachedProfile, setCachedProfile } from './lib/profile-cache'
import { SessionDataProvider, useSessionData } from './context/SessionDataContext'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type {
  NativeStackNavigationOptions,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack'
import { useFocusEffect, useNavigation, useNavigationState } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import type {
  ProgressTabStackParamList,
  YouTabStackParamList,
  MainTabParamList,
  MainStackParamList,
  MyCoachTabStackParamList,
} from './navigation/types'

export type {
  ProgressTabStackParamList,
  YouTabStackParamList,
  ClubId,
  CoachId,
  MainTabParamList,
  MainStackParamList,
  MyCoachTabStackParamList,
  CoachStudentChatParams,
} from './navigation/types'

const TAB_BAR_ACTIVE = '#FFFFFF'
const TAB_BAR_INACTIVE = '#5B9DFF'

const Tab = createBottomTabNavigator<MainTabParamList>()
const Stack = createNativeStackNavigator<MainStackParamList>()
const ProgressStack = createNativeStackNavigator<ProgressTabStackParamList>()
const YouStack = createNativeStackNavigator<YouTabStackParamList>()
const MyCoachStack = createNativeStackNavigator<MyCoachTabStackParamList>()

function ProgressTabStack() {
  const { theme: ctxTheme } = useContext(ThemeContext)
  const theme = ctxTheme?.backgroundColor != null ? ctxTheme : defaultTheme
  const stackBg = theme.backgroundColor ?? '#030A17'
  const screenOptions = useMemo(
    (): NativeStackNavigationOptions => ({
      headerShown: false,
      contentStyle: { backgroundColor: stackBg },
    }),
    [stackBg]
  )
  return (
    <ProgressStack.Navigator screenOptions={screenOptions}>
      <ProgressStack.Screen name="ProgressMain" component={ProgressScreen} />
      <ProgressStack.Screen name="DailyQuest" component={DailyQuestScreen} />
      <ProgressStack.Screen name="AllAchievements" component={AllAchievementsScreen} />
      <ProgressStack.Screen
        name="AchievementDetail"
        component={AchievementDetailScreen}
        options={{ presentation: 'modal' }}
      />
    </ProgressStack.Navigator>
  )
}

function MyCoachTabStack() {
  const { theme: ctxTheme } = useContext(ThemeContext)
  const theme = ctxTheme?.backgroundColor != null ? ctxTheme : defaultTheme
  const stackBg = theme.backgroundColor ?? '#030A17'
  const screenOptions = useMemo(
    (): NativeStackNavigationOptions => ({
      headerShown: false,
      contentStyle: { backgroundColor: stackBg },
    }),
    [stackBg]
  )
  return (
    <MyCoachStack.Navigator initialRouteName="MyCoachMain" screenOptions={screenOptions}>
      <MyCoachStack.Screen name="MyCoachMain" component={MyCoachScreen} />
      <MyCoachStack.Screen name="StudentProfile" component={StudentProfileScreen} />
      <MyCoachStack.Screen name="CoachStudentChat" component={CoachStudentChatScreen} />
    </MyCoachStack.Navigator>
  )
}

function YouTabStack({
  onProfileUpdated,
  onDone,
}: {
  onProfileUpdated: () => void
  onDone: () => void
}) {
  const { theme: ctxTheme } = useContext(ThemeContext)
  const theme = ctxTheme?.backgroundColor != null ? ctxTheme : defaultTheme
  const stackBg = theme.backgroundColor ?? '#030A17'
  const screenOptions = useMemo(
    (): NativeStackNavigationOptions => ({
      headerShown: false,
      contentStyle: { backgroundColor: stackBg },
    }),
    [stackBg]
  )
  return (
    <YouStack.Navigator screenOptions={screenOptions}>
      <YouStack.Screen name="YouMain">
        {() => <Profile onProfileUpdated={onProfileUpdated} onDone={onDone} />}
      </YouStack.Screen>
    </YouStack.Navigator>
  )
}

function MainTabsLayout(props: { profileRefreshTick: number; onProfileUpdated: () => void }) {
  return <MainTabsLayoutInner {...props} />
}

function MainTabsLayoutInner({
  profileRefreshTick,
  onProfileUpdated,
}: {
  profileRefreshTick: number
  onProfileUpdated: () => void
}) {
  const { t } = useTranslation()
  const { onTabFocus, viewerIsCoach, invalidate } = useSessionData()
  const stackNavigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const { theme: ctxTheme } = useContext(ThemeContext)
  const theme = ctxTheme?.backgroundColor != null ? ctxTheme : defaultTheme
  const insets = useSafeAreaInsets()
  const [techniqueResetKey, setTechniqueResetKey] = useState(0)
  const [profileName, setProfileName] = useState('Player')
  const [profileRank, setProfileRank] = useState('No rank yet')
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null)
  const tabLabels: Record<keyof MainTabParamList, string> = {
    AICoach: t('tabs.aiCoach'),
    MyCoach: viewerIsCoach ? t('tabs.myStudents') : t('tabs.myCoach'),
    Activities: viewerIsCoach ? t('tabs.calendar') : t('tabs.activities'),
    Progress: t('tabs.progress'),
    You: t('tabs.you'),
  }

  const goToTab = useCallback(
    (screen: keyof MainTabParamList) => {
      if (screen === 'You') {
        stackNavigation.navigate('Main', {
          screen: 'You',
          params: { screen: 'YouMain' },
        })
      } else if (screen === 'Progress') {
        stackNavigation.navigate('Main', {
          screen: 'Progress',
          params: { screen: 'ProgressMain' },
        })
      } else if (screen === 'MyCoach') {
        stackNavigation.navigate('Main', {
          screen: 'MyCoach',
          params: { screen: 'MyCoachMain' },
        })
      } else {
        stackNavigation.navigate('Main', { screen: screen as 'AICoach' | 'Activities' })
      }
    },
    [stackNavigation]
  )

  useEffect(() => {
    let mounted = true
    async function loadProfileFromCache() {
      const cached = await getCachedProfile()
      if (!mounted || !cached?.user) return

      setProfileName(cached.user?.name || 'Player')
      const levelText =
        cached?.profile?.level ||
        (cached?.profile?.rankingOrg && cached?.profile?.rankingValue
          ? `${cached.profile.rankingOrg}: ${cached.profile.rankingValue}`
          : 'No rank yet')
      setProfileRank(levelText)

      const rawImage = cached.user?.image
      if (typeof rawImage === 'string' && rawImage.length > 0) {
        const normalized = rawImage.startsWith('http')
          ? rawImage
          : `${DOMAIN.replace(/\/+$/, '')}${rawImage}`
        setProfileImageUri(`${normalized}${normalized.includes('?') ? '&' : '?'}t=${Date.now()}`)
      } else {
        setProfileImageUri(null)
      }
    }
    void loadProfileFromCache()
    return () => {
      mounted = false
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const res = await authClient.$fetch('/profile/me', { method: 'GET' }).catch(() => null)
    const body: any = (res as any)?.data ?? res
    if (!body?.user) return

    setProfileName(body.user?.name || 'Player')
    const levelText =
      body?.profile?.level ||
      (body?.profile?.rankingOrg && body?.profile?.rankingValue
        ? `${body.profile.rankingOrg}: ${body.profile.rankingValue}`
        : 'No rank yet')
    setProfileRank(levelText)

    const rawImage = body.user?.image
    if (typeof rawImage === 'string' && rawImage.length > 0) {
      const normalized = rawImage.startsWith('http')
        ? rawImage
        : `${DOMAIN.replace(/\/+$/, '')}${rawImage}`
      setProfileImageUri(`${normalized}${normalized.includes('?') ? '&' : '?'}t=${Date.now()}`)
    } else {
      setProfileImageUri(null)
    }

    void setCachedProfile({
      user: {
        name: body.user?.name || null,
        email: body.user?.email || null,
        image: body.user?.image || null,
      },
      profile: {
        username: body?.profile?.username || null,
        gender: body?.profile?.gender || null,
        level: body?.profile?.level || null,
        rankingOrg: body?.profile?.rankingOrg || null,
        rankingValue: body?.profile?.rankingValue || null,
        coachStudentRole: body?.profile?.coachStudentRole ?? null,
      },
    })
    invalidate()
  }, [invalidate])

  useEffect(() => {
    void refreshProfile()
  }, [profileRefreshTick, refreshProfile])

  useFocusEffect(
    useCallback(() => {
      void refreshProfile()
    }, [refreshProfile])
  )

  const styles = getStyles(theme)

  const activeTabName = useNavigationState((state) => {
    const r = state.routes[state.index]
    if (r.name !== 'Main' || !r.state || typeof (r.state as { index?: number }).index !== 'number') {
      return null
    }
    const tabState = r.state as { index: number; routes: { name: string }[] }
    return (tabState.routes[tabState.index]?.name as keyof MainTabParamList | undefined) ?? null
  })

  useEffect(() => {
    if (activeTabName === 'Activities' || activeTabName === 'You' || activeTabName === 'Progress') {
      onTabFocus()
    }
  }, [activeTabName, onTabFocus])

  useEffect(() => {
    if (viewerIsCoach && activeTabName === 'AICoach') {
      goToTab('MyCoach')
    }
  }, [activeTabName, viewerIsCoach, goToTab])

  useEffect(() => {
    return registerCorrectionNotificationDeepLink(stackNavigation)
  }, [stackNavigation])

  const headerSearchLeft =
    activeTabName === 'Progress' || activeTabName === 'You' || activeTabName === 'Activities'

  const { width: winW } = useWindowDimensions()
  /** Padding inside tab bar above home indicator — must fit inside explicit height below */
  const tabBarBottomPad = insets.bottom + 10

  const tabMetrics = useMemo(() => {
    const iconSize = winW < 340 ? 20 : winW < 400 ? 22 : 24
    const labelFontSize = winW < 340 ? 10 : winW < 380 ? 11 : 12
    return { iconSize, labelFontSize }
  }, [winW])

  /**
   * RN bottom-tabs default height is tight; explicit height must fit icon + label (incl. descenders).
   */
  const tabBarHeight = 66 + tabBarBottomPad

  const tabBg = theme.backgroundColor ?? '#030A17'

  const renderCoachTabLabel = useCallback(
    (label: string) =>
      ({ color }: { color: string }) => (
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          style={{
            color,
            fontFamily: theme.mediumFont,
            fontSize: tabMetrics.labelFontSize,
            lineHeight: tabMetrics.labelFontSize + (Platform.OS === 'android' ? 6 : 4),
            textAlign: 'center',
            marginTop: 0,
            marginBottom: 0,
            ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
          }}
        >
          {label}
        </Text>
      ),
    [theme.mediumFont, tabMetrics.labelFontSize]
  )

  const tabScreenOptions = useMemo(
    () =>
      ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: true,
        tabBarLabelPosition: 'below-icon' as const,
        tabBarActiveTintColor: TAB_BAR_ACTIVE,
        tabBarInactiveTintColor: TAB_BAR_INACTIVE,
        tabBarBackground: () => <MainTabBarBackground />,
        /** Opaque — transparent scenes let the native stack default (often white) show through. */
        sceneStyle: {
          backgroundColor: tabBg,
          paddingBottom: 0,
          paddingTop: 0,
        },
        /** No extra bottom inset — tab bar already reserves space; padding here showed as a gap above the bar. */
        sceneContainerStyle: {
          backgroundColor: tabBg,
          paddingBottom: 0,
          paddingTop: 0,
        },
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: tabBarHeight,
          paddingTop: 4,
          paddingBottom: tabBarBottomPad,
          paddingHorizontal: 4,
        },
        tabBarItemStyle: {
          paddingTop: 0,
          paddingBottom: 0,
          paddingHorizontal: 2,
          justifyContent: 'center',
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 2,
        },
      }) as const,
    [tabBarHeight, tabBarBottomPad, tabBg]
  )

  return (
    <View style={styles.shell}>
      <View style={styles.container}>
      <Header
        flatOverlay
        onProPress={() => stackNavigation.navigate('ProSubscription')}
        onProfilePress={headerSearchLeft ? undefined : () => goToTab('You')}
        profileName={profileName}
        profileRank={profileRank}
        profileImageUri={profileImageUri}
        onSettingsPress={() => stackNavigation.navigate('ProfileSettings')}
        onNotificationsPress={() => stackNavigation.navigate('Notifications')}
        headerLeftMode={headerSearchLeft ? 'search' : 'profile'}
        onSearchPress={headerSearchLeft ? () => stackNavigation.navigate('InviteSearch') : undefined}
      />
      <Tab.Navigator
        key={viewerIsCoach ? 'coach-tabs' : 'student-tabs'}
        screenOptions={({ route }) => ({
          ...tabScreenOptions,
          tabBarLabel:
            route.name === 'MyCoach' && viewerIsCoach
              ? renderCoachTabLabel(tabLabels.MyCoach)
              : route.name === 'Activities' && viewerIsCoach
                ? renderCoachTabLabel(tabLabels.Activities)
                : tabLabels[route.name as keyof MainTabParamList],
          ...(route.name === 'AICoach' && viewerIsCoach
            ? {
                tabBarButton: () => null,
                tabBarItemStyle: {
                  width: 0,
                  minWidth: 0,
                  maxWidth: 0,
                  height: 0,
                  padding: 0,
                  margin: 0,
                  overflow: 'hidden',
                  display: 'none' as const,
                },
              }
            : {}),
          tabBarLabelStyle: {
            fontFamily: theme.mediumFont,
            fontSize: tabMetrics.labelFontSize,
            lineHeight: tabMetrics.labelFontSize + (Platform.OS === 'android' ? 6 : 4),
            marginTop: 0,
            marginBottom: 0,
            ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
          },
          tabBarIcon: ({ focused }) => {
            const c = focused ? TAB_BAR_ACTIVE : TAB_BAR_INACTIVE
            const s = tabMetrics.iconSize
            switch (route.name) {
              case 'AICoach':
                return <NavIconAICoach color={c} size={s} />
              case 'MyCoach':
                return viewerIsCoach ? (
                  <NavIconMyStudents color={c} size={s} />
                ) : (
                  <NavIconMyCoach color={c} size={s} />
                )
              case 'Activities':
                return <NavIconActivities color={c} size={s} />
              case 'Progress':
                return <NavIconProgress color={c} size={s} />
              case 'You':
                return <NavIconYou color={c} size={s} />
              default:
                return null
            }
          },
        })}
      >
        <Tab.Screen name="AICoach" options={{ title: tabLabels.AICoach }}>
          {() => (
            <Technique key={techniqueResetKey} />
          )}
        </Tab.Screen>
        <Tab.Screen name="MyCoach" options={{ title: tabLabels.MyCoach }} component={MyCoachTabStack} />
        <Tab.Screen name="Activities" options={{ title: tabLabels.Activities }} component={ActivitiesScreen} />
        <Tab.Screen name="Progress" options={{ title: tabLabels.Progress }} component={ProgressTabStack} />
        <Tab.Screen name="You" options={{ title: tabLabels.You }}>
          {() => (
            <YouTabStack
              onProfileUpdated={onProfileUpdated}
              onDone={() => goToTab(viewerIsCoach ? 'MyCoach' : 'AICoach')}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
      </View>
    </View>
  )
}

function AuthenticatedStack() {
  const { theme: ctxTheme } = useContext(ThemeContext)
  const theme = ctxTheme?.backgroundColor != null ? ctxTheme : defaultTheme
  const stackContentBg = theme.backgroundColor ?? '#030A17'

  const [adminHubUnlocked, setAdminHubUnlocked] = useState(false)
  const [profileRefreshTick, setProfileRefreshTick] = useState(0)
  const onProfileUpdated = useCallback(() => setProfileRefreshTick((t) => t + 1), [])

  return (
    <View style={{ flex: 1, backgroundColor: stackContentBg }}>
      <SessionDataProvider profileRefreshTick={profileRefreshTick}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            /** Opaque route cards — default nav theme can still flash at edges if this is ever transparent. */
            contentStyle: {
              backgroundColor: stackContentBg,
            },
          }}
        >
      <Stack.Screen name="Main">
        {() => (
          <MainTabsLayout profileRefreshTick={profileRefreshTick} onProfileUpdated={onProfileUpdated} />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="InviteSearch"
        component={InviteFriendScreen}
        options={{
          headerShown: false,
          contentStyle: { backgroundColor: stackContentBg },
          /** Card push (not `fullScreenModal`) avoids per-tab modal transitions and light edges at rounded corners. */
          presentation: 'card',
        }}
      />
      <Stack.Screen name="ClubDetail" component={ClubDetailScreen} />
      <Stack.Screen name="CoachDetail" component={CoachDetailScreen} />
      <Stack.Screen name="AdminHub">
        {({ navigation }) => (
          <AdminHub
            hubUnlocked={adminHubUnlocked}
            onHubUnlocked={() => setAdminHubUnlocked(true)}
            onClose={() => {
              setAdminHubUnlocked(false)
              navigation.goBack()
            }}
            onOpenProLibraryVideo={() => navigation.navigate('AdminTrain')}
            onOpenLora={() => navigation.navigate('AdminFalLora')}
            onOpenAccuracy={() => navigation.navigate('AdminAccuracy')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="AdminTrain">
        {({ navigation }) => <AdminTrain skipPasswordGate onClose={() => navigation.goBack()} />}
      </Stack.Screen>
      <Stack.Screen name="AdminFalLora">
        {({ navigation }) => <AdminFalLora skipPasswordGate onClose={() => navigation.goBack()} />}
      </Stack.Screen>
      <Stack.Screen name="AdminAccuracy">
        {({ navigation }) => (
          <AdminAccuracy skipPasswordGate onClose={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="ProfileSettings">
        {({ navigation }) => (
          <ProfileSettingsScreen onProfileUpdated={onProfileUpdated} onClose={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="ProSubscription">
        {({ navigation }) => <ProScreen onClose={() => navigation.goBack()} />}
      </Stack.Screen>
      <Stack.Screen name="Notifications">
        {({ navigation }) => <NotificationsScreen onClose={() => navigation.goBack()} />}
      </Stack.Screen>
      <Stack.Screen name="CoachAddPeople" component={CoachAddPeopleScreen} />
      <Stack.Screen name="CoachReviewEditor" component={CoachReviewEditorScreen} />
      <Stack.Screen name="StudentCoachReview" component={StudentCoachReviewScreen} />
      <Stack.Screen name="AdminMembers" component={AdminMembersScreen} />
        </Stack.Navigator>
      </SessionDataProvider>
    </View>
  )
}

export function Main() {
  return (
    <SafeAreaProvider>
      <AuthenticatedStack />
    </SafeAreaProvider>
  )
}

const getStyles = (theme: { backgroundColor?: string }) =>
  StyleSheet.create({
    shell: {
      flex: 1,
      backgroundColor: theme.backgroundColor ?? '#030A17',
    },
    /** Opaque — `transparent` let the OS window show through during stack transitions (white “page” edges). */
    container: {
      flex: 1,
      zIndex: 1,
      backgroundColor: theme.backgroundColor ?? '#030A17',
    },
  })
