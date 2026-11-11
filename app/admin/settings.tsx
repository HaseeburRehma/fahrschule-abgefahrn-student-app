import React, { useCallback, useState } from 'react'
import { Alert, Platform, ScrollView, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect } from 'expo-router'

import { useTranslation } from '@/lib/i18n'
import { fetchSignupCode, normalizeSignupCode, setSignupCode } from '@/lib/admin'
import { Button, Card, ErrorText, Loader, TextField } from '@/components/ui'
import { FEATURE_FLAGS, setFeatureFlag, useFeatureFlags, type FeatureFlag } from '@/lib/flags'

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
  const { flags, reload: reloadFlags } = useFeatureFlags()
  const [flagBusy, setFlagBusy] = useState<FeatureFlag | null>(null)

  async function toggleFlag(name: FeatureFlag, on: boolean) {
    setFlagBusy(name)
    try {
      await setFeatureFlag(name, on)
      await reloadFlags()
    } catch (e: any) {
      notify(e?.message ?? t('common.error'))
    } finally {
      setFlagBusy(null)
    }
  }

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
          <Text className="font-m-regular text-sm text-neutral-400">{t('admin.v2.signupCodeHelp')}</Text>
          <Text className="text-sm font-m-semibold text-neutral-300">
            {t('admin.v2.currentCode')}
          </Text>
          <Text className="text-2xl font-m-xbold tracking-widest text-brand">
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

        <Card className="gap-3">
          <Text className="font-m-bold text-base text-neutral-100">{t('admin.flags.title')}</Text>
          <Text className="font-m-regular text-sm text-neutral-400">{t('admin.flags.help')}</Text>
          {FEATURE_FLAGS.map((name) => (
            <View key={name} className="flex-row items-center justify-between gap-3 py-1">
              <View className="flex-1">
                <Text className="font-m-semibold text-sm text-neutral-100">{t(`admin.flags.${name}`)}</Text>
                <Text className="font-m-regular text-xs text-neutral-500">{t(`admin.flags.${name}.hint`)}</Text>
              </View>
              <Switch
                value={flags[name]}
                disabled={flagBusy !== null}
                onValueChange={(v) => toggleFlag(name, v)}
                trackColor={{ true: '#00FF24' }}
                accessibilityLabel={t(`admin.flags.${name}`)}
              />
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  )
}
