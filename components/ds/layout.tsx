/**
 * Design-system layout: Screen (dark bg + hero glow), TopBar, StickyFooter.
 */

import React from 'react'
import { Image, KeyboardAvoidingView, Platform, ScrollView, View, type StyleProp, type ViewStyle, type RefreshControlProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { ArrowLeft } from 'phosphor-react-native/src/icons/ArrowLeft'
import { DotsThree } from 'phosphor-react-native/src/icons/DotsThree'

import { C } from './tokens'
import { T } from './primitives'
import { IconButton } from './controls'
import { useT } from '@/lib/i18n'

const GLOW_IMG = require('@/assets/brand/hero-glow.png')

/**
 * Figma "FX/Hero Glow": a 390×360 frame whose blurred green ellipse bleeds 185px left / 240px up.
 * The PNG (760×760 @2x, transparent) is rendered from the component's vector (ellipse
 * 520×340 #00FF24, Gaussian blur + 5 light lines), blur/opacity fitted to Figma's renders.
 * `top` = the frame's y in the screen (home −60, login −20, detail −30, Termine −100, Profil −50).
 */
export function HeroGlow({ top = -60, opacity = 1 }: { top?: number; opacity?: number }) {
  return (
    // Own full-size clipping layer: the 760px image must not make the screen
    // container scrollable (on web, focusing an input would scroll it sideways).
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', width: 760, height: 760, top: top - 240, left: '50%', marginLeft: -380, opacity }}>
        <Image source={GLOW_IMG} resizeMode="stretch" style={{ width: 760, height: 760 }} />
      </View>
    </View>
  )
}

/**
 * Full-screen page. Handles safe area, dark background, optional hero glow,
 * scrolling and bottom space for the tab bar / sticky footer.
 */
export function Screen({
  children,
  glow,
  scroll = true,
  padded = true,
  tabBar,
  footer,
  header,
  gap = 20,
  contentStyle,
  refreshControl,
  keyboard,
}: {
  children?: React.ReactNode
  /** hero glow frame y (see HeroGlow); omit for no glow */
  glow?: number
  scroll?: boolean
  /** 20px horizontal padding (Figma px-20) */
  padded?: boolean
  /** leave room for the bottom tab bar */
  tabBar?: boolean
  /** pinned content at the bottom (e.g. primary button) */
  footer?: React.ReactNode
  /** pinned content above the scroll area (e.g. TopBar) */
  header?: React.ReactNode
  gap?: number
  contentStyle?: StyleProp<ViewStyle>
  refreshControl?: React.ReactElement<RefreshControlProps>
  /** wrap in KeyboardAvoidingView (forms) */
  keyboard?: boolean
}) {
  const insets = useSafeAreaInsets()
  const bottomPad = footer ? 16 : tabBar ? 24 : Math.max(insets.bottom, 16) + 16
  const inner: StyleProp<ViewStyle> = [
    { paddingHorizontal: padded ? 20 : 0, paddingTop: header ? 8 : 12, paddingBottom: bottomPad, gap },
    contentStyle,
  ]

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[inner, { flexGrow: 1 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, inner]}>{children}</View>
  )

  const content = (
    <>
      {header}
      {body}
      {footer ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) + 8, gap: 12 }}>
          {footer}
        </View>
      ) : null}
    </>
  )

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, overflow: 'hidden' }}>
      {glow !== undefined ? <HeroGlow top={glow + insets.top} /> : null}
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {keyboard ? (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {content}
          </KeyboardAvoidingView>
        ) : (
          content
        )}
      </View>
    </View>
  )
}

/** Figma TopBar: h52, back IconButton, Heading/L title, optional right action. */
export function TopBar({
  title,
  onBack,
  back = true,
  right,
  rightIcon,
  onRight,
  rightLabel,
}: {
  title?: string
  onBack?: () => void
  back?: boolean
  right?: React.ReactNode
  rightIcon?: PhosphorIcon
  onRight?: () => void
  /** screen-reader label for the icon-only right action (default "Weitere Optionen") */
  rightLabel?: string
}) {
  const t = useT()
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/home')))
  return (
    <View style={{ height: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {back ? <IconButton icon={ArrowLeft} onPress={goBack} accessibilityLabel={t('ds.back')} /> : null}
      {title ? (
        <T variant="headingL" style={{ flex: 1 }} numberOfLines={1} accessibilityRole="header">
          {title}
        </T>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {right ?? (onRight ? <IconButton tone="plain" icon={rightIcon ?? DotsThree} onPress={onRight} accessibilityLabel={rightLabel ?? t('ds.more')} /> : null)}
    </View>
  )
}

/** Header row for tab pages: big title + subtitle on the left, action(s) on the right. */
export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="headingXL">{title}</T>
        {subtitle ? <T variant="bodyM" color={C.muted}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  )
}

export function Row({
  children,
  gap = 12,
  align = 'center',
  justify,
  style,
}: {
  children: React.ReactNode
  gap?: number
  align?: ViewStyle['alignItems']
  justify?: ViewStyle['justifyContent']
  style?: StyleProp<ViewStyle>
}) {
  return <View style={[{ flexDirection: 'row', alignItems: align, justifyContent: justify, gap }, style]}>{children}</View>
}

export function VStack({ children, gap = 12, style }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>
}
