/** Figma Home hero ring: 84×84, 8px stroke, #1C1E1C track, green arc from 12 o'clock with soft green glow. */

import React from 'react'
import { Platform, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

import { C, T } from '@/components/ds'

export function ProgressRing({ percent, size = 84, stroke = 8 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0
  const p = pct / 100
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
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={C.brand}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${circ * p} ${circ}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
        </View>
      ) : null}
      <T variant={size < 80 ? 'headingM' : 'headingL'}>{`${Math.round(pct)}%`}</T>
    </View>
  )
}

/** Thin green progress bar (h6 r3, #1C1E1C track, glowing fill) used on Fortschritt. */
export function ProgressBar({ value, height = 6 }: { value: number; height?: number }) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: C.surface, alignSelf: 'stretch' }}>
      {v > 0 ? (
        <View
          style={{
            width: `${v * 100}%`,
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
