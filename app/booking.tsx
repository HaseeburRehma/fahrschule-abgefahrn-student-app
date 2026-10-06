/**
 * Termin anfragen — Figma "Booking" (1284:1473).
 * Type (Fahrstunde / Sonderfahrt → Autobahn · Nacht · Überland), date + time chips, optional note,
 * "Anfrage senden" → "Anfrage gesendet" sheet.
 *  - School has availability slots → pick a slot (DB trigger capacity-checks + auto-confirms).
 *  - No slots → free request: next 14 days × 08–18 Uhr (past times disabled), +90 min,
 *    no slot_id → stays 'requested' until the school confirms in /admin.
 * Query params: `type=special` preselects Sonderfahrt, `kind=autobahn|night|overland` the kind.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { Moon } from 'phosphor-react-native/src/icons/Moon'
import { PaperPlaneTilt } from 'phosphor-react-native/src/icons/PaperPlaneTilt'
import { RoadHorizon } from 'phosphor-react-native/src/icons/RoadHorizon'
import { SteeringWheel } from 'phosphor-react-native/src/icons/SteeringWheel'

import {
  Button,
  C,
  ChoiceChip,
  ErrorState,
  GLOW,
  Input,
  Screen,
  Skeleton,
  T,
  TopBar,
  useToast,
} from '@/components/ds'
import { RequestSentSheet } from '@/components/schedule/request-sent-sheet'
import {
  SPECIAL_KINDS,
  appointmentErrorKey,
  dayKey,
  hm,
  lessonIcon,
  monthYear,
  shortDate,
  weekdayShort,
  type SpecialKind,
} from '@/components/schedule/helpers'
import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { fetchAvailableSlots, type SlotWithCount } from '@/lib/availability'
import { createAppointment } from '@/lib/appointments'
import { useRequestGuard } from '@/lib/use-request-guard'

const NOTE_MAX = 500

type Mode = 'lesson' | 'special'
const KIND_ICON: Record<SpecialKind, PhosphorIcon> = { autobahn: RoadHorizon, night: Moon, overland: RoadHorizon }

export default function Booking() {
  const params = useLocalSearchParams<{ type?: string; kind?: string }>()
  const { t, locale } = useTranslation()
  const toast = useToast()
  const { session } = useUser()
  const uid = session?.user?.id ?? null

  const initialKind = (SPECIAL_KINDS as readonly string[]).includes(String(params.kind)) ? (params.kind as SpecialKind) : 'autobahn'
  const [mode, setMode] = useState<Mode>(params.type === 'special' || params.kind ? 'special' : 'lesson')
  const [kind, setKind] = useState<SpecialKind>(initialKind)
  const [slots, setSlots] = useState<SlotWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [day, setDay] = useState<string | null>(null)
  /** slot mode: slot id · request mode: "HH:MM" */
  const [pick, setPick] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const guard = useRequestGuard()
  // content width: window (capped by the 672px web column) minus the 20px gutters
  const { width: winW } = useWindowDimensions()
  const width = Math.min(winW, 672) - 40
  const [sent, setSent] = useState<{ title: string; when: string; confirmed: boolean; icon: PhosphorIcon } | null>(null)

  const load = useCallback(async () => {
    const req = guard.begin()
    try {
      const s = await fetchAvailableSlots()
      if (!guard.isCurrent(req)) return
      setSlots(s.filter((x) => x?.id && !isNaN(new Date(x.starts_at).getTime())))
      setNetError(false)
    } catch (e: any) {
      if (!guard.isCurrent(req)) return
      // Only a real network failure blocks the screen; anything else → free request mode.
      setSlots([])
      setNetError(isNetworkError(e))
    } finally {
      if (guard.isCurrent(req)) setLoading(false)
    }
  }, [guard])

  useEffect(() => {
    load()
  }, [load])

  /** true → book one of the school's availability slots; false → request any date/time */
  const slotMode = slots.length > 0

  const days = useMemo(() => {
    if (slotMode) {
      const m = new Map<string, Date>()
      for (const s of slots) {
        const k = dayKey(s.starts_at)
        if (!m.has(k)) m.set(k, new Date(s.starts_at))
      }
      return [...m.entries()].map(([key, date]) => ({ key, date }))
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Array.from({ length: REQUEST_DAYS }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      return { key: dayKey(d), date: d }
    })
  }, [slotMode, slots])

  const optionsFor = useCallback(
    (key: string | null, date: Date | null): TimeOption[] => {
      if (!key || !date) return []
      if (slotMode) {
        return slots
          .filter((s) => dayKey(s.starts_at) === key)
          .map((s) => ({ key: s.id, label: hm(s.starts_at), disabled: false }))
      }
      const now = Date.now()
      return REQUEST_TIMES.map((time) => ({
        key: time,
        label: time,
        disabled: atTime(date, time).getTime() <= now,
      }))
    },
    [slotMode, slots],
  )

  // keep the selected day valid (request mode: skip today once all its times have passed)
  useEffect(() => {
    if (!days.length) {
      setDay(null)
      return
    }
    if (day && days.some((d) => d.key === day)) return
    const first = days.find((d) => optionsFor(d.key, d.date).some((o) => !o.disabled)) ?? days[0]
    setDay(first.key)
    setPick(null)
  }, [days, day, optionsFor])

  const selectedDay = days.find((d) => d.key === day)?.date ?? null
  const timeOptions = useMemo(() => optionsFor(day, selectedDay), [optionsFor, day, selectedDay])
  const picked = timeOptions.find((o) => o.key === pick && !o.disabled) ?? null

  const dateChipW = width ? (width - 6 * 8) / 7 : 0
  const timeChipW = width ? (width - 2 * 10) / 3 : 0

  async function send() {
    if (!uid || !picked || !selectedDay || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    const title = mode === 'special' ? t(`schedule.v2.type.${kind}`) : t('booking.v2.type.lesson')
    const lesson_type = mode === 'special' ? kind : 'regular'
    try {
      let created
      if (slotMode) {
        const slot = slots.find((s) => s.id === picked.key)
        if (!slot) return
        if (new Date(slot.starts_at).getTime() <= Date.now()) throw new Error('starts_in_past')
        created = await createAppointment({
          studentId: uid,
          title,
          starts_at: slot.starts_at,
          ends_at: slot.ends_at,
          note: note.trim().slice(0, NOTE_MAX) || null,
          slot_id: slot.id,
          lesson_type,
        })
      } else {
        // Free request: no slot_id → DB trigger keeps it 'requested' for the school to confirm.
        const start = atTime(selectedDay, picked.key)
        // the chip may have been picked minutes ago — the DB rejects past starts ('starts_in_past')
        if (start.getTime() <= Date.now()) throw new Error('starts_in_past')
        created = await createAppointment({
          studentId: uid,
          title,
          starts_at: start.toISOString(),
          ends_at: new Date(start.getTime() + REQUEST_DURATION_MIN * 60_000).toISOString(),
          note: note.trim().slice(0, NOTE_MAX) || null,
          lesson_type,
        })
      }
      setSent({
        title,
        when: t('booking.v2.sent.at', { date: shortDate(created.starts_at, locale), time: hm(created.starts_at) }),
        confirmed: created.status === 'confirmed',
        icon: mode === 'special' ? lessonIcon(kind) : SteeringWheel,
      })
    } catch (e: any) {
      const key = appointmentErrorKey(e)
      if (guard.isMounted()) {
        toast.show(t(key), 'error')
        if (key === 'booking.v2.slotFull' || key === 'booking.v2.inPast') {
          setPick(null)
          load()
        }
      }
    } finally {
      busyRef.current = false
      if (guard.isMounted()) setBusy(false)
    }
  }

  function done() {
    setSent(null)
    if (router.canGoBack()) router.back()
    else router.replace('/schedule' as any)
  }

  const header = <TopBar title={t('booking.v2.title')} />
  const ready = !loading && !netError

  return (
    <Screen
      header={header}
      gap={22}
      keyboard
      contentStyle={{ paddingTop: 8 }}
      footer={
        ready ? (
          <Button
            label={t('booking.v2.send')}
            iconRight={PaperPlaneTilt}
            onPress={send}
            loading={busy}
            disabled={!picked || !uid}
          />
        ) : undefined
      }
    >
      {/* Art des Termins */}
      <Section title={t('booking.v2.type')}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TypeChip icon={SteeringWheel} label={t('booking.v2.type.lesson')} selected={mode === 'lesson'} onPress={() => setMode('lesson')} />
          <TypeChip icon={RoadHorizon} label={t('booking.v2.type.special')} selected={mode === 'special'} onPress={() => setMode('special')} />
        </View>
        {mode === 'special' ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {SPECIAL_KINDS.map((k) => (
              <ChoiceChip
                key={k}
                icon={KIND_ICON[k]}
                label={t(`booking.v2.kind.${k}`)}
                selected={kind === k}
                onPress={() => setKind(k)}
                style={{ flex: 1, paddingHorizontal: 6 }}
              />
            ))}
          </View>
        ) : null}
      </Section>

      {loading ? (
        <View style={{ gap: 22 }}>
          <View style={{ gap: 10 }}>
            <Skeleton width={80} height={16} />
            <Skeleton height={62} radius={14} />
          </View>
          <View style={{ gap: 10 }}>
            <Skeleton width={80} height={16} />
            <Skeleton height={48} radius={14} />
            <Skeleton height={48} radius={14} />
          </View>
        </View>
      ) : netError ? (
        <ErrorState
          onRetry={() => {
            setLoading(true)
            load()
          }}
        />
      ) : (
        <View style={{ gap: 22 }}>
          {/* Datum */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T variant="titleM" style={{ flex: 1 }}>{t('booking.v2.date')}</T>
              {selectedDay ? <T variant="labelM" color={C.muted}>{monthYear(selectedDay, locale)}</T> : null}
            </View>
            {width ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -20, marginVertical: -8 }}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 8 }}
              >
                {days.map((d) => {
                  const allPast = !optionsFor(d.key, d.date).some((o) => !o.disabled)
                  return (
                    <DateChip
                      key={d.key}
                      width={dateChipW}
                      weekday={weekdayShort(d.date, locale)}
                      day={String(d.date.getDate())}
                      selected={d.key === day}
                      disabled={allPast}
                      onPress={() => {
                        setDay(d.key)
                        setPick(null)
                      }}
                    />
                  )
                })}
              </ScrollView>
            ) : null}
          </View>

          {/* Uhrzeit */}
          <View style={{ gap: 10 }}>
            <T variant="titleM">{t('booking.v2.time')}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {timeOptions.map((o) => (
                <TimeChip
                  key={o.key}
                  width={timeChipW}
                  label={o.label}
                  selected={o.key === picked?.key}
                  disabled={o.disabled}
                  onPress={() => setPick(o.key)}
                />
              ))}
            </View>
          </View>

          {/* Notiz */}
          <View style={{ gap: 10 }}>
            <T variant="titleM">{t('booking.v2.note')}</T>
            <Input
              value={note}
              onChangeText={setNote}
              placeholder={t('booking.v2.notePlaceholder')}
              multiline
              maxLength={NOTE_MAX}
              accessibilityLabel={t('booking.v2.note')}
            />
          </View>
        </View>
      )}

      <RequestSentSheet
        visible={!!sent}
        onDone={done}
        title={sent?.title ?? ''}
        when={sent?.when ?? ''}
        icon={sent?.icon}
        confirmed={sent?.confirmed}
      />
    </Screen>
  )
}

