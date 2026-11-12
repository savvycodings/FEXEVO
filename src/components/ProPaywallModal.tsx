import { useCallback, useContext, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import Svg, { Path } from 'react-native-svg'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { LocalSvgAsset } from './LocalSvgAsset'
import { UI } from './ui'
import type { MainStackParamList } from '../navigation/types'

const LOGO = require('../../assets/logo.svg')
const PRO_BADGE = require('../../assets/pro.svg')

const FEATURES = [
  { key: 'biomechanics', image: require('../../assets/paywall/feature-biomechanics.png') },
  { key: 'view3d', image: require('../../assets/paywall/feature-3d-view.png') },
  { key: 'progress', image: require('../../assets/paywall/feature-progress.png') },
  { key: 'tactical', image: require('../../assets/paywall/feature-tactical.png') },
  { key: 'drills', image: require('../../assets/paywall/feature-drills.png') },
  { key: 'tips', image: require('../../assets/paywall/feature-tips.png') },
] as const

const BLUE = '#1F4BFF'
const MUTED = '#86A7D2'

type Props = {
  visible: boolean
  onClose: () => void
  /** "Upgrade to AXEVO Pro". */
  onUpgrade: () => void
  /** "Restore Purchase". No purchases exist yet, so callers may pass nothing. */
  onRestore?: () => void
  /** "See What's Included (30 sec)". Hidden until there is a video to show. */
  onWatch?: () => void
}

/** Figma "Shot Analysis" Unlock PRO modal, shown when a free user opens a Pro feature. */
export function ProPaywallModal({ visible, onClose, onUpgrade, onRestore, onWatch }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const semi = theme.semiBoldFont ?? theme.mediumFont

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <BlurView intensity={30} tint="dark" style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('paywall.close')} />
        <View style={styles.card} testID="pro-paywall">
          <LinearGradient colors={['#0A1F66', '#030A17', '#041641']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('paywall.close')}
              style={styles.close}
              testID="pro-paywall-close"
            >
              <Ionicons name="close" size={22} color={UI.text} />
            </Pressable>

            <LocalSvgAsset assetModule={LOGO} width={126} height={53} />

            {/* Stand-in for the glowing crown artwork until that asset lands. */}
            <View style={styles.hero}>
              <View style={styles.heroRing} />
              <CrownIcon size={96} color="#7FC4FF" />
            </View>

            <View style={styles.titleRow}>
              <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.boldFont ?? semi }]}>
                {t('paywall.unlock')}
              </Text>
              <LocalSvgAsset assetModule={PRO_BADGE} width={76} height={28} />
            </View>
            <Text allowFontScaling={false} style={[styles.subtitle, { fontFamily: theme.regularFont }]}>
              {t('paywall.subtitle')}
            </Text>

            <View style={styles.grid}>
              {FEATURES.map((f) => (
                <View key={f.key} style={styles.feature} testID={`pro-paywall-feature-${f.key}`}>
                  <View style={styles.featureBadge}>
                    <LocalSvgAsset assetModule={PRO_BADGE} width={30} height={11} />
                  </View>
                  <Image source={f.image} style={styles.featureImage} resizeMode="contain" />
                  <Text allowFontScaling={false} numberOfLines={2} style={[styles.featureTitle, { fontFamily: semi }]}>
                    {t(`paywall.features.${f.key}.title`)}
                  </Text>
                  <Text allowFontScaling={false} numberOfLines={2} style={[styles.featureText, { fontFamily: theme.regularFont }]}>
                    {t(`paywall.features.${f.key}.text`)}
                  </Text>
                </View>
              ))}
            </View>

            <Pressable onPress={onUpgrade} accessibilityRole="button" style={styles.upgrade} testID="pro-paywall-upgrade">
              <LinearGradient colors={UI.btnPrimaryGradient} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.upgradeFill}>
                <CrownIcon size={24} color="#000000" />
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.upgradeLabel, { fontFamily: semi }]}>
                  {t('paywall.upgrade')}
                </Text>
                <Ionicons name="arrow-forward" size={22} color={UI.btnPrimaryText} />
              </LinearGradient>
            </Pressable>

            {onWatch ? (
              <Pressable onPress={onWatch} accessibilityRole="button" style={styles.watch} testID="pro-paywall-watch">
                <Ionicons name="play" size={20} color={UI.text} />
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.watchLabel, { fontFamily: semi }]}>
                  {t('paywall.watch')}
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.footer}>
              <View style={styles.rule} />
              <Text allowFontScaling={false} style={[styles.footerText, { fontFamily: theme.regularFont }]}>
                {t('paywall.alreadyPro')}
              </Text>
              <Pressable onPress={onRestore} disabled={!onRestore} hitSlop={8} testID="pro-paywall-restore">
                <Text allowFontScaling={false} style={[styles.restore, { fontFamily: theme.mediumFont }]}>
                  {t('paywall.restore')}
                </Text>
              </Pressable>
              <View style={styles.rule} />
            </View>
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  )
}

