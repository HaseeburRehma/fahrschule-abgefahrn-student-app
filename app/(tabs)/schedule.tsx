import React, { useCallback, useState } from 'react'
import { Alert, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { CalendarDays, CalendarClock, CalendarPlus, MapPin, Check, X, Plus } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { fetchMyClasses, splitByTime } from '@/lib/data'
import { fetchMyRsvp, setRsvp } from '@/lib/rsvp'
import {
  fetchMyAppointments,
  createAppointment,
  cancelAppointment,
  type Appointment,
} from '@/lib/appointments'
import { fetchAvailableSlots, bookSlot, type SlotWithCount } from '@/lib/availability'
import { addToCalendar } from '@/lib/calendar'
import { formatDateTime, formatTime, parseLocalDateTime } from '@/lib/format'
import { scheduleReminders, REMINDER_LEAD_HOURS } from '@/lib/reminders'
import { Button, Card, ErrorText, TextField } from '@/components/ui'
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
            <Text className={`text-xs font-bold ${rsvp === true ? 'text-ink' : 'text-neutral-300'}`}>
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
            <Text className={`text-xs font-bold ${rsvp === false ? 'text-white' : 'text-neutral-300'}`}>
              {t('common.no')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        onPress={() => addToCalendar(item, title)}
        className="mt-3 flex-row items-center gap-1.5 self-start"
      >
        <CalendarPlus size={14} color="#00FF24" />
        <Text className="text-xs font-semibold text-brand">{t('schedule.addCalendar')}</Text>
      </Pressable>
    </View>
  )
}

