/**
 * Reusable 1:1 chat thread (Figma "DE/Chat" 1287:1544 — bubbles + input bar).
 * Used by the student ("message the school", app/chat.tsx) and by the admin
 * (reply to a student, app/admin/chat/[id].tsx). "Mine" bubbles sit on the right.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { differenceInCalendarDays, format, isSameYear } from 'date-fns'
import { de as deLocale, enUS } from 'date-fns/locale'
import { PaperPlaneTilt } from 'phosphor-react-native/src/icons/PaperPlaneTilt'

import { C, ErrorState, F, T, useToast } from '@/components/ds'
import { getSupabase } from '@/lib/supabase/client'
import { uniqueChannelName } from '@/lib/supabase/channel'
import { useTranslation } from '@/lib/i18n'
import { fetchThread, sendMessage, markThreadRead, type ChatMessage } from '@/lib/chat'
import { formatTime, stripAbbrDots } from '@/lib/format'
import type { Locale } from '@/lib/types'

/** Client cap (server allows 4000). */
export const CHAT_MAX_LENGTH = 2000

type Row = { kind: 'day'; key: string; label: string } | { kind: 'msg'; key: string; msg: ChatMessage }

function dayLabel(iso: string, locale: Locale, t: (k: string) => string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const diff = differenceInCalendarDays(now, d)
  if (diff === 0) return t('chat.v2.today')
  if (diff === 1) return t('chat.v2.yesterday')
  const loc = locale === 'de' ? deLocale : enUS
  const pattern = isSameYear(d, now)
    ? locale === 'de' ? 'EEE, d. MMM' : 'EEE, d MMM'
    : locale === 'de' ? 'd. MMM yyyy' : 'd MMM yyyy'
  return stripAbbrDots(format(d, pattern, { locale: loc }))
}

function Bubble({ msg, mine, locale }: { msg: ChatMessage; mine: boolean; locale: Locale }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <View
        style={{
          maxWidth: '80%',
          backgroundColor: mine ? C.brand : C.surface,
          borderTopLeftRadius: mine ? 18 : 6,
          borderTopRightRadius: mine ? 6 : 18,
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18,
          paddingTop: 10,
          paddingBottom: 8,
          paddingHorizontal: 14,
          gap: 4,
        }}
      >
        <T variant="bodyM" color={mine ? C.onBrand : C.white} selectable>
          {msg.body}
        </T>
        <T variant="caption" color={mine ? '#0A3A10' : C.dim} style={{ textAlign: mine ? 'right' : 'left' }}>
          {formatTime(msg.created_at, locale)}
        </T>
      </View>
    </View>
  )
}

