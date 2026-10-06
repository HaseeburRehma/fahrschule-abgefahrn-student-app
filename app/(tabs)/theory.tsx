/**
 * Figma "Theorie" (1281:1340): progress summary + the 14 mandatory topics
 * with done / current / upcoming states. Each topic opens /theory/[id].
 */

import React, { useCallback, useRef, useState } from 'react'
import { Pressable, RefreshControl, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { BookOpen } from 'phosphor-react-native/src/icons/BookOpen'
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight'
import { Check } from 'phosphor-react-native/src/icons/Check'
import { LockSimple } from 'phosphor-react-native/src/icons/LockSimple'

import { C, EmptyState, ErrorState, PageHeader, Screen, Skeleton, T, useToast } from '@/components/ds'
import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { fetchMyDoneTopics, fetchTheoryTopics } from '@/lib/data'
import { topicTitle } from '@/lib/theory-content'
import type { TheoryTopic } from '@/lib/types'
import { useRequestGuard } from '@/lib/use-request-guard'

type TopicState = 'done' | 'current' | 'locked' | 'open'

export default function TheoryScreen() {
  const { t, locale } = useTranslation()
  const { profile, session } = useUser()
  const uid: string | null = session?.user?.id ?? null

  const [topics, setTopics] = useState<TheoryTopic[]>([])
  const [done, setDone] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const loadedOnce = useRef(false)
  const toast = useToast()
  const guard = useRequestGuard()

  /** Resolves to false when the request failed. */
  const load = useCallback(async (): Promise<boolean> => {
    const req = guard.begin()
    try {
      const [rows, doneSet] = await Promise.all([
        fetchTheoryTopics(),
        uid ? fetchMyDoneTopics(uid) : Promise.resolve(new Set<string>()),
      ])
      if (!guard.isCurrent(req)) return true
      setTopics(rows.filter((r) => r && r.id))
      setDone(doneSet)
      setError(false)
      loadedOnce.current = true
      return true
    } catch {
      if (guard.isCurrent(req) && !loadedOnce.current) setError(true)
      return false
    } finally {
      if (guard.isCurrent(req)) setLoading(false)
    }
  }, [uid, guard])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const ok = await load()
      if (!ok) toast.show(t('ds.error.refresh'), 'error')
    } finally {
      if (guard.isMounted()) setRefreshing(false)
    }
  }, [load, toast, t, guard])

  const total = topics.length
  const doneCount = topics.filter((x) => done.has(x.id)).length
  const remaining = Math.max(total - doneCount, 0)
  const pct = total ? Math.round((doneCount / total) * 100) : 0

  const currentId = profile?.current_theory_topic_id ?? null
  const currentNumber = topics.find((x) => x.id === currentId)?.number ?? null

  function stateOf(topic: TheoryTopic): TopicState {
    if (done.has(topic.id)) return 'done'
    if (topic.id === currentId) return 'current'
    if (currentNumber !== null && topic.number > currentNumber) return 'locked'
    return 'open'
  }

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} colors={[C.brand]} />

  if (loading) {
    return (
      <Screen tabBar gap={14} contentStyle={{ paddingTop: 6 }}>
        <View style={{ gap: 8 }}>
          <Skeleton width={130} height={26} />
          <Skeleton width={190} height={14} />
        </View>
        <Skeleton height={104} radius={18} />
        <Skeleton width={100} height={16} />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={64} radius={18} />
        ))}
      </Screen>
    )
  }

  if (error) {
    return (
      <Screen tabBar refreshControl={refresh}>
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

  return (
    <Screen tabBar glow={-90} gap={14} contentStyle={{ paddingTop: 6 }} refreshControl={refresh}>
      <PageHeader title={t('theory.v2.title')} subtitle={t('theory.v2.subtitle', { total: total || 14 })} />

      {total === 0 ? (
        <EmptyState icon={BookOpen} title={t('theory.v2.empty.title')} body={t('theory.v2.empty.body')} />
      ) : (
        <>
          {/* Progress summary */}
          <View
            style={{
              backgroundColor: C.card,
              borderWidth: 1,
              borderColor: C.lineGreen,
              borderRadius: 18,
              padding: 18,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1, gap: 1 }}>
                <T variant="titleM">{t('theory.v2.summary', { done: doneCount, total })}</T>
                <T variant="bodyS" color={C.muted}>
                  {remaining > 0 ? t('theory.v2.remaining', { n: remaining }) : t('theory.v2.allDone')}
                </T>
              </View>
              <T variant="displayL" color={C.brand}>{`${pct}%`}</T>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: C.surface, overflow: 'visible' }}>
              {pct > 0 ? (
                <View
                  style={{
                    width: `${pct}%`,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: C.brand,
                    shadowColor: C.brand,
                    shadowOpacity: 0.45,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 0 },
                  }}
                />
              ) : null}
            </View>
          </View>

          <T variant="titleM">{t('theory.v2.allTopics')}</T>

          <View style={{ gap: 10 }}>
            {topics.map((topic) => {
              const st = stateOf(topic)
              return (
              <TopicRow
                key={topic.id}
                number={topic.number}
                title={topicTitle(topic, locale)}
                state={st}
                label={t(`theory.v2.state.${st}`)}
                onPress={() => router.push(`/theory/${topic.id}` as any)}
              />
              )
            })}
          </View>
        </>
      )}
    </Screen>
  )
}

function TopicRow({
  number,
  title,
  state,
  label,
  onPress,
}: {
  number: number
  title: string
  state: TopicState
  label: string
  onPress: () => void
}) {
  const current = state === 'current'
  const isDone = state === 'done'
  const locked = state === 'locked'

  const circle = isDone ? (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: C.brand,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: C.brand,
        shadowOpacity: 0.45,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
        elevation: 4,
      }}
    >
      <Check size={20} color={C.onBrand} weight="bold" />
    </View>
  ) : current ? (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: C.tile,
        borderWidth: 2,
        borderColor: C.brand,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: C.brand,
        shadowOpacity: 0.45,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
        elevation: 4,
      }}
    >
      <T variant="labelL" color={C.brand}>{String(number)}</T>
    </View>
  ) : (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.line,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <T variant="labelL" color={C.dim}>{String(number)}</T>
    </View>
  )

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${number}. ${title} – ${label}`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: current ? 11.5 : 12,
          borderRadius: 18,
          backgroundColor: C.card,
          borderWidth: current ? 1.5 : 1,
          borderColor: current ? C.brand : C.line,
        },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      {circle}
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="titleM" color={isDone || current ? C.white : C.muted}>{title}</T>
        <T variant="caption" color={current ? C.brand : C.dim}>{label}</T>
      </View>
      {locked ? <LockSimple size={20} color={C.dim} /> : <CaretRight size={20} color={C.dim} />}
    </Pressable>
  )
}