type TimeOption = { key: string; label: string; disabled: boolean }

/** Request mode (school has no availability slots): next 14 days × fixed Figma times. */
const REQUEST_DAYS = 14
const REQUEST_TIMES = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00']
const REQUEST_DURATION_MIN = 90

/** Local date at "HH:MM". */
function atTime(date: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  return d
}

function isNetworkError(e: any): boolean {
  const msg = `${e?.name ?? ''} ${e?.message ?? ''} ${e?.details ?? ''}`
  return /network|failed to fetch|fetch failed|timeout|timed out|offline|load failed/i.test(msg)
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <T variant="titleM">{title}</T>
      {children}
    </View>
  )
}

const selectedGlow = { ...GLOW.button, shadowOpacity: 0.5, shadowRadius: 8 }

/** Figma type toggle: flex-1, py14, r16; green + glow when selected. */
function TypeChip({ icon: Icon, label, selected, onPress }: { icon: PhosphorIcon; label: string; selected: boolean; onPress: () => void }) {
  const fg = selected ? C.onBrand : C.muted
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 14,
          borderRadius: 16,
          backgroundColor: selected ? C.brand : C.surface,
          borderWidth: 1,
          borderColor: selected ? C.brand : C.line,
          opacity: pressed ? 0.85 : 1,
        },
        selected ? selectedGlow : null,
      ]}
    >
      <Icon size={20} color={fg} />
      <T variant="labelL" color={fg} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</T>
    </Pressable>
  )
}

