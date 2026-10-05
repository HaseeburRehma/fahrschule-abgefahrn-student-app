/**
 * Figma "Anfrage gesendet" (1306:2593 / EN 1315:3325): green check hero, body,
 * summary row (tile + lesson + "Mi, 7. Okt um 14:00"), "Alles klar".
 */

import React from 'react'
import { View } from 'react-native'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle'
import { SteeringWheel } from 'phosphor-react-native/src/icons/SteeringWheel'

import { Button, C, Sheet, SheetHero, T } from '@/components/ds'
import { useT } from '@/lib/i18n'

export function RequestSentSheet({
  visible,
  onDone,
  title,
  when,
  icon: Icon = SteeringWheel,
  confirmed,
}: {
  visible: boolean
  onDone: () => void
  /** e.g. "Fahrstunde" */
  title: string
  /** e.g. "Mi, 7. Okt um 14:00" */
  when: string
  icon?: PhosphorIcon
  /** slot bookings are auto-confirmed by the DB — show the "booked" copy instead */
  confirmed?: boolean
}) {
  const t = useT()
  return (
    <Sheet visible={visible} onClose={onDone}>
      <SheetHero
        icon={CheckCircle}
        tone="green"
        title={t(confirmed ? 'booking.v2.sent.confirmedTitle' : 'booking.v2.sent.title')}
        body={t(confirmed ? 'booking.v2.sent.confirmedBody' : 'booking.v2.sent.body')}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: C.surface,
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.tile, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={22} color={C.brand} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="titleM" numberOfLines={1}>{title}</T>
          <T variant="bodyS" color={C.muted} numberOfLines={1}>{when}</T>
        </View>
      </View>
      <Button label={t('booking.v2.sent.ok')} onPress={onDone} />
    </Sheet>
  )
}
