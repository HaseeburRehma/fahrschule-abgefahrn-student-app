/**
 * Design-system feedback: bottom Sheet, Toasts, Skeleton, Empty/Error/Loading states.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle'
import { Info } from 'phosphor-react-native/src/icons/Info'
import { Sparkle } from 'phosphor-react-native/src/icons/Sparkle'
import { WarningCircle } from 'phosphor-react-native/src/icons/WarningCircle'
import { X } from 'phosphor-react-native/src/icons/X'
import { ArrowRight } from 'phosphor-react-native/src/icons/ArrowRight'

import { C, GLOW } from './tokens'
import { T } from './primitives'
import { Button } from './controls'
import { useT } from '@/lib/i18n'

const native = Platform.OS !== 'web'

/* ------------------------------------------------------------------ Sheet */

/**
 * Bottom sheet modal (Figma "Modals"): #141614, top radius 30, handle 40×5, pt12 pb40 px24, gap 18.
 */
export function Sheet({
  visible,
  onClose,
  children,
  gap = 18,
  dismissable = true,
}: {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  gap?: number
  dismissable?: boolean
}) {
  const insets = useSafeAreaInsets()
  const t = useT()
  const [mounted, setMounted] = useState(visible)
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      setMounted(true)
      Animated.timing(anim, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start()
    } else if (mounted) {
      Animated.timing(anim, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: native }).start(() =>
        setMounted(false),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  if (!mounted) return null
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] })

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={() => dismissable && onClose()}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}
      >
        <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: C.overlay, opacity: anim }}>
          <Pressable style={{ flex: 1 }} onPress={() => dismissable && onClose()} accessibilityLabel={t('ds.close')} />
        </Animated.View>
        <Animated.View
          style={{
            width: '100%',
            maxWidth: 672,
            transform: [{ translateY }],
            backgroundColor: C.sheet,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: C.line,
            paddingTop: 12,
            paddingHorizontal: 24,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
            gap,
          }}
        >
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: C.line, alignSelf: 'center' }} />
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/** Centered sheet header: 76px hero circle + title + body (Anfrage gesendet / Termin absagen / Abmelden). */
export function SheetHero({
  icon: Icon,
  tone = 'green',
  title,
  body,
}: {
  icon: PhosphorIcon
  tone?: 'green' | 'danger'
  title: string
  body?: string
}) {
  const green = tone === 'green'
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <View
        style={[
          {
            width: 76,
            height: 76,
            borderRadius: 38,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: green ? C.tile : C.dangerBg,
            borderWidth: 1.5,
            borderColor: green ? C.brand : C.danger,
            marginTop: 6,
            marginBottom: 4,
          },
          green ? { ...GLOW.tile, shadowOpacity: 0.35, shadowRadius: 14 } : null,
        ]}
      >
        <Icon size={38} color={green ? C.brand : C.danger} weight={green ? 'fill' : 'regular'} />
      </View>
      <T variant="headingL" style={{ textAlign: 'center' }}>{title}</T>
      {body ? (
        <T variant="bodyL" color={C.muted} style={{ textAlign: 'center' }}>
          {body}
        </T>
      ) : null}
    </View>
  )
}

/** Left-aligned sheet title + optional subtitle (Sprache / Sonderfahrten / Prüfung eintragen). */
export function SheetTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 4, marginTop: 6 }}>
      <T variant="headingL">{title}</T>
      {subtitle ? <T variant="bodyS" color={C.muted}>{subtitle}</T> : null}
    </View>
  )
}

/* ------------------------------------------------------------------ Toasts */

export type ToastTone = 'success' | 'error' | 'info'
type ToastItem = { id: number; tone: ToastTone; title: string }

const ToastCtx = createContext<{ show: (title: string, tone?: ToastTone) => void }>({ show: () => {} })

export function useToast() {
  return useContext(ToastCtx)
}

export function ToastView({ tone, title, onClose }: { tone: ToastTone; title: string; onClose?: () => void }) {
  const t = useT()
  const s =
    tone === 'success'
      ? { bg: C.successToast, border: C.lineGreen, tile: C.brand, fg: C.onBrand, icon: CheckCircle, weight: 'fill' as const }
      : tone === 'error'
        ? { bg: C.dangerToast, border: C.dangerLine, tile: C.danger, fg: C.dangerInk, icon: WarningCircle, weight: 'regular' as const }
        : { bg: C.card, border: C.line, tile: C.surface, fg: C.dim, icon: Info, weight: 'regular' as const }
  const Icon = s.icon
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 15,
          borderRadius: 18,
          borderWidth: 1,
          backgroundColor: s.bg,
          borderColor: s.border,
        },
        GLOW.toast,
      ]}
    >
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: s.tile, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={s.fg} weight={s.weight} />
      </View>
      <T variant="titleM" style={{ flex: 1 }} accessibilityLiveRegion="polite">{title}</T>
      {onClose ? (
        <Pressable onPress={onClose} hitSlop={13} accessibilityRole="button" accessibilityLabel={t('ds.close')}>
          <X size={18} color={C.dim} />
        </Pressable>
      ) : null}
    </View>
  )
}

