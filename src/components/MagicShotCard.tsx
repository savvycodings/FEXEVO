import React, { useContext, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  type LayoutChangeEvent,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../context'
import { LocalSvgAsset } from './LocalSvgAsset'
import type { MagicShotStatus } from '../lib/magicShotJob'

const BEFORE_IMAGE = require('../../assets/magicshot/before.png')
const AFTER_IMAGE = require('../../assets/magicshot/after.png')
const SPARKLE_ICON = require('../../assets/magicshot/sparkle.svg')
const ARROW_ICON = require('../../assets/magicshot/arrow.svg')
const TIMER_ICON = require('../../assets/magicshot/timer.svg')
const BELL_ICON = require('../../assets/magicshot/bell.svg')

/** Fixed estimate shown before and during a generation. */
const ESTIMATE_MS = 10 * 60 * 1000
const TILE_GAP = 10
/** Figma tile geometry (159px tiles in a 328px row) that the image crop and arrow are relative to. */
const FIGMA_TILE = 159
const FIGMA_ROW = 328

type MagicShotCardProps = {
  status: MagicShotStatus
  startedAt: string | null
  error: string | null
  onGenerate: () => void
}

function remainingLabel(startedAt: string | null, now: number): string {
  const started = startedAt ? Date.parse(startedAt) : NaN
  if (!Number.isFinite(started)) return `${Math.round(ESTIMATE_MS / 60000)} m`
  const left = ESTIMATE_MS - (now - started)
  if (left < 60_000) return '<1 m'
  return `${Math.ceil(left / 60_000)} m`
}

export function MagicShotCard({ status, startedAt, error, onGenerate }: MagicShotCardProps) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const [rowW, setRowW] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  const busy = status === 'starting' || status === 'running'

  useEffect(() => {
    if (!busy) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [busy])

  const onRowLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width)
    if (w > 0 && w !== rowW) setRowW(w)
  }

  const tile = rowW > 0 ? (rowW - TILE_GAP) / 2 : 0
  const s = tile / FIGMA_TILE
  const imgW = 280 * s
  const imgH = 278 * s
  const imgLeft = tile / 2 + 3.5 * s - imgW / 2
  const imgTop = tile / 2 - 4.5 * s - imgH / 2
  const arrowScale = rowW / FIGMA_ROW

  const renderTile = (source: number, variant: 'before' | 'after') => (
    <View
      style={[
        styles.tile,
        variant === 'before' ? styles.tileBefore : styles.tileAfter,
        { width: tile, height: tile },
      ]}
    >
      <Image
        source={source}
        resizeMode="cover"
        style={{ position: 'absolute', left: imgLeft, top: imgTop, width: imgW, height: imgH }}
      />
      {variant === 'before' ? <View style={styles.beforeDim} /> : null}
    </View>
  )

  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.9}
        disabled={busy}
        onPress={onGenerate}
        style={[styles.buttonWrap, busy && styles.buttonBusy]}
        accessibilityRole="button"
      >
        <LinearGradient
          colors={['#00B8FF', '#0022FF']}
          locations={[0.09, 0.91]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          {busy ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.buttonText} allowFontScaling={false}>
                {t('technique.magicShot.generating')}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.buttonText} allowFontScaling={false}>
                {status === 'failed' ? (
                  t('technique.magicShot.retry')
                ) : (
                  <>
                    {t('technique.magicShot.generatePrefix')}
                    <Text style={styles.brandItalic}>{t('technique.magicShot.brand')}</Text>
                  </>
                )}
              </Text>
              <LocalSvgAsset assetModule={SPARKLE_ICON} width={24} height={24} />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {status === 'failed' && error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      <View style={styles.copy}>
        <Text style={styles.title}>
          {t('technique.magicShot.whatIsPrefix')}
          <Text style={styles.brandItalic}>{t('technique.magicShot.whatIsBrand')}</Text>
        </Text>
        <Text style={styles.body}>
          {t('technique.magicShot.descPrefix')}
          <Text style={styles.bodyBold}>{t('technique.magicShot.descBrand')}</Text>
          {t('technique.magicShot.descSuffix')}
        </Text>
      </View>

      <View style={styles.tileRow} onLayout={onRowLayout}>
        {tile > 0 ? (
          <>
            {renderTile(BEFORE_IMAGE, 'before')}
            {renderTile(AFTER_IMAGE, 'after')}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 111.51 * arrowScale,
                top: 102.46 * s,
                width: 104.986 * arrowScale,
                height: 42.078 * arrowScale,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ transform: [{ rotate: '-100.14deg' }, { scaleY: -1 }] }}>
                <LocalSvgAsset
                  assetModule={ARROW_ICON}
                  width={24.458 * arrowScale}
                  height={102.278 * arrowScale}
                />
              </View>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.etaRow}>
        <Text style={styles.etaLabel}>{t('technique.magicShot.etaLabel')}</Text>
        <View style={styles.etaValueRow}>
          <LocalSvgAsset assetModule={TIMER_ICON} width={24} height={24} />
          <Text style={styles.etaValue} allowFontScaling={false}>
            {remainingLabel(busy ? startedAt : null, now)}
          </Text>
        </View>
      </View>

      <View style={[styles.notifyBox, busy && styles.notifyBoxActive]}>
        <Text style={[styles.notifyText, busy && styles.notifyTextActive]}>
          {t('technique.magicShot.notifyHint')}
        </Text>
        <LocalSvgAsset assetModule={BELL_ICON} width={24} height={24} />
      </View>
    </View>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    card: {
      width: '100%',
      backgroundColor: '#001741',
      borderWidth: 4,
      borderColor: '#006EFF',
      borderRadius: 40,
      padding: 20,
      gap: 10,
    },
    buttonWrap: { width: '100%', borderRadius: 20, overflow: 'hidden' },
    buttonBusy: { opacity: 0.85 },
    button: {
      height: 60,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    buttonText: {
      fontFamily: theme.mediumFont,
      fontSize: 18,
      color: '#FFFFFF',
      textAlign: 'center',
      flexShrink: 1,
    },
    brandItalic: { fontFamily: 'Inter_700Bold_Italic' },
    errorText: { fontFamily: theme.regularFont, fontSize: 13, color: '#FF6B6B' },
    copy: { width: '100%', gap: 10 },
    title: { fontFamily: theme.mediumFont, fontSize: 18, color: '#FFFFFF' },
    body: { fontFamily: theme.regularFont, fontSize: 13, color: '#FFFFFF', lineHeight: 18 },
    bodyBold: { fontFamily: theme.boldFont },
    tileRow: { width: '100%', flexDirection: 'row', gap: TILE_GAP, marginTop: 4 },
    tile: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#01194D' },
    tileBefore: { borderWidth: 2, borderColor: '#004BFF' },
    tileAfter: { borderWidth: 4, borderColor: '#006EFF' },
    beforeDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
    etaRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    etaLabel: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: '#00B8FF',
      flexShrink: 1,
      maxWidth: 160,
    },
    etaValueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    etaValue: { fontFamily: theme.regularFont, fontSize: 36, color: '#00B8FF' },
    notifyBox: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      borderWidth: 2,
      borderColor: '#86A7D2',
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 15,
    },
    notifyBoxActive: { borderColor: '#00B8FF' },
    notifyText: {
      flex: 1,
      fontFamily: theme.regularFont,
      fontSize: 13,
      color: '#86A7D2',
      lineHeight: 18,
    },
    notifyTextActive: { color: '#FFFFFF' },
  })
}
