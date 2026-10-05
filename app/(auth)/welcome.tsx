/**
 * Onboarding pager — Figma DE/Onboarding 1–3 (1292:1749 / 1292:1797 / 1292:1845), EN 1296:2287.
 * Shown once on first launch; "Überspringen" or the last CTA marks it seen and opens Login.
 */

import React, { useCallback, useRef, useState } from 'react'
import { Animated, FlatList, Pressable, View, useWindowDimensions, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import type { Icon as PhosphorIcon, IconWeight } from 'phosphor-react-native'
import { ArrowRight } from 'phosphor-react-native/src/icons/ArrowRight'
import { Bell } from 'phosphor-react-native/src/icons/Bell'
import { CalendarDots } from 'phosphor-react-native/src/icons/CalendarDots'
import { ChartLineUp } from 'phosphor-react-native/src/icons/ChartLineUp'
import { ChatCircleDots } from 'phosphor-react-native/src/icons/ChatCircleDots'
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle'
import { Fire } from 'phosphor-react-native/src/icons/Fire'
import { RoadHorizon } from 'phosphor-react-native/src/icons/RoadHorizon'
import { SteeringWheel } from 'phosphor-react-native/src/icons/SteeringWheel'
import { Trophy } from 'phosphor-react-native/src/icons/Trophy'

import { Button, C, T } from '@/components/ds'
import { ONBOARDING_EMPHASIS, ScaledGlow } from '@/components/auth/ui'
import { markOnboardingSeen } from '@/lib/auth/flow'
import { useT } from '@/lib/i18n'

const AMBER = '#FFC83D'

type Tile = { icon: PhosphorIcon; weight: IconWeight; color: string; x: number; y: number }
type Page = { key: string; center: PhosphorIcon; left: Tile; right: Tile }

/** Illustration geometry is from the 240×240 Figma frame of each page. */
const PAGES: Page[] = [
  {
    key: '1',
    center: RoadHorizon,
    left: { icon: CheckCircle, weight: 'regular', color: C.brand, x: 6, y: 30 },
    right: { icon: SteeringWheel, weight: 'regular', color: C.brand, x: 182, y: 40 },
  },
  {
    key: '2',
    center: ChartLineUp,
    left: { icon: Fire, weight: 'fill', color: AMBER, x: 8, y: 24 },
    right: { icon: Trophy, weight: 'fill', color: AMBER, x: 180, y: 36 },
  },
  {
    key: '3',
    center: ChatCircleDots,
    left: { icon: Bell, weight: 'fill', color: C.brand, x: 6, y: 28 },
    right: { icon: CalendarDots, weight: 'fill', color: C.brand, x: 182, y: 40 },
  },
]

const ART = 240
/** illustration (240) + gap (50) + text block (≈146) */
const CONTENT_H = ART + 50 + 146

const tileGlow: ViewStyle = {
  shadowColor: C.brand,
  shadowOpacity: 0.5,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 0 },
  elevation: 6,
}

function SideTile({ tile }: { tile: Tile }) {
  const Icon = tile.icon
  return (
    <View
      style={[
        {
          position: 'absolute',
          left: tile.x,
          top: tile.y,
          width: 52,
          height: 52,
          borderRadius: 16,
          backgroundColor: C.card,
          borderWidth: 1,
          borderColor: C.line,
          alignItems: 'center',
          justifyContent: 'center',
        },
        tileGlow,
      ]}
    >
      <Icon size={26} color={tile.color} weight={tile.weight} />
    </View>
  )
}

function Illustration({ page }: { page: Page }) {
  const Center = page.center
  return (
    <View style={{ width: ART, height: ART, alignSelf: 'center' }}>
      <View
        style={[
          {
            position: 'absolute',
            left: 45,
            top: 45,
            width: 150,
            height: 150,
            borderRadius: 75,
            backgroundColor: C.tile,
            borderWidth: 2,
            borderColor: C.brand,
            alignItems: 'center',
            justifyContent: 'center',
          },
          tileGlow,
        ]}
      >
        <Center size={74} color={C.brand} />
      </View>
      <SideTile tile={page.left} />
      <SideTile tile={page.right} />
    </View>
  )
}

