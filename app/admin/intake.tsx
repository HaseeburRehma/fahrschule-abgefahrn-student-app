import React, { useCallback, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect } from 'expo-router'
import { UserCheck } from 'phosphor-react-native/src/icons/UserCheck'
import { X } from 'phosphor-react-native/src/icons/X'

import { useTranslation } from '@/lib/i18n'
import {
  fetchIntake,
  setIntakeStatus,
  createStudent,
} from '@/lib/admin'
import { formatDateTime } from '@/lib/format'
import { Card, Loader } from '@/components/ui'
import type { SignupIntake } from '@/lib/types'

function notify(msg: string) {
  if (Platform.OS === 'web') window.alert(msg)
  else Alert.alert(msg)
}

export default function IntakeQueue() {
  const { t, locale } = useTranslation()
  const [rows, setRows] = useState<SignupIntake[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchIntake('pending')
      .then(setRows)
      .catch(() => setRows([]))
  }, [])

  useFocusEffect(useCallback(() => load(), [load]))

  async function convert(row: SignupIntake) {
    if (!row.email) {
      notify(t('auth.err.notRegistered'))
      return
    }
    setBusyId(row.id)
    try {
      await createStudent({
        email: row.email,
        first_name: row.first_name ?? undefined,
        last_name: row.last_name ?? undefined,
        phone: row.phone ?? undefined,
      })
      await setIntakeStatus(row.id, 'converted')
      setRows((prev) => (prev ?? []).filter((r) => r.id !== row.id))
      notify(t('common.saved'))
    } catch (e: any) {
      notify(e?.message ?? t('common.error'))
    } finally {
      setBusyId(null)
    }
  }

  async function dismiss(row: SignupIntake) {
    setBusyId(row.id)
    try {
      await setIntakeStatus(row.id, 'dismissed')
      setRows((prev) => (prev ?? []).filter((r) => r.id !== row.id))
    } catch (e: any) {
      notify(e?.message ?? t('common.error'))
    } finally {
      setBusyId(null)
    }
  }

  if (rows === null) return <Loader />

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.intake') }} />
      <ScrollView contentContainerClassName="p-5 gap-3">
        {rows.length === 0 ? (
          <Text className="mt-16 text-center text-neutral-400">
            {t('admin.intakeEmpty')}
          </Text>
        ) : (
          rows.map((r) => {
            const name =
              [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email
            const busy = busyId === r.id
            return (
              <Card key={r.id} className="gap-3">
                <View>
                  <Text className="text-base font-bold text-neutral-100">
                    {name}
                  </Text>
                  {r.email ? (
                    <Text className="text-sm text-neutral-400">{r.email}</Text>
                  ) : null}
                  {r.phone ? (
                    <Text className="text-sm text-neutral-400">{r.phone}</Text>
                  ) : null}
                  {r.service_label ? (
                    <View className="mt-1 self-start rounded-full bg-brand/10 px-2.5 py-1">
                      <Text className="text-xs font-semibold text-brand">
                        {r.service_label}
                      </Text>
                    </View>
                  ) : null}
                  <Text className="mt-1 text-xs text-neutral-400">
                    {formatDateTime(r.created_at, locale)}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => convert(r)}
                    disabled={busy}
                    className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-brand py-3 ${busy ? 'opacity-50' : ''}`}
                  >
                    <UserCheck size={16} color="#0A0A0A" />
                    <Text className="font-bold text-ink">{t('admin.convert')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => dismiss(r)}
                    disabled={busy}
                    className={`flex-row items-center justify-center gap-1 rounded-xl border border-neutral-700 px-4 py-3 ${busy ? 'opacity-50' : ''}`}
                  >
                    <X size={16} color="#6B7280" />
                    <Text className="font-semibold text-neutral-400">
                      {t('admin.dismiss')}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            )
          })
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
