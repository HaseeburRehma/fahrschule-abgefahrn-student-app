/**
 * Termine tab — Figma "Termine" (1283:1473) + "Termine Vergangen" (1304:2587, EN 1314:3426).
 * Driving appointments + enrolled theory classes merged chronologically.
 * Keeps: RSVP for theory classes, calendar export, local reminders, pull-to-refresh.
 */

import React, { useCallback, useMemo, useState } from 'react'
import { Pressable, RefreshControl, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { ArrowSquareOut } from 'phosphor-react-native/src/icons/ArrowSquareOut'
import { BookOpen } from 'phosphor-react-native/src/icons/BookOpen'
import { CalendarDots } from 'phosphor-react-native/src/icons/CalendarDots'
import { CalendarPlus } from 'phosphor-react-native/src/icons/CalendarPlus'
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle'
import { ClockCounterClockwise } from 'phosphor-react-native/src/icons/ClockCounterClockwise'
import { HourglassMedium } from 'phosphor-react-native/src/icons/HourglassMedium'
import { Plus } from 'phosphor-react-native/src/icons/Plus'
import { ThumbsDown } from 'phosphor-react-native/src/icons/ThumbsDown'
import { ThumbsUp } from 'phosphor-react-native/src/icons/ThumbsUp'
import { XCircle } from 'phosphor-react-native/src/icons/XCircle'

import {
  Button,
  C,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  Screen,
  Segmented,
  T,
  useToast,
  type PillTone,
} from '@/components/ds'
import { ScheduleCard, ScheduleCardSkeleton } from '@/components/schedule/schedule-card'
import { ActionsSheet, type SheetAction } from '@/components/schedule/actions-sheet'
import {
  TheoryIcon,
  endTime,
  hm,
  lessonIcon,
  lessonSubtitle,
  lessonTypeOf,
  shortDate,
} from '@/components/schedule/helpers'
import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { fetchMyClasses, splitByTime } from '@/lib/data'
import { fetchMyRsvp, setRsvp } from '@/lib/rsvp'
import { fetchMyAppointments, type Appointment } from '@/lib/appointments'
import { addToCalendar } from '@/lib/calendar'
import { scheduleReminders, REMINDER_LEAD_HOURS } from '@/lib/reminders'
import type { TheoryClass } from '@/lib/types'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'

type Tab = 'upcoming' | 'past'
type Item =
  | { kind: 'appt'; id: string; at: number; appt: Appointment }
  | { kind: 'class'; id: string; at: number; cls: TheoryClass }

export default function Schedule() {
  const { t, locale } = useTranslation()
  const toast = useToast()
  const { profile, session } = useUser()
  const uid: string | null = session?.user?.id ?? null

  const [tab, setTab] = useState<Tab>('upcoming')
  const [classes, setClasses] = useState<TheoryClass[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [rsvp, setRsvpMap] = useState<Map<string, boolean>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [menu, setMenu] = useState<Item | null>(null)

  const load = useCallback(async () => {
    if (!profile) {
      setLoading(false)
      return
    }
    try {
      const [cls, myRsvp, appts] = await Promise.all([
        fetchMyClasses(profile.id),
        uid ? fetchMyRsvp(uid).catch(() => new Map<string, boolean>()) : Promise.resolve(new Map<string, boolean>()),
        uid ? fetchMyAppointments(uid) : Promise.resolve([] as Appointment[]),
      ])
      setClasses(cls)
      setRsvpMap(myRsvp)
      setAppointments(appts)
      setError(false)

      // Local reminders (REMINDER_LEAD_HOURS before each upcoming class / appointment)
      const { upcoming } = splitByTime(cls)
      const classReminders = upcoming.map((c) => ({
        id: c.id,
        fireAt: new Date(new Date(c.starts_at).getTime() - REMINDER_LEAD_HOURS * 3600_000),
        title: t('reminder.title'),
        body: t('reminder.body', {
          title: locale === 'de' ? c.title_de : c.title_en,
          time: hm(c.starts_at),
        }),
      }))
      const apptReminders = appts
        .filter((a) => a.status !== 'cancelled')
        .map((a) => ({
          id: a.id,
          fireAt: new Date(new Date(a.starts_at).getTime() - REMINDER_LEAD_HOURS * 3600_000),
          title: t('reminder.title'),
          body: t('reminder.body', { title: a.title, time: hm(a.starts_at) }),
        }))
      scheduleReminders([...classReminders, ...apptReminders])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [profile, uid, t, locale])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    const up: Item[] = []
    const pa: Item[] = []
    for (const a of appointments) {
      const it: Item = { kind: 'appt', id: a.id, at: new Date(a.starts_at).getTime(), appt: a }
      ;(endTime(a) >= now ? up : pa).push(it)
    }
    for (const c of classes) {
      const it: Item = { kind: 'class', id: c.id, at: new Date(c.starts_at).getTime(), cls: c }
      ;(endTime(c) >= now ? up : pa).push(it)
    }
    up.sort((a, b) => a.at - b.at)
    pa.sort((a, b) => b.at - a.at)
    return { upcoming: up, past: pa }
  }, [appointments, classes])

  async function handleRsvp(classId: string, attending: boolean) {
    if (!uid) return
    setRsvpMap((prev) => new Map(prev).set(classId, attending))
    try {
      await setRsvp(uid, classId, attending)
      toast.show(t('schedule.v2.rsvp.saved'), 'success')
    } catch {
      toast.show(t('schedule.v2.error'), 'error')
      load()
    }
  }

  const classTitle = (c: TheoryClass) => (locale === 'de' ? c.title_de : c.title_en) || c.title_de

  function openItem(it: Item) {
    if (it.kind === 'appt') {
      router.push(`/appointment/${it.appt.id}` as any)
    } else if (it.cls.topic_id) {
      router.push(`/theory/${it.cls.topic_id}` as any)
    } else {
      setMenu(it)
    }
  }

  function menuActions(it: Item): SheetAction[] {
    if (it.kind === 'appt') {
      const a = it.appt
      return [
        {
          key: 'details',
          icon: ArrowSquareOut,
          label: t('schedule.v2.action.details'),
          onPress: () => router.push(`/appointment/${a.id}` as any),
        },
        {
          key: 'cal',
          icon: CalendarPlus,
          label: t('schedule.v2.action.calendar'),
          onPress: () => addToCalendar({ starts_at: a.starts_at, ends_at: a.ends_at, location: a.meeting_point, notes: a.note }, a.title),
        },
      ]
    }
    const c = it.cls
    const isUpcoming = endTime(c) >= Date.now()
    const acts: SheetAction[] = []
    if (c.topic_id) {
      acts.push({
        key: 'topic',
        icon: BookOpen,
        label: t('schedule.v2.action.topic'),
        onPress: () => router.push(`/theory/${c.topic_id}` as any),
      })
    }
    if (isUpcoming) {
      acts.push(
        { key: 'yes', icon: ThumbsUp, label: t('schedule.v2.rsvp.attend'), onPress: () => handleRsvp(c.id, true) },
        { key: 'no', icon: ThumbsDown, label: t('schedule.v2.rsvp.decline'), onPress: () => handleRsvp(c.id, false) },
        { key: 'cal', icon: CalendarPlus, label: t('schedule.v2.action.calendar'), onPress: () => addToCalendar(c, classTitle(c)) },
      )
    }
    return acts
  }

  function renderItem(it: Item, isPast: boolean) {
    if (it.kind === 'appt') {
      const a = it.appt
      const type = lessonTypeOf(a)
      const pill = apptPill(a.status, isPast, t)
      return (
        <ScheduleCard
          key={`a-${a.id}`}
          icon={lessonIcon(type)}
          title={a.title}
          subtitle={lessonSubtitle(a, t) || undefined}
          pill={pill}
          date={shortDate(a.starts_at, locale)}
          time={isPast ? undefined : hm(a.starts_at)}
          place={isPast ? undefined : a.meeting_point?.trim() || t('schedule.v2.school')}
          past={isPast}
          dimmed={a.status === 'cancelled'}
          onPress={() => openItem(it)}
          onLongPress={() => setMenu(it)}
        />
      )
    }
    const c = it.cls
    const answer = rsvp.get(c.id)
    const pill: { label: string; tone: PillTone; icon?: PhosphorIcon } = isPast
      ? answer === false
        ? { label: t('schedule.v2.status.cancelled'), tone: 'neutral', icon: XCircle }
        : { label: t('schedule.v2.status.done'), tone: 'green', icon: CheckCircle }
      : answer === false
        ? { label: t('schedule.v2.status.cancelled'), tone: 'danger' }
        : { label: t('schedule.v2.status.confirmed'), tone: 'green' }
    return (
      <ScheduleCard
        key={`c-${c.id}`}
        icon={TheoryIcon}
        title={t('schedule.v2.theory')}
        subtitle={classTitle(c)}
        pill={pill}
        date={shortDate(c.starts_at, locale)}
        time={isPast ? undefined : hm(c.starts_at)}
        place={isPast ? undefined : c.location?.trim() || t('schedule.v2.school')}
        past={isPast}
        dimmed={!isPast && answer === false}
        onPress={() => openItem(it)}
        onLongPress={() => setMenu(it)}
      >
        {!isPast && answer === undefined && uid ? (
          <RsvpRow onAnswer={(v) => handleRsvp(c.id, v)} />
        ) : null}
      </ScheduleCard>
    )
  }

  const list = tab === 'upcoming' ? upcoming : past

  let body: React.ReactNode
  if (loading) {
    body = (
      <>
        <ScheduleCardSkeleton />
        <ScheduleCardSkeleton />
        <ScheduleCardSkeleton />
      </>
    )
  } else if (error && !appointments.length && !classes.length) {
    body = <ErrorState onRetry={() => { setLoading(true); load() }} />
  } else if (!list.length) {
    body =
      tab === 'upcoming' ? (
        <EmptyState
          icon={CalendarDots}
          title={t('schedule.v2.empty.upcoming.title')}
          body={t('schedule.v2.empty.upcoming.body')}
          action={t('schedule.v2.add')}
          actionIcon={Plus}
          onAction={() => router.push('/booking' as any)}
        />
      ) : (
        <EmptyState
          icon={ClockCounterClockwise}
          title={t('schedule.v2.empty.past.title')}
          body={t('schedule.v2.empty.past.body')}
        />
      )
  } else {
    body = (
      <>
        {list.map((it) => renderItem(it, tab === 'past'))}
        {tab === 'upcoming' ? (
          <Button
            variant="secondary"
            label={t('schedule.v2.request')}
            iconLeft={Plus}
            onPress={() => router.push('/booking' as any)}
          />
        ) : null}
      </>
    )
  }

  return (
    <Screen
      glow={-100}
      tabBar
      gap={16}
      contentStyle={{ paddingTop: 6 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} colors={[C.brand]} />}
    >
      <PageHeader
        title={t('schedule.v2.title')}
        subtitle={t('schedule.v2.subtitle')}
        right={
          <IconButton
            tone="green"
            icon={Plus}
            onPress={() => router.push('/booking' as any)}
            accessibilityLabel={t('schedule.v2.add')}
          />
        }
      />
      <Segmented<Tab>
        options={[
          { key: 'upcoming', label: t('schedule.v2.tab.upcoming') },
          { key: 'past', label: t('schedule.v2.tab.past') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {body}

      <ActionsSheet
        visible={!!menu}
        onClose={() => setMenu(null)}
        title={
          menu ? (menu.kind === 'appt' ? menu.appt.title : t('schedule.v2.theory')) : ''
        }
        subtitle={
          menu
            ? `${shortDate(menu.kind === 'appt' ? menu.appt.starts_at : menu.cls.starts_at, locale)} · ${hm(
                menu.kind === 'appt' ? menu.appt.starts_at : menu.cls.starts_at,
              )}`
            : undefined
        }
        actions={menu ? menuActions(menu) : []}
      />
    </Screen>
  )
}

function apptPill(
  status: Appointment['status'],
  isPast: boolean,
  t: (k: string) => string,
): { label: string; tone: PillTone; icon?: PhosphorIcon } {
  if (status === 'cancelled') return { label: t('schedule.v2.status.cancelled'), tone: 'danger', icon: isPast ? XCircle : undefined }
  if (isPast) {
    return status === 'confirmed'
      ? { label: t('schedule.v2.status.done'), tone: 'green', icon: CheckCircle }
      : { label: t('schedule.v2.status.unconfirmed'), tone: 'neutral', icon: HourglassMedium }
  }
  return status === 'confirmed'
    ? { label: t('schedule.v2.status.confirmed'), tone: 'green' }
    : { label: t('schedule.v2.status.requested'), tone: 'amber' }
}

/** Compact "Teilnahme? [Ja] [Nein]" row for unanswered upcoming theory classes. */
function RsvpRow({ onAnswer }: { onAnswer: (v: boolean) => void }) {
  const { t } = useTranslation()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <T variant="labelM" color={C.muted} style={{ flex: 1 }}>
        {t('schedule.v2.rsvp')}
      </T>
      <RsvpChip label={t('schedule.v2.rsvp.yes')} icon={ThumbsUp} onPress={() => onAnswer(true)} />
      <RsvpChip label={t('schedule.v2.rsvp.no')} icon={ThumbsDown} onPress={() => onAnswer(false)} />
    </View>
  )
}

function RsvpChip({ label, icon: Icon, onPress }: { label: string; icon: PhosphorIcon; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.line,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Icon size={15} color={C.white} />
      <T variant="labelM">{label}</T>
    </Pressable>
  )
}
