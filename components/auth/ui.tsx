/**
 * Local building blocks for the auth / onboarding screens (Figma "05/…" frames).
 * Everything else comes from the shared design system (`@/components/ds`).
 */

import React from 'react'
import { Image, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Icon as PhosphorIcon, IconProps } from 'phosphor-react-native'
import { WarningCircle } from 'phosphor-react-native/src/icons/WarningCircle'

import { C, F, HeroGlow, T, TYPE } from '@/components/ds'

const GLOW_IMG = require('@/assets/brand/hero-glow.png')

/**
 * The Figma "FX/Hero Glow" component scaled into an arbitrary box (onboarding illustrations
 * use it at 240×240). The PNG covers the glow's full bleed: 47.44 % left/right, 66.67 % up.
 */
export function ScaledGlow({ width, height }: { width: number; height: number }) {
  const bleedX = width * 0.4744
  const bleedY = height * 0.6667
  return (
    <Image
      source={GLOW_IMG}
      resizeMode="stretch"
      style={{ position: 'absolute', left: -bleedX, top: -bleedY, width: width + bleedX * 2, height: height + bleedY }}
    />
  )
}

/** Left-aligned two-line hero title (Display/L white + Emphasis/L green). */
export function AuthTitle({ line1, line2, gap = 2, align = 'left' }: { line1: string; line2: string; gap?: number; align?: 'left' | 'center' }) {
  return (
    <View style={{ gap, alignSelf: 'stretch' }}>
      <T variant="displayL" style={{ textAlign: align }}>{line1}</T>
      <T variant="emphasisL" color={C.brand} style={{ textAlign: align }}>{line2}</T>
    </View>
  )
}

/** Big 128px green circle with a strong glow (Link gesendet / Push erlauben / Konto erstellt). */
export function GlowCircle({ icon: Icon, weight = 'fill' }: { icon: PhosphorIcon; weight?: IconProps['weight'] }) {
  return (
    <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
      <View
        style={{
          width: 128,
          height: 128,
          borderRadius: 64,
          backgroundColor: C.brand,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: C.brand,
          shadowOpacity: 0.65,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 0 },
          elevation: 14,
        }}
      >
        <Icon size={66} color={C.onBrand} weight={weight} />
      </View>
    </View>
  )
}

/** Full-width text-only button (Button type, muted) — "Vielleicht später", "E-Mail erneut senden". */
export function TextButton({
  label,
  onPress,
  disabled,
  color = C.muted,
}: {
  label: string
  onPress?: () => void
  disabled?: boolean
  color?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({
        height: 52,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      <T variant="button" color={color}>{label}</T>
    </Pressable>
  )
}

/** "Noch kein Konto? Registrieren" footer row. */
export function FooterPrompt({ text, link, onPress }: { text: string; link: string; onPress: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <T variant="bodyM" color={C.muted}>{text}</T>
      <Pressable onPress={onPress} hitSlop={10} accessibilityRole="link">
        {({ pressed }) => (
          <T variant="labelL" color={C.brand} style={{ opacity: pressed ? 0.7 : 1 }}>{link}</T>
        )}
      </Pressable>
    </View>
  )
}

/** Inline error line (warning-circle + Caption, danger) — used for non-field errors. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <WarningCircle size={16} color={C.danger} />
      <T variant="caption" color={C.danger} style={{ flex: 1 }}>{message}</T>
    </View>
  )
}

/**
 * Centered hero layout (Figma 05/Link gesendet, Push erlauben, Konto erstellt):
 * glow −20, optional top bar row (y 64), 160px hero frame at y 170, title block at y 380,
 * actions pinned to the bottom. `bottomGap` = distance of the last action above the home indicator.
 */
export function CenteredHeroScreen({
  top,
  hero,
  line1,
  line2,
  body,
  actions,
  bottomGap = 28,
}: {
  top?: React.ReactNode
  hero: React.ReactNode
  line1: string
  line2: string
  body?: string
  actions: React.ReactNode
  bottomGap?: number
}) {
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, overflow: 'hidden' }}>
      <HeroGlow top={-20 + insets.top} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) + bottomGap }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* status bar (54) → top row at 64 (h44) → hero frame at 170 */}
        <View style={{ height: 116, paddingTop: 10, paddingHorizontal: 20 }}>{top}</View>
        {hero}
        <View style={{ marginTop: 50, paddingHorizontal: 32, gap: 12, alignItems: 'center' }}>
          <View style={{ alignSelf: 'stretch' }}>
            <T variant="displayL" style={{ textAlign: 'center' }}>{line1}</T>
            <T variant="emphasisL" color={C.brand} style={{ textAlign: 'center' }}>{line2}</T>
          </View>
          {body ? (
            <T variant="bodyL" color={C.muted} style={{ textAlign: 'center' }}>{body}</T>
          ) : null}
        </View>
        <View style={{ flex: 1, minHeight: 40 }} />
        <View style={{ paddingHorizontal: 24, gap: 12 }}>{actions}</View>
      </ScrollView>
    </View>
  )
}

/** Emphasis line used by the onboarding pager: Black Italic 34/46 (bigger than Emphasis/L). */
export const ONBOARDING_EMPHASIS = {
  ...TYPE.displayL,
  fontFamily: F.blackItalic,
  lineHeight: 46,
} as const

/** Wraps a Phosphor icon so the DS Button renders it with a fixed weight (Button forces "bold"). */
export function withWeight(Icon: PhosphorIcon, weight: IconProps['weight']): PhosphorIcon {
  const Wrapped = (props: IconProps) => <Icon {...props} weight={weight} />
  Wrapped.displayName = `${(Icon as any).displayName ?? 'Icon'}_${weight}`
  return Wrapped as unknown as PhosphorIcon
}

export function Spacer({ h }: { h: number }) {
  return <View style={{ height: h }} />
}

