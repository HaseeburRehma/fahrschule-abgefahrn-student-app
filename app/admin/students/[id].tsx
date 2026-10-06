import React, { useEffect, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { CalendarDots as CalendarDays } from 'phosphor-react-native/src/icons/CalendarDots'
import { FileText } from 'phosphor-react-native/src/icons/FileText'
import { GraduationCap } from 'phosphor-react-native/src/icons/GraduationCap'
import { Minus } from 'phosphor-react-native/src/icons/Minus'
import { Plus } from 'phosphor-react-native/src/icons/Plus'

import { useTranslation } from '@/lib/i18n'
import {
  fetchProfile,
  fetchPackages,
  fetchTopics,
  fetchStudentPackageIds,
  updateStudent,
  setStudentPackages,
  deleteStudent,
  LICENSE_CLASSES,
} from '@/lib/admin'
import { fetchMyClasses, splitByTime } from '@/lib/data'
import {
  fetchStudentDocuments,
  openDocumentExternally,
  type AdminDocRow,
} from '@/lib/documents'
import { formatDate, formatDateTime } from '@/lib/format'
import { Button, Card, ErrorText, Loader, TextField } from '@/components/ui'
import { ChipSelect, PackagePicker, TopicPicker } from '@/components/admin-pickers'
import { deDateToIso, isoToDeDate, maskDeDate } from '@/components/theory/dates'
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

type Tri = 'open' | 'passed' | 'failed'
const toTri = (b: boolean | null | undefined): Tri =>
  b === true ? 'passed' : b === false ? 'failed' : 'open'
const fromTri = (v: Tri): boolean | null =>
  v === 'passed' ? true : v === 'failed' ? false : null

export default function EditStudent() {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [packages, setPackages] = useState<Package[]>([])
  const [topics, setTopics] = useState<TheoryTopic[]>([])
  const [classes, setClasses] = useState<TheoryClass[]>([])
  const [docs, setDocs] = useState<AdminDocRow[]>([])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [active, setActive] = useState(true)
  const [topicId, setTopicId] = useState<string | null>(null)
  const [pkgIds, setPkgIds] = useState<string[]>([])

  // Training progress (shown to the student in the app)
  const [lessons, setLessons] = useState(0)
  const [autobahn, setAutobahn] = useState(false)
  const [night, setNight] = useState(false)
  const [overland, setOverland] = useState(false)
  const [licenseClass, setLicenseClass] = useState('B')
  const [theoryDate, setTheoryDate] = useState('')
  const [practicalDate, setPracticalDate] = useState('')
  const [theoryResult, setTheoryResult] = useState<Tri>('open')
  const [practicalResult, setPracticalResult] = useState<Tri>('open')

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    ;(async () => {
      setLoading(true)
      try {
        const [p, pkgs, tps, mine, cls, personal] = await Promise.all([
          fetchProfile(id),
          fetchPackages(),
          fetchTopics(),
          fetchStudentPackageIds(id),
          fetchMyClasses(id),
          fetchStudentDocuments(id).catch(() => [] as AdminDocRow[]),
        ])
        setDocs(personal)
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
          setLessons(p.driving_lessons_count ?? 0)
          setAutobahn(!!p.drive_autobahn)
          setNight(!!p.drive_night)
          setOverland(!!p.drive_overland)
          setLicenseClass(p.license_class || 'B')
          setTheoryDate(isoToDeDate(p.theory_exam_date))
          setPracticalDate(isoToDeDate(p.practical_exam_date))
          setTheoryResult(toTri(p.theory_passed))
          setPracticalResult(toTri(p.practical_passed))
        } else {
          setError(t('admin.v2.loadError'))
        }
      } catch (e: any) {
        setError(e?.message ?? t('admin.v2.loadError'))
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  function togglePkg(pid: string) {
    setPkgIds((prev) =>
      prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid],
    )
  }

  async function save() {
    if (!id || busy) return
    setError(null)
    const theoryIso = theoryDate.trim() ? deDateToIso(theoryDate) : null
    const practicalIso = practicalDate.trim() ? deDateToIso(practicalDate) : null
    if ((theoryDate.trim() && !theoryIso) || (practicalDate.trim() && !practicalIso)) {
      setError(t('admin.v2.badExamDate'))
      return
    }
    const cls = licenseClass.trim().toUpperCase()
    if (!cls) {
      setError(t('admin.v2.badLicenseClass'))
      return
    }
    setBusy(true)
    try {
      await updateStudent(id, {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        phone: phone.trim() || null,
        is_active: active,
        current_theory_topic_id: topicId,
        driving_lessons_count: lessons,
        drive_autobahn: autobahn,
        drive_night: night,
        drive_overland: overland,
        license_class: cls,
        theory_exam_date: theoryIso,
        practical_exam_date: practicalIso,
        theory_passed: fromTri(theoryResult),
        practical_passed: fromTri(practicalResult),
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
    if (!id || busy) return
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
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader />
  if (!profile)
    return (
      <SafeAreaView className="flex-1 bg-black p-5" edges={['bottom']}>
        <Stack.Screen options={{ title: t('admin.editStudent') }} />
        <ErrorText>{error ?? t('admin.v2.loadError')}</ErrorText>
      </SafeAreaView>
    )

  const triOptions: { value: Tri; label: string }[] = [
    { value: 'open', label: t('admin.v2.result.open') },
    { value: 'passed', label: t('admin.v2.result.passed') },
    { value: 'failed', label: t('admin.v2.result.failed') },
  ]
  const classOptions = [...LICENSE_CLASSES, ...(LICENSE_CLASSES as readonly string[]).includes(licenseClass) ? [] : [licenseClass]]
    .map((c) => ({ value: c, label: c }))
  const drives: { label: string; value: boolean; set: (v: boolean) => void }[] = [
    { label: t('admin.v2.drive.autobahn'), value: autobahn, set: setAutobahn },
    { label: t('admin.v2.drive.night'), value: night, set: setNight },
    { label: t('admin.v2.drive.overland'), value: overland, set: setOverland },
  ]

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.editStudent') }} />
      <ScrollView contentContainerClassName="p-5 gap-4">
        <Card className="gap-3">
          <Text className="font-m-regular text-sm text-neutral-400">{profile.email}</Text>
          {profile.birth_date ? (
            <Text className="font-m-regular text-sm text-neutral-400">
              {t('admin.v2.birthDate')}: {isoToDeDate(profile.birth_date)}
            </Text>
          ) : null}
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
            <Text className="font-m-semibold text-neutral-200">
              {t('admin.active')}
            </Text>
            <Switch
              value={active}
              onValueChange={setActive}
              trackColor={{ true: '#00FF24', false: '#D4D4D4' }}
            />
          </View>
        </Card>

        {/* Training progress — what the student sees on their progress screen */}
        <Card className="gap-4">
          <View className="flex-row items-center gap-2">
            <GraduationCap size={16} color="#00FF24" />
            <Text className="text-sm font-m-bold text-neutral-300">
              {t('admin.v2.progress')}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="font-m-semibold text-neutral-200">{t('admin.v2.lessons')}</Text>
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => setLessons((n) => Math.max(0, n - 1))}
                disabled={busy || lessons <= 0}
                className={`h-9 w-9 items-center justify-center rounded-full border border-neutral-700 ${busy || lessons <= 0 ? 'opacity-40' : ''}`}
              >
                <Minus size={16} color="#FFFFFF" />
              </Pressable>
              <Text className="min-w-[32px] text-center text-lg font-m-xbold text-brand">
                {lessons}
              </Text>
              <Pressable
                onPress={() => setLessons((n) => Math.min(999, n + 1))}
                disabled={busy}
                className={`h-9 w-9 items-center justify-center rounded-full border border-neutral-700 ${busy ? 'opacity-40' : ''}`}
              >
                <Plus size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-sm font-m-semibold text-neutral-300">
              {t('admin.v2.specialDrives')}
            </Text>
            {drives.map((d) => (
              <View key={d.label} className="flex-row items-center justify-between">
                <Text className="font-m-regular text-neutral-200">{d.label}</Text>
                <Switch
                  value={d.value}
                  onValueChange={d.set}
                  disabled={busy}
                  trackColor={{ true: '#00FF24', false: '#D4D4D4' }}
                />
              </View>
            ))}
          </View>

          <View className="gap-2">
            <Text className="text-sm font-m-semibold text-neutral-300">
              {t('admin.v2.licenseClass')}
            </Text>
            <ChipSelect
              options={classOptions}
              selected={licenseClass}
              onSelect={setLicenseClass}
              disabled={busy}
            />
          </View>
        </Card>

        <Card className="gap-4">
          <Text className="text-sm font-m-bold text-neutral-300">{t('admin.v2.exams')}</Text>
          <View className="gap-2">
            <Text className="font-m-semibold text-neutral-200">{t('admin.v2.theoryExam')}</Text>
            <TextField
              label={t('admin.v2.examDate')}
              value={theoryDate}
              onChangeText={(v) => setTheoryDate(maskDeDate(v))}
              placeholder="22.10.2026"
              keyboardType="number-pad"
              maxLength={10}
              editable={!busy}
            />
            <ChipSelect
              options={triOptions}
              selected={theoryResult}
              onSelect={setTheoryResult}
              disabled={busy}
            />
          </View>
          <View className="gap-2">
            <Text className="font-m-semibold text-neutral-200">{t('admin.v2.practicalExam')}</Text>
            <TextField
              label={t('admin.v2.examDate')}
              value={practicalDate}
              onChangeText={(v) => setPracticalDate(maskDeDate(v))}
              placeholder="22.10.2026"
              keyboardType="number-pad"
              maxLength={10}
              editable={!busy}
            />
            <ChipSelect
              options={triOptions}
              selected={practicalResult}
              onSelect={setPracticalResult}
              disabled={busy}
            />
          </View>
        </Card>

        <Card className="gap-3">
          <Text className="text-sm font-m-bold text-neutral-300">
            {t('admin.assignTopic')}
          </Text>
          <TopicPicker topics={topics} selected={topicId} onSelect={setTopicId} />
        </Card>

        <Card className="gap-3">
          <Text className="text-sm font-m-bold text-neutral-300">
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
            <CalendarDays size={16} color="#00FF24" />
            <Text className="text-sm font-m-bold text-neutral-300">
              {t('admin.enrolledClasses')}
            </Text>
          </View>
          {classes.length ? (
            classes.map((c) => (
              <View
                key={c.id}
                className="rounded-xl bg-neutral-800 px-3 py-2"
              >
                <Text className="text-sm font-m-semibold text-neutral-100">
                  {locale === 'de' ? c.title_de : c.title_en}
                </Text>
                <Text className="font-m-regular text-xs text-neutral-400">
                  {formatDateTime(c.starts_at, locale)}
                  {c.location ? ` • ${c.location}` : ''}
                </Text>
              </View>
            ))
          ) : (
            <Text className="font-m-regular text-sm text-neutral-500">
              {t('admin.noClassesEnrolled')}
            </Text>
          )}
        </Card>

        {/* Personal documents (read-only; upload from the Documents screen) */}
        <Card className="gap-2">
          <View className="flex-row items-center gap-2">
            <FileText size={16} color="#00FF24" />
            <Text className="text-sm font-m-bold text-neutral-300">
              {t('admin.v2.personalDocs')}
            </Text>
          </View>
          {docs.length ? (
            docs.map((d) => (
              <Pressable
                key={d.id}
                onPress={async () => {
                  if (!(await openDocumentExternally(d.path))) notify(t('admin.v2.docOpenError'))
                }}
                className="rounded-xl bg-neutral-800 px-3 py-2"
              >
                <Text className="text-sm font-m-semibold text-neutral-100">{d.title}</Text>
                <Text className="font-m-regular text-xs text-neutral-400">
                  {formatDate(d.created_at, locale)}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text className="font-m-regular text-sm text-neutral-500">{t('admin.v2.noPersonalDocs')}</Text>
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
