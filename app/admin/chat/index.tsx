import React, { useCallback, useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { CaretRight as ChevronRight } from 'phosphor-react-native/src/icons/CaretRight'

import { useTranslation } from '@/lib/i18n'
import { fetchConversations, type Conversation } from '@/lib/chat'
import { displayName } from '@/lib/data'
import { formatDateTime } from '@/lib/format'
import { Loader } from '@/components/ui'

export default function AdminChatList() {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const [rows, setRows] = useState<Conversation[] | null>(null)

  useFocusEffect(
    useCallback(() => {
      let alive = true
      fetchConversations()
        .then((r) => alive && setRows(r))
        .catch(() => alive && setRows([]))
      return () => {
        alive = false
      }
    }, []),
  )

  if (rows === null) return <Loader />

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.chat') }} />
      <FlatList
        data={rows}
        keyExtractor={(c) => c.studentId}
        contentContainerClassName="p-5 gap-2"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/admin/chat/${item.studentId}` as any)}
            className="flex-row items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <Text className="font-m-black text-brand">
                {(displayName(item.student) || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="font-m-semibold text-neutral-100">
                {displayName(item.student) || item.student?.email || '—'}
              </Text>
              <Text numberOfLines={1} className="font-m-regular text-sm text-neutral-400">
                {item.lastBody}
              </Text>
              <Text className="font-m-regular text-[10px] text-neutral-500">
                {formatDateTime(item.lastAt, locale)}
              </Text>
            </View>
            {item.unread > 0 ? (
              <View className="min-w-[22px] items-center rounded-full bg-red-500 px-2 py-0.5">
                <Text className="text-xs font-m-bold text-white">{item.unread}</Text>
              </View>
            ) : null}
            <ChevronRight size={20} color="#6B7280" />
          </Pressable>
        )}
        ListEmptyComponent={
          <Text className="font-m-regular mt-16 text-center text-neutral-400">
            {t('admin.chatEmpty')}
          </Text>
        }
      />
    </SafeAreaView>
  )
}
