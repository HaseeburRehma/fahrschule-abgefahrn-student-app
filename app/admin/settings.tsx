import React, { useCallback, useState } from 'react'
import { Alert, Platform, ScrollView, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect } from 'expo-router'

import { useTranslation } from '@/lib/i18n'
import { fetchSignupCode, normalizeSignupCode, setSignupCode } from '@/lib/admin'
import { Button, Card, ErrorText, Loader, TextField } from '@/components/ui'

function notify(msg: string) {
  if (Platform.OS === 'web') window.alert(msg)
  else Alert.alert(msg)
}

/** Admin settings — the school sign-up code students enter when registering. */
export default function AdminSettings() {
  const { t } = useTranslation()
  const [current, setCurrent] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const code = await fetchSignupCode()
      setCurrent(code)
      setDraft(code ?? '')
    } catch (e: any) {
      setError(e?.message ?? t('admin.v2.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  async function save() {
    if (saving) return
    setError(null)
    const code = normalizeSignupCode(draft)
    if (!code) {
      setError(t('admin.v2.badCode'))
      return
    }
    setSaving(true)
    try {
      const stored = await setSignupCode(code)
      setCurrent(stored)
      setDraft(stored)
      notify(t('admin.v2.codeSaved'))
    } catch (e: any) {
      setError(e?.message ?? t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  if (loading && current === null && !error) return <Loader />

  const unchanged = normalizeSignupCode(draft) === current

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.v2.signupCode') }} />
      <ScrollView contentContainerClassName="p-5 gap-4" keyboardShouldPersistTaps="handled">
        <Card className="gap-3">
          <Text className="text-sm text-neutral-400">{t('admin.v2.signupCodeHelp')}</Text>
          <Text className="text-sm font-semibold text-neutral-300">
            {t('admin.v2.currentCode')}
          </Text>
          <Text className="text-2xl font-extrabold tracking-widest text-brand">
            {current ?? t('admin.v2.noCode')}
          </Text>
        </Card>

        <Card className="gap-3">
          <TextField
            label={t('admin.v2.newCode')}
            hint={t('admin.v2.codeHint')}
            value={draft}
            onChangeText={(v) => setDraft(v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            editable={!saving}
          />
          <ErrorText>{error}</ErrorText>
          {error && current === null ? (
            <Button label={t('common.retry')} onPress={load} loading={loading} variant="ghost" />
          ) : null}
          <Button
            label={t('common.save')}
            onPress={save}
            loading={saving}
            disabled={loading || unchanged}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  )
}
