/**
 * Motion primitives from the Figma animation boards
 * ("09 · Anim/…" and "12 · Animationen"), each drawn there as an A → B pair:
 *
 *  - Strecke-Puls   → PulseRing on the current journey node
 *  - Streak-Puls    → PulseRing halo (120 → 176 around a 92 circle ≈ ×1.45)
 *  - Vollgas / Fortschritt → useFill: bars and rings fill up on appear
 *  - Maskottchen    → FloatIdle: mascot floats up 14 and back
 *  - Grünes Licht   → GreenLight overlay before a quiz starts ("LOS!")
 *
 * Everything respects the OS "Reduce Motion" setting (static end state).
 */

import React, { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Platform, View, type StyleProp, type ViewStyle } from 'react-native'

import { C, F } from './tokens'
import { T } from './primitives'

const NATIVE = Platform.OS !== 'web'

/** true when the user asked the OS to reduce motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => alive && setReduced(!!v)).catch(() => undefined)
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setReduced(!!v))
    return () => {
      alive = false
      sub?.remove?.()
    }
  }, [])
  return reduced
}

/** 0 → 1 → 0 … forever (or a constant 0 with reduced motion). */
function useLoop(duration: number, reduced: boolean, delay = 0): Animated.Value {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) {
      v.setValue(0)
      return
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: NATIVE }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [v, duration, reduced, delay])
  return v
}

/**
 * Expanding, fading ring centred on its parent (Strecke-Puls / Streak-Puls).
 * Place inside a container that is `alignItems/justifyContent: 'center'`.
 */
export function PulseRing({
  size,
  color = C.brand,
  scaleTo = 1.45,
  duration = 1600,
  filled = false,
}: {
  size: number
  color?: string
  scaleTo?: number
  duration?: number
  /** soft filled halo instead of a 2px ring */
  filled?: boolean
}) {
  const reduced = useReducedMotion()
  const t = useLoop(duration, reduced)
  if (reduced) return null
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: filled ? 0 : 2,
        borderColor: color,
        backgroundColor: filled ? color : 'transparent',
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [filled ? 0.35 : 0.7, 0] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] }) }],
      }}
    />
  )
}

/** Gentle up-and-down float (Figma "Maskottchen": y 120 → 106). */
export function FloatIdle({
  children,
  distance = 14,
  duration = 2600,
  style,
}: {
  children: React.ReactNode
  distance?: number
  duration?: number
  style?: StyleProp<ViewStyle>
}) {
  const reduced = useReducedMotion()
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) return
    const half = duration / 2
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
        Animated.timing(v, { toValue: 0, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [v, duration, reduced])
  return (
    <Animated.View style={[style, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] }) }] }]}>
      {children}
    </Animated.View>
  )
}

/** Pop-in on mount (feedback mascot, result cards). */
export function PopIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion()
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current
  useEffect(() => {
    if (reduced) {
      v.setValue(1)
      return
    }
    Animated.spring(v, { toValue: 1, delay, friction: 6, tension: 120, useNativeDriver: NATIVE }).start()
  }, [v, delay, reduced])
  return (
    <Animated.View
      style={[
        style,
        { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  )
}

/**
 * Animated value that eases from its previous value to `target` (0–1) —
 * "Vollgas" / "Fortschritt" fill. JS driver: it drives widths and SVG dashes.
 */
export function useFill(target: number, duration = 900): Animated.Value {
  const reduced = useReducedMotion()
  const clamped = Number.isFinite(target) ? Math.max(0, Math.min(1, target)) : 0
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) {
      v.setValue(clamped)
      return
    }
    Animated.timing(v, { toValue: clamped, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [v, clamped, duration, reduced])
  return v
}

/**
 * "Grünes Licht": three lamps light up one after another, then the light turns
 * green with "LOS!" and `onDone` fires. ~1.3s; immediate with reduced motion.
 */
export function GreenLight({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0) // 0..3 lamps lit, 4 = green
  const done = useRef(false)
  // keep the latest callback without restarting the sequence when the parent re-renders
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  useEffect(() => {
    if (reduced) {
      onDoneRef.current()
      return
    }
    const timers = [250, 500, 750, 1000].map((ms, i) => setTimeout(() => setStep(i + 1), ms))
    const end = setTimeout(() => {
      if (!done.current) {
        done.current = true
        onDoneRef.current()
      }
    }, 1400)
    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(end)
    }
  }, [reduced])
  if (reduced) return null
  const green = step >= 4
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 22 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        {green ? <View style={{ width: 4, height: 64, borderRadius: 2, backgroundColor: C.brand }} /> : null}
        <View style={{ width: 64, padding: 8, gap: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }}>
          {[0, 1, 2].map((i) => {
            const lit = green ? i === 2 : step > i
            const color = green ? C.brand : '#3B3F3B'
            return (
              <View
                key={i}
                style={[
                  { width: 48, height: 48, borderRadius: 24, backgroundColor: lit ? (green ? C.brand : '#5A5E5A') : '#2A2D2A' },
                  lit && green ? { shadowColor: color, shadowOpacity: 0.8, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } } : null,
                ]}
              />
            )
          })}
        </View>
        {green ? <View style={{ width: 4, height: 64, borderRadius: 2, backgroundColor: C.brand }} /> : null}
      </View>
      <T style={{ fontFamily: F.black, fontSize: 34, opacity: green ? 1 : 0 }} color={C.brand}>
        LOS!
      </T>
    </View>
  )
}
