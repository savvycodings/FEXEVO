import React, { useContext } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native'
import { ThemeContext } from '../context'
import { LinearGradient } from 'expo-linear-gradient'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { StatusBar } from 'expo-status-bar'
import { WelcomeHeader } from '../components'

const WELCOME_SEEN_KEY = 'xevo_welcome_v1'

const STEP_SEGMENT_COLORS = ['#0022FF', '#005CFF', '#00BBFF'] as const
const PROGRESS_HEIGHT = 6

const HERO_IMAGES = [
  require('../../assets/loading/1.png'),
  require('../../assets/loading/2.png'),
  require('../../assets/loading/3.png'),
] as const

const ICON_MODULES = [
  require('../../assets/loading/1icon.svg'),
  require('../../assets/loading/2icon.svg'),
  require('../../assets/loading/3icon.svg'),
] as const

const SLIDES = [
  {
    title: 'Upload or Record\nyour video',
    body: null as string | null,
  },
  {
    title: 'Analyse',
    body: 'Our AI extracts your pose and\ncompares to PRO mechanics.',
  },
  {
    title: 'Improve',
    body: 'Get actionable feedback and drills to fix your technique.',
  },
] as const

async function markWelcomeSeen() {
  try {
    await AsyncStorage.setItem(WELCOME_SEEN_KEY, '1')
  } catch {
    /* ignore */
  }
}

type Props = { navigation: { navigate: (n: string) => void; replace: (n: string) => void } }

export function WelcomeIntro({ navigation }: Props) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const [step, setStep] = React.useState(0)
  const { width: winW, height: winH } = useWindowDimensions()
  /** Edge-to-edge width; `cover` fills (no pillarboxing from `contain`) */
  const heroRegionHeight = Math.min(winH * 0.58, 560)

  const slide = SLIDES[step]
  const isLast = step === SLIDES.length - 1

  return (
    <View style={styles.root}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Full-bleed hero; `cover` + 100% width removes side gutters from letterboxing */}
        <View style={[styles.heroStack, { width: winW }]}>
          <View style={styles.headerOverlay} pointerEvents="box-none">
            <WelcomeHeader />
          </View>
          <View style={[styles.heroWrap, { width: winW, height: heroRegionHeight }]}>
            <Image
              source={HERO_IMAGES[step]}
              style={[
                styles.heroImage,
                { width: winW, height: heroRegionHeight },
                Platform.OS === 'web' && styles.heroImageWeb,
              ]}
              resizeMode="cover"
            />
          </View>
        </View>

        <View style={styles.lower}>
          <View style={styles.progressWrap}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.progressSegment,
                  i <= step && { backgroundColor: STEP_SEGMENT_COLORS[i] },
                ]}
              />
            ))}
          </View>

          <View style={styles.iconWrap}>
            <Image source={ICON_MODULES[step]} style={styles.iconImg} resizeMode="contain" />
          </View>

          <Text style={styles.title}>{slide.title}</Text>
          {slide.body ? <Text style={styles.body}>{slide.body}</Text> : null}

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.primaryBtnOuter}
            onPress={async () => {
              await markWelcomeSeen()
              navigation.navigate('SignUp')
            }}
          >
            <LinearGradient
              colors={['#0022FF', '#00BBFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtnInner}
            >
              <Text style={styles.primaryBtnText}>Free Trial</Text>
            </LinearGradient>
          </TouchableOpacity>

          {isLast ? (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={async () => {
                await markWelcomeSeen()
                navigation.replace('SignIn')
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>Login</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setStep((s) => Math.min(s + 1, SLIDES.length - 1))}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>Next</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#030A17',
    },
    scroll: { flex: 1, width: '100%' },
    scrollInner: {
      flexGrow: 1,
      paddingBottom: 28,
      paddingHorizontal: 0,
      marginHorizontal: 0,
      width: '100%',
      alignItems: 'stretch',
    },
    heroStack: {
      position: 'relative',
      width: '100%',
      alignSelf: 'stretch',
      overflow: 'hidden',
    },
    headerOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
      backgroundColor: 'transparent',
    },
    heroWrap: {
      width: '100%',
      overflow: 'hidden',
      backgroundColor: '#000',
    },
    heroImage: {
      width: '100%',
      backgroundColor: 'transparent',
    },
    heroImageWeb: {
      outlineWidth: 0,
      borderWidth: 0,
    },
    lower: {
      paddingHorizontal: 24,
      paddingTop: 18,
    },
    progressWrap: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 18,
      alignSelf: 'center',
      width: '70%',
    },
    progressSegment: {
      flex: 1,
      height: PROGRESS_HEIGHT,
      borderRadius: PROGRESS_HEIGHT / 2,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    iconWrap: {
      alignItems: 'center',
      marginBottom: 12,
    },
    iconImg: {
      width: 46,
      height: 46,
    },
    title: {
      fontFamily: theme.semiBoldFont,
      fontSize: 17,
      color: '#00BBFF',
      textAlign: 'center',
      marginBottom: 12,
    },
    body: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      color: 'rgba(255,255,255,0.78)',
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: 28,
    },
    primaryBtnOuter: {
      borderRadius: 14,
      overflow: 'hidden',
      marginTop: 24,
    },
    primaryBtnInner: {
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
    },
    primaryBtnText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      color: '#fff',
    },
    secondaryBtn: {
      marginTop: 14,
      paddingVertical: 12,
      alignItems: 'center',
    },
    secondaryBtnText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      color: '#8CB0E2',
    },
  })
}

export { WELCOME_SEEN_KEY, markWelcomeSeen }
