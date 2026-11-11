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

/**
 * State passed to style functions. `hovered` comes from expo-router's / RN-web's
 * Pressable typings; it isn't in plain React Native's type, so build the object
 * outside the call (no excess-property check) to type-check in both setups.
 */
function pressState(pressed: boolean) {
  const state = { pressed, hovered: false }
  return state
}

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
      style={dynamic ? style(pressState(pressed)) : style}
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
