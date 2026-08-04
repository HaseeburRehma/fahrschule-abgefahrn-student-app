/**
 * Small shared UI kit (NativeWind). Keeps screens declarative and on-brand.
 */

import React from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native'

const LION = require('../assets/lion.png')
const WORDMARK = require('../assets/logo.png')

// Aspect ratio of the wordmark (assets/logo.png ≈ 410:83).
const WORDMARK_RATIO = 410 / 83

/** The lion mark on a rounded near-black tile (avatar / compact brand). */
export function Brand({ size = 56 }: { size?: number }) {
  return (
    <View
      className="items-center justify-center rounded-2xl bg-ink"
      style={{ width: size, height: size }}
    >
      <Image
        source={LION}
        style={{ width: size * 0.72, height: size * 0.72 }}
        resizeMode="contain"
      />
    </View>
  )
}

/** The full "#FAHRSCHULE ABGEFAHRN" wordmark (lion + text). */
export function Logo({ width = 220 }: { width?: number }) {
  return (
    <Image
      source={WORDMARK}
      style={{ width, height: width / WORDMARK_RATIO }}
      resizeMode="contain"
    />
  )
}

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: {
  label: string
  onPress?: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'ghost' | 'danger'
}) {
  const isDisabled = disabled || loading
  const base =
    'w-full flex-row items-center justify-center rounded-2xl px-5 py-4'
  const styles =
    variant === 'primary'
      ? 'bg-brand'
      : variant === 'danger'
        ? 'bg-red-500'
        : 'bg-transparent border border-neutral-300'
  const textColor =
    variant === 'ghost' ? 'text-neutral-800' : 'text-ink'
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`${base} ${styles} ${isDisabled ? 'opacity-50' : 'active:opacity-80'}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? '#404040' : '#0A0A0A'} />
      ) : (
        <Text className={`text-base font-bold ${textColor}`}>{label}</Text>
      )}
    </Pressable>
  )
}

export function TextField({
  label,
  hint,
  ...props
}: TextInputProps & { label?: string; hint?: string }) {
  return (
    <View className="w-full">
      {label ? (
        <Text className="mb-1.5 text-sm font-semibold text-neutral-700">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor="#A3A3A3"
        className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-4 text-base text-neutral-900"
        {...props}
      />
      {hint ? (
        <Text className="mt-1.5 text-xs text-neutral-500">{hint}</Text>
      ) : null}
    </View>
  )
}

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <View className={`rounded-2xl border border-neutral-200 bg-white p-4 ${className}`}>
      {children}
    </View>
  )
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return <Text className="text-sm font-medium text-red-500">{children}</Text>
}

export function Loader({ label }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator color="#22C55E" size="large" />
      {label ? (
        <Text className="mt-3 text-sm text-neutral-500">{label}</Text>
      ) : null}
    </View>
  )
}
