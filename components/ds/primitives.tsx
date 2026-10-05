/**
 * Design-system primitives (Figma "Mobile App"): typography, cards, tiles, pills, labels.
 */

import React from 'react'
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { SvgXml } from 'react-native-svg'
import type { Icon as PhosphorIcon, IconWeight } from 'phosphor-react-native'

import { C, GLOW, TYPE, type TypeVariant } from './tokens'
import { LOGO_FULL_XML } from './logo-xml'

/* ------------------------------------------------------------------ text */

export function T({
  variant = 'bodyS',
  color = C.white,
  style,
  ...props
}: TextProps & { variant?: TypeVariant; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text {...props} style={[TYPE[variant], { color }, style]} />
}

/** Two-line hero title: white first line + green italic emphasis (e.g. "Willkommen / zurück"). */
export function HeroTitle({
  line1,
  line2,
  size = 'L',
  align = 'left',
  variant1,
}: {
  line1: string
  line2: string
  size?: 'L' | 'M'
  align?: 'left' | 'center'
  /** override the first line's style (e.g. splash uses Heading/L) */
  variant1?: TypeVariant
}) {
  const a = { textAlign: align } as const
  if (size === 'M') {
    return (
      <View style={{ alignItems: align === 'center' ? 'center' : 'flex-start' }}>
        <T variant="headingM" style={a}>{line1}</T>
        <T variant="emphasisM" color={C.brand} style={a}>{line2}</T>
      </View>
    )
  }
  return (
    <View style={{ gap: variant1 ? 0 : 2, alignItems: align === 'center' ? 'center' : 'flex-start' }}>
      <T variant={variant1 ?? 'displayL'} style={a}>{line1}</T>
      <T variant="emphasisL" color={C.brand} style={a}>{line2}</T>
    </View>
  )
}

/** Page title for tab screens: Heading/XL + optional Body/M subtitle. */
export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 2, flex: 1 }}>
      <T variant="headingXL">{title}</T>
      {subtitle ? <T variant="bodyM" color={C.muted}>{subtitle}</T> : null}
    </View>
  )
}

/** Uppercase section label (Label/M, dim), e.g. "KONTO". */
export function SectionLabel({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return (
    <T variant="labelM" color={C.dim} style={style}>
      {children.toUpperCase()}
    </T>
  )
}

export function Logo({ width = 157 }: { width?: number }) {
  return <SvgXml xml={LOGO_FULL_XML} width={width} height={(width * 32) / 158} />
}

/* ------------------------------------------------------------------ surfaces */

export function Card({
  children,
  highlight,
  radius = 20,
  padding = 16,
  onPress,
  style,
}: {
  children: React.ReactNode
  /** green border + soft green glow ("Deine Strecke", profile header) */
  highlight?: boolean
  radius?: number
  padding?: number
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}) {
  const s: StyleProp<ViewStyle> = [
    {
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: highlight ? C.lineGreen : C.line,
      borderRadius: radius,
      padding,
    },
    highlight ? GLOW.card : null,
    style,
  ]
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    )
  }
  return <View style={s}>{children}</View>
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: C.line, alignSelf: 'stretch' }, style]} />
}

/** Rounded square with an icon (green tile by default). */
export function IconTile({
  icon: Icon,
  size = 46,
  iconSize,
  radius = 14,
  tone = 'green',
  weight = 'regular',
  glow,
}: {
  icon: PhosphorIcon
  size?: number
  iconSize?: number
  radius?: number
  tone?: 'green' | 'surface' | 'danger' | 'solid'
  weight?: IconWeight
  glow?: boolean
}) {
  const bg =
    tone === 'green' ? C.tile : tone === 'danger' ? C.dangerBg : tone === 'solid' ? C.brand : C.surface
  const fg = tone === 'danger' ? C.danger : tone === 'solid' ? C.onBrand : tone === 'surface' ? C.white : C.brand
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: radius, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        glow ? GLOW.tile : null,
      ]}
    >
      <Icon size={iconSize ?? Math.round(size * 0.52)} color={fg} weight={weight} />
    </View>
  )
}

/** Big circular hero icon (auth flows / empty / success). */
export function HeroIcon({
  icon: Icon,
  tone = 'solid',
  size = 104,
}: {
  icon: PhosphorIcon
  tone?: 'solid' | 'danger' | 'muted' | 'ring'
  size?: number
}) {
  const style: ViewStyle =
    tone === 'solid'
      ? { backgroundColor: C.brand, ...GLOW.button, shadowRadius: 22 }
      : tone === 'danger'
        ? { backgroundColor: C.dangerBg, borderWidth: 1.5, borderColor: C.danger }
        : tone === 'ring'
          ? { backgroundColor: C.tile, borderWidth: 1.5, borderColor: C.brand }
          : { backgroundColor: C.surface }
  const fg = tone === 'solid' ? C.onBrand : tone === 'danger' ? C.danger : tone === 'ring' ? C.brand : C.dim
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Icon size={Math.round(size * 0.5)} color={fg} weight={tone === 'solid' ? 'fill' : 'regular'} />
    </View>
  )
}

/* ------------------------------------------------------------------ pills */

export type PillTone = 'green' | 'amber' | 'neutral' | 'danger'

const PILL: Record<PillTone, { bg: string; fg: string }> = {
  green: { bg: C.tile, fg: C.brand },
  amber: { bg: '#2A2410', fg: '#FFC43D' },
  neutral: { bg: C.surface, fg: C.muted },
  danger: { bg: C.dangerBg, fg: C.danger },
}

export function Pill({
  label,
  tone = 'green',
  icon: Icon,
}: {
  label: string
  tone?: PillTone
  icon?: PhosphorIcon
}) {
  const p = PILL[tone]
  return (
    <View
      style={{
        backgroundColor: p.bg,
        borderRadius: 999,
        paddingLeft: Icon ? 9 : 10,
        paddingRight: Icon ? 11 : 10,
        paddingVertical: Icon ? 6 : 5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
      }}
    >
      {Icon ? <Icon size={15} color={p.fg} weight="fill" /> : null}
      <T variant="labelM" color={p.fg}>{label}</T>
    </View>
  )
}

/** Small icon + text meta line (date, time, place). */
export function Meta({
  icon: Icon,
  text,
  size = 16,
  iconColor = C.muted,
}: {
  icon: PhosphorIcon
  text: string
  size?: number
  iconColor?: string
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon size={size} color={iconColor} />
      <T variant="bodyS" color={C.muted}>{text}</T>
    </View>
  )
}
