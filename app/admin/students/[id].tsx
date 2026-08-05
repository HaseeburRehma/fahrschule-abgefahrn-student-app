import React, { useEffect, useState } from 'react'
import { Alert, Platform, ScrollView, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { CalendarDays } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import {
  fetchProfile,
  fetchPackages,
  fetchTopics,
  fetchStudentPackageIds,
  updateStudent,
  setStudentPackages,
  deleteStudent,
} from '@/lib/admin'
import { fetchMyClasses, splitByTime } from '@/lib/data'
import { formatDateTime } from '@/lib/format'
import { Button, Card, ErrorText, Loader, TextField } from '@/components/ui'
import { PackagePicker, TopicPicker } from '@/components/admin-pickers'
import type { Package, Profile, TheoryClass, TheoryTopic } from '@/lib/types'

function notify(msg: string) {
  if (Platform.OS === 'web') window.alert(msg)
  else Alert.alert(msg)
}

function confirmDelete(msg: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(msg))
  return new Promise((resolve) =>
    Alert.alert('', msg, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', style: 'destructive', onPress: () => resolve(true) },
    ]),
  )
}

export default function EditStudent() {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [packages, setPackages] = useState<Package[]>([])
  const [topics, setTopics] = useState<TheoryTopic[]>([])
  const [classes, setClasses] = useState<TheoryClass[]>([])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [active, setActive] = useState(true)
  const [topicId, setTopicId] = useState<string | null>(null)
  const [pkgIds, setPkgIds] = useState<string[]>([])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const [p, pkgs, tps, mine, cls] = await Promise.all([
          fetchProfile(id),
          fetchPackages(),
          fetchTopics(),
          fetchStudentPackageIds(id),
          fetchMyClasses(id),
        ])
        setPackages(pkgs)
        setTopics(tps)
        setPkgIds(mine)
        const { upcoming, past } = splitByTime(cls)
        setClasses([...upcoming, ...past])
        if (p) {
          setProfile(p)
          setFirstName(p.first_name ?? '')
          setLastName(p.last_name ?? '')
          setPhone(p.phone ?? '')
          setActive(p.is_active)
          setTopicId(p.current_theory_topic_id)
        }
      } catch (e: any) {
        setError(e?.message ?? t('common.error'))
      }
    })()
  }, [id])

  function togglePkg(pid: string) {
    setPkgIds((prev) =>
      prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid],
    )
  }

  async function save() {
    if (!id) return
    setError(null)
    setBusy(true)
    try {
      await updateStudent(id, {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        phone: phone.trim() || null,
        is_active: active,
        current_theory_topic_id: topicId,
      })
      await setStudentPackages(id, pkgIds)
      notify(t('common.saved'))
      router.back()
    } catch (e: any) {
      setError(e?.message ?? t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  async function del() {
    if (!id) return
    const ok = await confirmDelete(t('admin.deleteConfirm'))
    if (!ok) return
    setError(null)
    setBusy(true)
    try {
      await deleteStudent(id)
      notify(t('admin.deleted'))
      router.back()
    } catch (e: any) {
      setError(e?.message ?? t('common.error'))
      setBusy(false)
    }
  }

  if (!profile) return <Loader />

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.editStudent') }} />
      <ScrollView contentContainerClassName="p-5 gap-4">
        <Card className="gap-3">
          <Text className="text-sm text-neutral-400">{profile.email}</Text>
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
          <View className="flex-row items-center justify-between pt-1">
            <Text className="font-semibold text-neutral-200">
              {t('admin.active')}
            </Text>
            <Switch
              value={active}
              onValueChange={setActive}
              trackColor={{ true: '#22C55E', false: '#D4D4D4' }}
            />
          </View>
        </Card>

        <Card className="gap-3">
          <Text className="text-sm font-bold text-neutral-300">
            {t('admin.assignTopic')}
          </Text>
          <TopicPicker topics={topics} selected={topicId} onSelect={setTopicId} />
        </Card>

        <Card className="gap-3">
          <Text className="text-sm font-bold text-neutral-300">
            {t('admin.assignPackages')}
          </Text>
          <PackagePicker
            packages={packages}
            selected={pkgIds}
            onToggle={togglePkg}
          />
        </Card>

        {/* Enrolled theory classes (read-only; manage from a class screen) */}
        <Card className="gap-2">
          <View className="flex-row items-center gap-2">
            <CalendarDays size={16} color="#22C55E" />
            <Text className="text-sm font-bold text-neutral-300">
              {t('admin.enrolledClasses')}
            </Text>
          </View>
          {classes.length ? (
            classes.map((c) => (
              <View
                key={c.id}
                className="rounded-xl bg-neutral-800 px-3 py-2"
              >
                <Text className="text-sm font-semibold text-neutral-100">
                  {locale === 'de' ? c.title_de : c.title_en}
                </Text>
                <Text className="text-xs text-neutral-400">
                  {formatDateTime(c.starts_at, locale)}
                  {c.location ? ` • ${c.location}` : ''}
                </Text>
              </View>
            ))
          ) : (
            <Text className="text-sm text-neutral-500">
              {t('admin.noClassesEnrolled')}
            </Text>
          )}
        </Card>

        <ErrorText>{error}</ErrorText>
        <Button label={t('common.save')} onPress={save} loading={busy} />
        <Button
          label={t('admin.delete')}
          onPress={del}
          disabled={busy}
          variant="danger"
        />
      </ScrollView>
    </SafeAreaView>
  )
}
