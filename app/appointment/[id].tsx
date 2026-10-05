/**
 * Termin Detail — Figma 1304:2500 (EN 1314:3339).
 * Header card (tile, title, type, status) + date/time, info rows (Fahrlehrer / Art /
 * Treffpunkt — hidden when missing), map tile + "Route öffnen", "Termin absagen".
 */

import React, { useCallback, useState } from 'react'
import { Linking, Pressable, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { CalendarDots } from 'phosphor-react-native/src/icons/CalendarDots'
import { CalendarPlus } from 'phosphor-react-native/src/icons/CalendarPlus'
import { CalendarX } from 'phosphor-react-native/src/icons/CalendarX'
import { ChatCircleDots } from 'phosphor-react-native/src/icons/ChatCircleDots'
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle'
import { Clock } from 'phosphor-react-native/src/icons/Clock'
import { HourglassMedium } from 'phosphor-react-native/src/icons/HourglassMedium'
import { MapPin } from 'phosphor-react-native/src/icons/MapPin'
import { Note } from 'phosphor-react-native/src/icons/Note'
import { RoadHorizon } from 'phosphor-react-native/src/icons/RoadHorizon'
import { User } from 'phosphor-react-native/src/icons/User'
import { XCircle } from 'phosphor-react-native/src/icons/XCircle'

import {
  Button,
  C,
  EmptyState,
  ErrorState,
  GLOW,
  Pill,
  Screen,
  Skeleton,
  T,
  TopBar,
  type PillTone,
} from '@/components/ds'
import { ActionsSheet, type SheetAction } from '@/components/schedule/actions-sheet'
import { CancelSheet } from '@/components/schedule/cancel-sheet'
import { endTime, lessonIcon, lessonTypeOf, longDate, timeRange } from '@/components/schedule/helpers'
import { useTranslation } from '@/lib/i18n'
import { fetchAppointment, type Appointment } from '@/lib/appointments'
import { addToCalendar } from '@/lib/calendar'
import { SCHOOL, mapsUrl } from '@/lib/school'

export default function AppointmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t, locale } = useTranslation()
  const [appt, setAppt] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }
    try {
      setAppt(await fetchAppointment(String(id)))
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const header = <TopBar title={t('appointment.v2.title')} onRight={appt ? () => setMenuOpen(true) : undefined} />

  if (loading) {
    return (
      <Screen glow={-30} header={header} gap={16} contentStyle={{ paddingTop: 8 }}>
        <Skeleton height={150} radius={20} />
        <Skeleton height={200} radius={20} />
        <Skeleton height={120} radius={18} />
      </Screen>
    )
  }
  if (error && !appt) {
    return (
      <Screen glow={-30} header={header}>
        <ErrorState
          onRetry={() => {
            setLoading(true)
            load()
          }}
        />
      </Screen>
    )
  }
  if (!appt) {
    return (
      <Screen glow={-30} header={header}>
        <EmptyState icon={CalendarX} title={t('appointment.v2.notFound.title')} body={t('appointment.v2.notFound.body')} />
      </Screen>
    )
  }

  const type = lessonTypeOf(appt)
  const typeLabel = type ? t(`schedule.v2.type.${type}`) : null
  const isPast = endTime(appt) < Date.now()
  const cancelled = appt.status === 'cancelled'
  const canCancel = !cancelled && !isPast
  const meeting = appt.meeting_point?.trim()
  const place = meeting || t('appointment.v2.schoolPlace', { street: SCHOOL.street })
  const routeUrl = meeting
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meeting)}`
    : mapsUrl()
  const openRoute = () => Linking.openURL(routeUrl).catch(() => {})

  const pill: { label: string; tone: PillTone; icon: PhosphorIcon } = cancelled
    ? { label: t('schedule.v2.status.cancelled'), tone: 'danger', icon: XCircle }
    : appt.status === 'confirmed'
      ? isPast
        ? { label: t('schedule.v2.status.done'), tone: 'green', icon: CheckCircle }
        : { label: t('schedule.v2.status.confirmed'), tone: 'green', icon: CheckCircle }
      : { label: t('schedule.v2.status.requested'), tone: 'amber', icon: HourglassMedium }

  const actions: SheetAction[] = [
    {
      key: 'cal',
      icon: CalendarPlus,
      label: t('schedule.v2.action.calendar'),
      onPress: () =>
        addToCalendar({ starts_at: appt.starts_at, ends_at: appt.ends_at, location: meeting || `${SCHOOL.street}, ${SCHOOL.city}`, notes: appt.note }, appt.title),
    },
    { key: 'chat', icon: ChatCircleDots, label: t('appointment.v2.chat'), onPress: () => router.push('/chat' as any) },
  ]
  if (canCancel) {
    actions.push({ key: 'cancel', icon: CalendarX, label: t('appointment.v2.cancel'), danger: true, onPress: () => setCancelOpen(true) })
  }

  const rows: { key: string; icon: PhosphorIcon; label: string; value: string }[] = []
  if (appt.instructor_name?.trim()) rows.push({ key: 'i', icon: User, label: t('appointment.v2.instructor'), value: appt.instructor_name.trim() })
  if (typeLabel) rows.push({ key: 't', icon: RoadHorizon, label: t('appointment.v2.type'), value: typeLabel })
  rows.push({ key: 'm', icon: MapPin, label: t('appointment.v2.meetingPoint'), value: place })
  if (appt.note?.trim()) rows.push({ key: 'n', icon: Note, label: t('appointment.v2.note'), value: appt.note.trim() })

  const Icon = lessonIcon(type)

  return (
    <Screen
      glow={-30}
      header={header}
      gap={16}
      contentStyle={{ paddingTop: 8 }}
      footer={
        canCancel ? (
          <Button variant="dangerSoft" label={t('appointment.v2.cancel')} onPress={() => setCancelOpen(true)} style={{ height: 52, marginHorizontal: 4 }} />
        ) : undefined
      }
    >
      {/* Header card */}
      <View
        style={{
          backgroundColor: C.card,
          borderWidth: 1,
          borderColor: C.lineGreen,
          borderRadius: 20,
          padding: 18,
          gap: 16,
          opacity: cancelled ? 0.85 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 50, height: 50, borderRadius: 13, backgroundColor: C.tile, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={26} color={C.brand} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <T variant="headingL" numberOfLines={1}>{appt.title}</T>
            {typeLabel ? (
              <T variant="bodyS" color={C.muted} numberOfLines={1}>{typeLabel}</T>
            ) : null}
          </View>
          <Pill label={pill.label} tone={pill.tone} icon={pill.icon} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <CalendarDots size={18} color={C.brand} />
          <T variant="titleM">{longDate(appt.starts_at, locale)}</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Clock size={18} color={C.brand} />
          <T variant="titleM">{timeRange(appt.starts_at, appt.ends_at, t)}</T>
        </View>
      </View>

      {/* Info rows */}
      <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 16 }}>
        {rows.map((r, i) => (
          <React.Fragment key={r.key}>
            {i > 0 ? <View style={{ height: 1, backgroundColor: C.line }} /> : null}
            <InfoRow icon={r.icon} label={r.label} value={r.value} />
          </React.Fragment>
        ))}
      </View>

      {/* Map tile + route */}
      <Pressable
        onPress={openRoute}
        accessibilityRole="link"
        accessibilityLabel={t('appointment.v2.route')}
        style={({ pressed }) => ({
          height: 120,
          borderRadius: 18,
          backgroundColor: C.tileMap,
          borderWidth: 1,
          borderColor: C.line,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View
          style={[
            { width: 48, height: 48, borderRadius: 13, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
            GLOW.tile,
          ]}
        >
          <MapPin size={26} color={C.onBrand} />
        </View>
      </Pressable>
      <Button variant="secondary" label={t('appointment.v2.route')} iconLeft={MapPin} onPress={openRoute} />

      <ActionsSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={appt.title}
        subtitle={`${longDate(appt.starts_at, locale)} · ${timeRange(appt.starts_at, appt.ends_at, t)}`}
        actions={actions}
      />
      <CancelSheet
        visible={cancelOpen}
        onClose={() => setCancelOpen(false)}
        appointment={appt}
        onCancelled={() => setAppt((a) => (a ? { ...a, status: 'cancelled' } : a))}
      />
    </Screen>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: PhosphorIcon; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
      <View style={{ width: 36, height: 36, borderRadius: 13, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={19} color={C.muted} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="caption" color={C.dim}>{label.toUpperCase()}</T>
        <T variant="titleM">{value}</T>
      </View>
    </View>
  )
}
