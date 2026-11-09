/**
 * The living mascot: the lion cut out of the stage artwork (assets/mascot/lion.png) on a
 * clean stage (assets/mascot/stage-bg.jpg), so it can move on its own:
 *
 *  - Entrance  → drops in from above and lands with a bounce, its shadow growing under it
 *  - Breathing → slow squash/stretch anchored at the feet
 *  - Sway      → gentle weight shift from foot to foot
 *  - Hop       → a happy hop every few seconds: anticipation squash, jump, landing squash;
 *                the contact shadow shrinks and fades while it is in the air
 *  - Tap       → hop + wiggle (when `interactive`)
 *
 * Every layer uses the native driver; with the OS "Reduce Motion" setting the lion stands still.
 * Geometry is in source pixels of the 1189×1420 stage canvas, scaled by `k` (see StageImage).
 */

import React, { useCallback, useEffect, useRef } from 'react'
import { Animated, Easing, Image, Platform, Pressable, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg'

import { useReducedMotion } from '@/components/ds'

const NATIVE = Platform.OS !== 'web'

/* eslint-disable @typescript-eslint/no-require-imports */
const LION_IMG = require('../../assets/mascot/lion.png')
/* eslint-enable @typescript-eslint/no-require-imports */

/** Where the cut-out sits on the 1189×1420 stage canvas (source px). */
export const STAGE = { w: 1189, h: 1420 } as const
const LION = { x: 409, y: 306, w: 378, h: 525 } as const
/** contact-shadow ellipse under the feet (source px) */
const FEET = { cx: 597, cy: 822, rx: 150, ry: 18 } as const
/** hop height in source px (≈45pt on the full-screen stage) */
const HOP = 62

const FEET_ORIGIN = { transformOrigin: 'bottom' } as unknown as ViewStyle
const FILL: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }

function loopTiming(v: Animated.Value, to: number, duration: number) {
  return Animated.timing(v, { toValue: to, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE })
}

