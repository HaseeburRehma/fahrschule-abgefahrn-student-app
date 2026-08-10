import React, { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { CalendarDays, CalendarPlus, MapPin, Check, X } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { fetchMyClasses, splitByTime } from '@/lib/data'
import { fetchMyRsvp, setRsvp } from '@/lib/rsvp'
import { addToCalendar } from '@/lib/calendar'
import { formatDateTime, formatTime } from '@/lib/format'
import { scheduleReminders, REMINDER_LEAD_HOURS } from '@/lib/reminders'
import type { TheoryClass } from '@/lib/types'

function ClassRow({
  item,
  dim,
  showRsvp,
  rsvp,
  onRsvp,
}: {
  item: TheoryClass
  dim?: boolean
  showRsvp?: boolean
  rsvp?: boolean
  onRsvp?: (attending: boolean) => void
}) {
  const { t, locale } = useTranslation()
  const title = locale === 'de' ? item.title_de : item.title_en
  return (
    <View
      className={`rounded-2xl border border-neutral-800 bg-neutral-900 p-4 ${dim ? 'opacity-60' : ''}`}
    >
      <Text className="text-base font-bold text-neutral-100">{title}</Text>
      <View className="mt-1 flex-row items-center gap-1.5">
        <CalendarDays size={14} color="#6B7280" />
        <Text className="text-sm text-neutral-400">
          {formatDateTime(item.starts_at, locale)}
        </Text>
      </View>
      {item.location ? (
        <View className="mt-0.5 flex-row items-center gap-1.5">
          <MapPin size={14} color="#6B7280" />
          <Text className="text-sm text-neutral-400">{item.location}</Text>
        </View>
      ) : null}
      {item.notes ? (
        <Text className="mt-1 text-sm text-neutral-400">{item.notes}</Text>
      ) : null}

      {showRsvp ? (
        <View className="mt-3 flex-row items-center gap-2">
          <Text className="text-sm font-semibold text-neutral-300">
            {t('schedule.rsvp')}
          </Text>
          <Pressable
            onPress={() => onRsvp?.(true)}
            className={`flex-row items-center gap-1 rounded-full border px-3 py-1 ${
              rsvp === true ? 'border-brand bg-brand' : 'border-neutral-700'
            }`}
          >
            {rsvp === true ? <Check size={12} color="#0A0A0A" /> : null}
            <Text
              className={`text-xs font-bold ${rsvp === true ? 'text-ink' : 'text-neutral-300'}`}
            >
              {t('common.yes')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onRsvp?.(false)}
            className={`flex-row items-center gap-1 rounded-full border px-3 py-1 ${
              rsvp === false ? 'border-red-500 bg-red-500' : 'border-neutral-700'
            }`}
          >
            {rsvp === false ? <X size={12} color="#FFFFFF" /> : null}
            <Text
              className={`text-xs font-bold ${rsvp === false ? 'text-white' : 'text-neutral-300'}`}
            >
              {t('common.no')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        onPress={() => addToCalendar(item, title)}
        className="mt-3 flex-row items-center gap-1.5 self-start"
      >
        <CalendarPlus size={14} color="#22C55E" />
        <Text className="text-xs font-semibold text-brand">
          {t('schedule.addCalendar')}
        </Text>
      </Pressable>
    </View>
  )
}

export default function Schedule() {
  const { t, locale } = useTranslation()
  const { profile, session } = useUser()
  const uid: string | null = session?.user?.id ?? null
  const [upcoming, setUpcoming] = useState<TheoryClass[]>([])
  const [past, setPast] = useState<TheoryClass[]>([])
  const [rsvp, setRsvpMap] = useState<Map<string, boolean>>(new Map())
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!profile) return
    try {
      const [classes, myRsvp] = await Promise.all([
        fetchMyClasses(profile.id),
        uid ? fetchMyRsvp(uid) : Promise.resolve(new Map<string, boolean>()),
      ])
      const { upcoming, past } = splitByTime(classes)
      setUpcoming(upcoming)
      setPast(past)
      setRsvpMap(myRsvp)
      scheduleReminders(
        upcoming.map((c) => ({
          id: c.id,
          fireAt: new Date(
            new Date(c.starts_at).getTime() - REMINDER_LEAD_HOURS * 3600_000,
          ),
          title: t('reminder.title'),
          body: t('reminder.body', {
            title: locale === 'de' ? c.title_de : c.title_en,
            time: formatTime(c.starts_at, locale),
          }),
        })),
      )
    } catch {}
  }, [profile, uid, t, locale])

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

  async function handleRsvp(classId: string, attending: boolean) {
    if (!uid) return
    setRsvpMap((prev) => new Map(prev).set(classId, attending)) // optimistic
    try {
      await setRsvp(uid, classId, attending)
    } catch {
      load()
    }
  }

  const empty = upcoming.length === 0 && past.length === 0

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <View className="px-5 pb-2 pt-3">
        <Text className="text-2xl font-extrabold text-neutral-100">
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
            <View className="h-14 w-14 items-center justify-center rounded-full bg-neutral-800">
              <CalendarDays size={24} color="#9CA3AF" />
            </View>
            <Text className="text-neutral-400">{t('schedule.empty')}</Text>
          </View>
        ) : null}

        {upcoming.length ? (
          <Text className="mb-1 mt-1 text-xs font-bold uppercase tracking-wide text-neutral-400">
            {t('schedule.upcoming')}
          </Text>
        ) : null}
        {upcoming.map((c) => (
          <ClassRow
            key={c.id}
            item={c}
            showRsvp
            rsvp={rsvp.get(c.id)}
            onRsvp={(a) => handleRsvp(c.id, a)}
          />
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
