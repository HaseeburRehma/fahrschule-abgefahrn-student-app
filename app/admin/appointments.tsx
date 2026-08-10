import React, { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect } from 'expo-router'
import { Check, X, CalendarDays } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import {
  fetchAllAppointments,
  setAppointmentStatus,
  type AppointmentWithStudent,
} from '@/lib/appointments'
import { displayName } from '@/lib/data'
import { formatDateTime, formatTime } from '@/lib/format'
import { Card, Loader } from '@/components/ui'

export default function AdminAppointments() {
  const { t, locale } = useTranslation()
  const [rows, setRows] = useState<AppointmentWithStudent[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchAllAppointments()
      .then(setRows)
      .catch(() => setRows([]))
  }, [])
  useFocusEffect(useCallback(() => load(), [load]))

  async function set(id: string, status: 'confirmed' | 'cancelled') {
    setBusyId(id)
    setRows((prev) => (prev ?? []).map((r) => (r.id === id ? { ...r, status } : r)))
    try {
      await setAppointmentStatus(id, status)
    } catch {
      load()
    } finally {
      setBusyId(null)
    }
  }

  if (rows === null) return <Loader />

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.appointments') }} />
      <ScrollView contentContainerClassName="p-5 gap-2">
        {rows.length === 0 ? (
          <Text className="mt-16 text-center text-neutral-400">
            {t('admin.apptEmpty')}
          </Text>
        ) : (
          rows.map((r) => {
            const cancelled = r.status === 'cancelled'
            const statusColor =
              r.status === 'confirmed'
                ? 'text-brand'
                : r.status === 'cancelled'
                  ? 'text-red-500'
                  : 'text-neutral-400'
            const busy = busyId === r.id
            return (
              <Card key={r.id} className={`gap-2 ${cancelled ? 'opacity-60' : ''}`}>
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-bold text-neutral-100">
                    {r.title}
                  </Text>
                  <Text className={`text-xs font-bold ${statusColor}`}>
                    {t(`appt.status.${r.status}` as any)}
                  </Text>
                </View>
                <Text className="text-sm text-neutral-300">
                  {displayName(r.student) || r.student?.email || '—'}
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <CalendarDays size={14} color="#6B7280" />
                  <Text className="text-sm text-neutral-400">
                    {formatDateTime(r.starts_at, locale)}
                    {r.ends_at ? ` – ${formatTime(r.ends_at, locale)}` : ''}
                  </Text>
                </View>
                {r.note ? (
                  <Text className="text-sm text-neutral-400">{r.note}</Text>
                ) : null}
                {!cancelled ? (
                  <View className="mt-1 flex-row gap-2">
                    {r.status !== 'confirmed' ? (
                      <Pressable
                        onPress={() => set(r.id, 'confirmed')}
                        disabled={busy}
                        className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 ${busy ? 'opacity-50' : ''}`}
                      >
                        <Check size={15} color="#0A0A0A" />
                        <Text className="font-bold text-ink">{t('admin.confirm')}</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => set(r.id, 'cancelled')}
                      disabled={busy}
                      className={`flex-row items-center justify-center gap-1.5 rounded-xl border border-neutral-700 px-4 py-2.5 ${busy ? 'opacity-50' : ''}`}
                    >
                      <X size={15} color="#6B7280" />
                      <Text className="font-semibold text-neutral-400">
                        {t('appt.cancel')}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </Card>
            )
          })
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