/** One hop: anticipation → take-off (stretch) → fall → landing squash → settle. */
function hopSequence(hop: Animated.Value, squash: Animated.Value): Animated.CompositeAnimation {
  return Animated.sequence([
    Animated.timing(squash, { toValue: 1, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
    Animated.parallel([
      Animated.timing(squash, { toValue: -1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
      Animated.timing(hop, { toValue: 1, duration: 270, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
    ]),
    Animated.parallel([
      Animated.timing(squash, { toValue: 0, duration: 200, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
      Animated.timing(hop, { toValue: 0, duration: 240, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }),
    ]),
    Animated.timing(squash, { toValue: 0.8, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
    Animated.spring(squash, { toValue: 0, friction: 4, tension: 160, useNativeDriver: NATIVE }),
  ])
}

/**
 * The animated lion + its shadow, positioned on the stage canvas. Render it inside the
 * same box as the stage background: origin = canvas centre line (x) / canvas top (y).
 */
export function AnimatedLion({ k, interactive = false, hopEvery = 4200 }: { k: number; interactive?: boolean; hopEvery?: number }) {
  const reduced = useReducedMotion()
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current
  const breath = useRef(new Animated.Value(0)).current
  const sway = useRef(new Animated.Value(0)).current
  const hop = useRef(new Animated.Value(0)).current
  const squash = useRef(new Animated.Value(0)).current
  const wiggle = useRef(new Animated.Value(0)).current
  const busy = useRef(false)

  useEffect(() => {
    if (reduced) {
      ;[breath, sway, hop, squash, wiggle].forEach((v) => v.setValue(0))
      enter.setValue(1)
      return
    }
    enter.setValue(0)
    const entrance = Animated.spring(enter, { toValue: 1, friction: 5.5, tension: 55, useNativeDriver: NATIVE })
    const breathing = Animated.loop(Animated.sequence([loopTiming(breath, 1, 1500), loopTiming(breath, 0, 1500)]))
    const swaying = Animated.loop(
      Animated.sequence([loopTiming(sway, 1, 1300), loopTiming(sway, -1, 2600), loopTiming(sway, 0, 1300)]),
    )
    const hopping = Animated.loop(Animated.sequence([Animated.delay(hopEvery), hopSequence(hop, squash)]))
    entrance.start(() => {
      breathing.start()
      swaying.start()
      hopping.start()
    })
    return () => {
      entrance.stop()
      breathing.stop()
      swaying.stop()
      hopping.stop()
    }
  }, [reduced, enter, breath, sway, hop, squash, wiggle, hopEvery])

  const onTap = useCallback(() => {
    if (reduced || busy.current) return
    busy.current = true
    Animated.parallel([
      hopSequence(hop, squash),
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 1, duration: 90, useNativeDriver: NATIVE }),
        Animated.timing(wiggle, { toValue: -1, duration: 140, useNativeDriver: NATIVE }),
        Animated.timing(wiggle, { toValue: 0.6, duration: 120, useNativeDriver: NATIVE }),
        Animated.spring(wiggle, { toValue: 0, friction: 4, tension: 120, useNativeDriver: NATIVE }),
      ]),
    ]).start(() => {
      busy.current = false
    })
  }, [reduced, hop, squash, wiggle])

  const half = STAGE.w / 2
  const lionBox: ViewStyle = { position: 'absolute', left: (LION.x - half) * k, top: LION.y * k, width: LION.w * k, height: LION.h * k }
  const shW = FEET.rx * 2 * k
  const shH = FEET.ry * 2 * k * 1.6

  const lion = (box: ViewStyle) => (
    // drop-in (translateY) + weight shift (rotate) + tap wiggle, all pivoting on the feet
    <Animated.View
      pointerEvents="none"
      style={[
        box,
        FEET_ORIGIN,
        {
          opacity: enter.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-260 * k, 0] }) },
            { translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -HOP * k] }) },
            { rotate: sway.interpolate({ inputRange: [-1, 1], outputRange: ['-1.6deg', '1.6deg'] }) },
            { rotate: wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] }) },
          ],
        },
      ]}
    >
      {/* hop squash / stretch */}
      <Animated.View
        style={[
          { flex: 1 },
          FEET_ORIGIN,
          {
            transform: [
              { scaleX: squash.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.95, 1, 1.07] }) },
              { scaleY: squash.interpolate({ inputRange: [-1, 0, 1], outputRange: [1.07, 1, 0.92] }) },
            ],
          },
        ]}
      >
        {/* breathing */}
        <Animated.View
          style={[
            { flex: 1 },
            FEET_ORIGIN,
            {
              transform: [
                { scaleX: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 0.99] }) },
                { scaleY: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.022] }) },
              ],
            },
          ]}
        >
          <Image source={LION_IMG} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  )

  return (
    <>
      {/* contact shadow: grows in on entrance, shrinks + fades while the lion is airborne */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: (FEET.cx - half) * k - shW / 2,
          top: FEET.cy * k - shH / 2,
          width: shW,
          height: shH,
          opacity: Animated.multiply(
            enter.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
            hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }),
          ),
          transform: [
            { scale: hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.68] }) },
            { scaleX: sway.interpolate({ inputRange: [-1, 0, 1], outputRange: [1.03, 1, 1.03] }) },
          ],
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 20" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="lionShadow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#1E5A12" stopOpacity="0.42" />
              <Stop offset="0.6" stopColor="#1E5A12" stopOpacity="0.16" />
              <Stop offset="1" stopColor="#1E5A12" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50" cy="10" rx="50" ry="10" fill="url(#lionShadow)" />
        </Svg>
      </Animated.View>

      {interactive ? (
        <Pressable onPress={onTap} accessible={false} style={lionBox}>
          {lion(FILL)}
        </Pressable>
      ) : (
        lion(lionBox)
      )}
    </>
  )
}

/**
 * Idle life for a standalone mascot pose (e.g. the "thinking" lion on the result card):
 * pops up from below, then breathes and tilts slowly as if pondering.
 */
export function MascotIdle({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion()
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current
  const breath = useRef(new Animated.Value(0)).current
  const tilt = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (reduced) {
      enter.setValue(1)
      breath.setValue(0)
      tilt.setValue(0)
      return
    }
    enter.setValue(0)
    const entrance = Animated.spring(enter, { toValue: 1, friction: 6, tension: 70, useNativeDriver: NATIVE })
    const breathing = Animated.loop(Animated.sequence([loopTiming(breath, 1, 1600), loopTiming(breath, 0, 1600)]))
    const tilting = Animated.loop(
      Animated.sequence([loopTiming(tilt, 1, 1800), Animated.delay(500), loopTiming(tilt, -1, 2600), Animated.delay(400), loopTiming(tilt, 0, 1400)]),
    )
    entrance.start(() => {
      breathing.start()
      tilting.start()
    })
    return () => {
      entrance.stop()
      breathing.stop()
      tilting.stop()
    }
  }, [reduced, enter, breath, tilt])

  return (
    <Animated.View
      style={[
        style,
        FEET_ORIGIN,
        {
          opacity: enter.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
            { rotate: tilt.interpolate({ inputRange: [-1, 1], outputRange: ['-3deg', '3deg'] }) },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          FEET_ORIGIN,
          {
            transform: [
              { scaleX: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 0.99] }) },
              { scaleY: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  )
}
