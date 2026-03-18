import { useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Technique, Profile } from './screens'
import { Header } from './components'
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'
import { ThemeContext } from './context'
import { authClient } from './lib/auth-client'
import { DOMAIN } from '../constants'
import { useEffect } from 'react'

function MainComponent() {
  const insets = useSafeAreaInsets()
  const { theme } = useContext(ThemeContext)
  const [techniqueResetKey, setTechniqueResetKey] = useState(0)
  const [activeView, setActiveView] = useState<'technique' | 'profile'>('technique')
  const [profileName, setProfileName] = useState('Player')
  const [profileRank, setProfileRank] = useState('No rank yet')
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null)
  const [profileRefreshTick, setProfileRefreshTick] = useState(0)
  const styles = getStyles({ theme, insets })

  useEffect(() => {
    let mounted = true
    async function loadProfile() {
      const res = await authClient.$fetch('/profile/me', { method: 'GET' }).catch(() => null)
      const body: any = (res as any)?.data ?? res
      if (!mounted || !body?.user) return

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
    }
    void loadProfile()
    return () => {
      mounted = false
    }
  }, [activeView, profileRefreshTick])
  
  return (
    <View style={styles.container}>
      <Header
        onLogoPress={() => {
          setActiveView('technique')
          setTechniqueResetKey(prev => prev + 1)
        }}
        onProfilePress={() => setActiveView('profile')}
        profileName={profileName}
        profileRank={profileRank}
        profileImageUri={profileImageUri}
      />
      {activeView === 'technique' ? (
        <Technique key={techniqueResetKey} />
      ) : (
        <Profile
          onProfileUpdated={() => {
            setProfileRefreshTick(prev => prev + 1)
          }}
        />
      )}
    </View>
  );
}

export function Main() {
  return (
    <SafeAreaProvider>
      <MainComponent />
    </SafeAreaProvider>
  )
}

const getStyles = ({ theme } : { theme: any, insets: any}) => StyleSheet.create({
  container: {
    backgroundColor: theme.backgroundColor,
    flex: 1,
  },
})
