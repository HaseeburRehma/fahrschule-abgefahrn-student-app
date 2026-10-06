/**
 * Figma "DE/Mitteilungen" (1286:1518): stack screen with "Alle gelesen",
 * grouped NEU (unread) / FRÜHER (read). Tap = mark read + open the related
 * screen; long-press = delete.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Alert, Platform, Pressable, RefreshControl, View } from 'react-native'
import { useRouter } from 'expo-router'
import { differenceInCalendarDays, differenceInMinutes, format, isSameYear } from 'date-fns'
import { de as deLocale, enUS } from 'date-fns/locale'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { Bell } from 'phosphor-react-native/src/icons/Bell'
import { BookOpen } from 'phosphor-react-native/src/icons/BookOpen'
import { CalendarDots } from 'phosphor-react-native/src/icons/CalendarDots'
import { ChatCircleDots } from 'phosphor-react-native/src/icons/ChatCircleDots'
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle'
import { ClockCountdown } from 'phosphor-react-native/src/icons/ClockCountdown'
import { Confetti } from 'phosphor-react-native/src/icons/Confetti'
import { FileText } from 'phosphor-react-native/src/icons/FileText'
import { GraduationCap } from 'phosphor-react-native/src/icons/GraduationCap'
import { Package } from 'phosphor-react-native/src/icons/Package'

import { C, EmptyState, ErrorState, Screen, SectionLabel, Skeleton, T, TopBar, useToast } from '@/components/ds'
import { stripAbbrDots } from '@/lib/format'
import { useTranslation } from '@/lib/i18n'
import { useNotifications } from '@/lib/notifications-context'
import type { Locale, NotificationRow } from '@/lib/types'

/* ------------------------------------------------------------------ helpers */

function kindOf(n: NotificationRow): string {
  const d = (n.data ?? {}) as Record<string, any>
  return String(d.kind ?? d.type ?? n.type ?? 'general')
}

function iconFor(n: NotificationRow): PhosphorIcon {
  const d = (n.data ?? {}) as Record<string, any>
  const k = kindOf(n)
  if (k === 'document' || d.document_id) return FileText
  if (k === 'chat' || k === 'message') return ChatCircleDots
  if (k === 'welcome') return Confetti
  if (k === 'exam') return GraduationCap
  if (k === 'confirmed' || d.status === 'confirmed') return CheckCircle
  if (k === 'reminder') return ClockCountdown
  if (k === 'schedule' || n.type === 'schedule') return CalendarDots
  if (k === 'theory' || n.type === 'theory') return BookOpen
  if (k === 'package' || n.type === 'package') return Package
  return Bell
}

function routeFor(n: NotificationRow): string | null {
  const d = (n.data ?? {}) as Record<string, any>
  if (typeof d.route === 'string' && d.route.startsWith('/')) return d.route
  if (typeof d.appointment_id === 'string' && d.appointment_id) return `/appointment/${d.appointment_id}`
  const k = kindOf(n)
  if (k === 'document' || d.document_id) return d.document_id ? `/documents/${d.document_id}` : '/documents'
  if (k === 'chat' || k === 'message') return '/chat'
  if (k === 'exam') return '/exams'
  if (k === 'schedule' || k === 'reminder' || n.type === 'schedule' || n.type === 'reminder') return '/schedule'
  if (k === 'theory' || n.type === 'theory') return '/theory'
  if (k === 'package' || n.type === 'package') return '/progress'
  return null
}

function relativeTime(iso: string, locale: Locale, t: (k: string, v?: Record<string, string | number>) => string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const loc = locale === 'de' ? deLocale : enUS
  const mins = differenceInMinutes(now, d)
  const days = differenceInCalendarDays(now, d)
  if (days === 0) {
    if (mins < 1) return t('notifications.v2.justNow')
    if (mins < 60) return t('notifications.v2.minAgo', { n: mins })
    return t('notifications.v2.hoursAgo', { n: Math.floor(mins / 60) })
  }
  if (days === 1) return t('notifications.v2.yesterday')
  // Figma style: "Mo, 29. Sep" / "5. Aug" — date-fns de abbreviations carry trailing dots ("Fr.", "Okt.").
  const fmt = (pattern: string) => stripAbbrDots(format(d, pattern, { locale: loc }))
  if (days < 7) return fmt(locale === 'de' ? 'EEE, d. MMM' : 'EEE, d MMM')
  if (isSameYear(d, now)) return fmt(locale === 'de' ? 'd. MMM' : 'd MMM')
  return fmt(locale === 'de' ? 'd. MMM yyyy' : 'd MMM yyyy')
}

