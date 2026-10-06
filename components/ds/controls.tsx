/**
 * Design-system controls (Figma "Mobile App"): buttons, inputs, segmented, toggle, checkbox, list rows.
 */

import React, { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,

  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { ArrowLeft } from 'phosphor-react-native/src/icons/ArrowLeft'
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight'
import { Check } from 'phosphor-react-native/src/icons/Check'
import { WarningCircle } from 'phosphor-react-native/src/icons/WarningCircle'

import { C, F, GLOW } from './tokens'
import { T } from './primitives'

/* ------------------------------------------------------------------ Button */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSoft'

const BTN: Record<ButtonVariant, { bg?: string; fg: string; border?: string }> = {
  primary: { bg: C.brand, fg: C.onBrand },
  secondary: { fg: C.brand, border: C.brand },
  ghost: { bg: C.surface, fg: C.white },
  danger: { bg: C.danger, fg: C.dangerInk },
  dangerSoft: { bg: C.dangerBg, fg: C.danger },
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  iconRight: IconRight,
  iconLeft: IconLeft,
  loading,
  disabled,
  style,
  compact,
  iconWeight = 'bold',
}: {
  label: string
  onPress?: () => void
  variant?: ButtonVariant
  iconRight?: PhosphorIcon
  iconLeft?: PhosphorIcon
  loading?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  /** auto width (e.g. "Erneut versuchen", "Fahrschule fragen") instead of full width */
  compact?: boolean
  /** Phosphor weight for the button icons (Figma mostly uses bold arrows, filled checks) */
  iconWeight?: 'regular' | 'bold' | 'fill'
}) {
  const v = BTN[variant]
  const isDisabled = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        {
          height: compact ? 48 : 54,
          borderRadius: 28,
          paddingHorizontal: compact ? 22 : 24,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          alignSelf: compact ? 'center' : 'stretch',
          backgroundColor: v.bg ?? 'transparent',
          borderWidth: v.border ? 1.5 : 0,
          borderColor: v.border,
        },
        variant === 'primary' && !isDisabled ? GLOW.button : null,
        isDisabled ? { opacity: 0.5 } : pressed ? { opacity: 0.85, transform: [{ scale: 0.99 }] } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {IconLeft ? <IconLeft size={20} color={v.fg} weight={iconWeight} /> : null}
          <T variant="button" color={v.fg} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</T>
          {IconRight ? <IconRight size={20} color={v.fg} weight={iconWeight} /> : null}
        </>
      )}
    </Pressable>
  )
}

/** Text-only link button (e.g. "Passwort vergessen?", "Vielleicht später"). */
export function LinkButton({
  label,
  onPress,
  color = C.brand,
  align = 'center',
}: {
  label: string
  onPress?: () => void
  color?: string
  align?: 'left' | 'center' | 'right'
}) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" style={{ alignSelf: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }}>
      {({ pressed }) => (
        <T variant="labelL" color={color} style={{ opacity: pressed ? 0.7 : 1, textAlign: align }}>
          {label}
        </T>
      )}
    </Pressable>
  )
}

/* ------------------------------------------------------------------ IconButton */

export function IconButton({
  icon: Icon = ArrowLeft,
  onPress,
  tone = 'surface',
  accessibilityLabel,
  badge,
}: {
  icon?: PhosphorIcon
  onPress?: () => void
  /** surface = back/close (dark, #3B3F3B border) · plain = dark with #2A2D2A border · green = primary action (+) */
  tone?: 'surface' | 'plain' | 'green'
  accessibilityLabel?: string
  /** small green dot (e.g. unread notifications) */
  badge?: boolean
}) {
  const green = tone === 'green'
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: green ? C.brand : C.surface,
          borderWidth: green ? 0 : 1,
          borderColor: tone === 'plain' ? C.line : C.lineStrong,
        },
        green ? { ...GLOW.tile, shadowRadius: 6 } : null,
        pressed ? { opacity: 0.8 } : null,
      ]}
    >
      <Icon size={green ? 24 : 22} color={green ? C.onBrand : C.white} weight={green ? 'bold' : 'regular'} />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: 7,
            right: 7,
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: C.brand,
            borderWidth: 1.5,
            borderColor: C.surface,
          }}
        />
      ) : null}
    </Pressable>
  )
}

/* ------------------------------------------------------------------ Input */

export function Input({
  label,
  icon: Icon,
  error,
  hint,
  right,
  multiline,
  style,
  ...props
}: TextInputProps & {
  label?: string
  icon?: PhosphorIcon
  /** red border; a string also shows the message below */
  error?: string | boolean
  hint?: string
  right?: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  // Figma: 1px #2A2D2A idle · brand when focused · 1.5px danger on error
  const borderColor = error ? C.danger : focused ? C.brand : C.line
  const borderWidth = error ? 1.5 : 1
  return (
    <View style={{ gap: 8, alignSelf: 'stretch' }}>
      {label ? <T variant="labelL" color={C.muted}>{label}</T> : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: 12,
          backgroundColor: C.surface,
          borderRadius: 16,
          borderWidth,
          borderColor,
          paddingHorizontal: 16,
          paddingVertical: multiline ? 14 : 0,
          minHeight: multiline ? 96 : 58,
        }}
      >
        {Icon ? <Icon size={20} color={C.dim} /> : null}
        <TextInput
          placeholderTextColor={C.dim}
          selectionColor={C.brand}
          cursorColor={C.brand}
          accessibilityLabel={label ?? props.placeholder}
          {...props}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            props.onBlur?.(e)
          }}
          style={[
            {
              flex: 1,
              color: C.white,
              fontFamily: F.medium,
              fontSize: 16,
              lineHeight: multiline ? 22 : undefined,
              paddingVertical: multiline ? 0 : 16,
              textAlignVertical: multiline ? 'top' : 'center',
              outlineWidth: 0,
            } as any,
            style,
          ]}
        />
        {right}
      </View>
      {typeof error === 'string' && error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <WarningCircle size={16} color={C.danger} />
          <T variant="caption" color={C.danger} style={{ flex: 1 }}>{error}</T>
        </View>
      ) : hint ? (
        <T variant="caption" color={C.dim}>{hint}</T>
      ) : null}
    </View>
  )
}

