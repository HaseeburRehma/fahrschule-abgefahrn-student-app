import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { BookOpen, Car, Check, Minus, Plus } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import {
  fetchMyDoneTopics,
  fetchTheoryTopics,
  updateMyProfile,
} from '@/lib/data'
import { Card } from '@/components/ui'

export default function ProgressScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { profile, session, refreshProfile } = useUser()
  const uid: string | null = session?.user?.id ?? null

  const [doneTopics, setDoneTopics] = useState(0)
  const [totalTopics, setTotalTopics] = useState(14)
  const [lessons, setLessons] = useState(profile?.driving_lessons_count ?? 0)
  const [autobahn, setAutobahn] = useState(profile?.drive_autobahn ?? false)
  const [night, setNight] = useState(profile?.drive_night ?? false)
  const [overland, setOverland] = useState(profile?.drive_overland ?? false)

  useEffect(() => {
    setLessons(profile?.driving_lessons_count ?? 0)
    setAutobahn(profile?.drive_autobahn ?? false)
    setNight(profile?.drive_night ?? false)
    setOverland(profile?.drive_overland ?? false)
  }, [profile])

  useFocusEffect(
    useCallback(() => {
      if (!uid) return
      Promise.all([fetchMyDoneTopics(uid), fetchTheoryTopics()])
        .then(([done, all]) => {
          setDoneTopics(done.size)
          setTotalTopics(all.length || 14)
        })
        .catch(() => {})
    }, [uid]),
  )

  async function saveLessons(next: number) {
    if (!uid) return
    const v = Math.max(0, next)
    setLessons(v)
    await updateMyProfile(uid, { driving_lessons_count: v }).catch(() => {})
    refreshProfile()
  }

  async function toggleDrive(
    key: 'drive_autobahn' | 'drive_night' | 'drive_overland',
    val: boolean,
    setter: (b: boolean) => void,
  ) {
    if (!uid) return
    setter(val)
    await updateMyProfile(uid, { [key]: val } as any).catch(() => {})
    refreshProfile()
  }

  const specialDone = [autobahn, night, overland].filter(Boolean).length
  const overall = Math.round(
    ((doneTopics + specialDone) / (totalTopics + 3)) * 100,
  )

  const DriveCheck = ({
    label,
    value,
    onToggle,
  }: {
    label: string
    value: boolean
    onToggle: (b: boolean) => void
  }) => (
    <Pressable
      onPress={() => onToggle(!value)}
      className={`flex-row items-center gap-3 rounded-xl border px-3 py-3 ${
        value ? 'border-brand bg-brand/10' : 'border-neutral-800 bg-neutral-900'
      }`}
    >
      <View
        className={`h-6 w-6 items-center justify-center rounded-md border ${
          value ? 'border-brand bg-brand' : 'border-neutral-600'
        }`}
      >
        {value ? <Check size={15} color="#0A0A0A" /> : null}
      </View>
      <Text className="flex-1 font-medium text-neutral-100">{label}</Text>
    </Pressable>
  )

  return (
    <SafeAreaView className="flex-1 bg-black">
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('progress.title'),
          headerStyle: { backgroundColor: '#0A0A0A' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '800' },
        }}
      />
      <ScrollView contentContainerClassName="p-5 gap-4">
        {/* Overall */}
        <Card className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-neutral-400">
              {t('progress.overall')}
            </Text>
            <Text className="text-lg font-extrabold text-brand">{overall}%</Text>
          </View>
          <View className="h-3 w-full overflow-hidden rounded-full bg-neutral-800">
            <View className="h-full rounded-full bg-brand" style={{ width: `${overall}%` }} />
          </View>
        </Card>

        {/* Theory topics */}
        <Pressable onPress={() => router.push('/(tabs)/theory')}>
          <Card className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <BookOpen size={20} color="#00FF24" />
            </View>
            <Text className="flex-1 font-semibold text-neutral-100">
              {t('progress.topics')}
            </Text>
            <Text className="font-bold text-neutral-100">
              {doneTopics}/{totalTopics}
            </Text>
          </Card>
        </Pressable>

        {/* Driving lessons counter */}
        <Card className="gap-3">
          <View className="flex-row items-center gap-2">
            <Car size={18} color="#00FF24" />
            <Text className="text-sm font-semibold text-neutral-400">
              {t('progress.lessons')}
            </Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => saveLessons(lessons - 1)}
              className="h-11 w-11 items-center justify-center rounded-full bg-neutral-800"
            >
              <Minus size={20} color="#FFFFFF" />
            </Pressable>
            <Text className="text-3xl font-extrabold text-neutral-100">{lessons}</Text>
            <Pressable
              onPress={() => saveLessons(lessons + 1)}
              className="h-11 w-11 items-center justify-center rounded-full bg-brand"
            >
              <Plus size={20} color="#0A0A0A" />
            </Pressable>
          </View>
        </Card>

        {/* Special drives */}
        <Card className="gap-2">
          <Text className="text-sm font-semibold text-neutral-400">
            {t('progress.special')} ({specialDone}/3)
          </Text>
          <DriveCheck
            label={t('progress.autobahn')}
            value={autobahn}
            onToggle={(v) => toggleDrive('drive_autobahn', v, setAutobahn)}
          />
          <DriveCheck
            label={t('progress.night')}
            value={night}
            onToggle={(v) => toggleDrive('drive_night', v, setNight)}
          />
          <DriveCheck
            label={t('progress.overland')}
            value={overland}
            onToggle={(v) => toggleDrive('drive_overland', v, setOverland)}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  )
}
