import React, { useEffect, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack } from 'expo-router'
import { Check } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { fetchStudents, sendNotification } from '@/lib/admin'
import { displayName } from '@/lib/data'
import { Button, Card, ErrorText, TextField } from '@/components/ui'
import type { Profile } from '@/lib/types'

function notify(msg: string) {
  if (Platform.OS === 'web') window.alert(msg)
  else Alert.alert(msg)
}

export default function AdminNotify() {
  const { t } = useTranslation()
  const [students, setStudents] = useState<Profile[]>([])
  const [toAll, setToAll] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStudents().then(setStudents).catch(() => {})
  }, [])

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function send() {
    setError(null)
    if (!title.trim()) {
      setError(t('common.required'))
      return
    }
    const recipients = toAll
      ? students.filter((s) => s.is_active).map((s) => s.id)
      : selected
    if (!recipients.length) {
      setError(t('common.required'))
      return
    }
    setBusy(true)
    try {
      const n = await sendNotification(recipients, {
        title: title.trim(),
        body: body.trim() || undefined,
        type: 'general',
      })
      notify(`${t('admin.notifySent')} (${n})`)
      setTitle('')
      setBody('')
      setSelected([])
    } catch (e: any) {
      setError(e?.message ?? t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.notify') }} />
      <ScrollView contentContainerClassName="p-5 gap-4">
        <Card className="gap-3">
          <Text className="text-sm font-bold text-neutral-700">
            {t('admin.notifyTo')}
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setToAll(true)}
              className={`flex-1 items-center rounded-xl border py-3 ${
                toAll ? 'border-brand bg-brand-light' : 'border-neutral-200 bg-white'
              }`}
            >
              <Text
                className={`font-bold ${toAll ? 'text-brand-dark' : 'text-neutral-600'}`}
              >
                {t('admin.notifyAll')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setToAll(false)}
              className={`flex-1 items-center rounded-xl border py-3 ${
                !toAll ? 'border-brand bg-brand-light' : 'border-neutral-200 bg-white'
              }`}
            >
              <Text
                className={`font-bold ${!toAll ? 'text-brand-dark' : 'text-neutral-600'}`}
              >
                {t('admin.students')}
              </Text>
            </Pressable>
          </View>

          {!toAll ? (
            <View className="gap-2 pt-1">
              {students.map((s) => {
                const on = selected.includes(s.id)
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => toggle(s.id)}
                    className={`flex-row items-center gap-3 rounded-xl border px-3 py-2.5 ${
                      on ? 'border-brand bg-brand-light' : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <View
                      className={`h-5 w-5 items-center justify-center rounded-md border ${
                        on ? 'border-brand bg-brand' : 'border-neutral-300'
                      }`}
                    >
                      {on ? <Check size={14} color="#0A0A0A" /> : null}
                    </View>
                    <Text className="flex-1 text-neutral-900">
                      {displayName(s) || s.email}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          ) : null}
        </Card>

        <Card className="gap-3">
          <TextField
            label={t('admin.notifyTitle')}
            value={title}
            onChangeText={setTitle}
          />
          <TextField
            label={t('admin.notifyBody')}
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={4}
            style={{ minHeight: 96, textAlignVertical: 'top' }}
          />
        </Card>

        <ErrorText>{error}</ErrorText>
        <Button label={t('common.send')} onPress={send} loading={busy} />
      </ScrollView>
    </SafeAreaView>
  )
}
