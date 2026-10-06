/** Figma "DE/Home" (1276:1288) · EN 1296:1982. */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, RefreshControl, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { Bell } from 'phosphor-react-native/src/icons/Bell'
import { BookOpen } from 'phosphor-react-native/src/icons/BookOpen'
import { CalendarDots } from 'phosphor-react-native/src/icons/CalendarDots'
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight'
import { ChatCircleDots } from 'phosphor-react-native/src/icons/ChatCircleDots'
import { Check } from 'phosphor-react-native/src/icons/Check'
import { Clock } from 'phosphor-react-native/src/icons/Clock'
import { FileText } from 'phosphor-react-native/src/icons/FileText'
import { Fire } from 'phosphor-react-native/src/icons/Fire'
import { GraduationCap } from 'phosphor-react-native/src/icons/GraduationCap'
import { RoadHorizon } from 'phosphor-react-native/src/icons/RoadHorizon'
import { SteeringWheel } from 'phosphor-react-native/src/icons/SteeringWheel'

import {
  C,
  Card,
  ErrorState,
  HeroTitle,
  IconButton,
  IconTile,
  LoadingScreenSkeleton,
  Pill,
  Screen,
  T,
  useToast,
} from '@/components/ds'
import { ProgressRing } from '@/components/home/progress-ring'
import { SpecialDrivesSheet } from '@/components/home/special-drives-sheet'
import { computeJourney, loadTheoryCounts, longDate, shortDate, timeRange, type Journey, type Stage } from '@/components/home/journey'
import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { useNotifications } from '@/lib/notifications-context'
import { fetchMyAppointments, type Appointment } from '@/lib/appointments'
import { shouldOfferPushPrompt } from '@/lib/auth/push'
import { instructorFirstName, lessonTitle } from '@/components/schedule/helpers'
import { getSupabase } from '@/lib/supabase/client'
import { useRequestGuard } from '@/lib/use-request-guard'

const AMBER = '#FFC83D'