/* ------------------------------------------------------------------ Segmented */

export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[]
  value: K
  onChange: (k: K) => void
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999, backgroundColor: C.surface, alignSelf: 'stretch' }}>
      {options.map((o) => {
        const active = o.key === value
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center', backgroundColor: active ? C.brand : 'transparent' }}
          >
            <T variant="labelL" color={active ? C.onBrand : C.muted} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{o.label}</T>
          </Pressable>
        )
      })}
    </View>
  )
}

/* ------------------------------------------------------------------ Toggle / Checkbox / Radio */

/** 46×28 switch: green track + dark knob when on. */
export function Toggle({
  value,
  onChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  accessibilityLabel?: string
}) {
  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={10}
      style={{
        width: 46,
        height: 28,
        borderRadius: 14,
        padding: 3,
        backgroundColor: value ? C.brand : C.surface2,
        borderWidth: value ? 0 : 1,
        borderColor: C.lineStrong,
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: value ? C.onBrand : C.dim,
          alignSelf: value ? 'flex-end' : 'flex-start',
        }}
      />
    </Pressable>
  )
}

/** Rounded square checkbox (sign-up terms). */
export function Checkbox({ value, onChange, size = 22 }: { value: boolean; onChange?: (v: boolean) => void; size?: number }) {
  return (
    <Pressable
      onPress={() => onChange?.(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      hitSlop={11}
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        backgroundColor: value ? C.brand : 'transparent',
        borderWidth: value ? 0 : 1.5,
        borderColor: C.lineStrong,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {value ? <Check size={size * 0.64} color={C.onBrand} weight="bold" /> : null}
    </Pressable>
  )
}

/** Round check (lists): filled green with check when done, empty ring otherwise. */
export function CheckCircleMark({ done, size = 24 }: { done: boolean; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: done ? C.brand : 'transparent',
        borderWidth: done ? 0 : 1.5,
        borderColor: C.lineStrong,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {done ? <Check size={size * 0.6} color={C.onBrand} weight="bold" /> : null}
    </View>
  )
}

/* ------------------------------------------------------------------ List rows */

/** Grouped list container (Profil sections): card with hairline dividers between rows. */
export function ListGroup({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = React.Children.toArray(children).filter(Boolean)
  return (
    <View style={[{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 20, overflow: 'hidden' }, style]}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <View style={{ height: 1, backgroundColor: C.line }} /> : null}
          {child}
        </React.Fragment>
      ))}
    </View>
  )
}

export function ListRow({
  icon: Icon,
  title,
  value,
  onPress,
  right,
  danger,
  chevron = true,
}: {
  icon: PhosphorIcon
  title: string
  value?: string
  onPress?: () => void
  right?: React.ReactNode
  danger?: boolean
  chevron?: boolean
}) {
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: danger ? C.dangerBg : C.tile, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={19} color={danger ? C.danger : C.brand} />
      </View>
      <T variant="titleM" color={danger ? C.danger : C.white} style={{ flex: 1 }}>{title}</T>
      {value ? <T variant="bodyS" color={C.muted} numberOfLines={1} style={{ flexShrink: 1, maxWidth: '45%' }}>{value}</T> : null}
      {right ?? (onPress && chevron && !danger ? <CaretRight size={20} color={C.dim} /> : null)}
    </View>
  )
  if (!onPress) return body
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => (pressed ? { backgroundColor: '#161816' } : null)}>
      {body}
    </Pressable>
  )
}

/** Selectable chip (booking: date / time slots, type toggle). */
export function ChoiceChip({
  label,
  sublabel,
  selected,
  disabled,
  onPress,
  icon: Icon,
  style,
}: {
  label: string
  sublabel?: string
  selected?: boolean
  disabled?: boolean
  onPress?: () => void
  icon?: PhosphorIcon
  style?: StyleProp<ViewStyle>
}) {
  const fg = selected ? C.onBrand : disabled ? C.dim : C.white
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={sublabel ? `${sublabel} ${label}` : label}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        {
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 6,
          backgroundColor: selected ? C.brand : C.surface,
          borderWidth: 1,
          borderColor: selected ? C.brand : C.line,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        selected ? GLOW.tile : null,
        style,
      ]}
    >
      {Icon ? <Icon size={18} color={fg} weight={selected ? 'fill' : 'regular'} /> : null}
      <View style={{ alignItems: 'center', flexShrink: 1 }}>
        {sublabel ? <T variant="caption" color={selected ? C.onBrand : C.dim} numberOfLines={1}>{sublabel}</T> : null}
        <T variant="labelL" color={fg} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{label}</T>
      </View>
    </Pressable>
  )
}