function AnimatedToast({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const anim = useRef(new Animated.Value(0)).current
  const close = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: native }).start(() => onDone(item.id))
  }, [anim, item.id, onDone])
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start()
    const t = setTimeout(close, item.tone === 'error' ? 4500 : 3000)
    return () => clearTimeout(t)
  }, [anim, close, item.tone])
  return (
    <Animated.View
      style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] }}
    >
      <ToastView tone={item.tone} title={item.title} onClose={close} />
    </Animated.View>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets()
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const show = useCallback((title: string, tone: ToastTone = 'success') => {
    const id = ++seq.current
    setItems((prev) => [...prev.slice(-2), { id, tone, title }])
  }, [])
  const remove = useCallback((id: number) => setItems((prev) => prev.filter((x) => x.id !== id)), [])
  const value = useMemo(() => ({ show }), [show])
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {items.length ? (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, alignItems: 'center', zIndex: 1000 }}
        >
          <View pointerEvents="box-none" style={{ width: '100%', maxWidth: 672, paddingHorizontal: 20, gap: 10 }}>
            {items.map((it) => (
              <AnimatedToast key={it.id} item={it} onDone={remove} />
            ))}
          </View>
        </View>
      ) : null}
    </ToastCtx.Provider>
  )
}

/* ------------------------------------------------------------------ Skeleton */

function usePulse() {
  const v = useRef(new Animated.Value(0.55)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 750, useNativeDriver: native }),
        Animated.timing(v, { toValue: 0.55, duration: 750, useNativeDriver: native }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [v])
  return v
}

export function Skeleton({
  width = '100%',
  height = 14,
  radius = 8,
  style,
}: {
  width?: DimensionValue
  height?: number
  radius?: number
  style?: StyleProp<ViewStyle>
}) {
  const opacity = usePulse()
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: C.surface, opacity }, style]} />
}

/** Figma "Laden" (1311:2910): skeleton of the home screen + "Lädt deine Daten …". */
export function LoadingScreenSkeleton({ label }: { label?: string }) {
  const t = useT()
  const box: ViewStyle = { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 24 }
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width={120} height={14} />
          <Skeleton width={170} height={22} />
        </View>
        <Skeleton width={44} height={44} radius={14} />
      </View>
      <View style={[box, { padding: 18, gap: 16 }]}>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <Skeleton width={84} height={84} radius={42} />
          <View style={{ flex: 1, gap: 10 }}>
            <Skeleton width="50%" height={11} />
            <Skeleton width="72%" height={18} />
            <Skeleton width="92%" height={11} />
          </View>
        </View>
        <Skeleton height={8} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[box, { flex: 1, padding: 14, gap: 10, borderRadius: 20 }]}>
            <Skeleton width={32} height={32} radius={10} />
            <Skeleton width={36} height={18} />
            <Skeleton width={54} height={8} />
          </View>
        ))}
      </View>
      {[0, 1].map((i) => (
        <View key={i} style={[box, { padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center', borderRadius: 20 }]}>
          <Skeleton width={46} height={46} radius={14} />
          <View style={{ flex: 1, gap: 10 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="88%" height={11} />
          </View>
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 }}>
        <Sparkle size={18} color={C.brand} weight="fill" />
        <T variant="bodyS" color={C.muted}>{label ?? t('ds.loading')}</T>
      </View>
    </View>
  )
}

/* ------------------------------------------------------------------ Empty / Error */

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  onAction,
  actionIcon,
}: {
  icon: PhosphorIcon
  title: string
  body?: string
  action?: string
  onAction?: () => void
  actionIcon?: PhosphorIcon
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 32, flexGrow: 1 }}>
      <View
        style={{
          width: 104,
          height: 104,
          borderRadius: 52,
          backgroundColor: C.card,
          borderWidth: 1,
          borderColor: C.line,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <Icon size={46} color={C.dim} />
      </View>
      <T variant="headingL" style={{ textAlign: 'center' }}>{title}</T>
      {body ? (
        <T variant="bodyL" color={C.muted} style={{ textAlign: 'center', maxWidth: 300 }}>
          {body}
        </T>
      ) : null}
      {action ? (
        <Button compact label={action} onPress={onAction} iconLeft={actionIcon} style={{ marginTop: 12 }} />
      ) : null}
    </View>
  )
}

/** Figma "Verbindungsfehler" (1311:2996). */
export function ErrorState({
  title,
  body,
  onRetry,
  icon: Icon = WarningCircle,
}: {
  title?: string
  body?: string
  onRetry?: () => void
  icon?: PhosphorIcon
}) {
  const t = useT()
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24, flexGrow: 1 }}>
      <View
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: C.dangerBg,
          borderWidth: 1,
          borderColor: C.dangerLine,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <Icon size={54} color={C.danger} />
      </View>
      <T variant="headingL" style={{ textAlign: 'center' }}>{title ?? t('ds.offline.title')}</T>
      <T variant="bodyL" color={C.muted} style={{ textAlign: 'center', maxWidth: 300 }}>
        {body ?? t('ds.offline.body')}
      </T>
      {onRetry ? (
        <Button compact label={t('ds.retry')} iconLeft={ArrowRight} onPress={onRetry} style={{ marginTop: 14 }} />
      ) : null}
    </View>
  )
}


