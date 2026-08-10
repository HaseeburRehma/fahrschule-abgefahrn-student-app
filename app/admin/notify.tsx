import React, { useEffect, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack } from 'expo-router'
import { Check } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import {
  fetchStudents,
  fetchClasses,
  fetchClassEnrollmentIds,
  sendNotification,
} from '@/lib/admin'
import { displayName } from '@/lib/data'
import { formatDateTime } from '@/lib/format'
import { Button, Card, ErrorText, TextField } from '@/components/ui'
import type { Profile, TheoryClass } from '@/lib/types'

function notify(msg: string) {
  if (Platform.OS === 'web') window.alert(msg)
  else Alert.alert(msg)
}

type Mode = 'all' | 'select' | 'class'

export default function AdminNotify() {
  const { t, locale } = useTranslation()
  const [students, setStudents] = useState<Profile[]>([])
  const [classes, setClasses] = useState<TheoryClass[]>([])
  const [mode, setMode] = useState<Mode>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [classId, setClassId] = useState<string | null>(null)
  const [classRecipients, setClassRecipients] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStudents().then(setStudents).catch(() => {})
    fetchClasses().then(setClasses).catch(() => {})
  }, [])

  async function pickClass(id: string) {
    setClassId(id)
    try {
      setClassRecipients(await fetchClassEnrollmentIds(id))
    } catch {
      setClassRecipients([])
    }
  }

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function recipients(): string[] {
    if (mode === 'all') return students.filter((s) => s.is_active).map((s) => s.id)
    if (mode === 'select') return selected
    return classRecipients
  }

  async function send() {
    setError(null)
    if (!title.trim()) {
      setError(t('common.required'))
      return
    }
    const to = recipients()
    if (!to.length) {
      setError(t('common.required'))
      return
    }
    setBusy(true)
    try {
      const n = await sendNotification(to, {
        title: title.trim(),
        body: body.trim() || undefined,
        type: mode === 'class' ? 'schedule' : 'general',
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

  const modeBtn = (m: Mode, label: string) => (
    <Pressable
      onPress={() => setMode(m)}
      className={`flex-1 items-center rounded-xl border py-3 ${
        mode === m ? 'border-brand bg-brand/10' : 'border-neutral-800 bg-neutral-900'
      }`}
    >
      <Text className={`text-xs font-bold ${mode === m ? 'text-brand' : 'text-neutral-400'}`}>
        {label}
      </Text>
    </Pressable>
  )

  const count = recipients().length

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.notify') }} />
      <ScrollView contentContainerClassName="p-5 gap-4">
        <Card className="gap-3">
          <Text className="text-sm font-bold text-neutral-300">
            {t('admin.notifyTo')} ({count})
          </Text>
          <View className="flex-row gap-2">
            {modeBtn('all', t('admin.notifyAll'))}
            {modeBtn('select', t('admin.students'))}
            {modeBtn('class', t('admin.notifyByClass'))}
          </View>

          {mode === 'select' ? (
            <View className="gap-2 pt-1">
              {students.map((s) => {
                const on = selected.includes(s.id)
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => toggle(s.id)}
                    className={`flex-row items-center gap-3 rounded-xl border px-3 py-2.5 ${
                      on ? 'border-brand bg-brand/10' : 'border-neutral-800 bg-neutral-900'
                    }`}
                  >
                    <View
                      className={`h-5 w-5 items-center justify-center rounded-md border ${
                        on ? 'border-brand bg-brand' : 'border-neutral-700'
                      }`}
                    >
                      {on ? <Check size={14} color="#0A0A0A" /> : null}
                    </View>
                    <Text className="flex-1 text-neutral-100">
                      {displayName(s) || s.email}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          ) : null}

          {mode === 'class' ? (
            <View className="gap-2 pt-1">
              {classes.length === 0 ? (
                <Text className="text-sm text-neutral-500">{t('admin.noClasses')}</Text>
              ) : (
                classes.map((c) => {
                  const on = c.id === classId
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => pickClass(c.id)}
                      className={`rounded-xl border px-3 py-2.5 ${
                        on ? 'border-brand bg-brand/10' : 'border-neutral-800 bg-neutral-900'
                      }`}
                    >
                      <Text className="font-semibold text-neutral-100">
                        {locale === 'de' ? c.title_de : c.title_en}
                      </Text>
                      <Text className="text-xs text-neutral-400">
                        {formatDateTime(c.starts_at, locale)}
                      </Text>
                    </Pressable>
                  )
                })
              )}
            </View>
          ) : null}
        </Card>

        <Card className="gap-3">
          <TextField label={t('admin.notifyTitle')} value={title} onChangeText={setTitle} />
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
