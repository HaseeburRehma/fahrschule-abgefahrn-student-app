import React, { useCallback, useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Bell, CheckCheck } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { useNotifications } from '@/lib/notifications-context'
import { formatDateTime } from '@/lib/format'
import type { NotificationRow } from '@/lib/types'

export default function NotificationsScreen() {
  const { t, locale } = useTranslation()
  const { items, unreadCount, refresh, markAsRead, markAllAsRead } =
    useNotifications()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  const renderItem = useCallback(
    ({ item }: { item: NotificationRow }) => (
      <Pressable
        onPress={() => !item.is_read && markAsRead(item.id)}
        className={`mb-2 rounded-2xl border p-4 ${
          item.is_read
            ? 'border-neutral-800 bg-neutral-900'
            : 'border-brand/40 bg-brand/10'
        }`}
      >
        <View className="flex-row items-start gap-2">
          {!item.is_read ? (
            <View className="mt-1.5 h-2 w-2 rounded-full bg-brand" />
          ) : (
            <View className="mt-1.5 h-2 w-2 rounded-full bg-transparent" />
          )}
          <View className="flex-1">
            <Text className="text-base font-bold text-neutral-100">
              {item.title}
            </Text>
            {item.body ? (
              <Text className="mt-0.5 text-sm text-neutral-300">{item.body}</Text>
            ) : null}
            <Text className="mt-1 text-xs text-neutral-400">
              {formatDateTime(item.created_at, locale)}
            </Text>
          </View>
        </View>
      </Pressable>
    ),
    [markAsRead, locale],
  )

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
        <Text className="text-2xl font-extrabold text-neutral-100">
          {t('notif.title')}
        </Text>
        {unreadCount > 0 ? (
          <Pressable
            onPress={markAllAsRead}
            className="flex-row items-center gap-1 rounded-full bg-neutral-900 px-3 py-1.5"
          >
            <CheckCheck size={16} color="#22C55E" />
            <Text className="text-xs font-semibold text-brand">
              {t('notif.markAllRead')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        contentContainerClassName="px-5 pb-6 pt-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />
        }
        ListEmptyComponent={
          <View className="mt-24 items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-neutral-800">
              <Bell size={24} color="#9CA3AF" />
            </View>
            <Text className="text-neutral-400">{t('notif.empty')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}
