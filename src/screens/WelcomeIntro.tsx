import React, { useContext } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Platform,
  PanResponder,
  useWindowDimensions,
} from 'react-native'
import { ThemeContext } from '../context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { StatusBar } from 'expo-status-bar'
import { WelcomeHeader } from '../components'
import { LocalSvgAsset, prefetchSvgAssets } from '../components/LocalSvgAsset'
import { GlowButton, SurfaceButton, TextLink, UI } from '../components/ui'
import { useTranslation } from 'react-i18next'
import { TEST_IDS } from '../lib/testIds'

const WELCOME_SEEN_KEY = 'xevo_welcome_v1'

const PROGRESS_HEIGHT = 6
const ICON_SIZE = 36
const TITLE_LINE = 28
const BODY_LINE = 21
/** Two title lines (slide 1) vs one title + two body lines (slides 2–3): reserve the larger. */
const TEXT_BLOCK_HEIGHT = Math.max(TITLE_LINE * 2, TITLE_LINE + 10 + BODY_LINE * 2)
/** Horizontal drag (pt) that flips to the next / previous slide. */
const SWIPE_THRESHOLD = 40

const HERO_IMAGES = [
  require('../../assets/loading/1.png'),
  require('../../assets/loading/2.png'),
  require('../../assets/loading/3.jpg'),
] as const

const ICON_MODULES = [
  require('../../assets/loading/1icon.svg'),
  require('../../assets/loading/2icon.svg'),
  require('../../assets/loading/3icon.svg'),
] as const

prefetchSvgAssets([...ICON_MODULES])

async function markWelcomeSeen() {
  try {
    await AsyncStorage.setItem(WELCOME_SEEN_KEY, '1')
  } catch {
    /* ignore */
  }
}

type Props = {
  navigation: { navigate: (n: string, params?: object) => void; replace: (n: string) => void }
}

export function WelcomeIntro({ navigation }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const [step, setStep] = React.useState(0)
  const { width: winW, height: winH } = useWindowDimensions()
  /** Edge-to-edge width; `cover` fills (no pillarboxing from `contain`) */
  const heroRegionHeight = Math.min(winH * 0.58, 560)

  const slides = React.useMemo(
    () => [
      { title: t('welcome.slide1Title'), body: null as string | null },
      { title: t('welcome.slide2Title'), body: t('welcome.slide2Body') },
      { title: t('welcome.slide3Title'), body: t('welcome.slide3Body') },
    ],
    [t]
  )

  const slide = slides[step]

  /** Swipe left/right anywhere on the screen to change slide (there is no Next button). */
  const swipe = React.useMemo(
    () =>
      PanResponder.create({
        // Capture phase so the vertical ScrollView doesn't take clearly horizontal drags first.
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_, g) => {
          if (g.dx <= -SWIPE_THRESHOLD) setStep((s) => Math.min(s + 1, slides.length - 1))
          else if (g.dx >= SWIPE_THRESHOLD) setStep((s) => Math.max(s - 1, 0))
        },
      }),
    [slides.length]
  )

  return (
    <View style={styles.root} {...swipe.panHandlers}>
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
            {slides.map((_, i) => (
              <TouchableOpacity
                key={i}
                style={styles.progressHit}
                onPress={() => setStep(i)}
                testID={i === step + 1 ? TEST_IDS.welcomeNext : undefined}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1} / ${slides.length}`}
                accessibilityState={{ selected: i === step }}
              >
                <View style={[styles.progressSegment, i === step && styles.progressSegmentActive]} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Fixed-size icon slot + text block sized for the tallest slide, so the buttons never move between slides. */}
          <View style={styles.iconWrap}>
            <LocalSvgAsset assetModule={ICON_MODULES[step]} width={ICON_SIZE} height={ICON_SIZE} />
          </View>
          <View style={styles.textBlock}>
            <Text allowFontScaling={false} numberOfLines={2} style={styles.title}>
              {slide.title}
            </Text>
            {slide.body ? (
              <Text allowFontScaling={false} numberOfLines={2} style={styles.body}>
                {slide.body}
              </Text>
            ) : null}
          </View>

          <GlowButton
            label={t('welcome.freeTrial')}
            testID={TEST_IDS.welcomeFreeTrial}
            style={styles.primaryBtn}
            onPress={async () => {
              await markWelcomeSeen()
              navigation.navigate('SignUp')
            }}
          />
          <SurfaceButton
            label={t('welcome.coachSignup')}
            testID={TEST_IDS.welcomeCoachSignup}
            style={styles.secondaryBtn}
            onPress={async () => {
              await markWelcomeSeen()
              navigation.navigate('SignUp', { coachSignup: true })
            }}
          />
          <TextLink
            label={t('auth.login')}
            muted
            testID={TEST_IDS.welcomeLogin}
            style={styles.loginLink}
            onPress={async () => {
              await markWelcomeSeen()
              navigation.replace('SignIn')
            }}
          />
        </View>
      </ScrollView>
    </View>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: UI.pageBg,
    },
    scroll: { flex: 1, width: '100%' },
    scrollInner: {
      flexGrow: 1,
      paddingBottom: 28,
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
      paddingTop: 14,
    },
    progressWrap: {
      flexDirection: 'row',
      gap: 4,
      marginBottom: 16,
      alignSelf: 'center',
      width: '60%',
    },
    progressHit: {
      flex: 1,
      paddingVertical: 8,
    },
    progressSegment: {
      height: PROGRESS_HEIGHT,
      borderRadius: PROGRESS_HEIGHT / 2,
      backgroundColor: UI.track,
    },
    progressSegmentActive: {
      backgroundColor: UI.accent,
    },
    iconWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      height: ICON_SIZE,
      marginBottom: 10,
    },
    textBlock: {
      height: TEXT_BLOCK_HEIGHT,
      alignItems: 'center',
    },
    title: {
      fontFamily: theme.regularFont,
      fontSize: 22,
      lineHeight: TITLE_LINE,
      color: UI.accent,
      textAlign: 'center',
      marginBottom: 10,
    },
    body: {
      fontFamily: theme.regularFont,
      fontSize: 15,
      color: UI.textMuted,
      textAlign: 'center',
      lineHeight: BODY_LINE,
    },
    primaryBtn: {
      marginTop: 18,
    },
    secondaryBtn: {
      marginTop: 14,
    },
    loginLink: {
      marginTop: 18,
    },
  })
}

export { WELCOME_SEEN_KEY, markWelcomeSeen }