export default function Home() {
  const { t, locale } = useTranslation()
  const narrow = useWindowDimensions().width < 360
  const router = useRouter()
  const { profile, session, refreshProfile } = useUser()
  const { unreadCount } = useNotifications()
  const uid = session?.user?.id ?? profile?.id ?? null

  const [theory, setTheory] = useState<{ done: number; total: number } | null>(null)
  const [nextAppt, setNextAppt] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sheet, setSheet] = useState(false)
  const loadedOnce = useRef(false)
  const toast = useToast()
  const guard = useRequestGuard()

  /** Resolves to false when the request failed (pull-to-refresh shows a toast). */
  const load = useCallback(async (): Promise<boolean> => {
    const req = guard.begin()
    if (!uid) {
      setLoading(false)
      return true
    }
    try {
      const [counts, appts] = await Promise.all([loadTheoryCounts(uid), fetchMyAppointments(uid)])
      if (!guard.isCurrent(req)) return true
      const now = Date.now()
      const startOf = (a: Appointment) => new Date(a.starts_at).getTime()
      const upcoming = appts
        .filter((a) => {
          const end = new Date(a.ends_at ?? a.starts_at).getTime()
          return a.status !== 'cancelled' && Number.isFinite(end) && end >= now
        })
        .sort((a, b) => startOf(a) - startOf(b))
      setTheory(counts)
      setNextAppt(upcoming[0] ?? null)
      setError(false)
      loadedOnce.current = true
      return true
    } catch {
      // only replace the screen with the error state if we have nothing to show yet
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

  // Daily streak: bump once per app session; refresh the profile only if the value changed.
  const streakTouched = useRef(false)
  useEffect(() => {
    if (!uid || streakTouched.current) return
    streakTouched.current = true
    ;(async () => {
      try {
        const { data, error: rpcError } = await getSupabase().rpc('touch_streak')
        if (!rpcError && typeof data === 'number' && data !== (profile?.streak_days ?? null)) {
          await refreshProfile()
        }
      } catch {
        // optional RPC (migration may not be applied yet)
      }
    })()
  }, [uid, profile?.streak_days, refreshProfile])

  // Existing students who log in (no sign-up flow) get the "Push erlauben" screen once.
  useEffect(() => {
    if (!uid) return
    let alive = true
    shouldOfferPushPrompt()
      .then((offer) => {
        if (offer && alive) router.push('/push-permission' as any)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const [ok] = await Promise.all([load(), refreshProfile().catch(() => {})])
      if (!ok) toast.show(t('ds.error.refresh'), 'error')
    } finally {
      if (guard.isMounted()) setRefreshing(false)
    }
  }, [load, refreshProfile, toast, t, guard])

  const retry = useCallback(() => {
    setError(false)
    setLoading(true)
    load()
  }, [load])

  const journey = useMemo(
    () => computeJourney(profile, theory?.done ?? 0, theory?.total ?? 0),
    [profile, theory],
  )

  const firstName = (profile?.first_name ?? '').trim()
  const streak = profile?.streak_days ?? 0

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="bodyS" color={C.muted}>{t('home.v2.welcome')}</T>
        <T variant="headingL" numberOfLines={1}>
          {firstName ? t('home.v2.hello', { name: firstName }) : t('home.v2.helloNoName')}
        </T>
      </View>
      <IconButton
        icon={Bell}
        tone="plain"
        badge={unreadCount > 0}
        onPress={() => router.push('/notifications' as any)}
        accessibilityLabel={t('home.v2.notifications')}
      />
    </View>
  )

  if (loading || error) {
    return (
      // Figma Laden / Verbindungsfehler: plain background, no hero glow
      <Screen tabBar gap={16} contentStyle={{ paddingTop: 6 }}>
        {error ? <ErrorState onRetry={retry} /> : <LoadingScreenSkeleton />}
      </Screen>
    )
  }

  const next = nextStep(journey, profile?.theory_passed === true, profile?.practical_passed === true, t, locale)

  return (
    <Screen
      glow={-60}
      tabBar
      gap={16}
      contentStyle={{ paddingTop: 6 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
    >
      {header}

      {/* Hero: Deine Strecke */}
      <Card highlight radius={24} padding={18} onPress={() => router.push('/progress' as any)} style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <HeroTitle size="M" line1={t('home.v2.road1')} line2={t('home.v2.road2')} />
          </View>
          {streak > 0 ? (
            <View
              style={{
                backgroundColor: C.surface,
                borderRadius: 999,
                paddingLeft: 10,
                paddingRight: 12,
                paddingVertical: 7,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Fire size={18} color={AMBER} weight="fill" />
              <T variant="labelM">{String(streak)}</T>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: narrow ? 12 : 16 }}>
          {/* small phones (< 360pt): smaller ring so "Theorieprüfung" never breaks mid-word */}
          <ProgressRing percent={journey.percent} size={narrow ? 66 : 84} stroke={narrow ? 7 : 8} />
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="caption" color={C.brand}>{t('home.v2.nextStep').toUpperCase()}</T>
            <T variant="headingM">{next.title}</T>
            {next.body ? <T variant="bodyS" color={C.muted}>{next.body}</T> : null}
          </View>
        </View>
        <JourneyStepper stages={journey.stages.slice(0, 6)} />
      </Card>

      {/* Stat tiles */}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'stretch' }}>
        <StatTile
          icon={BookOpen}
          value={`${journey.theoryDone}/${journey.theoryTotal}`}
          label={t('home.v2.stat.theory')}
          onPress={() => router.push('/theory' as any)}
        />
        <StatTile
          icon={SteeringWheel}
          value={String(journey.lessons)}
          label={t('home.v2.stat.lessons')}
          onPress={() => router.push('/progress' as any)}
        />
        <StatTile
          icon={RoadHorizon}
          value={`${journey.specialDone}/3`}
          label={t('home.v2.stat.special')}
          onPress={() => setSheet(true)}
        />
      </View>

      {/* Nächster Termin */}
      <Card
        radius={24}
        padding={18}
        style={{ gap: 14 }}
        onPress={() => router.push((nextAppt ? `/appointment/${nextAppt.id}` : '/booking') as any)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T variant="titleM" numberOfLines={1} style={{ flexShrink: 1 }}>{t('home.v2.nextAppt')}</T>
          {nextAppt?.status === 'requested' ? <Pill label={t('home.v2.requested')} tone="amber" /> : null}
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.push('/schedule' as any)} hitSlop={14} accessibilityRole="link" accessibilityLabel={`${t('home.v2.all')} – ${t('home.v2.nextAppt')}`}>
            <T variant="labelM" color={C.brand}>{t('home.v2.all')}</T>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <IconTile icon={nextAppt ? SteeringWheel : CalendarDots} size={48} iconSize={24} radius={14} />
          <View style={{ flex: 1, gap: 3 }}>
            {nextAppt ? (
              <>
                <T variant="titleM" numberOfLines={1}>
                  {instructorFirstName(nextAppt)
                    ? t('schedule.v2.with', { type: lessonTitle(nextAppt, t, locale), name: instructorFirstName(nextAppt)! })
                    : lessonTitle(nextAppt, t, locale)}
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <CalendarDots size={15} color={C.muted} />
                    <T variant="bodyS" color={C.muted}>{shortDate(nextAppt.starts_at, locale)}</T>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Clock size={15} color={C.muted} />
                    <T variant="bodyS" color={C.muted}>{timeRange(nextAppt.starts_at, nextAppt.ends_at)}</T>
                  </View>
                </View>
              </>
            ) : (
              <>
                <T variant="titleM">{t('home.v2.noAppt')}</T>
                <T variant="bodyS" color={C.muted}>{t('home.v2.noApptBody')}</T>
              </>
            )}
          </View>
          <CaretRight size={22} color={C.dim} />
        </View>
      </Card>

      {/* Schnellzugriff */}
      <T variant="titleM">{t('home.v2.quick')}</T>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <QuickTile
            icon={BookOpen}
            title={t('home.v2.quick.theory')}
            body={t('home.v2.quick.theoryBody', { done: journey.theoryDone, total: journey.theoryTotal })}
            onPress={() => router.push('/theory' as any)}
          />
          <QuickTile
            icon={GraduationCap}
            title={t('home.v2.quick.exams')}
            body={t('home.v2.quick.examsBody')}
            onPress={() => router.push('/exams' as any)}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <QuickTile
            icon={FileText}
            title={t('home.v2.quick.docs')}
            body={t('home.v2.quick.docsBody')}
            onPress={() => router.push('/documents' as any)}
          />
          <QuickTile
            icon={ChatCircleDots}
            title={t('home.v2.quick.chat')}
            body={t('home.v2.quick.chatBody')}
            onPress={() => router.push('/chat' as any)}
          />
        </View>
      </View>

      <SpecialDrivesSheet visible={sheet} onClose={() => setSheet(false)} />
    </Screen>
  )
}

/* ------------------------------------------------------------------ helpers */

function nextStep(
  j: Journey,
  theoryPassed: boolean,
  practicalPassed: boolean,
  t: (k: string, v?: Record<string, string | number>) => string,
  locale: 'de' | 'en',
): { title: string; body: string } {
  if (!theoryPassed) {
    const left = j.theoryTotal - j.theoryDone
    const body =
      !j.theoryComplete && left > 0
        ? left === 1
          ? t('home.v2.next.theoryHour')
          : t('home.v2.next.theoryHours', { n: left })
        : j.theoryExamDate
          ? t('home.v2.next.on', { date: longDate(j.theoryExamDate, locale) })
          : t('home.v2.next.ready')
    return { title: t('progress.v2.stage.theoryExam'), body }
  }
  if (j.specialDone < 3) {
    return { title: t('progress.v2.stage.special'), body: t('home.v2.next.special', { n: j.specialDone }) }
  }
  if (!practicalPassed) {
    return {
      title: t('progress.v2.stage.practicalExam'),
      body: j.practicalExamDate
        ? t('home.v2.next.on', { date: longDate(j.practicalExamDate, locale) })
        : t('home.v2.next.ready'),
    }
  }
  return { title: t('progress.v2.stage.license'), body: t('home.v2.next.licenseDone') }
}

/** Compact 6-node stepper at the bottom of the hero card. */
function JourneyStepper({ stages: raw }: { stages: Stage[] }) {
  // Linear like Figma: done stages stay done, the first open one is "current",
  // everything after it is upcoming (theory + lessons can both be active in the
  // Fortschritt timeline, but this compact track shows a single next step).
  const firstOpen = raw.findIndex((s) => s.state !== 'done')
  const stages = raw.map((s, i) =>
    s.state === 'done' ? s : { ...s, state: (i === firstOpen ? 'current' : 'upcoming') as Stage['state'] },
  )
  const reached = (s: Stage) => s.state === 'done' || s.state === 'current'
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {stages.map((s, i) => (
        <React.Fragment key={s.key}>
          {i > 0 ? (
            <View
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                backgroundColor: reached(s) && reached(stages[i - 1]) ? C.brand : C.surface,
              }}
            />
          ) : null}
          <StepDot state={s.state} />
        </React.Fragment>
      ))}
    </View>
  )
}

function StepDot({ state }: { state: Stage['state'] }) {
  const base: StyleProp<ViewStyle> = { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }
  if (state === 'done') {
    return (
      <View style={[base, { backgroundColor: C.brand }]}>
        <Check size={14} color={C.onBrand} weight="bold" />
      </View>
    )
  }
  if (state === 'current') {
    return (
      <View
        style={[
          base,
          {
            backgroundColor: C.tile,
            borderWidth: 2,
            borderColor: C.brand,
            shadowColor: C.brand,
            shadowOpacity: 0.5,
            shadowRadius: 7,
            shadowOffset: { width: 0, height: 0 },
            elevation: 4,
          },
        ]}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.brand }} />
      </View>
    )
  }
  return <View style={[base, { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }]} />
}

function StatTile({ icon, value, label, onPress }: { icon: PhosphorIcon; value: string; label: string; onPress: () => void }) {
  return (
    <Card radius={24} padding={14} onPress={onPress} style={{ flex: 1, gap: 10 }}>
      <IconTile icon={icon} size={32} iconSize={17} radius={14} />
      <T variant="headingL" numberOfLines={1}>{value}</T>
      <T variant="caption" color={C.muted} numberOfLines={1}>{label}</T>
    </Card>
  )
}

function QuickTile({ icon, title, body, onPress }: { icon: PhosphorIcon; title: string; body: string; onPress: () => void }) {
  return (
    <Card radius={24} padding={16} onPress={onPress} style={{ flex: 1, gap: 10 }}>
      <IconTile icon={icon} size={42} iconSize={22} radius={14} />
      <T variant="titleM" numberOfLines={1}>{title}</T>
      <T variant="caption" color={C.muted} numberOfLines={1}>{body}</T>
    </Card>
  )
}
