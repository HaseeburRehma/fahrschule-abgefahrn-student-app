import React, { useCallback, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect } from 'expo-router'
import { CalendarCheck as CalendarClock } from 'phosphor-react-native/src/icons/CalendarCheck'
import { Plus } from 'phosphor-react-native/src/icons/Plus'
import { Trash as Trash2 } from 'phosphor-react-native/src/icons/Trash'

import { useTranslation } from '@/lib/i18n'
import {
  fetchSlots,
  createSlot,
  deleteSlot,
  type SlotWithCount,
} from '@/lib/availability'
import { formatDateTime, formatTime, parseLocalDateTime } from '@/lib/format'
import { Button, Card, ErrorText, Loader, TextField } from '@/components/ui'

function notify(msg: string) {
  if (Platform.OS === 'web') window.alert(msg)
  else Alert.alert(msg)
}

export default function AdminAvailability() {
  const { t, locale } = useTranslation()
  const [rows, setRows] = useState<SlotWithCount[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [capacity, setCapacity] = useState('1')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchSlots()
      .then(setRows)
      .catch(() => setRows([]))
  }, [])
  useFocusEffect(useCallback(() => load(), [load]))

  async function create() {
    setError(null)
    const starts = parseLocalDateTime(`${date.trim()} ${from.trim()}`)
    const ends = to.trim() ? parseLocalDateTime(`${date.trim()} ${to.trim()}`) : null
    if (!starts) {
      setError(t('appt.badTime'))
      return
    }
    setBusy(true)
    try {
      await createSlot({
        starts_at: starts,
        ends_at: ends,
        capacity: Math.max(1, parseInt(capacity, 10) || 1),
        note: note.trim() || null,
      })
      setDate('')
      setFrom('')
      setTo('')
      setCapacity('1')
      setNote('')
      setShowForm(false)
      notify(t('common.saved'))
      load()
    } catch (e: any) {
      setError(e?.message ?? t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setRows((prev) => (prev ?? []).filter((s) => s.id !== id))
    try {
      await deleteSlot(id)
    } catch {
      load()
    }
  }

  if (rows === null) return <Loader />

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.availability') }} />
      <ScrollView contentContainerClassName="p-5 gap-3">
        <Pressable
          onPress={() => setShowForm((s) => !s)}
          className="flex-row items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3.5"
        >
          <Plus size={18} color="#0A0A0A" />
          <Text className="font-bold text-ink">{t('admin.newSlot')}</Text>
        </Pressable>

        {showForm ? (
          <Card className="gap-3">
            <TextField label={t('appt.date')} value={date} onChangeText={setDate} placeholder="2026-08-24" autoCapitalize="none" />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField label={t('appt.from')} value={from} onChangeText={setFrom} placeholder="12:00" />
              </View>
              <View className="flex-1">
                <TextField label={t('appt.to')} value={to} onChangeText={setTo} placeholder="14:00" />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField label={t('admin.capacity')} value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
              </View>
              <View className="flex-[2]">
                <TextField label={t('appt.note')} value={note} onChangeText={setNote} />
              </View>
            </View>
            <ErrorText>{error}</ErrorText>
            <Button label={t('admin.createSlot')} onPress={create} loading={busy} />
          </Card>
        ) : null}

        {rows.length === 0 ? (
          <Text className="mt-8 text-center text-neutral-400">
            {t('admin.slotsEmpty')}
          </Text>
        ) : (
          rows.map((s) => (
            <View
              key={s.id}
              className="flex-row items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
            >
              <CalendarClock size={18} color="#00FF24" />
              <View className="flex-1">
                <Text className="font-semibold text-neutral-100">
                  {formatDateTime(s.starts_at, locale)}
                  {s.ends_at ? ` – ${formatTime(s.ends_at, locale)}` : ''}
                </Text>
                <Text className="text-xs text-neutral-400">
                  {t('admin.slotCount', { booked: s.booked, capacity: s.capacity })}
                  {s.note ? ` • ${s.note}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => remove(s.id)} hitSlop={8} className="p-1">
                <Trash2 size={18} color="#EF4444" />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
