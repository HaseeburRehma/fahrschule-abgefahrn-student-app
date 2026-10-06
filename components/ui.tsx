/**
 * Small shared UI kit (NativeWind). Keeps screens declarative and on-brand.
 */

import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native'

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
        : 'bg-transparent border border-neutral-700'
  const textColor =
    variant === 'ghost' ? 'text-neutral-200' : 'text-ink'
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`${base} ${styles} ${isDisabled ? 'opacity-50' : 'active:opacity-80'}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? '#404040' : '#0A0A0A'} />
      ) : (
        <Text className={`text-base font-m-bold ${textColor}`}>{label}</Text>
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
        <Text className="mb-1.5 text-sm font-m-semibold text-neutral-300">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor="#A3A3A3"
        className="font-m-medium w-full rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-4 text-base text-neutral-100"
        {...props}
      />
      {hint ? (
        <Text className="font-m-regular mt-1.5 text-xs text-neutral-400">{hint}</Text>
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
    <View className={`rounded-2xl border border-neutral-800 bg-neutral-900 p-4 ${className}`}>
      {children}
    </View>
  )
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return <Text className="text-sm font-m-medium text-red-500">{children}</Text>
}

export function Loader({ label }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-neutral-900">
      <ActivityIndicator color="#00FF24" size="large" />
      {label ? (
        <Text className="font-m-regular mt-3 text-sm text-neutral-400">{label}</Text>
      ) : null}
    </View>
  )
}
