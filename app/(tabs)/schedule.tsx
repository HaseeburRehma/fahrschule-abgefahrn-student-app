import React, { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { CalendarDays, MapPin } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { fetchMyClasses, splitByTime } from '@/lib/data'
import { formatDateTime } from '@/lib/format'
import type { TheoryClass } from '@/lib/types'

function ClassRow({ item, dim }: { item: TheoryClass; dim?: boolean }) {
  const { t, locale } = useTranslation()
  return (
    <View
      className={`rounded-2xl border border-neutral-200 bg-white p-4 ${dim ? 'opacity-60' : ''}`}
    >
      <Text className="text-base font-bold text-neutral-900">
        {locale === 'de' ? item.title_de : item.title_en}
      </Text>
      <View className="mt-1 flex-row items-center gap-1.5">
        <CalendarDays size={14} color="#6B7280" />
        <Text className="text-sm text-neutral-600">
          {formatDateTime(item.starts_at, locale)}
        </Text>
      </View>
      {item.location ? (
        <View className="mt-0.5 flex-row items-center gap-1.5">
          <MapPin size={14} color="#6B7280" />
          <Text className="text-sm text-neutral-500">{item.location}</Text>
        </View>
      ) : null}
      {item.notes ? (
        <Text className="mt-1 text-sm text-neutral-500">{item.notes}</Text>
      ) : null}
    </View>
  )
}

export default function Schedule() {
  const { t } = useTranslation()
  const { profile } = useUser()
  const [upcoming, setUpcoming] = useState<TheoryClass[]>([])
  const [past, setPast] = useState<TheoryClass[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!profile) return
    try {
      const classes = await fetchMyClasses(profile.id)
      const { upcoming, past } = splitByTime(classes)
      setUpcoming(upcoming)
      setPast(past)
    } catch {}
  }, [profile])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const empty = upcoming.length === 0 && past.length === 0

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      <View className="px-5 pb-2 pt-3">
        <Text className="text-2xl font-extrabold text-neutral-900">
          {t('schedule.title')}
        </Text>
      </View>
      <ScrollView
        contentContainerClassName="px-5 pb-6 pt-1 gap-2"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />
        }
      >
        {empty ? (
          <View className="mt-24 items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-neutral-200">
              <CalendarDays size={24} color="#9CA3AF" />
            </View>
            <Text className="text-neutral-500">{t('schedule.empty')}</Text>
          </View>
        ) : null}

        {upcoming.length ? (
          <Text className="mb-1 mt-1 text-xs font-bold uppercase tracking-wide text-neutral-400">
            {t('schedule.upcoming')}
          </Text>
        ) : null}
        {upcoming.map((c) => (
          <ClassRow key={c.id} item={c} />
        ))}

        {past.length ? (
          <Text className="mb-1 mt-4 text-xs font-bold uppercase tracking-wide text-neutral-400">
            {t('schedule.past')}
          </Text>
        ) : null}
        {past.map((c) => (
          <ClassRow key={c.id} item={c} dim />
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}
