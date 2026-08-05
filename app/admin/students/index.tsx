import React, { useCallback, useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { UserPlus, ChevronRight, CircleDot } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { fetchStudents } from '@/lib/admin'
import { displayName } from '@/lib/data'
import { Loader } from '@/components/ui'
import type { Profile } from '@/lib/types'

export default function StudentsList() {
  const { t } = useTranslation()
  const router = useRouter()
  const [students, setStudents] = useState<Profile[] | null>(null)

  useFocusEffect(
    useCallback(() => {
      let alive = true
      fetchStudents()
        .then((s) => alive && setStudents(s))
        .catch(() => alive && setStudents([]))
      return () => {
        alive = false
      }
    }, []),
  )

  if (students === null) return <Loader />

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.students') }} />
      <FlatList
        data={students}
        keyExtractor={(s) => s.id}
        contentContainerClassName="p-5 gap-2"
        ListHeaderComponent={
          <Pressable
            onPress={() => router.push('/admin/students/new')}
            className="mb-2 flex-row items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-4"
          >
            <UserPlus size={18} color="#0A0A0A" />
            <Text className="font-bold text-ink">{t('admin.addStudent')}</Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/admin/students/${item.id}`)}
            className="flex-row items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <Text className="font-black text-brand">
                {(displayName(item) || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-neutral-100">
                {displayName(item) || item.email}
              </Text>
              {item.email ? (
                <Text className="text-sm text-neutral-400">{item.email}</Text>
              ) : null}
            </View>
            {!item.is_active ? (
              <CircleDot size={16} color="#EF4444" />
            ) : null}
            <ChevronRight size={20} color="#9CA3AF" />
          </Pressable>
        )}
        ListEmptyComponent={
          <Text className="mt-16 text-center text-neutral-400">
            {t('admin.noStudents')}
          </Text>
        }
      />
    </SafeAreaView>
  )
}
