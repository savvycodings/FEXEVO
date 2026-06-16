import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from 'react-native-svg'
import { ThemeContext } from '../context'
import { LocalSvgAsset } from '../components/LocalSvgAsset'
import { ProLibraryGradientFrame } from '../components/ProLibraryGradientFrame'
import { MainTabBarChrome } from '../components/MainTabBarChrome'
import type { MainStackParamList } from '../navigation/types'
import { getCachedProfile } from '../lib/profile-cache'
import { DOMAIN } from '../../constants'

const PRO_BADGE_SVG = require('../../assets/pro.svg')
const SWITCH_ON = require('../../assets/proscreen/switchon.svg')
const SWITCH_OFF = require('../../assets/proscreen/switchoff.svg')
const TICK_YES = require('../../assets/proscreen/tickyes.svg')
const TICK_NO = require('../../assets/proscreen/tickno.svg')
const CROWN = require('../../assets/proscreen/crown.png')
const HERO_IMAGE = require('../../assets/proscreen/proimg1.png')

type BillingCycle = 'monthly' | 'annual'

type FeatureRow = {
  freeLabel: string
  proLabel: string
  freeIncluded: boolean
}

const FEATURE_ROWS: FeatureRow[] = [
  { freeLabel: 'Upload videos', proLabel: 'Upload videos', freeIncluded: true },
  { freeLabel: 'AI Coach', proLabel: 'AI Coach', freeIncluded: true },
  { freeLabel: 'Posture Analysis', proLabel: 'Posture Analysis', freeIncluded: true },
  { freeLabel: 'Advanced Metrics', proLabel: 'Advanced Metrics', freeIncluded: true },
  { freeLabel: 'Basic Shot Score', proLabel: 'Advanced Shot Score', freeIncluded: false },
  { freeLabel: 'Limited History', proLabel: 'Unlimited History', freeIncluded: false },
  { freeLabel: '10 AI analysis/week', proLabel: 'Unlimited AI analysis', freeIncluded: false },
  { freeLabel: 'Local Ranking', proLabel: 'Global Ranking', freeIncluded: false },
  { freeLabel: 'Compare Lists', proLabel: 'Compare Lists', freeIncluded: false },
]

type Nav = NativeStackNavigationProp<MainStackParamList>

