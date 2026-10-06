/** Figma "DE/Fortschritt" (1277:1284) · EN 1296:2145. */

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Pressable, RefreshControl, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { BookOpen } from 'phosphor-react-native/src/icons/BookOpen'
import { Car } from 'phosphor-react-native/src/icons/Car'
import { Check } from 'phosphor-react-native/src/icons/Check'
import { Fire } from 'phosphor-react-native/src/icons/Fire'
import { GraduationCap } from 'phosphor-react-native/src/icons/GraduationCap'
import { LockSimple } from 'phosphor-react-native/src/icons/LockSimple'
import { Minus } from 'phosphor-react-native/src/icons/Minus'
import { Plus } from 'phosphor-react-native/src/icons/Plus'
import { RoadHorizon } from 'phosphor-react-native/src/icons/RoadHorizon'
import { SteeringWheel } from 'phosphor-react-native/src/icons/SteeringWheel'
import { Trophy } from 'phosphor-react-native/src/icons/Trophy'

import { C, Card, ErrorState, HeroTitle, LoadingScreenSkeleton, Screen, T, useToast } from '@/components/ds'
import { ProgressBar } from '@/components/home/progress-ring'
import { SpecialDrivesSheet } from '@/components/home/special-drives-sheet'
import {
  TOTAL_ETAPPEN,
  computeJourney,
  loadTheoryCounts,
  longDate,
  type Journey,
  type StageKey,
  type StageState,
} from '@/components/home/journey'
import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { updateMyProfile } from '@/lib/data'
import { useRequestGuard } from '@/lib/use-request-guard'

const AMBER = '#FFC83D'
const AMBER_BG = '#2A2410'
const AMBER_LINE = '#3A3410'
const NODE = 42
/** Sanity cap for the self-reported lesson counter. */
const MAX_LESSONS = 999
const ROW_GAP = 20
const GREEN_GLOW = {
  shadowColor: C.brand,
  shadowOpacity: 0.5,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 0 },
} as const

const ICONS: Record<StageKey, PhosphorIcon> = {
  signup: Check,
  theory: BookOpen,
  lessons: SteeringWheel,
  theoryExam: GraduationCap,
  special: RoadHorizon,
  practicalExam: Car,
  license: Trophy,
}

