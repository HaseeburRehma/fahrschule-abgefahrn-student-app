import React, { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect } from 'expo-router'
import { Trash2 } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import {
  fetchMotivationMessages,
  createMotivation,
  deleteMotivation,
  type MotivationMessage,
} from '@/lib/motivation'
import { Button, Card, ErrorText, Loader, TextField } from '@/components/ui'

export default function AdminMotivation() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<MotivationMessage[] | null>(null)
  const [de, setDe] = useState('')
  const [en, setEn] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchMotivationMessages(false)
      .then(setRows)
      .catch(() => setRows([]))
  }, [])
  useFocusEffect(useCallback(() => load(), [load]))

  async function add() {
    setError(null)
    if (!de.trim() || !en.trim()) {
      setError(t('common.required'))
      return
    }
    setBusy(true)
    try {
      await createMotivation(de.trim(), en.trim())
      setDe('')
      setEn('')
      load()
    } catch (e: any) {
      setError(e?.message ?? t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setRows((prev) => (prev ?? []).filter((r) => r.id !== id))
    try {
      await deleteMotivation(id)
    } catch {
      load()
    }
  }

  if (rows === null) return <Loader />

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.motivation') }} />
      <ScrollView contentContainerClassName="p-5 gap-3">
        <Card className="gap-3">
          <TextField label={t('admin.msgDe')} value={de} onChangeText={setDe} multiline style={{ minHeight: 60, textAlignVertical: 'top' }} />
          <TextField label={t('admin.msgEn')} value={en} onChangeText={setEn} multiline style={{ minHeight: 60, textAlignVertical: 'top' }} />
          <ErrorText>{error}</ErrorText>
          <Button label={t('admin.addMessage')} onPress={add} loading={busy} />
        </Card>

        {rows.length === 0 ? (
          <Text className="mt-4 text-center text-neutral-400">
            {t('admin.motivationEmpty')}
          </Text>
        ) : (
          rows.map((m) => (
            <View
              key={m.id}
              className="flex-row items-start gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
            >
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-semibold text-neutral-100">{m.body_de}</Text>
                <Text className="text-xs text-neutral-400">{m.body_en}</Text>
              </View>
              <Pressable onPress={() => remove(m.id)} hitSlop={8} className="p-1">
                <Trash2 size={18} color="#EF4444" />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
