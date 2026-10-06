import React, { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect } from 'expo-router'

import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { fetchAdmins, fetchStudents, setUserRole } from '@/lib/admin'
import { displayName } from '@/lib/data'
import { Button, Card, ErrorText, Loader } from '@/components/ui'
import { StudentPicker } from '@/components/admin-pickers'
import type { Profile } from '@/lib/types'

function confirmMsg(msg: string, okLabel: string, cancelLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(msg))
  return new Promise((resolve) =>
    Alert.alert('', msg, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: 'destructive', onPress: () => resolve(true) },
    ], { onDismiss: () => resolve(false) }),
  )
}

function roleError(e: any, t: (k: string) => string): string {
  const msg = String(e?.message ?? '')
  if (msg.includes('last_admin')) return t('admin.v2.admins.lastAdmin')
  if (msg.includes('not_allowed')) return t('admin.v2.admins.notAllowed')
  return msg || t('common.error')
}

/** Administration → Administratoren: promote students, remove other admins. */
export default function AdminAdmins() {
  const { t } = useTranslation()
  const { session } = useUser()
  const me: string | null = session?.user?.id ?? null
  const [admins, setAdmins] = useState<Profile[]>([])
  const [students, setStudents] = useState<Profile[]>([])
  const [pick, setPick] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [a, s] = await Promise.all([fetchAdmins(), fetchStudents()])
      setAdmins(a)
      setStudents(s)
    } catch (e: any) {
      setError(roleError(e, t))
    } finally {
      setLoading(false)
    }
  }, [t])
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  async function promote() {
    if (!pick || busy) return
    const s = students.find((x) => x.id === pick)
    if (!s) return
    const ok = await confirmMsg(
      t('admin.v2.admins.promoteConfirm').replace('{name}', displayName(s)),
      t('admin.v2.admins.promote'),
      t('common.cancel'),
    )
    if (!ok) return
    setBusy(pick)
    setError(null)
    try {
      await setUserRole(pick, 'admin')
      setPick(null)
      await load()
    } catch (e: any) {
      setError(roleError(e, t))
    } finally {
      setBusy(null)
    }
  }

  async function demote(p: Profile) {
    if (busy) return
    const ok = await confirmMsg(
      t('admin.v2.admins.demoteConfirm').replace('{name}', displayName(p)),
      t('admin.v2.admins.demote'),
      t('common.cancel'),
    )
    if (!ok) return
    setBusy(p.id)
    setError(null)
    try {
      await setUserRole(p.id, 'student')
      await load()
    } catch (e: any) {
      setError(roleError(e, t))
    } finally {
      setBusy(null)
    }
  }

  if (loading && admins.length === 0 && !error) return <Loader />

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.v2.admins.title') }} />
      <ScrollView contentContainerClassName="p-5 gap-4" keyboardShouldPersistTaps="handled">
        <Card className="gap-3">
          <Text className="text-sm text-neutral-400">{t('admin.v2.admins.help')}</Text>
          {admins.map((a) => (
            <View key={a.id} className="flex-row items-center gap-3 border-t border-neutral-800 pt-3">
              <View className="flex-1">
                <Text className="text-base font-semibold text-neutral-100" numberOfLines={1}>
                  {displayName(a)}
                  {a.id === me ? `  (${t('admin.v2.admins.you')})` : ''}
                  {a.is_active ? '' : `  · ${t('admin.v2.admins.inactive')}`}
                </Text>
                <Text className="text-xs text-neutral-500" numberOfLines={1}>{a.email}</Text>
              </View>
              {a.id !== me ? (
                <Pressable
                  onPress={() => demote(a)}
                  disabled={!!busy}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('admin.v2.admins.demote')}: ${displayName(a)}`}
                  hitSlop={8}
                  className={`rounded-full border border-neutral-700 px-4 py-2 ${busy ? 'opacity-50' : ''}`}
                >
                  {busy === a.id ? (
                    <ActivityIndicator size="small" color="#FF5A5A" />
                  ) : (
                    <Text className="text-sm font-semibold text-red-400">{t('admin.v2.admins.demote')}</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          ))}
        </Card>

        <Card className="gap-3">
          <Text className="text-sm font-semibold text-neutral-300">{t('admin.v2.admins.add')}</Text>
          <StudentPicker
            students={students}
            selected={pick}
            onSelect={setPick}
            placeholder={t('admin.v2.admins.search')}
            disabled={!!busy}
          />
          <Button
            label={t('admin.v2.admins.promote')}
            onPress={promote}
            loading={!!busy && busy === pick}
            disabled={!pick || !!busy}
          />
        </Card>

        <ErrorText>{error}</ErrorText>
        {error && admins.length === 0 ? <Button label={t('common.retry')} onPress={load} variant="ghost" /> : null}
      </ScrollView>
    </SafeAreaView>
  )
}