function confirmDelete(msg: string, cancel: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(typeof window !== 'undefined' ? window.confirm(msg) : false)
  return new Promise((resolve) =>
    Alert.alert(msg, undefined, [
      { text: cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  )
}

/* ------------------------------------------------------------------ card */

function NotificationCard({
  item,
  time,
  onPress,
  onLongPress,
}: {
  item: NotificationRow
  time: string
  onPress: () => void
  onLongPress: () => void
}) {
  const unread = !item.is_read
  const Icon = iconFor(item)
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 14,
        borderRadius: 18,
        borderWidth: 1,
        backgroundColor: unread ? C.tileMap : C.card,
        borderColor: unread ? C.lineGreen : C.line,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          backgroundColor: unread ? C.tile : C.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={22} color={unread ? C.brand : C.muted} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T variant="titleM" style={{ flex: 1 }}>{item.title}</T>
          {unread ? (
            <View
              style={{
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: C.brand,
                shadowColor: C.brand,
                shadowOpacity: 0.8,
                shadowRadius: 5,
                shadowOffset: { width: 0, height: 0 },
              }}
            />
          ) : null}
        </View>
        {item.body ? <T variant="bodyS" color={C.muted}>{item.body}</T> : null}
        {time ? <T variant="caption" color={C.dim}>{time}</T> : null}
      </View>
    </Pressable>
  )
}

/* ------------------------------------------------------------------ screen */

export default function NotificationsScreen() {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const { items, unreadCount, loading, error, refresh, markAsRead, markAllAsRead, deleteNotification } = useNotifications()
  const [refreshing, setRefreshing] = useState(false)
  const deleting = useRef<Set<string>>(new Set())

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const ok = await refresh()
      if (!ok) toast.show(t('ds.error.refresh'), 'error')
    } finally {
      setRefreshing(false)
    }
  }, [refresh, toast, t])

  const { fresh, earlier } = useMemo(
    () => ({ fresh: items.filter((n) => !n.is_read), earlier: items.filter((n) => n.is_read) }),
    [items],
  )

  function open(n: NotificationRow) {
    if (!n.is_read) markAsRead(n.id)
    const route = routeFor(n)
    if (route) router.push(route as any)
  }

  async function remove(n: NotificationRow) {
    if (deleting.current.has(n.id)) return
    deleting.current.add(n.id)
    try {
      const ok = await confirmDelete(t('notifications.v2.deleteConfirm'), t('ds.cancel'))
      if (!ok) return
      await deleteNotification(n.id)
      toast.show(t('notifications.v2.deleted'), 'success')
    } catch {
      toast.show(t('common.error'), 'error')
    } finally {
      deleting.current.delete(n.id)
    }
  }

  const card = (n: NotificationRow) => (
    <NotificationCard
      key={n.id}
      item={n}
      time={relativeTime(n.created_at, locale, t)}
      onPress={() => open(n)}
      onLongPress={() => remove(n)}
    />
  )

  const header = (
    <TopBar
      title={t('notifications.v2.title')}
      right={
        unreadCount > 0 ? (
          <Pressable onPress={markAllAsRead} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('notifications.v2.markAll')}>
            {({ pressed }) => (
              <T variant="labelM" color={C.brand} style={{ opacity: pressed ? 0.7 : 1 }}>
                {t('notifications.v2.markAll')}
              </T>
            )}
          </Pressable>
        ) : null
      }
    />
  )

  const initialLoading = loading && items.length === 0 && !refreshing

  return (
    <Screen
      glow={-40}
      header={header}
      gap={12}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
    >
      {initialLoading ? (
        [0, 1, 2].map((i) => (
          <View
            key={i}
            style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.card }}
          >
            <Skeleton width={42} height={42} radius={13} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="90%" height={11} />
              <Skeleton width="30%" height={10} />
            </View>
          </View>
        ))
      ) : items.length === 0 && error ? (
        <ErrorState onRetry={() => refresh()} />
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title={t('notifications.v2.empty.title')} body={t('notifications.v2.empty.body')} />
      ) : (
        <>
          {fresh.length ? (
            <>
              <SectionLabel style={{ color: C.brand }}>{t('notifications.v2.new')}</SectionLabel>
              {fresh.map(card)}
            </>
          ) : null}
          {earlier.length ? (
            <>
              <SectionLabel>{t('notifications.v2.earlier')}</SectionLabel>
              {earlier.map(card)}
            </>
          ) : null}
        </>
      )}
    </Screen>
  )
}
