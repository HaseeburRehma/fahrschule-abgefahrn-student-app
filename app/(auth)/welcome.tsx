/**
 * Onboarding pager — Figma DE/Onboarding 1–3 (1292:1749 / 1292:1797 / 1292:1845), EN 1296:2287.
 * Shown once on first launch; "Überspringen" or the last CTA marks it seen and opens Login.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Easing, FlatList, Platform, ScrollView, View, useWindowDimensions, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/ds/pressable'
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

import { Button, C, PopIn, PulseRing, T, useReducedMotion } from '@/components/ds'
import { ONBOARDING_EMPHASIS, ScaledGlow } from '@/components/auth/ui'
import { markOnboardingSeen } from '@/lib/auth/flow'
import { useT } from '@/lib/i18n'

const AMBER = '#FFC83D'
const NATIVE = Platform.OS !== 'web'

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

/** Idle bob for the floating tiles: up/down with a slight tilt, each tile on its own phase. */
function Bob({ children, duration, delay, distance = 8, tilt = 3 }: { children: React.ReactNode; duration: number; delay: number; distance?: number; tilt?: number }) {
  const reduced = useReducedMotion()
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) {
      v.setValue(0)
      return
    }
    const half = duration / 2
    const ease = Easing.inOut(Easing.sin)
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: half, easing: ease, useNativeDriver: NATIVE }),
        Animated.timing(v, { toValue: 0, duration: half, easing: ease, useNativeDriver: NATIVE }),
      ]),
    )
    const timer = setTimeout(() => anim.start(), delay)
    return () => {
      clearTimeout(timer)
      anim.stop()
    }
  }, [v, duration, delay, reduced])
  return (
    <Animated.View
      style={{
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] }) },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${-tilt}deg`, `${tilt}deg`] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  )
}

/** Slow "breathing" scale for the big centre icon. */
function Breathe({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion()
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) return
    const ease = Easing.inOut(Easing.sin)
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1300, easing: ease, useNativeDriver: NATIVE }),
        Animated.timing(v, { toValue: 0, duration: 1300, easing: ease, useNativeDriver: NATIVE }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [v, reduced])
  return <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>{children}</Animated.View>
}

function SideTile({ tile, side, p }: { tile: Tile; side: 'left' | 'right'; p: Animated.AnimatedInterpolation<number> }) {
  const Icon = tile.icon
  // parallax: the tiles travel further than the page while swiping (right tile = "closer" to the camera)
  const travel = side === 'left' ? 56 : 112
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: tile.x,
        top: tile.y,
        width: 52,
        height: 52,
        transform: [
          { translateX: p.interpolate({ inputRange: [-1, 0, 1], outputRange: [travel, 0, -travel] }) },
          { translateY: p.interpolate({ inputRange: [-1, 0, 1], outputRange: [18, 0, 18] }) },
          { rotate: p.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-24deg', '0deg', '24deg'] }) },
        ],
      }}
    >
      <PopIn delay={side === 'left' ? 160 : 300}>
        <Bob duration={side === 'left' ? 2800 : 3400} delay={side === 'left' ? 0 : 700}>
          <View
            style={[
              {
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
        </Bob>
      </PopIn>
    </Animated.View>
  )
}

function Illustration({ page, index, x, width }: { page: Page; index: number; x: Animated.Value; width: number }) {
  const Center = page.center
  // -1 … 0 … 1 = page is left of / at / right of the viewport
  const w = Math.max(width, 1)
  const p = x.interpolate({ inputRange: [(index - 1) * w, index * w, (index + 1) * w], outputRange: [1, 0, -1], extrapolate: 'clamp' })
  return (
    <View style={{ width: ART, height: ART, alignSelf: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          left: 45,
          top: 45,
          width: 150,
          height: 150,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: p.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.35, 1, 0.35] }),
          transform: [
            { scale: p.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.72, 1, 0.72] }) },
            { rotate: p.interpolate({ inputRange: [-1, 0, 1], outputRange: ['14deg', '0deg', '-14deg'] }) },
          ],
        }}
      >
        <PulseRing size={150} scaleTo={1.32} duration={2200} />
        <PopIn>
          <View
            style={[
              {
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
            <Breathe>
              <Center size={74} color={C.brand} />
            </Breathe>
          </View>
        </PopIn>
      </Animated.View>
      <SideTile tile={page.left} side="left" p={p} />
      <SideTile tile={page.right} side="right" p={p} />
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
  const { width: winW } = useWindowDimensions()
  // Page width = the pager's real width (the web build caps the app column at 672px,
  // so the window width would make pages wider than the visible area).
  const [pagerW, setPagerW] = useState(0)
  const width = pagerW || Math.min(winW, 672)
  const listRef = useRef<FlatList<Page>>(null)
  const x = useRef(new Animated.Value(0)).current
  const [index, setIndex] = useState(0)
  const [pagerH, setPagerH] = useState(0)
  const leaving = useRef(false)

  const finish = useCallback(async () => {
    if (leaving.current) return
    leaving.current = true
    try {
      await markOnboardingSeen()
    } finally {
      router.replace('/(auth)/login' as any)
    }
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
        <View
          style={{ flex: 1 }}
          onLayout={(e) => {
            setPagerH(e.nativeEvent.layout.height)
            setPagerW(e.nativeEvent.layout.width)
          }}
        >
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
            extraData={`${width}:${topPad}`}
            renderItem={({ item, index }) => (
              // Short screens (e.g. 320×568): the illustration + text are taller than the pager —
              // let the page scroll vertically instead of cutting the text off.
              <ScrollView
                style={{ width }}
                contentContainerStyle={{ paddingTop: topPad, paddingBottom: 8 }}
                showsVerticalScrollIndicator={false}
                bounces={false}
                nestedScrollEnabled
              >
                <Illustration page={item} index={index} x={x} width={width} />
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
              </ScrollView>
            )}
          />

          {/* Überspringen — Label/L dim, y64 (10 below the status bar), right 20 */}
          <Pressable
            onPress={finish}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('auth.onb.skip')}
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