function Dots({ x, width }: { x: Animated.Value; width: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 8 }}>
      {PAGES.map((p, i) => {
        const range = [(i - 1) * width, i * width, (i + 1) * width]
        const w = x.interpolate({ inputRange: range, outputRange: [8, 26, 8], extrapolate: 'clamp' })
        const on = x.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' })
        return (
          <Animated.View
            key={p.key}
            style={{ width: w, height: 8, borderRadius: 4, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, overflow: 'visible' }}
          >
            <Animated.View
              style={[
                { position: 'absolute', top: -1, left: -1, right: -1, bottom: -1, borderRadius: 4, backgroundColor: C.brand, opacity: on },
                { shadowColor: C.brand, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
              ]}
            />
          </Animated.View>
        )
      })}
    </View>
  )
}

export default function Welcome() {
  const t = useT()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const listRef = useRef<FlatList<Page>>(null)
  const x = useRef(new Animated.Value(0)).current
  const [index, setIndex] = useState(0)
  const [pagerH, setPagerH] = useState(0)
  const leaving = useRef(false)

  const finish = useCallback(async () => {
    if (leaving.current) return
    leaving.current = true
    await markOnboardingSeen()
    router.replace('/(auth)/login' as any)
  }, [])

  const next = () => {
    if (index >= PAGES.length - 1) return finish()
    const n = index + 1
    listRef.current?.scrollToOffset({ offset: n * width, animated: true })
    setIndex(n)
  }

  // Figma: illustration frame at y150 (96 below the status bar); shrink the top gap on short screens.
  const topPad = pagerH ? Math.max(16, Math.min(96, pagerH - CONTENT_H - 8)) : 96
  const last = index === PAGES.length - 1

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, overflow: 'hidden' }}>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View style={{ flex: 1 }} onLayout={(e) => setPagerH(e.nativeEvent.layout.height)}>
          {/* static hero glow behind the illustration (Figma FX/Hero Glow inside the 240 frame) */}
          <View pointerEvents="none" style={{ position: 'absolute', top: topPad, left: (width - ART) / 2, width: ART, height: ART }}>
            <ScaledGlow width={ART} height={ART} />
          </View>

          <Animated.FlatList
            ref={listRef as any}
            data={PAGES}
            keyExtractor={(p) => p.key}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], {
              useNativeDriver: false,
              // web has no momentum events — derive the page from the offset
              listener: (e: any) => {
                const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1))
                setIndex((cur) => (cur === i ? cur : Math.min(Math.max(i, 0), PAGES.length - 1)))
              },
            })}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            renderItem={({ item }) => (
              <View style={{ width, paddingTop: topPad }}>
                <Illustration page={item} />
                <View style={{ marginTop: 50, paddingHorizontal: 32, gap: 14, alignItems: 'center' }}>
                  <View style={{ alignSelf: 'stretch' }}>
                    <T variant="displayL" style={{ textAlign: 'center' }}>{t(`auth.onb.${item.key}.line1`)}</T>
                    <T style={[ONBOARDING_EMPHASIS, { textAlign: 'center' }]} color={C.brand}>
                      {t(`auth.onb.${item.key}.line2`)}
                    </T>
                  </View>
                  <T variant="bodyL" color={C.muted} style={{ textAlign: 'center' }}>
                    {t(`auth.onb.${item.key}.body`)}
                  </T>
                </View>
              </View>
            )}
          />

          {/* Überspringen — Label/L dim, y64 (10 below the status bar), right 20 */}
          <Pressable
            onPress={finish}
            hitSlop={12}
            accessibilityRole="button"
            style={({ pressed }) => ({ position: 'absolute', top: 10, right: 20, opacity: pressed ? 0.6 : 1 })}
          >
            <T variant="labelL" color={C.dim}>{t('auth.onb.skip')}</T>
          </Pressable>
        </View>

        <View style={{ paddingTop: 8 }}>
          <Dots x={x} width={width} />
        </View>
        <View style={{ paddingHorizontal: 24, paddingTop: 36, paddingBottom: Math.max(insets.bottom, 16) + 22 }}>
          <Button label={last ? t('auth.onb.start') : t('auth.onb.next')} iconRight={ArrowRight} onPress={next} />
        </View>
      </View>
    </View>
  )
}
