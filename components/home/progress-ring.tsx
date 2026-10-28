/** Figma Home hero ring: 84×84, 8px stroke, #1C1E1C track, green arc from 12 o'clock with soft green glow. */

import React from 'react'
import { Animated, Platform, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

import { C, T, useFill } from '@/components/ds'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export function ProgressRing({
  percent,
  size = 84,
  stroke = 8,
  label,
  caption,
}: {
  percent: number
  size?: number
  stroke?: number
  /** replaces the "45%" center text (e.g. Tagesziel "1/2") */
  label?: string
  /** small uppercase line under the label (e.g. "LEKTIONEN") */
  caption?: string
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0
  const p = pct / 100
  // Figma "Fortschritt": the arc fills up from 0 when it appears / changes
  const fill = useFill(p)
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.surface} strokeWidth={stroke} fill="none" />
      </Svg>
      {p > 0 ? (
        <View
          style={[
            { position: 'absolute', width: size, height: size },
            // iOS shadows follow the arc's alpha; on web a box-shadow would draw a
            // square, so use a CSS drop-shadow filter there instead.
            Platform.OS === 'web'
              ? ({ filter: 'drop-shadow(0px 0px 7px rgba(0,255,36,0.5))' } as any)
              : { shadowColor: C.brand, shadowOpacity: 0.5, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } },
          ]}
        >
          <Svg width={size} height={size} testID="progress-ring-arc">
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={C.brand}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${circ} ${circ}`}
              strokeDashoffset={fill.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] })}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
        </View>
      ) : null}
      {label !== undefined ? (
        <View style={{ alignItems: 'center' }}>
          <T variant="displayL">{label}</T>
          {caption ? <T variant="caption" color={C.muted}>{caption}</T> : null}
        </View>
      ) : (
        <T variant={size < 80 ? 'headingM' : 'headingL'}>{`${Math.round(pct)}%`}</T>
      )}
    </View>
  )
}

/** Thin green progress bar (h6 r3, #1C1E1C track, glowing fill) used on Fortschritt. */
export function ProgressBar({ value, height = 6 }: { value: number; height?: number }) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
  // Figma "Vollgas": the bar fills up when it appears / changes
  const fill = useFill(v)
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: C.surface, alignSelf: 'stretch' }}>
      {v > 0 ? (
        <Animated.View
          testID="progress-bar-fill"
          style={{
            width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            height,
            borderRadius: height / 2,
            backgroundColor: C.brand,
            shadowColor: C.brand,
            shadowOpacity: 0.5,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      ) : null}
    </View>
  )
}