export function ChatThread({
  studentId,
  senderId,
  isAdmin,
  keyboardOffset = 90,
}: {
  studentId: string
  senderId: string
  isAdmin: boolean
  /** distance from the screen top to this view (header height); iOS keyboard avoidance */
  keyboardOffset?: number
}) {
  const { t, locale } = useTranslation()
  const toast = useToast()
  const insets = useSafeAreaInsets()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const sendingRef = useRef(false)
  const listRef = useRef<FlatList<Row>>(null)
  // Latest thread request; responses for an older request / another thread are dropped.
  const reqRef = useRef(0)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(async () => {
    const req = ++reqRef.current
    try {
      const rows = await fetchThread(studentId)
      if (!mountedRef.current || req !== reqRef.current) return
      // Merge: keep realtime/optimistic rows that arrived while the fetch was in flight.
      setMessages((prev) => {
        const ids = new Set(rows.map((m) => m.id))
        const extra = prev.filter((m) => !ids.has(m.id) && m.student_id === studentId)
        return extra.length
          ? [...rows, ...extra].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
          : rows
      })
      setLoadError(false)
      markThreadRead(studentId, isAdmin).catch(() => {})
    } catch {
      // keep whatever we have; only an empty thread shows the error state
      if (mountedRef.current && req === reqRef.current) setLoadError(true)
    } finally {
      if (mountedRef.current && req === reqRef.current) setLoading(false)
    }
  }, [studentId, isAdmin])

  useEffect(() => {
    setMessages([])
    setLoading(true)
    setLoadError(false)
    load()
    let subscribedOnce = false
    const supabase = getSupabase()
    const channel = supabase
      .channel(uniqueChannelName(`chat:${studentId}`))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `student_id=eq.${studentId}`,
        },
        (payload: any) => {
          const row = payload.new as ChatMessage
          if (!row?.id || !mountedRef.current) return
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
          // If the incoming message is from the other side, mark read.
          if (row.from_admin !== isAdmin) markThreadRead(studentId, isAdmin).catch(() => {})
        },
      )
      .subscribe((status: string) => {
        // Re-joined after a dropped connection → refetch so missed messages appear.
        if (status === 'SUBSCRIBED') {
          if (subscribedOnce) load()
          subscribedOnce = true
        }
      })
    return () => {
      try {
        supabase.removeChannel(channel)
      } catch {}
    }
  }, [studentId, isAdmin, load])

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    let lastDay = ''
    for (const m of messages) {
      const day = (m.created_at || '').slice(0, 10)
      const localDay = new Date(m.created_at).toDateString()
      if (localDay !== lastDay) {
        out.push({ kind: 'day', key: `d-${day}-${out.length}`, label: dayLabel(m.created_at, locale, t) })
        lastDay = localDay
      }
      out.push({ kind: 'msg', key: m.id, msg: m })
    }
    return out
  }, [messages, locale, t])

  async function onSend() {
    const body = text.trim().slice(0, CHAT_MAX_LENGTH)
    if (!body || sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setText('')
    try {
      const msg = await sendMessage({ studentId, senderId, fromAdmin: isAdmin, body })
      if (mountedRef.current) setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
    } catch {
      if (mountedRef.current) {
        setText((cur) => (cur ? cur : body)) // restore on failure (unless the user typed again)
        toast.show(t('chat.v2.sendError'), 'error')
      }
    } finally {
      sendingRef.current = false
      if (mountedRef.current) setSending(false)
    }
  }

  const canSend = !!text.trim() && !sending

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardOffset}
    >
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.brand} />
        </View>
      ) : loadError && !messages.length ? (
        <View style={{ flex: 1 }}>
          <ErrorState
            onRetry={() => {
              setLoading(true)
              load()
            }}
          />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerStyle={{ paddingTop: 18, paddingHorizontal: 20, paddingBottom: 12, gap: 12, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) =>
            item.kind === 'day' ? (
              <View style={{ alignItems: 'center' }}>
                <View style={{ backgroundColor: C.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                  <T variant="caption" color={C.dim}>{item.label}</T>
                </View>
              </View>
            ) : (
              <Bubble msg={item.msg} mine={item.msg.from_admin === isAdmin} locale={locale} />
            )
          }
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
              <T variant="bodyM" color={C.dim} style={{ textAlign: 'center' }}>{t('chat.v2.empty')}</T>
            </View>
          }
        />
      )}

      {/* Input bar */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) + 4 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 10,
            minHeight: 52,
            borderRadius: 26,
            backgroundColor: C.surface,
            borderWidth: 1,
            borderColor: C.line,
            paddingLeft: 16,
            paddingRight: 5,
            paddingVertical: 5,
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('chat.v2.placeholder')}
            placeholderTextColor={C.dim}
            selectionColor={C.brand}
            cursorColor={C.brand}
            multiline
            maxLength={CHAT_MAX_LENGTH}
            accessibilityLabel={t('chat.v2.placeholder')}
            // web renders a <textarea>; start at one row like the Figma pill (grows up to maxHeight)
            numberOfLines={1}
            style={
              {
                flex: 1,
                maxHeight: 120,
                minHeight: 40,
                paddingTop: 9,
                paddingBottom: 9,
                color: C.white,
                fontFamily: F.regular,
                fontSize: 15,
                lineHeight: 22,
                outlineWidth: 0,
              } as any
            }
          />
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t('chat.v2.send')}
            accessibilityState={{ disabled: !canSend, busy: sending }}
            hitSlop={4}
            style={({ pressed }) => [
              {
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: C.brand,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: C.brand,
                shadowOpacity: 0.5,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
                elevation: 6,
                // Figma shows the send button at full strength even with an empty field
                opacity: pressed && canSend ? 0.85 : 1,
              },
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color={C.onBrand} />
            ) : (
              <PaperPlaneTilt size={20} color={C.onBrand} weight="fill" />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
