/**
 * Admin appointment editor — used to create, confirm or edit an appointment
 * (date/time, lesson type, instructor, meeting point, note).
 */

import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { format } from 'date-fns'

import { useTranslation } from '@/lib/i18n'
import {
  LESSON_TYPES,
  adminCreateAppointment,
  updateAppointment,
  type Appointment,
  type AppointmentLessonType,
} from '@/lib/appointments'
import { parseLocalDateTime } from '@/lib/format'
import { deDateToIso, maskDeDate } from '@/components/theory/dates'
import { Button, Card, ErrorText, TextField } from '@/components/ui'
import { ChipSelect, StudentPicker } from '@/components/admin-pickers'
import type { Profile } from '@/lib/types'

export type AppointmentFormMode = 'create' | 'edit' | 'confirm'

/** "1430" → "14:30" while typing. */
function maskTime(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`
}

/** dd.mm.yyyy + HH:MM → ISO (null when invalid). */
function toIso(date: string, time: string): string | null {
  const day = deDateToIso(date)
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!day || !m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return parseLocalDateTime(
    `${day} ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
  )
}

function isLessonType(v: string | null | undefined): v is AppointmentLessonType {
  return !!v && (LESSON_TYPES as readonly string[]).includes(v)
}

export function AppointmentForm({
  mode,
  appointment,
  students = [],
  onDone,
  onCancel,
}: {
  mode: AppointmentFormMode
  appointment?: Appointment
  students?: Profile[]
  onDone: (a: Appointment) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const a = appointment
  const start = a ? new Date(a.starts_at) : null
  const end = a?.ends_at ? new Date(a.ends_at) : null

  const [studentId, setStudentId] = useState<string | null>(a?.student_id ?? null)
  const [title, setTitle] = useState(a?.title ?? t('appt.defaultTitle'))
  const [date, setDate] = useState(start ? format(start, 'dd.MM.yyyy') : '')
  const [from, setFrom] = useState(start ? format(start, 'HH:mm') : '')
  const [to, setTo] = useState(end ? format(end, 'HH:mm') : '')
  const initialType = a?.lesson_type
  const [lessonType, setLessonType] = useState<AppointmentLessonType>(
    isLessonType(initialType) ? initialType : 'regular',
  )
  const [instructor, setInstructor] = useState(a?.instructor_name ?? '')
  const [meetingPoint, setMeetingPoint] = useState(a?.meeting_point ?? '')
  const [note, setNote] = useState(a?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (busy) return
    setError(null)
    if (mode === 'create' && !studentId) return setError(t('admin.v2.needStudent'))
    if (!title.trim()) return setError(t('admin.v2.needTitle'))
    const startsAt = toIso(date, from)
    if (!startsAt) return setError(t('admin.v2.badDateTime'))
    let endsAt: string | null = null
    if (to.trim()) {
      endsAt = toIso(date, to)
      if (!endsAt) return setError(t('admin.v2.badDateTime'))
      if (new Date(endsAt) <= new Date(startsAt)) return setError(t('admin.v2.badEnd'))
    }
    const details = {
      title: title.trim(),
      starts_at: startsAt,
      ends_at: endsAt,
      note: note.trim() || null,
      lesson_type: lessonType,
      instructor_name: instructor.trim() || null,
      meeting_point: meetingPoint.trim() || null,
    }
    setBusy(true)
    try {
      const saved =
        mode === 'create'
          ? await adminCreateAppointment({ studentId: studentId!, ...details })
          : await updateAppointment(a!.id, {
              ...details,
              ...(mode === 'confirm' ? { status: 'confirmed' as const } : {}),
            })
      onDone(saved)
    } catch (e: any) {
      setError(e?.message ?? t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  const heading =
    mode === 'create'
      ? t('admin.v2.newAppt')
      : mode === 'confirm'
        ? t('admin.v2.confirmAppt')
        : t('admin.v2.editAppt')
  const submitLabel =
    mode === 'create'
      ? t('admin.v2.create')
      : mode === 'confirm'
        ? t('admin.v2.confirmSave')
        : t('common.save')

  return (
    <Card className="gap-3">
      <Text className="text-base font-bold text-neutral-100">{heading}</Text>

      {mode === 'create' ? (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-neutral-300">
            {t('admin.v2.student')}
          </Text>
          <StudentPicker
            students={students}
            selected={studentId}
            onSelect={setStudentId}
            placeholder={t('admin.v2.searchStudent')}
            disabled={busy}
          />
        </View>
      ) : null}

      <TextField
        label={t('admin.v2.apptTitle')}
        value={title}
        onChangeText={setTitle}
        editable={!busy}
      />

      <View className="gap-2">
        <Text className="text-sm font-semibold text-neutral-300">
          {t('admin.v2.lessonType')}
        </Text>
        <ChipSelect
          options={LESSON_TYPES.map((lt) => ({ value: lt, label: t(`admin.v2.type.${lt}`) }))}
          selected={lessonType}
          onSelect={setLessonType}
          disabled={busy}
        />
      </View>

      <TextField
        label={t('admin.v2.date')}
        value={date}
        onChangeText={(v) => setDate(maskDeDate(v))}
        placeholder="22.10.2026"
        keyboardType="number-pad"
        maxLength={10}
        editable={!busy}
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <TextField
            label={t('admin.v2.from')}
            value={from}
            onChangeText={(v) => setFrom(maskTime(v))}
            placeholder="14:00"
            keyboardType="number-pad"
            maxLength={5}
            editable={!busy}
          />
        </View>
        <View className="flex-1">
          <TextField
            label={t('admin.v2.to')}
            value={to}
            onChangeText={(v) => setTo(maskTime(v))}
            placeholder="15:30"
            keyboardType="number-pad"
            maxLength={5}
            editable={!busy}
          />
        </View>
      </View>

      <TextField
        label={t('admin.v2.instructor')}
        value={instructor}
        onChangeText={setInstructor}
        placeholder={t('admin.v2.instructorPh')}
        editable={!busy}
      />
      <TextField
        label={t('admin.v2.meetingPoint')}
        value={meetingPoint}
        onChangeText={setMeetingPoint}
        placeholder={t('admin.v2.meetingPointPh')}
        editable={!busy}
      />
      <TextField
        label={t('admin.v2.note')}
        value={note}
        onChangeText={setNote}
        multiline
        editable={!busy}
      />

      <ErrorText>{error}</ErrorText>
      <Button label={submitLabel} onPress={submit} loading={busy} />
      <Button label={t('common.cancel')} onPress={onCancel} disabled={busy} variant="ghost" />
    </Card>
  )
}
