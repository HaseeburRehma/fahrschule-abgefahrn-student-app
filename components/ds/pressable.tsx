/**
 * Pressable that resolves `style={({ pressed }) => …}` itself.
 *
 * NativeWind's css-interop wraps react-native's Pressable on iOS/Android and only merges
 * style objects — a style *function* is dropped, so buttons, cards and chips rendered without
 * background, border or flex layout in the release build (web was unaffected). Use this
 * component wherever the style depends on the pressed state.
 */

import React, { forwardRef, useState } from 'react'
import {
  Pressable as RNPressable,
  type GestureResponderEvent,
  type PressableProps,
  type View,
} from 'react-native'

export const Pressable = forwardRef<View, PressableProps>(function Pressable(
  { style, onPressIn, onPressOut, ...rest },
  ref,
) {
  const [pressed, setPressed] = useState(false)
  const dynamic = typeof style === 'function'
  return (
    <RNPressable
      ref={ref}
      {...rest}
      style={dynamic ? style({ pressed, hovered: false }) : style}
      onPressIn={(e: GestureResponderEvent) => {
        if (dynamic) setPressed(true)
        onPressIn?.(e)
      }}
      onPressOut={(e: GestureResponderEvent) => {
        if (dynamic) setPressed(false)
        onPressOut?.(e)
      }}
    />
  )
})