/** Figma date chip: weekday caption + day number, r14, py10. */
function DateChip({
  width,
  weekday,
  day,
  selected,
  disabled,
  onPress,
}: {
  width: number
  weekday: string
  day: string
  selected: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${weekday} ${day}`}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        {
          width,
          minWidth: 40,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          paddingVertical: 10,
          borderRadius: 14,
          backgroundColor: selected ? C.brand : C.surface,
          borderWidth: 1,
          borderColor: selected ? C.brand : C.line,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        selected ? selectedGlow : null,
      ]}
    >
      <T variant="caption" color={selected ? C.onBrand : C.dim}>{weekday}</T>
      <T variant="labelL" color={selected ? C.onBrand : C.white}>{day}</T>
    </Pressable>
  )
}

/** Figma time chip: 3 per row, py14, r14. */
function TimeChip({
  width,
  label,
  selected,
  disabled,
  onPress,
}: {
  width: number
  label: string
  selected: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        {
          width,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 14,
          borderRadius: 14,
          backgroundColor: selected ? C.brand : C.surface,
          borderWidth: 1,
          borderColor: selected ? C.brand : C.line,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        selected ? selectedGlow : null,
      ]}
    >
      <T variant="labelL" color={selected ? C.onBrand : C.white}>{label}</T>
    </Pressable>
  )
}