export function ProScreen({ onClose: _onClose }: { onClose?: () => void }) {
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const { width: winW } = useWindowDimensions()
  const [billing, setBilling] = useState<BillingCycle>('annual')
  const [profileName, setProfileName] = useState('Player')
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null)

  const styles = useMemo(() => getStyles(theme, winW), [theme, winW])
  const heroHeight = Math.round(Math.min(220, Math.max(180, winW * 0.5)))
  const heroImageWidth = heroHeight * (329 / 179)
  /** Wider than the image so the radial vignette extends left over the image edge */
  const heroRadialWidth = heroImageWidth * 1.22

  useEffect(() => {
    let mounted = true
    void getCachedProfile().then((cached) => {
      if (!mounted || !cached?.user) return
      setProfileName(cached.user?.name || 'Player')
      const rawImage = cached.user?.image
      if (typeof rawImage === 'string' && rawImage.length > 0) {
        const normalized = rawImage.startsWith('http')
          ? rawImage
          : `${DOMAIN.replace(/\/+$/, '')}${rawImage}`
        setProfileImageUri(`${normalized}${normalized.includes('?') ? '&' : '?'}t=${Date.now()}`)
      } else {
        setProfileImageUri(null)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  const navigateMainTab = useCallback(
    (screen: 'AICoach' | 'You') => {
      if (screen === 'You') {
        navigation.navigate('Main', { screen: 'You', params: { screen: 'YouMain' } })
      } else {
        navigation.navigate('Main', { screen: 'AICoach' })
      }
    },
    [navigation]
  )

  const priceLabel = billing === 'annual' ? '$20' : '$25'
  const priceSub =
    billing === 'annual' ? 'per month/billed anually' : 'per month/billed monthly'

  return (
    <View style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        colors={['#071D47', theme.backgroundColor ?? '#030A17']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.35 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.headerProfile}
          activeOpacity={0.8}
          onPress={() => navigateMainTab('You')}
          accessibilityLabel="Open profile"
        >
          <View style={styles.avatarWrap}>
            {profileImageUri ? (
              <Image source={{ uri: profileImageUri }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Ionicons name="person" size={16} color="#FFFFFF" />
            )}
          </View>
          <Text numberOfLines={1} allowFontScaling={false} style={styles.headerName}>
            {profileName}
          </Text>
        </TouchableOpacity>
        <View style={styles.proBadgeWrap}>
          <LocalSvgAsset assetModule={PRO_BADGE_SVG} width={65} height={24} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollInner, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[styles.hero, { height: heroHeight }]}>
          <Image source={HERO_IMAGE} style={[styles.heroImage, { height: heroHeight, width: heroImageWidth }]} resizeMode="cover" />
          <Svg pointerEvents="none" style={[styles.heroRadial, { height: heroHeight, width: heroRadialWidth }]}>
            <Defs>
              <SvgRadialGradient id="proHeroRadial" cx="62%" cy="50%" rx="58%" ry="52%">
                <Stop offset="43%" stopColor="#030A17" stopOpacity={0} />
                <Stop offset="100%" stopColor="#030A17" stopOpacity={1} />
              </SvgRadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#proHeroRadial)" />
          </Svg>
          <LinearGradient
            pointerEvents="none"
            colors={['#030A17', '#030A17', 'rgba(3,10,23,0.55)', 'rgba(3,10,23,0)']}
            locations={[0, 0.34, 0.58, 0.82]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroTextCol}>
            <Text allowFontScaling={false} style={styles.heroTitle}>
              Be Pro
            </Text>
            <Text allowFontScaling={false} style={styles.heroSubtitle}>
              Improve your game.{'\n'}Unlock your potential.
            </Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setBilling('monthly')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.toggleLabel, billing === 'monthly' && styles.toggleLabelActive]}
                >
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setBilling(billing === 'monthly' ? 'annual' : 'monthly')}
                accessibilityLabel="Toggle billing cycle"
              >
                <LocalSvgAsset
                  assetModule={billing === 'annual' ? SWITCH_ON : SWITCH_OFF}
                  width={46}
                  height={24}
                />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setBilling('annual')}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.toggleLabel, billing === 'annual' && styles.toggleLabelActive]}
                >
                  Anual
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Plan comparison */}
        <View style={styles.comparison}>
          {/* Headers (above the cards) */}
          <View style={styles.planHeaderRow}>
            <View style={styles.planHeaderColFree}>
              <View style={styles.titleRow}>
                <Text allowFontScaling={false} style={styles.freeTitle}>
                  Free
                </Text>
                <View style={styles.basicPlanBadge}>
                  <Text allowFontScaling={false} style={styles.basicPlanText}>
                    BASIC PLAN
                  </Text>
                </View>
              </View>
              <Text allowFontScaling={false} style={styles.freeSubtitle}>
                Great to get started
              </Text>
            </View>

            <View style={styles.planHeaderColPro}>
              <View style={styles.proTitleRow}>
                <Image source={CROWN} style={styles.crown} resizeMode="contain" />
                <Text allowFontScaling={false} style={styles.proTitle}>
                  Pro
                </Text>
                <LinearGradient
                  colors={['#00BBFF', '#0022FF']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.popularBadge}
                >
                  <Text allowFontScaling={false} style={styles.popularBadgeText}>
                    MOST POPULAR
                  </Text>
                </LinearGradient>
              </View>
              <Text allowFontScaling={false} style={styles.proSubtitle}>
                Everything you need to Excel
              </Text>
              <View style={styles.priceRow}>
                <Text allowFontScaling={false} style={styles.proPrice}>
                  {priceLabel}
                </Text>
                <Text allowFontScaling={false} style={styles.proPriceSub}>
                  {priceSub}
                </Text>
              </View>
            </View>
          </View>

          {/* Cards */}
          <View style={styles.cardsRow}>
            {/* Free card */}
            <View style={styles.freeCard}>
              {FEATURE_ROWS.map((row, i) => (
                <View
                  key={`free-${i}`}
                  style={[
                    styles.featureCell,
                    i < FEATURE_ROWS.length - 1 && styles.featureCellBorderFree,
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[styles.featureLabelFree, row.freeIncluded && styles.featureLabelFreeIncluded]}
                  >
                    {row.freeLabel}
                  </Text>
                  <LocalSvgAsset
                    assetModule={row.freeIncluded ? TICK_YES : TICK_NO}
                    width={18}
                    height={18}
                  />
                </View>
              ))}
            </View>

            {/* Pro card */}
            <ProLibraryGradientFrame
              style={styles.proCardBorder}
              borderRadius={14}
              innerBorderRadius={12}
              strokeWidth={2}
              gradientVariant="accent"
              innerStyle={styles.proCardInner}
            >
              {FEATURE_ROWS.map((row, i) => (
                <View
                  key={`pro-${i}`}
                  style={[styles.featureCell, i < FEATURE_ROWS.length - 1 && styles.featureCellBorder]}
                >
                  <Text allowFontScaling={false} style={styles.featureLabelPro}>
                    {row.proLabel}
                  </Text>
                  <LocalSvgAsset assetModule={TICK_YES} width={18} height={18} />
                </View>
              ))}
            </ProLibraryGradientFrame>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.ctaOuter}
          onPress={() => {
            /* subscription flow TBD */
          }}
          accessibilityLabel="Start 3-Day Free Trial"
        >
          <LinearGradient
            colors={['#00BBFF', '#0022FF']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.ctaInner}
          >
            <Text allowFontScaling={false} style={styles.ctaText}>
              Start 3-Day Free Trial
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      <MainTabBarChrome />
    </View>
  )
}