function AppointmentRow({
  item,
  onCancel,
}: {
  item: Appointment
  onCancel: () => void
}) {
  const { t, locale } = useTranslation()
  const cancelled = item.status === 'cancelled'
  const statusColor =
    item.status === 'confirmed'
      ? 'text-brand'
      : item.status === 'cancelled'
        ? 'text-red-500'
        : 'text-neutral-400'
  return (
    <View
      className={`rounded-2xl border border-neutral-800 bg-neutral-900 p-4 ${cancelled ? 'opacity-60' : ''}`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-bold text-neutral-100">{item.title}</Text>
        <Text className={`text-xs font-bold ${statusColor}`}>
          {t(`appt.status.${item.status}` as any)}
        </Text>
      </View>
      <View className="mt-1 flex-row items-center gap-1.5">
        <CalendarDays size={14} color="#6B7280" />
        <Text className="text-sm text-neutral-400">
          {formatDateTime(item.starts_at, locale)}
          {item.ends_at ? ` – ${formatTime(item.ends_at, locale)}` : ''}
        </Text>
      </View>
      {item.note ? (
        <Text className="mt-1 text-sm text-neutral-400">{item.note}</Text>
      ) : null}
      <View className="mt-3 flex-row items-center gap-4">
        <Pressable
          onPress={() => addToCalendar(item, item.title)}
          className="flex-row items-center gap-1.5"
        >
          <CalendarPlus size={14} color="#00FF24" />
          <Text className="text-xs font-semibold text-brand">
            {t('schedule.addCalendar')}
          </Text>
        </Pressable>
        {!cancelled ? (
          <Pressable onPress={onCancel} className="flex-row items-center gap-1.5">
            <X size={14} color="#EF4444" />
            <Text className="text-xs font-semibold text-red-500">
              {t('appt.cancel')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

export default function Schedule() {
  const { t, locale } = useTranslation()
  const { profile, session } = useUser()
  const uid: string | null = session?.user?.id ?? null
  const [upcoming, setUpcoming] = useState<TheoryClass[]>([])
  const [past, setPast] = useState<TheoryClass[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [slots, setSlots] = useState<SlotWithCount[]>([])
  const [rsvp, setRsvpMap] = useState<Map<string, boolean>>(new Map())
  const [refreshing, setRefreshing] = useState(false)

  // booking form
  const [showForm, setShowForm] = useState(false)
  const [apTitle, setApTitle] = useState('')
  const [apDate, setApDate] = useState('')
  const [apFrom, setApFrom] = useState('')
  const [apTo, setApTo] = useState('')
  const [apNote, setApNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!profile) return
    try {
      const [classes, myRsvp, appts, avail] = await Promise.all([
        fetchMyClasses(profile.id),
        uid ? fetchMyRsvp(uid) : Promise.resolve(new Map<string, boolean>()),
        uid ? fetchMyAppointments(uid) : Promise.resolve([] as Appointment[]),
        fetchAvailableSlots().catch(() => [] as SlotWithCount[]),
      ])
      const { upcoming, past } = splitByTime(classes)
      setUpcoming(upcoming)
      setPast(past)
      setRsvpMap(myRsvp)
      setAppointments(appts)
      setSlots(avail)

      const classReminders = upcoming.map((c) => ({
        id: c.id,
        fireAt: new Date(new Date(c.starts_at).getTime() - REMINDER_LEAD_HOURS * 3600_000),
        title: t('reminder.title'),
        body: t('reminder.body', {
          title: locale === 'de' ? c.title_de : c.title_en,
          time: formatTime(c.starts_at, locale),
        }),
      }))
      const apptReminders = appts
        .filter((a) => a.status !== 'cancelled')
        .map((a) => ({
          id: a.id,
          fireAt: new Date(new Date(a.starts_at).getTime() - REMINDER_LEAD_HOURS * 3600_000),
          title: t('reminder.title'),
          body: t('reminder.body', { title: a.title, time: formatTime(a.starts_at, locale) }),
        }))
      scheduleReminders([...classReminders, ...apptReminders])
    } catch {}
  }, [profile, uid, t, locale])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  async function handleRsvp(classId: string, attending: boolean) {
    if (!uid) return
    setRsvpMap((prev) => new Map(prev).set(classId, attending))
    try {
      await setRsvp(uid, classId, attending)
    } catch {
      load()
    }
  }

  async function book() {
    if (!uid) return
    setError(null)
    const starts = parseLocalDateTime(`${apDate.trim()} ${apFrom.trim()}`)
    const ends = apTo.trim() ? parseLocalDateTime(`${apDate.trim()} ${apTo.trim()}`) : null
    if (!starts) {
      setError(t('appt.badTime'))
      return
    }
    setBusy(true)
    try {
      await createAppointment({
        studentId: uid,
        title: apTitle.trim() || t('appt.defaultTitle'),
        starts_at: starts,
        ends_at: ends,
        note: apNote.trim() || null,
      })
      setApTitle('')
      setApDate('')
      setApFrom('')
      setApTo('')
      setApNote('')
      setShowForm(false)
      await load()
    } catch (e: any) {
      setError(e?.message ?? t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel(id: string) {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a)),
    )
    try {
      await cancelAppointment(id)
    } catch {
      load()
    }
  }

  async function onBookSlot(slot: SlotWithCount) {
    if (!uid) return
    try {
      await bookSlot(uid, slot, t('appt.defaultTitle'))
      const msg = t('appt.slotBooked')
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert(msg)
      await load()
    } catch {
      const msg = t('appt.slotFull')
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert(msg)
      load()
    }
  }

  const empty =
    upcoming.length === 0 && past.length === 0 && appointments.length === 0

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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00FF24" />
        }
      >
        {/* Available slots to grab (auto-confirmed) */}
        {slots.length ? (
          <>
            <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-neutral-400">
              {t('appt.available')}
            </Text>
            {slots.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => onBookSlot(s)}
                className="flex-row items-center gap-3 rounded-2xl border border-brand/40 bg-brand/10 p-4"
              >
                <CalendarClock size={18} color="#00FF24" />
                <View className="flex-1">
                  <Text className="font-semibold text-neutral-100">
                    {formatDateTime(s.starts_at, locale)}
                    {s.ends_at ? ` – ${formatTime(s.ends_at, locale)}` : ''}
                  </Text>
                  {s.note ? (
                    <Text className="text-xs text-neutral-400">{s.note}</Text>
                  ) : null}
                </View>
                <Text className="text-xs font-bold text-brand">
                  {t('appt.book')}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}

        {/* Free-form request */}
        <Pressable
          onPress={() => setShowForm((s) => !s)}
          className="mt-1 flex-row items-center justify-center gap-2 rounded-2xl border border-neutral-700 px-4 py-3"
        >
          <Plus size={18} color="#00FF24" />
          <Text className="font-bold text-neutral-100">{t('appt.freeForm')}</Text>
        </Pressable>

        {showForm ? (
          <Card className="gap-3">
            <TextField
              label={t('appt.title')}
              value={apTitle}
              onChangeText={setApTitle}
              placeholder={t('appt.defaultTitle')}
            />
            <TextField
              label={t('appt.date')}
              value={apDate}
              onChangeText={setApDate}
              placeholder="2026-08-24"
              autoCapitalize="none"
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField label={t('appt.from')} value={apFrom} onChangeText={setApFrom} placeholder="12:00" />
              </View>
              <View className="flex-1">
                <TextField label={t('appt.to')} value={apTo} onChangeText={setApTo} placeholder="14:00" />
              </View>
            </View>
            <TextField label={t('appt.note')} value={apNote} onChangeText={setApNote} />
            <ErrorText>{error}</ErrorText>
            <Button label={t('appt.book')} onPress={book} loading={busy} />
          </Card>
        ) : null}

        {empty ? (
          <View className="mt-16 items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-neutral-800">
              <CalendarDays size={24} color="#9CA3AF" />
            </View>
            <Text className="text-neutral-400">{t('schedule.empty')}</Text>
          </View>
        ) : null}

        {/* My appointments */}
        {appointments.length ? (
          <Text className="mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-neutral-400">
            {t('appt.mine')}
          </Text>
        ) : null}
        {appointments.map((a) => (
          <AppointmentRow key={a.id} item={a} onCancel={() => handleCancel(a.id)} />
        ))}

        {/* Theory classes */}
        {upcoming.length ? (
          <Text className="mb-1 mt-4 text-xs font-bold uppercase tracking-wide text-neutral-400">
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
