import React, { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, Text, View, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Bell, BookOpen, CalendarDays, FileText, MessageCircle, Package as PackageIcon } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { useNotifications } from '@/lib/notifications-context'
import {
  fetchMyPackages,
  fetchTopicById,
  fetchMyClasses,
  fetchMyDoneTopics,
  fetchTheoryTopics,
  splitByTime,
  displayName,
} from '@/lib/data'
import { formatDateTime, formatPrice } from '@/lib/format'
import { Card, Logo } from '@/components/ui'
import type { Package, TheoryClass, TheoryTopic } from '@/lib/types'

export default function Home() {
  const { t, locale } = useTranslation()
  const { profile } = useUser()
  const { unreadCount } = useNotifications()
  const router = useRouter()

  const [packages, setPackages] = useState<Package[]>([])
  const [topic, setTopic] = useState<TheoryTopic | null>(null)
  const [nextClass, setNextClass] = useState<TheoryClass | null>(null)
  const [doneCount, setDoneCount] = useState(0)
  const [totalTopics, setTotalTopics] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!profile) return
    try {
      const [pkgs, tpc, classes, done, allTopics] = await Promise.all([
        fetchMyPackages(profile.id),
        fetchTopicById(profile.current_theory_topic_id),
        fetchMyClasses(profile.id),
        fetchMyDoneTopics(profile.id),
        fetchTheoryTopics(),
      ])
      setPackages(pkgs)
      setTopic(tpc)
      setNextClass(splitByTime(classes).upcoming[0] ?? null)
      setDoneCount(done.size)
      setTotalTopics(allTopics.length)
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

  const name = displayName(profile)

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <ScrollView
        contentContainerClassName="p-5 gap-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />
        }
      >
        <View className="mb-1 flex-row items-center justify-between">
          <View className="rounded-xl bg-ink px-3 py-2">
            <Logo width={150} />
          </View>
        </View>
        <Text className="text-2xl font-extrabold text-neutral-100">
          {name ? t('home.greeting', { name }) : t('home.greetingNoName')}
        </Text>

        {/* Unread notifications */}
        <Pressable onPress={() => router.push('/(tabs)/notifications')}>
          <Card className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <Bell size={20} color="#22C55E" />
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-neutral-100">
                {t('notif.title')}
              </Text>
              <Text className="text-sm text-neutral-400">
                {unreadCount > 0
                  ? t('home.unread', { count: unreadCount })
                  : t('notif.empty')}
              </Text>
            </View>
            {unreadCount > 0 ? (
              <View className="min-w-[24px] items-center rounded-full bg-red-500 px-2 py-0.5">
                <Text className="text-xs font-bold text-white">{unreadCount}</Text>
              </View>
            ) : null}
          </Card>
        </Pressable>

        {/* Theory progress */}
        {totalTopics > 0 ? (
          <Card className="gap-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <BookOpen size={18} color="#22C55E" />
                <Text className="text-sm font-semibold text-neutral-400">
                  {t('home.progress')}
                </Text>
              </View>
              <Text className="text-sm font-bold text-neutral-100">
                {doneCount}/{totalTopics}
              </Text>
            </View>
            <View className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-800">
              <View
                className="h-full rounded-full bg-brand"
                style={{
                  width: `${Math.round((doneCount / totalTopics) * 100)}%`,
                }}
              />
            </View>
          </Card>
        ) : null}

        {/* Current theory class */}
        <Card className="gap-2">
          <View className="flex-row items-center gap-2">
            <BookOpen size={18} color="#22C55E" />
            <Text className="text-sm font-semibold text-neutral-400">
              {t('home.currentTopic')}
            </Text>
          </View>
          {topic ? (
            <View>
              <Text className="text-xs font-bold text-brand">
                {t('theory.topicN', { n: topic.number })}
              </Text>
              <Text className="text-lg font-bold text-neutral-100">
                {locale === 'de' ? topic.title_de : topic.title_en}
              </Text>
            </View>
          ) : (
            <Text className="text-neutral-400">{t('home.noTopic')}</Text>
          )}
        </Card>

        {/* Next appointment */}
        <Card className="gap-2">
          <View className="flex-row items-center gap-2">
            <CalendarDays size={18} color="#22C55E" />
            <Text className="text-sm font-semibold text-neutral-400">
              {t('home.nextAppointment')}
            </Text>
          </View>
          {nextClass ? (
            <View>
              <Text className="text-lg font-bold text-neutral-100">
                {locale === 'de' ? nextClass.title_de : nextClass.title_en}
              </Text>
              <Text className="text-sm text-neutral-400">
                {formatDateTime(nextClass.starts_at, locale)}
              </Text>
              {nextClass.location ? (
                <Text className="text-sm text-neutral-400">
                  {t('schedule.location')}: {nextClass.location}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text className="text-neutral-400">{t('home.noAppointment')}</Text>
          )}
        </Card>

        {/* Packages */}
        <Card className="gap-3">
          <View className="flex-row items-center gap-2">
            <PackageIcon size={18} color="#22C55E" />
            <Text className="text-sm font-semibold text-neutral-400">
              {packages.length > 1 ? t('home.yourPackages') : t('home.yourPackage')}
            </Text>
          </View>
          {packages.length ? (
            packages.map((p) => (
              <View
                key={p.id}
                className="flex-row items-center justify-between rounded-xl bg-neutral-800 px-3 py-2"
              >
                <Text className="font-semibold text-neutral-100">
                  {locale === 'de' ? p.name_de : p.name_en}
                </Text>
                <Text className="text-sm font-bold text-brand">
                  {formatPrice(Number(p.price_eur), locale)}
                </Text>
              </View>
            ))
          ) : (
            <Text className="text-neutral-400">{t('home.noPackage')}</Text>
          )}
        </Card>

        {/* Documents */}
        <Pressable onPress={() => router.push('/documents' as any)}>
          <Card className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <FileText size={20} color="#22C55E" />
            </View>
            <Text className="flex-1 font-semibold text-neutral-100">
              {t('home.documents')}
            </Text>
          </Card>
        </Pressable>

        {/* Messages */}
        <Pressable onPress={() => router.push('/chat' as any)}>
          <Card className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <MessageCircle size={20} color="#22C55E" />
            </View>
            <Text className="flex-1 font-semibold text-neutral-100">
              {t('home.messages')}
            </Text>
          </Card>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