function getStyles(theme: { semiBoldFont?: string; regularFont?: string; mediumFont?: string }, winW: number) {
  const horizontalPad = 16
  const cardGap = 10
  const cardsAvailable = winW - horizontalPad * 2 - cardGap
  const freeCardWidth = Math.floor(cardsAvailable * 0.46)
  const proCardWidth = cardsAvailable - freeCardWidth

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#030A17',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: horizontalPad,
      paddingBottom: 8,
    },
    headerProfile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
      paddingRight: 8,
    },
    avatarWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0, 94, 255, 0.35)',
      borderWidth: 1,
      borderColor: 'rgba(0, 187, 255, 0.65)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: 36,
      height: 36,
    },
    headerName: {
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
      lineHeight: 16,
      flexShrink: 1,
    },
    proBadgeWrap: {
      paddingVertical: 4,
    },
    scroll: {
      flex: 1,
    },
    scrollInner: {
      paddingTop: 0,
    },
    hero: {
      width: winW,
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: '#030A17',
    },
    heroTextCol: {
      position: 'absolute',
      left: horizontalPad,
      top: 0,
      bottom: 0,
      maxWidth: winW * 0.62,
      justifyContent: 'center',
      zIndex: 3,
    },
    heroTitle: {
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont,
      fontSize: 32,
      lineHeight: 36,
      letterSpacing: -0.5,
    },
    heroSubtitle: {
      color: '#0059FF',
      fontFamily: theme.boldFont ?? theme.semiBoldFont,
      fontSize: 17,
      lineHeight: 24,
      marginTop: 6,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 14,
    },
    toggleLabel: {
      color: '#86A7D2',
      fontFamily: theme.mediumFont ?? theme.regularFont,
      fontSize: 13,
      lineHeight: 16,
    },
    toggleLabelActive: {
      color: '#FFFFFF',
    },
    heroImage: {
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 1,
    },
    heroRadial: {
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 2,
    },
    comparison: {
      marginTop: 4,
      paddingHorizontal: horizontalPad,
    },
    planHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: cardGap,
      marginBottom: 12,
    },
    planHeaderColFree: {
      width: freeCardWidth,
      paddingTop: 34,
    },
    planHeaderColPro: {
      width: proCardWidth,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    proTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
      minHeight: 34,
    },
    freeTitle: {
      color: '#86A7D2',
      fontFamily: theme.semiBoldFont,
      fontSize: 22,
      lineHeight: 26,
    },
    basicPlanBadge: {
      backgroundColor: '#041641',
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    basicPlanText: {
      color: '#5B9DFF',
      fontFamily: theme.semiBoldFont,
      fontSize: 8,
      letterSpacing: 0.4,
    },
    freeSubtitle: {
      color: '#86A7D2',
      fontFamily: theme.regularFont,
      fontSize: 11,
      lineHeight: 14,
      marginTop: 6,
    },
    crown: {
      width: 28,
      height: 22,
    },
    proTitle: {
      color: '#0059FF',
      fontFamily: theme.semiBoldFont,
      fontSize: 28,
      lineHeight: 32,
    },
    popularBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    popularBadgeText: {
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont,
      fontSize: 9,
      letterSpacing: 0.4,
    },
    proSubtitle: {
      color: '#FFFFFF',
      fontFamily: theme.regularFont,
      fontSize: 11,
      lineHeight: 14,
      marginTop: 6,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      marginTop: 4,
    },
    proPrice: {
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont,
      fontSize: 28,
      lineHeight: 30,
    },
    proPriceSub: {
      color: '#86A7D2',
      fontFamily: theme.regularFont,
      fontSize: 10,
      lineHeight: 13,
      paddingBottom: 4,
      flexShrink: 1,
      transform: [{ translateY: -4 }],
    },
    cardsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: cardGap,
    },
    freeCard: {
      width: freeCardWidth,
      backgroundColor: 'rgba(8, 20, 44, 0.65)',
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 2,
    },
    proCardBorder: {
      width: proCardWidth,
    },
    proCardInner: {
      backgroundColor: 'rgba(7, 30, 78, 0.95)',
      paddingHorizontal: 12,
      paddingVertical: 2,
    },
    featureCell: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 11,
      gap: 6,
      minHeight: 40,
    },
    featureCellBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(134, 167, 210, 0.2)',
    },
    featureCellBorderFree: {
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0, 184, 255, 0.38)',
    },
    featureLabelFree: {
      flex: 1,
      color: 'rgba(255, 255, 255, 0.55)',
      fontFamily: theme.regularFont,
      fontSize: 11,
      lineHeight: 14,
    },
    featureLabelFreeIncluded: {
      color: '#FFFFFF',
    },
    featureLabelPro: {
      flex: 1,
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont,
      fontSize: 11,
      lineHeight: 14,
    },
    ctaOuter: {
      marginTop: 20,
      marginHorizontal: horizontalPad,
      borderRadius: 12,
      overflow: 'hidden',
    },
    ctaInner: {
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },
    ctaText: {
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      lineHeight: 20,
      ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
    },
  })
}
