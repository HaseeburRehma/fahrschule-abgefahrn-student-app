/**
 * Figma "Termin absagen" (1306:2690 / EN 1315:3484): danger hero, body with the
 * date + 48-hour note, "Ja, Termin absagen" (danger) and "Zurück" (ghost).
 * The 48 h rule is informational only (no rule existed before) — cancelling is
 * always allowed; the school sees the cancellation in /admin.
 */

import React, { useRef, useState } from 'react'
import { WarningCircle } from 'phosphor-react-native/src/icons/WarningCircle'

import { Button, Sheet, SheetHero, useToast } from '@/components/ds'
import { useTranslation } from '@/lib/i18n'
import { cancelMyAppointment, type Appointment } from '@/lib/appointments'
import { appointmentErrorKey, lessonTitle, shortDate } from './helpers'

export function CancelSheet({
  visible,
  onClose,
  appointment,
  onCancelled,
}: {
  visible: boolean
  onClose: () => void
  appointment: Pick<Appointment, 'id' | 'title' | 'starts_at'> | null
  onCancelled?: () => void
}) {
  const { t, locale } = useTranslation()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  async function confirm() {
    if (!appointment || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      // Never delete: students may only set status → 'cancelled' (school keeps the record).
      await cancelMyAppointment(appointment.id)
      toast.show(t('appointment.v2.cancelled'), 'success')
      onClose()
      onCancelled?.()
    } catch (e) {
      toast.show(t(appointmentErrorKey(e)), 'error')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <Sheet visible={visible} onClose={() => !busyRef.current && onClose()} dismissable={!busy}>
      <SheetHero
        icon={WarningCircle}
        tone="danger"
        title={t('appointment.v2.cancelSheet.title')}
        body={
          appointment
            ? t('appointment.v2.cancelSheet.body', {
                title: lessonTitle(appointment, t, locale),
                date: shortDate(appointment.starts_at, locale),
              })
            : undefined
        }
      />
      <Button variant="danger" label={t('appointment.v2.cancelSheet.confirm')} onPress={confirm} loading={busy} />
      <Button variant="ghost" label={t('appointment.v2.cancelSheet.back')} onPress={() => !busyRef.current && onClose()} disabled={busy} />
    </Sheet>
  )
}
