import React, { useEffect, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Check } from 'phosphor-react-native/src/icons/Check'
import { PencilSimple as Pencil } from 'phosphor-react-native/src/icons/PencilSimple'

import { useTranslation } from '@/lib/i18n'
import {
  fetchClass,
  fetchStudents,
  fetchClassEnrollmentIds,
  enrollStudent,
  unenrollStudent,
  updateClass,
  deleteClass,
  fetchTopics,
} from '@/lib/admin'
import { displayName } from '@/lib/data'
import { fetchClassAttendance } from '@/lib/rsvp'
import { formatDateTime, parseLocalDateTime } from '@/lib/format'
import { Button, Card, ErrorText, Loader, TextField } from '@/components/ui'
import { TopicPicker } from '@/components/admin-pickers'
import type { Profile, TheoryClass, TheoryTopic } from '@/lib/types'

function notify(msg: string) {
  if (Platform.OS === 'web') window.alert(msg)
  else Alert.alert(msg)
}
function confirmMsg(msg: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(msg))
  return new Promise((resolve) =>
    Alert.alert('', msg, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', style: 'destructive', onPress: () => resolve(true) },
    ]),
  )
}
/** ISO → "YYYY-MM-DD HH:MM" local, for the edit input. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function ClassDetail() {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [cls, setCls] = useState<TheoryClass | null>(null)
  const [students, setStudents] = useState<Profile[]>([])
  const [enrolled, setEnrolled] = useState<string[]>([])
  const [topics, setTopics] = useState<TheoryTopic[]>([])
  const [attendance, setAttendance] = useState<{ yes: number; no: number }>({ yes: 0, no: 0 })
  const [pending, setPending] = useState<string | null>(null)

  // edit form
  const [showEdit, setShowEdit] = useState(false)
  const [titleDe, setTitleDe] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [location, setLocation] = useState('')
  const [topicId, setTopicId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function hydrate(c: TheoryClass) {
    setCls(c)
    setTitleDe(c.title_de)
    setTitleEn(c.title_en)
    setStartsAt(toLocalInput(c.starts_at))
    setLocation(c.location ?? '')
    setTopicId(c.topic_id)
  }

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const [c, s, e, tp, att] = await Promise.all([
        fetchClass(id),
        fetchStudents(),
        fetchClassEnrollmentIds(id),
        fetchTopics(),
        fetchClassAttendance(id),
      ])
      if (c) hydrate(c)
      setStudents(s)
      setEnrolled(e)
      setTopics(tp)
      setAttendance(att)
    })().catch(() => {})
  }, [id])

  async function toggle(studentId: string) {
    if (!id) return
    const isOn = enrolled.includes(studentId)
    setPending(studentId)
    setEnrolled((prev) =>
      isOn ? prev.filter((x) => x !== studentId) : [...prev, studentId],
    )
    try {
      if (isOn) await unenrollStudent(studentId, id)
      else await enrollStudent(studentId, id)
    } catch {
      setEnrolled((prev) =>
        isOn ? [...prev, studentId] : prev.filter((x) => x !== studentId),
      )
    } finally {
      setPending(null)
    }
  }

  async function saveEdit() {
    if (!id) return
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
      await updateClass(id, {
        title_de: titleDe.trim(),
        title_en: titleEn.trim(),
        starts_at: iso,
        location: location.trim() || null,
        topic_id: topicId,
      })
      const c = await fetchClass(id)
      if (c) hydrate(c)
      setShowEdit(false)
      notify(t('common.saved'))
    } catch (e: any) {
      setError(e?.message ?? t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  async function removeClass() {
    if (!id) return
    const ok = await confirmMsg(t('admin.deleteClassConfirm'))
    if (!ok) return
    setBusy(true)
    try {
      await deleteClass(id)
      notify(t('admin.deleted'))
      router.back()
    } catch (e: any) {
      setError(e?.message ?? t('common.error'))
      setBusy(false)
    }
  }

  if (!cls) return <Loader />

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: locale === 'de' ? cls.title_de : cls.title_en,
          headerRight: () => (
            <Pressable onPress={() => setShowEdit((s) => !s)} hitSlop={8} className="px-2">
              <Pencil size={18} color="#00FF24" />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerClassName="p-5 gap-4">
        {showEdit ? (
          <Card className="gap-3">
            <TextField label={t('admin.classTitleDe')} value={titleDe} onChangeText={setTitleDe} />
            <TextField label={t('admin.classTitleEn')} value={titleEn} onChangeText={setTitleEn} />
            <TextField
              label={t('admin.startsAt')}
              value={startsAt}
              onChangeText={setStartsAt}
              hint={t('admin.startsAtHint')}
              autoCapitalize="none"
            />
            <TextField label={t('admin.location')} value={location} onChangeText={setLocation} />
            <View className="gap-2">
              <Text className="text-sm font-m-bold text-neutral-300">{t('admin.topic')}</Text>
              <TopicPicker topics={topics} selected={topicId} onSelect={setTopicId} />
            </View>
            <ErrorText>{error}</ErrorText>
            <Button label={t('common.save')} onPress={saveEdit} loading={busy} />
            <Button label={t('admin.deleteClass')} onPress={removeClass} disabled={busy} variant="danger" />
          </Card>
        ) : (
          <Card>
            <Text className="text-lg font-m-bold text-neutral-100">
              {locale === 'de' ? cls.title_de : cls.title_en}
            </Text>
            <Text className="font-m-regular mt-1 text-sm text-neutral-400">
              {formatDateTime(cls.starts_at, locale)}
              {cls.location ? ` • ${cls.location}` : ''}
            </Text>
          </Card>
        )}

        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-m-bold text-neutral-300">
            {t('admin.enrolled')} ({enrolled.length})
          </Text>
          <Text className="text-xs font-m-semibold text-neutral-400">
            {t('admin.attendance', { yes: attendance.yes, no: attendance.no })}
          </Text>
        </View>

        <View className="gap-2">
          {students.map((s) => {
            const on = enrolled.includes(s.id)
            return (
              <Pressable
                key={s.id}
                onPress={() => toggle(s.id)}
                disabled={pending === s.id}
                className={`flex-row items-center gap-3 rounded-xl border px-3 py-3 ${
                  on ? 'border-brand bg-brand/10' : 'border-neutral-800 bg-neutral-900'
                } ${pending === s.id ? 'opacity-50' : ''}`}
              >
                <View
                  className={`h-5 w-5 items-center justify-center rounded-md border ${
                    on ? 'border-brand bg-brand' : 'border-neutral-700'
                  }`}
                >
                  {on ? <Check size={14} color="#0A0A0A" /> : null}
                </View>
                <Text className="font-m-regular flex-1 text-neutral-100">
                  {displayName(s) || s.email}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