/**
 * Paywall wired for a screen: `open()` shows it, Upgrade closes it and opens the Pro screen.
 * Render `paywall` once in the screen. Restore and the 30-second video aren't available yet.
 *
 *   const { open, paywall } = useProPaywall()
 *   onPress={() => (isPro ? show3d() : open())}
 */
export function useProPaywall() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const [visible, setVisible] = useState(false)
  const open = useCallback(() => setVisible(true), [])
  const close = useCallback(() => setVisible(false), [])
  const paywall = (
    <ProPaywallModal
      visible={visible}
      onClose={close}
      onUpgrade={() => {
        setVisible(false)
        navigation.navigate('ProSubscription')
      }}
    />
  )
  return { open, close, paywall }
}

function CrownIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M5.4135 20V18.5H18.5865V20H5.4135ZM5.38475 16.8077L4.023 8.975C3.98967 8.98133 3.95217 8.98708 3.9105 8.99225C3.86883 8.99742 3.83133 9 3.798 9C3.43267 9 3.125 8.87383 2.875 8.6215C2.625 8.369 2.5 8.0625 2.5 7.702C2.5 7.336 2.625 7.02492 2.875 6.76875C3.125 6.51275 3.43292 6.38475 3.79875 6.38475C4.16442 6.38475 4.47525 6.51275 4.73125 6.76875C4.98742 7.02492 5.1155 7.336 5.1155 7.702C5.1155 7.795 5.10775 7.88142 5.09225 7.96125C5.07692 8.04092 5.05258 8.116 5.01925 8.1865L8.18275 9.52875L11.2307 5.36925C11.0667 5.25508 10.9344 5.10492 10.8338 4.91875C10.7331 4.73258 10.6827 4.53208 10.6827 4.31725C10.6827 3.95142 10.8108 3.64042 11.0668 3.38425C11.3228 3.12808 11.6337 3 11.9995 3C12.3652 3 12.6762 3.12792 12.9327 3.38375C13.1891 3.63942 13.3172 3.95 13.3172 4.3155C13.3172 4.53467 13.2669 4.73658 13.1663 4.92125C13.0656 5.10575 12.9332 5.25508 12.7692 5.36925L15.8173 9.52875L18.9807 8.1865C18.9551 8.11833 18.9327 8.04325 18.9135 7.96125C18.8942 7.87942 18.8845 7.793 18.8845 7.702C18.8845 7.336 19.0095 7.02492 19.2595 6.76875C19.5095 6.51275 19.8174 6.38475 20.1832 6.38475C20.5489 6.38475 20.8598 6.51275 21.116 6.76875C21.372 7.02492 21.5 7.336 21.5 7.702C21.5 8.0615 21.3717 8.36775 21.1152 8.62075C20.8587 8.87358 20.5472 9 20.1807 9C20.1514 9 20.1184 8.99583 20.0818 8.9875C20.0452 8.97917 20.0093 8.975 19.9738 8.975L18.6152 16.8077H5.38475Z"
      />
    </Svg>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 48 },
  card: {
    maxHeight: '100%',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: BLUE,
    overflow: 'hidden',
    backgroundColor: '#030A17',
    boxShadow: '0px 0px 30px 0px rgba(0, 72, 255, 0.6)',
  },
  content: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 28, paddingBottom: 24, gap: 12 },
  close: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: BLUE,
    backgroundColor: '#041641',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { width: 200, height: 120, alignItems: 'center', justifyContent: 'center' },
  heroRing: {
    position: 'absolute',
    bottom: 10,
    width: 180,
    height: 40,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: '#4DA6FF',
    boxShadow: '0px 0px 18px 2px #2F7BFF',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: UI.text, fontSize: 30 },
  subtitle: { color: MUTED, fontSize: 14, lineHeight: 19, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', alignSelf: 'stretch' },
  feature: {
    width: '31.8%',
    minHeight: 132,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: BLUE,
    backgroundColor: '#041641',
    boxShadow: '0px 0px 20px 0px rgba(0, 72, 255, 0.5) inset',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingTop: 18,
    paddingBottom: 8,
    gap: 3,
  },
  featureBadge: { position: 'absolute', top: 5, right: 6 },
  featureImage: { width: 44, height: 44, marginBottom: 2 },
  featureTitle: { color: UI.text, fontSize: 11, textAlign: 'center' },
  featureText: { color: MUTED, fontSize: 9, lineHeight: 12, textAlign: 'center' },
  upgrade: { alignSelf: 'stretch', height: 50, borderRadius: 25, overflow: 'hidden', marginTop: 4 },
  upgradeFill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  upgradeLabel: { color: UI.btnPrimaryText, fontSize: 16, flexShrink: 1 },
  watch: {
    alignSelf: 'stretch',
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: BLUE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  watchLabel: { color: UI.text, fontSize: 16 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', marginTop: 6 },
  rule: { flex: 1, height: 1, backgroundColor: 'rgba(134, 167, 210, 0.4)' },
  footerText: { color: MUTED, fontSize: 12 },
  restore: { color: '#6EF0A0', fontSize: 12 },
})
