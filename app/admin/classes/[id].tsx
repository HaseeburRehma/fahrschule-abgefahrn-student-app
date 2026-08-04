import React, { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams } from 'expo-router'
import { Check } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import {
  fetchClass,
  fetchStudents,
  fetchClassEnrollmentIds,
  enrollStudent,
  unenrollStudent,
} from '@/lib/admin'
import { displayName } from '@/lib/data'
import { formatDateTime } from '@/lib/format'
import { Card, Loader } from '@/components/ui'
import type { Profile, TheoryClass } from '@/lib/types'

export default function ClassEnrollments() {
  const { t, locale } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [cls, setCls] = useState<TheoryClass | null>(null)
  const [students, setStudents] = useState<Profile[]>([])
  const [enrolled, setEnrolled] = useState<string[]>([])
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const [c, s, e] = await Promise.all([
        fetchClass(id),
        fetchStudents(),
        fetchClassEnrollmentIds(id),
      ])
      setCls(c)
      setStudents(s)
      setEnrolled(e)
    })().catch(() => {})
  }, [id])

  async function toggle(studentId: string) {
    if (!id) return
    const isOn = enrolled.includes(studentId)
    setPending(studentId)
    // optimistic
    setEnrolled((prev) =>
      isOn ? prev.filter((x) => x !== studentId) : [...prev, studentId],
    )
    try {
      if (isOn) await unenrollStudent(studentId, id)
      else await enrollStudent(studentId, id)
    } catch {
      // rollback
      setEnrolled((prev) =>
        isOn ? [...prev, studentId] : prev.filter((x) => x !== studentId),
      )
    } finally {
      setPending(null)
    }
  }

  if (!cls) return <Loader />

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen
        options={{ title: locale === 'de' ? cls.title_de : cls.title_en }}
      />
      <ScrollView contentContainerClassName="p-5 gap-4">
        <Card>
          <Text className="text-lg font-bold text-neutral-900">
            {locale === 'de' ? cls.title_de : cls.title_en}
          </Text>
          <Text className="mt-1 text-sm text-neutral-500">
            {formatDateTime(cls.starts_at, locale)}
            {cls.location ? ` • ${cls.location}` : ''}
          </Text>
        </Card>

        <Text className="text-sm font-bold text-neutral-700">
          {t('admin.enrolled')} ({enrolled.length})
        </Text>

        <View className="gap-2">
          {students.map((s) => {
            const on = enrolled.includes(s.id)
            return (
              <Pressable
                key={s.id}
                onPress={() => toggle(s.id)}
                disabled={pending === s.id}
                className={`flex-row items-center gap-3 rounded-xl border px-3 py-3 ${
                  on ? 'border-brand bg-brand-light' : 'border-neutral-200 bg-white'
                } ${pending === s.id ? 'opacity-50' : ''}`}
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
      </ScrollView>
    </SafeAreaView>
  )
}