export default function ProgressScreen() {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const { profile, session, refreshProfile } = useUser()
  const uid = session?.user?.id ?? profile?.id ?? null

  const [theory, setTheory] = useState<{ done: number; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [lessons, setLessons] = useState<number | null>(null)
  const [savingLessons, setSavingLessons] = useState(false)
  const savingLessonsRef = useRef(false)
  const loadedOnce = useRef(false)
  const guard = useRequestGuard()

  /** Resolves to false when the request failed (pull-to-refresh shows a toast). */
  const load = useCallback(async (): Promise<boolean> => {
    const req = guard.begin()
    if (!uid) {
      setLoading(false)
      return true
    }
    try {
      const counts = await loadTheoryCounts(uid)
      if (!guard.isCurrent(req)) return true
      setTheory(counts)
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
      const [ok] = await Promise.all([load(), refreshProfile().catch(() => {})])
      if (!ok) toast.show(t('ds.error.refresh'), 'error')
    } finally {
      if (guard.isMounted()) setRefreshing(false)
    }
  }, [load, refreshProfile, toast, t, guard])

  const journey = useMemo(() => {
    const p = profile && lessons !== null ? { ...profile, driving_lessons_count: lessons } : profile
    return computeJourney(p, theory?.done ?? 0, theory?.total ?? 0)
  }, [profile, theory, lessons])

  /** Students log their own driving lessons (kept from the previous progress screen). */
  const saveLessons = useCallback(
    async (next: number) => {
      // One write at a time: overlapping absolute writes could land out of order.
      if (!uid || savingLessonsRef.current) return
      const v = Math.min(MAX_LESSONS, Math.max(0, Math.floor(next)))
      savingLessonsRef.current = true
      setSavingLessons(true)
      setLessons(v)
      try {
        await updateMyProfile(uid, { driving_lessons_count: v })
        await refreshProfile()
      } catch {
        toast.show(t('ds.error.save'), 'error')
      } finally {
        savingLessonsRef.current = false
        if (guard.isMounted()) {
          setLessons(null)
          setSavingLessons(false)
        }
      }
    },
    [uid, refreshProfile, toast, t, guard],
  )

  if (loading || error) {
    return (
      // Figma state frames: no hero glow
      <Screen tabBar gap={16} contentStyle={{ paddingTop: 6 }}>
        {error ? (
          <ErrorState
            onRetry={() => {
              setError(false)
              setLoading(true)
              load()
            }}
          />
        ) : (
          <LoadingScreenSkeleton />
        )}
      </Screen>
    )
  }

  const streak = profile?.streak_days ?? 0
  const cls = (profile?.license_class ?? '').trim() || 'B'

  return (
    <Screen
      glow={-80}
      tabBar
      gap={16}
      contentStyle={{ paddingTop: 6 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
    >
      {/* Title + Klasse */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <HeroTitle line1={t('progress.v2.title1')} line2={t('progress.v2.title2')} variant1="headingXL" />
        </View>
        <View style={{ backgroundColor: C.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0 }}>
          <T variant="labelM" color={C.brand} numberOfLines={1}>{t('progress.v2.class', { cls: cls.slice(0, 6) })}</T>
        </View>
      </View>

      {/* Gesamtfortschritt */}
      <Card padding={18} style={{ gap: 14, borderColor: C.lineGreen }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="bodyS" color={C.muted}>{t('progress.v2.overall')}</T>
            <T variant="displayL" color={C.brand}>{`${journey.percent}%`}</T>
          </View>
          {streak > 0 ? (
            <View
              style={{
                backgroundColor: C.surface,
                borderRadius: 999,
                paddingLeft: 12,
                paddingRight: 14,
                paddingVertical: 9,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Fire size={20} color={AMBER} weight="fill" />
              <T variant="labelL">
                {streak === 1 ? t('progress.v2.streakDay') : t('progress.v2.streakDays', { n: streak })}
              </T>
            </View>
          ) : null}
        </View>
        <ProgressBar value={journey.percent / 100} />
        <T variant="bodyS" color={C.muted}>
          {t('progress.v2.stages', { done: journey.doneEtappen, total: TOTAL_ETAPPEN })}
        </T>
      </Card>

      <T variant="titleM">{t('progress.v2.roadmap')}</T>

      {/* Dein Fahrplan */}
      <View style={{ gap: ROW_GAP }}>
        {journey.stages.map((s, i) => {
          const nextStage = journey.stages[i + 1]
          const reached = (st?: StageState) => st === 'done' || st === 'current'
          const lineGreen = !!nextStage && reached(s.state) && reached(nextStage.state)
          return (
            <View key={s.key} style={{ flexDirection: 'row', gap: 21 }}>
              {/* connector to the next node (drawn behind the node) */}
              {nextStage ? (
                <View
                  style={[
                    {
                      position: 'absolute',
                      left: NODE / 2 - 1.5,
                      width: 3,
                      top: 6 + NODE / 2,
                      bottom: -(ROW_GAP + 6 + NODE / 2),
                      borderRadius: 2,
                      backgroundColor: lineGreen ? C.brand : C.surface,
                    },
                    lineGreen ? GREEN_GLOW : null,
                  ]}
                />
              ) : null}
              <View style={{ marginTop: 6 }}>
                <StageNode stageKey={s.key} state={s.state} />
              </View>
              <StageCard
                stageKey={s.key}
                state={s.state}
                journey={journey}
                t={t}
                locale={locale}
                onPress={s.key === 'special' ? () => setSheet(true) : s.key === 'theory' ? () => router.push('/theory' as any) : s.key === 'theoryExam' || s.key === 'practicalExam' ? () => router.push('/exams' as any) : undefined}
                right={
                  s.key === 'lessons' && s.state !== 'done' ? (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <MiniButton
                        icon={Minus}
                        label={t('progress.v2.lessonsMinus')}
                        disabled={journey.lessons <= 0 || savingLessons}
                        onPress={() => saveLessons(journey.lessons - 1)}
                      />
                      <MiniButton
                        icon={Plus}
                        label={t('progress.v2.lessonsPlus')}
                        green
                        disabled={journey.lessons >= MAX_LESSONS || savingLessons}
                        onPress={() => saveLessons(journey.lessons + 1)}
                      />
                    </View>
                  ) : null
                }
              />
            </View>
          )
        })}
      </View>

      <SpecialDrivesSheet visible={sheet} onClose={() => setSheet(false)} />
    </Screen>
  )
}

/* ------------------------------------------------------------------ pieces */

function StageNode({ stageKey, state }: { stageKey: StageKey; state: StageState }) {
  const size = NODE
  const base = { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' } as const
  if (state === 'done') {
    return (
      <View style={[base, { backgroundColor: C.brand }, GREEN_GLOW, { elevation: 4 }]}>
        <Check size={22} color={C.onBrand} weight="bold" />
      </View>
    )
  }
  if (state === 'goal') {
    return (
      <View style={[base, { backgroundColor: AMBER_BG, borderWidth: 2, borderColor: AMBER }]}>
        <Trophy size={22} color={AMBER} weight="fill" />
      </View>
    )
  }
  if (state === 'current') {
    const Icon = ICONS[stageKey]
    return (
      <View style={[base, { backgroundColor: C.tile, borderWidth: 2.5, borderColor: C.brand }, GREEN_GLOW, { elevation: 4 }]}>
        <Icon size={22} color={C.brand} weight="fill" />
      </View>
    )
  }
  const Icon = state === 'locked' ? LockSimple : ICONS[stageKey]
  return (
    <View style={[base, { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }]}>
      <Icon size={20} color={C.dim} />
    </View>
  )
}

function StageCard({
  stageKey,
  state,
  journey: j,
  t,
  locale,
  onPress,
  right,
}: {
  stageKey: StageKey
  state: StageState
  journey: Journey
  t: (k: string, v?: Record<string, string | number>) => string
  locale: 'de' | 'en'
  onPress?: () => void
  right?: React.ReactNode
}) {
  const subtitle = stageSubtitle(stageKey, state, j, t, locale)
  const subColor = state === 'goal' ? AMBER : state === 'done' || state === 'current' ? C.brand : C.dim
  return (
    <Card
      radius={20}
      padding={14}
      onPress={onPress}
      style={{ flex: 1, gap: 8, minHeight: 88, borderColor: state === 'goal' ? AMBER_LINE : C.line }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 20 }}>
        <T variant="titleM" color={state === 'locked' ? C.muted : C.white} style={{ flex: 1 }} numberOfLines={1}>
          {t(`progress.v2.stage.${stageKey}`)}
        </T>
        {right}
      </View>
      <T variant="bodyS" color={subColor}>{subtitle}</T>
    </Card>
  )
}

function stageSubtitle(
  key: StageKey,
  state: StageState,
  j: Journey,
  t: (k: string, v?: Record<string, string | number>) => string,
  locale: 'de' | 'en',
): string {
  switch (key) {
    case 'signup':
      return t('progress.v2.sub.completed')
    case 'theory':
      return t('progress.v2.sub.theory', { done: j.theoryDone, total: j.theoryTotal })
    case 'lessons':
      if (j.lessons === 0) return t('progress.v2.sub.noLessons')
      return j.lessons === 1 ? t('progress.v2.sub.lesson') : t('progress.v2.sub.lessons', { n: j.lessons })
    case 'theoryExam':
      if (state === 'done') return t('progress.v2.sub.passed')
      if (j.theoryExamDate) return t('progress.v2.sub.on', { date: longDate(j.theoryExamDate, locale) })
      if (state === 'current') return t('progress.v2.sub.ready')
      return t('progress.v2.sub.examFrom', { total: j.theoryTotal })
    case 'special':
      return t('progress.v2.sub.special', { n: j.specialDone })
    case 'practicalExam':
      if (state === 'done') return t('progress.v2.sub.passed')
      if (state === 'locked') return t('progress.v2.sub.locked')
      if (j.practicalExamDate) return t('progress.v2.sub.on', { date: longDate(j.practicalExamDate, locale) })
      return t('progress.v2.sub.ready')
    case 'license':
      return state === 'done' ? t('progress.v2.sub.licenseDone') : t('progress.v2.sub.goal')
  }
}

function MiniButton({
  icon: Icon,
  label,
  onPress,
  disabled,
  green,
}: {
  icon: PhosphorIcon
  label: string
  onPress: () => void
  disabled?: boolean
  green?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: green ? C.tile : C.surface,
        borderWidth: 1,
        borderColor: green ? C.lineGreen : C.line,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Icon size={16} color={green ? C.brand : C.white} weight="bold" />
    </Pressable>
  )
}
