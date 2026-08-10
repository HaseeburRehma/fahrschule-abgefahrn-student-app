/**
 * Reusable 1:1 chat thread. Used by the student ("message the school") and by
 * the admin (reply to a student). "Mine" bubbles sit on the right.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Send } from 'lucide-react-native'

import { getSupabase } from '@/lib/supabase/client'
import { uniqueChannelName } from '@/lib/supabase/channel'
import { useTranslation } from '@/lib/i18n'
import {
  fetchThread,
  sendMessage,
  markThreadRead,
  type ChatMessage,
} from '@/lib/chat'
import { formatTime } from '@/lib/format'

export function ChatThread({
  studentId,
  senderId,
  isAdmin,
}: {
  studentId: string
  senderId: string
  isAdmin: boolean
}) {
  const { t, locale } = useTranslation()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList<ChatMessage>>(null)

  const load = useCallback(async () => {
    try {
      const rows = await fetchThread(studentId)
      setMessages(rows)
      markThreadRead(studentId, isAdmin).catch(() => {})
    } catch {}
  }, [studentId, isAdmin])

  useEffect(() => {
    load()
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
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row],
          )
          // If the incoming message is from the other side, mark read.
          if (row.from_admin !== isAdmin) markThreadRead(studentId, isAdmin).catch(() => {})
        },
      )
      .subscribe()
    return () => {
      try {
        supabase.removeChannel(channel)
      } catch {}
    }
  }, [studentId, isAdmin, load])

  async function onSend() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setText('')
    try {
      const msg = await sendMessage({ studentId, senderId, fromAdmin: isAdmin, body })
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
      )
    } catch {
      setText(body) // restore on failure
    } finally {
      setSending(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-black"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerClassName="p-4 gap-2"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.from_admin === isAdmin
          return (
            <View className={`max-w-[80%] ${mine ? 'self-end' : 'self-start'}`}>
              <View
                className={`rounded-2xl px-3.5 py-2.5 ${
                  mine ? 'bg-brand' : 'bg-neutral-800'
                }`}
              >
                <Text className={mine ? 'text-ink' : 'text-neutral-100'}>
                  {item.body}
                </Text>
              </View>
              <Text
                className={`mt-0.5 text-[10px] text-neutral-500 ${mine ? 'text-right' : ''}`}
              >
                {formatTime(item.created_at, locale)}
              </Text>
            </View>
          )
        }}
        ListEmptyComponent={
          <Text className="mt-24 text-center text-neutral-500">
            {t('chat.empty')}
          </Text>
        }
      />
      <View className="flex-row items-end gap-2 border-t border-neutral-800 bg-black p-3">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('chat.placeholder')}
          placeholderTextColor="#6B7280"
          multiline
          className="max-h-28 flex-1 rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-base text-neutral-100"
        />
        <Pressable
          onPress={onSend}
          disabled={!text.trim() || sending}
          className={`h-11 w-11 items-center justify-center rounded-full bg-brand ${
            !text.trim() || sending ? 'opacity-50' : ''
          }`}
        >
          <Send size={18} color="#0A0A0A" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}
