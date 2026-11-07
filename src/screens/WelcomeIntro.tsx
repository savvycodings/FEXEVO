import React, { useContext } from 'react'
import {
  View,
  StyleSheet,
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
import { GlowButton, SurfaceButton, TextButton, UI } from '../components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { TEST_IDS } from '../lib/testIds'
import Animated, {
  Easing,
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

const WELCOME_SEEN_KEY = 'xevo_welcome_v1'

/** Design: each segment 63.3 × 10, 5px apart (3 × 63.3 + 2 × 5 ≈ 200 wide). */
const PROGRESS_HEIGHT = 10
const PROGRESS_WIDTH = 200
const PROGRESS_GAP = 5
const PROGRESS_SEG = (PROGRESS_WIDTH - PROGRESS_GAP * 2) / 3
/** Vertical hit padding around each progress segment (the moving indicator sits inside it). */
const PROGRESS_HIT_PAD = 8
const ICON_SIZE = 36
/** Inter 18px with `line-height: normal` (design spec). */
const TITLE_LINE = 22
/** Inter 13px with `line-height: normal` (design spec). */
const BODY_LINE = 16
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
  /** 1 = moving forward (content comes from the right), -1 = back. */
  const [dir, setDir] = React.useState<1 | -1>(1)
  const stepRef = React.useRef(0)
  const goTo = React.useCallback((next: number) => {
    const target = Math.max(0, Math.min(next, HERO_IMAGES.length - 1))
    if (target === stepRef.current) return
    setDir(target > stepRef.current ? 1 : -1)
    stepRef.current = target
    setStep(target)
  }, [])

  /** Progress indicator glides between segments and stretches mid-way. */
  const progress = useSharedValue(0)
  React.useEffect(() => {
    progress.value = withSpring(step, { damping: 18, stiffness: 170, mass: 0.9 })
  }, [step, progress])
  const indicatorStyle = useAnimatedStyle(() => {
    const travel = Math.abs(progress.value - Math.round(progress.value))
    return {
      transform: [
        { translateX: progress.value * (PROGRESS_SEG + PROGRESS_GAP) },
        { scaleX: 1 + travel * 0.7 },
      ],
    }
  })

  /** New hero photo: fades in while easing out of a slight zoom, drifting in from the swipe side. */
  const heroEntering = React.useMemo(
    () =>
      new Keyframe({
        0: { opacity: 0, transform: [{ scale: 1.08 }, { translateX: 28 * dir }] },
        100: {
          opacity: 1,
          transform: [{ scale: 1 }, { translateX: 0 }],
          easing: Easing.out(Easing.cubic),
        },
      }).duration(650),
    [dir]
  )
  const textEntering = (delay: number) =>
    (dir > 0 ? FadeInRight : FadeInLeft).duration(380).delay(delay).easing(Easing.out(Easing.cubic))
  const { width: winW, height: winH } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const bottomPad = 28 + insets.bottom
  /** Measured height of the copy + buttons block, so the hero can take only what is left. */
  const [lowerH, setLowerH] = React.useState(0)
  /** Edge-to-edge width; `cover` fills (no pillarboxing from `contain`). Shrinks so Login clears the gesture bar. */
  const heroRegionHeight = lowerH
    ? Math.max(winH * 0.35, Math.min(winH - lowerH - bottomPad, 560))
    : Math.min(winH * 0.58, 560)

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
          if (g.dx <= -SWIPE_THRESHOLD) goTo(stepRef.current + 1)
          else if (g.dx >= SWIPE_THRESHOLD) goTo(stepRef.current - 1)
        },
      }),
    [goTo]
  )

  return (
    <View style={styles.root} {...swipe.panHandlers}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollInner, { paddingBottom: bottomPad }]}
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
            {/* Keyed by step: the old photo fades out underneath while the new one zooms/drifts in. */}
            <Animated.Image
              key={step}
              source={HERO_IMAGES[step]}
              entering={heroEntering}
              exiting={FadeOut.duration(450)}
              style={[
                styles.heroImage,
                styles.heroImageLayer,
                { width: winW, height: heroRegionHeight },
                Platform.OS === 'web' && styles.heroImageWeb,
              ]}
              resizeMode="cover"
            />
            {/* Fade the photo into the page so the shorter hero has no hard edge. */}
            <LinearGradient
              colors={['transparent', UI.pageBg]}
              pointerEvents="none"
              style={styles.heroFade}
            />
          </View>
        </View>

        <View style={styles.lower} onLayout={(e) => setLowerH(e.nativeEvent.layout.height)}>
          <View style={styles.progressWrap}>
            {slides.map((_, i) => (
              <TouchableOpacity
                key={i}
                style={styles.progressHit}
                onPress={() => goTo(i)}
                testID={i === step + 1 ? TEST_IDS.welcomeNext : undefined}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1} / ${slides.length}`}
                accessibilityState={{ selected: i === step }}
              >
                <View style={styles.progressSegment} />
              </TouchableOpacity>
            ))}
            <Animated.View
              pointerEvents="none"
              style={[styles.progressSegment, styles.progressSegmentActive, styles.progressIndicator, indicatorStyle]}
            />
          </View>

          {/* Fixed-size icon slot + text block sized for the tallest slide, so the buttons never move between slides. */}
          <View style={styles.iconWrap}>
            <Animated.View key={`icon-${step}`} entering={FadeIn.duration(350).easing(Easing.out(Easing.cubic))}>
              <LocalSvgAsset assetModule={ICON_MODULES[step]} width={ICON_SIZE} height={ICON_SIZE} />
            </Animated.View>
          </View>
          <View style={styles.textBlock}>
            <Animated.Text
              key={`title-${step}`}
              entering={textEntering(60)}
              allowFontScaling={false}
              numberOfLines={2}
              style={styles.title}
            >
              {slide.title}
            </Animated.Text>
            {slide.body ? (
              <Animated.Text
                key={`body-${step}`}
                entering={textEntering(130)}
                allowFontScaling={false}
                numberOfLines={2}
                style={styles.body}
              >
                {slide.body}
              </Animated.Text>
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
          <TextButton
            label={t('auth.login')}
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
    heroFade: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 140,
    },
    heroImageLayer: {
      position: 'absolute',
      top: 0,
      left: 0,
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
      gap: PROGRESS_GAP,
      marginBottom: 16,
      alignSelf: 'center',
      width: PROGRESS_WIDTH,
    },
    progressHit: {
      flex: 1,
      paddingVertical: PROGRESS_HIT_PAD,
    },
    /** The single glowing segment that moves between slots. */
    progressIndicator: {
      position: 'absolute',
      top: PROGRESS_HIT_PAD,
      left: 0,
      width: PROGRESS_SEG,
    },
    progressSegment: {
      height: PROGRESS_HEIGHT,
      borderRadius: PROGRESS_HEIGHT / 2,
      backgroundColor: UI.track,
    },
    /** Design spec: `#0BF`, radius 50, inner white glow + outer blue glow. */
    progressSegmentActive: {
      backgroundColor: UI.accent,
      borderRadius: 50,
      boxShadow: '0px 0px 4px 2px rgba(255, 255, 255, 0.25) inset, 0px 0px 15px 0px #0048FF',
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
      fontSize: 18,
      lineHeight: TITLE_LINE,
      color: UI.accent,
      textAlign: 'center',
      marginBottom: 10,
    },
    /** Design spec: `#86A7D2`, Inter 400 13px, centred. */
    body: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: '#86A7D2',
      textAlign: 'center',
      lineHeight: BODY_LINE,
    },
    /** Design: 30px from the slide's body text to Free Trial. */
    primaryBtn: {
      marginTop: 30,
    },
    secondaryBtn: {
      marginTop: 14,
    },
    loginLink: {
      marginTop: 12,
    },
  })
}

export { WELCOME_SEEN_KEY, markWelcomeSeen }
