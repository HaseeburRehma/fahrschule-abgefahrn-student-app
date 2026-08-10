import React, { useCallback, useState } from 'react'
import { FlatList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect } from 'expo-router'
import { Users } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { fetchNotificationHistory, type SentNotification } from '@/lib/admin'
import { formatDateTime } from '@/lib/format'
import { Card, Loader } from '@/components/ui'

export default function NotificationHistory() {
  const { t, locale } = useTranslation()
  const [rows, setRows] = useState<SentNotification[] | null>(null)

  useFocusEffect(
    useCallback(() => {
      let alive = true
      fetchNotificationHistory()
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
      <Stack.Screen options={{ title: t('admin.history') }} />
      <FlatList
        data={rows}
        keyExtractor={(r, i) => `${r.created_at}-${i}`}
        contentContainerClassName="p-5 gap-2"
        renderItem={({ item }) => (
          <Card className="gap-1">
            <Text className="text-base font-bold text-neutral-100">
              {item.title}
            </Text>
            {item.body ? (
              <Text className="text-sm text-neutral-300">{item.body}</Text>
            ) : null}
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="text-xs text-neutral-400">
                {formatDateTime(item.created_at, locale)}
              </Text>
              <View className="flex-row items-center gap-1 rounded-full bg-neutral-800 px-2 py-0.5">
                <Users size={12} color="#9CA3AF" />
                <Text className="text-[11px] font-semibold text-neutral-300">
                  {t('admin.recipients', { count: item.count })}
                </Text>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <Text className="mt-16 text-center text-neutral-400">
            {t('admin.historyEmpty')}
          </Text>
        }
      />
    </SafeAreaView>
  )
}
