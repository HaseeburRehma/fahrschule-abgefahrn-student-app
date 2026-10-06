/**
 * Figma "Theorie Detail" (1304:2427 / EN 1314:3266): topic number + state,
 * title, description, learn points, linked theory class, mark-as-done.
 */

import React, { useCallback, useRef, useState } from 'react'
import { View } from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { BookOpen } from 'phosphor-react-native/src/icons/BookOpen'
import { CalendarDots } from 'phosphor-react-native/src/icons/CalendarDots'
import { Check } from 'phosphor-react-native/src/icons/Check'
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle'

import { Button, C, Card, EmptyState, ErrorState, Pill, Screen, Skeleton, T, TopBar, useToast } from '@/components/ds'
import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { fetchMyClasses, fetchMyDoneTopics, fetchTopicById, setTopicDone, splitByTime } from '@/lib/data'
import { topicDetail, topicTitle } from '@/lib/theory-content'
import type { TheoryClass, TheoryTopic } from '@/lib/types'
import { hhmm, shortDate } from '@/components/theory/dates'
import { useRequestGuard } from '@/lib/use-request-guard'

/** Button renders its icons with weight="bold"; Figma uses the filled check-circle here. */
const CheckCircleFill = ((props: any) => <CheckCircle {...props} weight="fill" />) as unknown as PhosphorIcon

export default function TheoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t, locale } = useTranslation()
  const { profile, session } = useUser()
  const toast = useToast()
  const uid: string | null = session?.user?.id ?? null

  const [topic, setTopic] = useState<TheoryTopic | null>(null)
  const [isDone, setIsDone] = useState(false)
  const [nextClass, setNextClass] = useState<TheoryClass | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const loadedOnce = useRef(false)
  const guard = useRequestGuard()
  const topicId = Array.isArray(id) ? id[0] : id

  const load = useCallback(async () => {
    const req = guard.begin()
    if (!topicId) {
      setLoading(false)
      return
    }
    try {
      const row = await fetchTopicById(String(topicId))
      const [doneSet, classes] =
        uid && row
          ? await Promise.all([
              fetchMyDoneTopics(uid).catch(() => null),
              fetchMyClasses(uid).catch(() => [] as TheoryClass[]),
            ])
          : [null, [] as TheoryClass[]]
      // ignore stale results (refocus while loading) and don't clobber an in-flight toggle
      if (!guard.isCurrent(req)) return
      setTopic(row)
      setError(false)
      loadedOnce.current = true
      if (row) {
        if (doneSet && !savingRef.current) setIsDone(doneSet.has(row.id))
        const { upcoming } = splitByTime(classes.filter((c) => c.topic_id === row.id))
        setNextClass(upcoming[0] ?? null)
      }
    } catch {
      // keep the content on a failed background refetch
      if (guard.isCurrent(req) && !loadedOnce.current) setError(true)
    } finally {
      if (guard.isCurrent(req)) setLoading(false)
    }
  }, [topicId, uid, guard])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  async function toggleDone() {
    if (!uid || !topic || savingRef.current) return
    const next = !isDone
    savingRef.current = true
    setSaving(true)
    setIsDone(next) // optimistic
    try {
      await setTopicDone(uid, topic.id, next)
      if (guard.isMounted()) toast.show(next ? t('theory.v2.markedDone') : t('theory.v2.markedUndone'), 'success')
    } catch {
      if (guard.isMounted()) {
        setIsDone(!next)
        toast.show(t('theory.v2.saveError'), 'error')
      }
    } finally {
      savingRef.current = false
      if (guard.isMounted()) setSaving(false)
    }
  }

  if (loading) {
    return (
      <Screen glow={-30} header={<TopBar />} gap={16}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Skeleton width={84} height={28} radius={999} />
          <Skeleton width={90} height={28} radius={999} />
        </View>
        <Skeleton width="80%" height={34} />
        <Skeleton height={140} radius={20} />
        <Skeleton height={200} radius={20} />
      </Screen>
    )
  }

  if (error) {
    return (
      <Screen glow={-30} header={<TopBar />}>
        <ErrorState
          onRetry={() => {
            setError(false)
            setLoading(true)
            load()
          }}
        />
      </Screen>
    )
  }

  if (!topic) {
    return (
      <Screen glow={-30} header={<TopBar />}>
        <EmptyState icon={BookOpen} title={t('theory.v2.notFound.title')} body={t('theory.v2.notFound.body')} />
      </Screen>
    )
  }

  const isCurrent = topic.id === profile?.current_theory_topic_id
  const { description, learnPoints } = topicDetail(topic, locale)
  const parsedStart = nextClass ? new Date(nextClass.starts_at) : null
  const classStart = parsedStart && !isNaN(parsedStart.getTime()) ? parsedStart : null

  return (
    <Screen
      glow={-30}
      header={<TopBar title={t('theory.v2.topicN', { n: topic.number })} />}
      gap={16}
      footer={
        <Button
          label={isDone ? t('theory.v2.markUndone') : t('theory.v2.markDone')}
          variant={isDone ? 'secondary' : 'primary'}
          iconLeft={isDone ? undefined : CheckCircleFill}
          loading={saving}
          onPress={toggleDone}
          style={{ marginHorizontal: 4 }}
        />
      }
    >
      {/* Number / state + title */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Pill tone="neutral" label={t('theory.v2.topicN', { n: topic.number })} />
          {isDone ? (
            <Pill tone="green" label={t('theory.v2.state.done')} />
          ) : isCurrent ? (
            <Pill tone="green" label={t('theory.v2.state.current')} />
          ) : null}
        </View>
        <T variant="displayL">{topicTitle(topic, locale)}</T>
      </View>

      {/* Worum geht's? */}
      {description ? (
        <Card style={{ gap: 8 }}>
          <T variant="titleM">{t('theory.v2.about')}</T>
          <T variant="bodyL" color={C.muted}>{description}</T>
        </Card>
      ) : null}

      {/* Das lernst du */}
      {learnPoints.length ? (
        <Card style={{ gap: 14 }}>
          <T variant="titleM">{t('theory.v2.learn')}</T>
          {learnPoints.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: C.tile,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={15} color={C.brand} weight="bold" />
              </View>
              <T variant="bodyL" style={{ flex: 1 }}>{p}</T>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Gehört zur Theoriestunde */}
      {classStart ? (
        <Card radius={16} padding={0} style={{ paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 13,
              backgroundColor: C.tile,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CalendarDots size={20} color={C.brand} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="caption" color={C.dim}>{t('theory.v2.classLabel')}</T>
            <T variant="titleM">
              {t('theory.v2.classAt', { date: shortDate(classStart, locale), time: hhmm(classStart) })}
            </T>
          </View>
        </Card>
      ) : null}
    </Screen>
  )
}
