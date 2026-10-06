import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { CaretRight as ChevronRight } from 'phosphor-react-native/src/icons/CaretRight'
import { Plus } from 'phosphor-react-native/src/icons/Plus'

import { useTranslation } from '@/lib/i18n'
import { createClass, fetchClasses, fetchTopics } from '@/lib/admin'
import { formatDateTime, parseLocalDateTime } from '@/lib/format'
import { Button, Card, ErrorText, TextField } from '@/components/ui'
import { TopicPicker } from '@/components/admin-pickers'
import type { TheoryClass, TheoryTopic } from '@/lib/types'

function notify(msg: string) {
  if (Platform.OS === 'web') window.alert(msg)
  else Alert.alert(msg)
}

export default function ClassesAdmin() {
  const { t, locale } = useTranslation()
  const router = useRouter()

  const [classes, setClasses] = useState<TheoryClass[]>([])
  const [topics, setTopics] = useState<TheoryTopic[]>([])
  const [showForm, setShowForm] = useState(false)

  const [titleDe, setTitleDe] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [location, setLocation] = useState('')
  const [topicId, setTopicId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [c, tp] = await Promise.all([fetchClasses(), fetchTopics()])
      setClasses(c)
      setTopics(tp)
    } catch {}
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  async function create() {
    setError(null)
    if (!titleDe.trim() || !titleEn.trim()) {
      setError(t('common.required'))
      return
    }
    const iso = parseLocalDateTime(startsAt)
    if (!iso) {
      setError(t('admin.badDate'))
      return
    }
    setBusy(true)
    try {
      await createClass({
        title_de: titleDe.trim(),
        title_en: titleEn.trim(),
        starts_at: iso,
        location: location.trim() || null,
        topic_id: topicId,
      })
      setTitleDe('')
      setTitleEn('')
      setStartsAt('')
      setLocation('')
      setTopicId(null)
      setShowForm(false)
      notify(t('common.saved'))
      load()
    } catch (e: any) {
      setError(e?.message ?? t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.classes') }} />
      <ScrollView contentContainerClassName="p-5 gap-3">
        <Pressable
          onPress={() => setShowForm((s) => !s)}
          className="flex-row items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3.5"
        >
          <Plus size={18} color="#0A0A0A" />
          <Text className="font-bold text-ink">{t('admin.newClass')}</Text>
        </Pressable>

        {showForm ? (
          <Card className="gap-3">
            <TextField
              label={t('admin.classTitleDe')}
              value={titleDe}
              onChangeText={setTitleDe}
            />
            <TextField
              label={t('admin.classTitleEn')}
              value={titleEn}
              onChangeText={setTitleEn}
            />
            <TextField
              label={t('admin.startsAt')}
              value={startsAt}
              onChangeText={setStartsAt}
              placeholder="2026-08-20 18:30"
              hint={t('admin.startsAtHint')}
              autoCapitalize="none"
            />
            <TextField
              label={t('admin.location')}
              value={location}
              onChangeText={setLocation}
            />
            <View className="gap-2">
              <Text className="text-sm font-bold text-neutral-300">
                {t('admin.topic')}
              </Text>
              <TopicPicker topics={topics} selected={topicId} onSelect={setTopicId} />
            </View>
            <ErrorText>{error}</ErrorText>
            <Button label={t('admin.createClass')} onPress={create} loading={busy} />
          </Card>
        ) : null}

        {classes.length === 0 ? (
          <Text className="mt-8 text-center text-neutral-400">
            {t('admin.noClasses')}
          </Text>
        ) : (
          classes.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/admin/classes/${c.id}`)}
              className="flex-row items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
            >
              <View className="flex-1">
                <Text className="font-semibold text-neutral-100">
                  {locale === 'de' ? c.title_de : c.title_en}
                </Text>
                <Text className="text-sm text-neutral-400">
                  {formatDateTime(c.starts_at, locale)}
                  {c.location ? ` • ${c.location}` : ''}
                </Text>
              </View>
              <ChevronRight size={20} color="#9CA3AF" />
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
