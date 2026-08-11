import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { GraduationCap, Check, X } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { updateMyProfile } from '@/lib/data'
import { fetchMotivationMessages, buildMotivationItems } from '@/lib/motivation'
import { scheduleReminders } from '@/lib/reminders'
import { Button, Card, TextField } from '@/components/ui'

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim())
function daysUntil(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

export default function ExamScreen() {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const { profile, session, refreshProfile } = useUser()
  const uid: string | null = session?.user?.id ?? null

  const [theory, setTheory] = useState(profile?.theory_exam_date ?? '')
  const [practical, setPractical] = useState(profile?.practical_exam_date ?? '')

  useEffect(() => {
    setTheory(profile?.theory_exam_date ?? '')
    setPractical(profile?.practical_exam_date ?? '')
  }, [profile])

  // (Re)schedule the daily motivation pushes for the nearest upcoming exam.
  const rescheduleMotivation = useCallback(async () => {
    const candidates = [profile?.theory_exam_date, profile?.practical_exam_date]
      .filter((d): d is string => !!d && daysUntil(d) > 0)
      .sort()
    if (!candidates.length) {
      scheduleReminders([], 'motivation') // clear
      return
    }
    try {
      const msgs = await fetchMotivationMessages(true)
      const bodies = msgs.map((m) => (locale === 'de' ? m.body_de : m.body_en))
      const items = buildMotivationItems(
        new Date(candidates[0] + 'T00:00:00'),
        bodies,
        (days) => t('exam.motivationTitle', { days }),
      )
      scheduleReminders(items, 'motivation')
    } catch {}
  }, [profile, locale, t])

  useFocusEffect(
    useCallback(() => {
      rescheduleMotivation()
    }, [rescheduleMotivation]),
  )

  async function saveDate(which: 'theory' | 'practical', value: string) {
    if (!uid) return
    const clean = value.trim()
    if (clean && !isDate(clean)) return
    const patch =
      which === 'theory'
        ? { theory_exam_date: clean || null, theory_passed: null }
        : { practical_exam_date: clean || null, practical_passed: null }
    await updateMyProfile(uid, patch as any).catch(() => {})
    await refreshProfile()
    rescheduleMotivation()
  }

  async function setPassed(which: 'theory' | 'practical', passed: boolean) {
    if (!uid) return
    const patch =
      which === 'theory' ? { theory_passed: passed } : { practical_passed: passed }
    await updateMyProfile(uid, patch as any).catch(() => {})
    await refreshProfile()
    if (passed) router.push('/congrats' as any)
  }

  function ExamBlock({
    which,
    label,
    value,
    setValue,
    passed,
  }: {
    which: 'theory' | 'practical'
    label: string
    value: string
    setValue: (s: string) => void
    passed: boolean | null | undefined
  }) {
    const left = value && isDate(value) ? daysUntil(value) : null
    const isPast = left !== null && left < 0
    return (
      <Card className="gap-3">
        <View className="flex-row items-center gap-2">
          <GraduationCap size={18} color="#00FF24" />
          <Text className="font-semibold text-neutral-100">{label}</Text>
        </View>

        {left !== null && left >= 0 ? (
          <Text className="text-3xl font-extrabold text-brand">
            {left === 0 ? t('exam.today') : t('exam.countdown', { days: left })}
          </Text>
        ) : null}

        <TextField
          label={t('exam.dateHint')}
          value={value}
          onChangeText={setValue}
          placeholder="2026-09-15"
          autoCapitalize="none"
          onBlur={() => saveDate(which, value)}
        />

        {/* Passed? prompt once the date has passed */}
        {isPast && (passed === null || passed === undefined) ? (
          <View className="gap-2">
            <Text className="text-sm font-semibold text-neutral-300">
              {t('exam.passedQ')}
            </Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setPassed(which, true)}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-brand py-3"
              >
                <Check size={16} color="#0A0A0A" />
                <Text className="font-bold text-ink">{t('common.yes')}</Text>
              </Pressable>
              <Pressable
                onPress={() => setPassed(which, false)}
                className="flex-row items-center justify-center gap-1.5 rounded-xl border border-neutral-700 px-5 py-3"
              >
                <X size={16} color="#6B7280" />
                <Text className="font-semibold text-neutral-400">{t('common.no')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {passed === true ? (
          <Text className="font-bold text-brand">{t('exam.congrats')}</Text>
        ) : null}
        {passed === false ? (
          <Text className="text-neutral-400">{t('exam.notPassed')}</Text>
        ) : null}
      </Card>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('exam.title'),
          headerStyle: { backgroundColor: '#0A0A0A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '800' },
        }}
      />
      <ScrollView contentContainerClassName="p-5 gap-4">
        <ExamBlock
          which="theory"
          label={t('exam.theory')}
          value={theory}
          setValue={setTheory}
          passed={profile?.theory_passed}
        />
        <ExamBlock
          which="practical"
          label={t('exam.practical')}
          value={practical}
          setValue={setPractical}
          passed={profile?.practical_passed}
        />
        <Button label={t('common.save')} onPress={() => {
          saveDate('theory', theory)
          saveDate('practical', practical)
        }} />
      </ScrollView>
    </SafeAreaView>
  )
}
