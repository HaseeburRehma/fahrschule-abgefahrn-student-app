/**
 * Small action menu (dots-three on Termin Detail, long-press on a Termine card).
 * Built from DS Sheet + ListGroup/ListRow.
 */

import React, { useEffect, useRef } from 'react'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'

import { ListGroup, ListRow, Sheet, SheetTitle } from '@/components/ds'

export type SheetAction = {
  key: string
  icon: PhosphorIcon
  label: string
  onPress: () => void
  danger?: boolean
}

export function ActionsSheet({
  visible,
  onClose,
  title,
  subtitle,
  actions,
}: {
  visible: boolean
  onClose: () => void
  title: string
  subtitle?: string
  actions: SheetAction[]
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetTitle title={title} subtitle={subtitle} />
      <ListGroup>
        {actions.map((a) => (
          <ListRow
            key={a.key}
            icon={a.icon}
            title={a.label}
            danger={a.danger}
            chevron={false}
            onPress={() => {
              if (timer.current) return // one action per opening (double taps)
              onClose()
              // let the sheet close before navigating / opening another sheet
              timer.current = setTimeout(() => {
                timer.current = null
                a.onPress()
              }, 220)
            }}
          />
        ))}
      </ListGroup>
    </Sheet>
  )
}
