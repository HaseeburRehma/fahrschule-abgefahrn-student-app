/**
 * Admin UI kit — responsive building blocks for the admin dashboard on web
 * (wide column, see app/_layout.tsx) and phones.
 *
 * Only built-in APIs (Share, Linking, expo-web-browser, DOM on web), so nothing
 * here needs a new native build.
 */

import React from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as WebBrowser from 'expo-web-browser'

export const ADMIN_MAX_WIDTH = 1200
export const GREEN = '#00FF24'

/** Wide layout (tables, multi-column grids) from 900 px window width. */
export function useWide(): boolean {
  return useWindowDimensions().width >= 900
}

export function notify(msg: string) {
  if (Platform.OS === 'web') window.alert(msg)
  else Alert.alert(msg)
}

export function confirmAsk(msg: string, ok = 'OK', cancel = 'Abbrechen'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(msg))
  return new Promise((resolve) =>
    Alert.alert('', msg, [
      { text: cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: 'destructive', onPress: () => resolve(true) },
    ]),
  )
}

/** Web: copy to the clipboard → 'copied'. Native: share sheet (copy is one tap there) → 'shared'. */
export async function copyOrShare(text: string): Promise<'copied' | 'shared' | 'failed'> {
  try {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(text)
      return 'copied'
    }
    await Share.share({ message: text })
    return 'shared'
  } catch {
    return 'failed'
  }
}

/** Web: download as a file. Native: share sheet with the text. */
export async function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: mime }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return
  }
  await Share.share({ message: text, title: filename })
}

export async function openUrl(url: string) {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  await WebBrowser.openBrowserAsync(url)
}

// ── layout ──────────────────────────────────────────────────────────────────

export function Page({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const inner: ViewStyle = { width: '100%', maxWidth: ADMIN_MAX_WIDTH, alignSelf: 'center', padding: 20, gap: 16 }
  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={inner}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[inner, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  )
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="font-m-xbold text-lg text-neutral-100">{children}</Text>
      {right}
    </View>
  )
}

/** Wrapping grid: `cols` columns on wide screens, `phoneCols` on phones. */
export function Grid({ children, cols = 4, phoneCols = 2, gap = 12 }: { children: React.ReactNode; cols?: number; phoneCols?: number; gap?: number }) {
  const wide = useWide()
  const n = wide ? cols : phoneCols
  const items = React.Children.toArray(children).filter(Boolean)
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2 }}>
      {items.map((child, i) => (
        <View key={i} style={{ width: `${100 / n}%`, paddingHorizontal: gap / 2, paddingBottom: gap, flexDirection: 'column' }}>
          {child}
        </View>
      ))}
    </View>
  )
}

// ── atoms ───────────────────────────────────────────────────────────────────

export type Tone = 'green' | 'red' | 'amber' | 'blue' | 'gray'

const TONE: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: 'rgba(0,255,36,0.12)', fg: GREEN },
  red: { bg: 'rgba(255,90,90,0.14)', fg: '#FF7A7A' },
  amber: { bg: 'rgba(255,184,0,0.14)', fg: '#FFC233' },
  blue: { bg: 'rgba(80,160,255,0.14)', fg: '#7CB8FF' },
  gray: { bg: 'rgba(255,255,255,0.08)', fg: '#A3A3A3' },
}

export function Badge({ label, tone = 'gray' }: { label: string; tone?: Tone }) {
  const c = TONE[tone]
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: c.fg }} className="font-m-semibold text-[11px]" numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

export function Kpi({ label, value, hint, tone = 'green' }: { label: string; value: string | number; hint?: string; tone?: Tone }) {
  return (
    <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4" style={{ minHeight: 92, flexGrow: 1 }}>
      <Text style={{ color: TONE[tone].fg }} className="font-m-xbold text-2xl" numberOfLines={1}>
        {value}
      </Text>
      <Text className="font-m-semibold mt-1 text-xs text-neutral-300" numberOfLines={2}>
        {label}
      </Text>
      {hint ? (
        <Text className="font-m-regular mt-0.5 text-[11px] text-neutral-500" numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

export function Chip({ label, active, onPress, count }: { label: string; active?: boolean; onPress?: () => void; count?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      className={`flex-row items-center gap-1.5 rounded-full border px-3 py-2 ${active ? 'border-brand bg-brand/15' : 'border-neutral-800 bg-neutral-900'}`}
    >
      <Text className={`font-m-semibold text-xs ${active ? 'text-brand' : 'text-neutral-300'}`}>{label}</Text>
      {count !== undefined ? (
        <Text className={`font-m-bold text-[11px] ${active ? 'text-brand' : 'text-neutral-500'}`}>{count}</Text>
      ) : null}
    </Pressable>
  )
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
      {children}
    </ScrollView>
  )
}

export function ProgressBar({ pct, tone = 'green', height = 6 }: { pct: number; tone?: Tone; height?: number }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <View style={{ height, borderRadius: height, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <View style={{ width: `${p}%`, height, borderRadius: height, backgroundColor: TONE[tone].fg }} />
    </View>
  )
}

export function SmallButton({
  label,
  onPress,
  icon,
  variant = 'ghost',
  disabled,
  loading,
}: {
  label: string
  onPress?: () => void
  icon?: React.ReactNode
  variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  loading?: boolean
}) {
  const cls =
    variant === 'primary'
      ? 'bg-brand border-brand'
      : variant === 'danger'
        ? 'border-red-500/50 bg-red-500/10'
        : 'border-neutral-700 bg-neutral-900'
  const txt = variant === 'primary' ? 'text-ink' : variant === 'danger' ? 'text-red-400' : 'text-neutral-100'
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`flex-row items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 ${cls} ${disabled || loading ? 'opacity-50' : 'active:opacity-80'}`}
    >
      {loading ? <ActivityIndicator size="small" color={variant === 'primary' ? '#0A0A0A' : GREEN} /> : icon}
      <Text className={`font-m-bold text-[13px] ${txt}`} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

export function Notice({ title, body, tone = 'amber' }: { title: string; body?: string; tone?: Tone }) {
  const c = TONE[tone]
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 16, padding: 14, gap: 4 }}>
      <Text style={{ color: c.fg }} className="font-m-bold text-sm">
        {title}
      </Text>
      {body ? <Text className="font-m-regular text-[13px] leading-5 text-neutral-300">{body}</Text> : null}
    </View>
  )
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <View className="items-center gap-2 py-12">
      <Text className="font-m-bold text-center text-neutral-200">{title}</Text>
      {body ? <Text className="font-m-regular max-w-md text-center text-sm text-neutral-500">{body}</Text> : null}
    </View>
  )
}

/** Simple table for wide screens. `flex` per column sets the width ratio. */
export function TableHeader({ cols }: { cols: { label: string; flex: number; align?: 'left' | 'right' | 'center' }[] }) {
  return (
    <View className="flex-row border-b border-neutral-800 px-3 pb-2">
      {cols.map((c, i) => (
        <Text
          key={i}
          style={{ flex: c.flex, textAlign: c.align ?? 'left' }}
          className="font-m-bold text-[11px] uppercase tracking-wide text-neutral-500"
          numberOfLines={1}
        >
          {c.label}
        </Text>
      ))}
    </View>
  )
}

export function Spinner() {
  return (
    <View className="items-center py-16">
      <ActivityIndicator color={GREEN} size="large" />
    </View>
  )
}
