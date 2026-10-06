import React, { useCallback, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect } from 'expo-router'
import { Check } from 'phosphor-react-native/src/icons/Check'
import { X } from 'phosphor-react-native/src/icons/X'
import { CalendarDots as CalendarDays } from 'phosphor-react-native/src/icons/CalendarDots'
import { PencilSimple as Pencil } from 'phosphor-react-native/src/icons/PencilSimple'
import { Plus } from 'phosphor-react-native/src/icons/Plus'
import { User } from 'phosphor-react-native/src/icons/User'
import { MapPin } from 'phosphor-react-native/src/icons/MapPin'
import { Car } from 'phosphor-react-native/src/icons/Car'

import { useTranslation } from '@/lib/i18n'
import {
  LESSON_TYPES,
  fetchAllAppointments,
  setAppointmentStatus,
  type Appointment,
  type AppointmentWithStudent,
} from '@/lib/appointments'
import { fetchStudents } from '@/lib/admin'
import { displayName } from '@/lib/data'
import { formatDateTime, formatTime } from '@/lib/format'
import { Button, Card, ErrorText, Loader } from '@/components/ui'
import { AppointmentForm, type AppointmentFormMode } from '@/components/admin-appointment-form'
import type { Profile } from '@/lib/types'

type FormState = { mode: AppointmentFormMode; id?: string } | null

function byStart(a: Appointment, b: Appointment) {
  return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
}

export default function AdminAppointments() {
  const { t, locale } = useTranslation()
  const [rows, setRows] = useState<AppointmentWithStudent[]>([])
  const [students, setStudents] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [appts, studs] = await Promise.all([
        fetchAllAppointments(),
        fetchStudents().catch(() => [] as Profile[]),
      ])
      setRows(appts)
      setStudents(studs)
    } catch (e: any) {
      setLoadError(e?.message ?? t('admin.v2.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  async function cancel(id: string) {
    if (busyId) return
    // destructive + notifies the student → ask first
    const msg = t('admin.v2.appt.cancelConfirm')
    const ok =
      Platform.OS === 'web'
        ? window.confirm(msg)
        : await new Promise<boolean>((resolve) =>
            Alert.alert('', msg, [
              { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
              { text: t('appt.cancel'), style: 'destructive', onPress: () => resolve(true) },
            ]),
          )
    if (!ok) return
    setActionError(null)
    setBusyId(id)
    try {
      await setAppointmentStatus(id, 'cancelled')
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)))
    } catch (e: any) {
      setActionError(e?.message ?? t('common.error'))
    } finally {
      setBusyId(null)
    }
  }

  function onSaved(saved: Appointment) {
    setRows((prev) => {
      const student =
        prev.find((r) => r.id === saved.id)?.student ??
        students.find((s) => s.id === saved.student_id) ??
        null
      const rest = prev.filter((r) => r.id !== saved.id)
      return [...rest, { ...saved, student }].sort(byStart)
    })
    setForm(null)
  }

  if (loading && !rows.length) return <Loader />

  const typeLabel = (lt?: string | null) =>
    lt && (LESSON_TYPES as readonly string[]).includes(lt) ? t(`admin.v2.type.${lt}`) : null

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.appointments') }} />
      <ScrollView contentContainerClassName="p-5 gap-2" keyboardShouldPersistTaps="handled">
        {form?.mode === 'create' ? (
          <AppointmentForm
            mode="create"
            students={students}
            onDone={onSaved}
            onCancel={() => setForm(null)}
          />
        ) : (
          <Pressable
            onPress={() => setForm({ mode: 'create' })}
            className="mb-1 flex-row items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-4"
          >
            <Plus size={18} color="#0A0A0A" />
            <Text className="font-bold text-ink">{t('admin.v2.newAppt')}</Text>
          </Pressable>
        )}

        <ErrorText>{loadError}</ErrorText>
        {loadError ? (
          <Button label={t('common.retry')} onPress={load} loading={loading} variant="ghost" />
        ) : null}
        <ErrorText>{actionError}</ErrorText>

        {rows.length === 0 && !loadError ? (
          <Text className="mt-16 text-center text-neutral-400">
            {t('admin.apptEmpty')}
          </Text>
        ) : (
          rows.map((r) => {
            if (form && form.id === r.id) {
              return (
                <AppointmentForm
                  key={r.id}
                  mode={form.mode}
                  appointment={r}
                  onDone={onSaved}
                  onCancel={() => setForm(null)}
                />
              )
            }
            const cancelled = r.status === 'cancelled'
            const statusColor =
              r.status === 'confirmed'
                ? 'text-brand'
                : r.status === 'cancelled'
                  ? 'text-red-500'
                  : 'text-neutral-400'
            const busy = busyId === r.id
            const type = typeLabel(r.lesson_type)
            return (
              <Card key={r.id} className={`gap-2 ${cancelled ? 'opacity-60' : ''}`}>
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-base font-bold text-neutral-100">
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
                {type ? (
                  <View className="flex-row items-center gap-1.5">
                    <Car size={14} color="#6B7280" />
                    <Text className="text-sm text-neutral-400">{type}</Text>
                  </View>
                ) : null}
                {r.instructor_name ? (
                  <View className="flex-row items-center gap-1.5">
                    <User size={14} color="#6B7280" />
                    <Text className="text-sm text-neutral-400">
                      {t('admin.v2.instructor')}: {r.instructor_name}
                    </Text>
                  </View>
                ) : null}
                {r.meeting_point ? (
                  <View className="flex-row items-center gap-1.5">
                    <MapPin size={14} color="#6B7280" />
                    <Text className="text-sm text-neutral-400">
                      {t('admin.v2.meetingPoint')}: {r.meeting_point}
                    </Text>
                  </View>
                ) : null}
                {r.note ? (
                  <Text className="text-sm text-neutral-400">{r.note}</Text>
                ) : null}
                <View className="mt-1 flex-row gap-2">
                  {!cancelled && r.status !== 'confirmed' ? (
                    <Pressable
                      onPress={() => setForm({ mode: 'confirm', id: r.id })}
                      disabled={busy}
                      className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 ${busy ? 'opacity-50' : ''}`}
                    >
                      <Check size={15} color="#0A0A0A" />
                      <Text className="font-bold text-ink">{t('admin.confirm')}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => setForm({ mode: 'edit', id: r.id })}
                    disabled={busy}
                    className={`flex-row items-center justify-center gap-1.5 rounded-xl border border-neutral-700 px-4 py-2.5 ${busy ? 'opacity-50' : ''}`}
                  >
                    <Pencil size={15} color="#6B7280" />
                    <Text className="font-semibold text-neutral-400">
                      {t('admin.v2.edit')}
                    </Text>
                  </Pressable>
                  {!cancelled ? (
                    <Pressable
                      onPress={() => cancel(r.id)}
                      disabled={busy || busyId !== null}
                      className={`flex-row items-center justify-center gap-1.5 rounded-xl border border-neutral-700 px-4 py-2.5 ${busy ? 'opacity-50' : ''}`}
                    >
                      <X size={15} color="#6B7280" />
                      <Text className="font-semibold text-neutral-400">
                        {t('appt.cancel')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </Card>
            )
          })
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
