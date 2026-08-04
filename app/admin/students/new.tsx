import React, { useEffect, useState } from 'react'
import { Alert, Platform, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'

import { useTranslation } from '@/lib/i18n'
import {
  createStudent,
  fetchPackages,
  fetchTopics,
} from '@/lib/admin'
import { Button, Card, ErrorText, TextField } from '@/components/ui'
import { PackagePicker, TopicPicker } from '@/components/admin-pickers'
import type { Package, TheoryTopic } from '@/lib/types'

function notify(msg: string) {
  if (Platform.OS === 'web') window.alert(msg)
  else Alert.alert(msg)
}

export default function NewStudent() {
  const { t } = useTranslation()
  const router = useRouter()

  const [packages, setPackages] = useState<Package[]>([])
  const [topics, setTopics] = useState<TheoryTopic[]>([])

  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [topicId, setTopicId] = useState<string | null>(null)
  const [pkgIds, setPkgIds] = useState<string[]>([])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPackages().then(setPackages).catch(() => {})
    fetchTopics().then(setTopics).catch(() => {})
  }, [])

  function togglePkg(id: string) {
    setPkgIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function save() {
    setError(null)
    const clean = email.trim().toLowerCase()
    if (!clean.includes('@')) {
      setError(t('common.required'))
      return
    }
    setBusy(true)
    try {
      await createStudent({
        email: clean,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        current_theory_topic_id: topicId,
        package_ids: pkgIds,
      })
      notify(t('common.saved'))
      router.back()
    } catch (e: any) {
      setError(e?.message ?? t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.addStudent') }} />
      <ScrollView contentContainerClassName="p-5 gap-4">
        <Card className="gap-3">
          <TextField
            label={t('auth.email')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            inputMode="email"
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField
                label={t('admin.firstName')}
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View className="flex-1">
              <TextField
                label={t('admin.lastName')}
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>
          <TextField
            label={t('admin.phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </Card>

        <Card className="gap-3">
          <Text className="text-sm font-bold text-neutral-700">
            {t('admin.assignTopic')}
          </Text>
          <TopicPicker topics={topics} selected={topicId} onSelect={setTopicId} />
        </Card>

        <Card className="gap-3">
          <Text className="text-sm font-bold text-neutral-700">
            {t('admin.assignPackages')}
          </Text>
          <PackagePicker
            packages={packages}
            selected={pkgIds}
            onToggle={togglePkg}
          />
        </Card>

        <ErrorText>{error}</ErrorText>
        <Button label={t('admin.addStudent')} onPress={save} loading={busy} />
      </ScrollView>
    </SafeAreaView>
  )
}
