/**
 * Small action menu (dots-three on Termin Detail, long-press on a Termine card).
 * Built from DS Sheet + ListGroup/ListRow.
 */

import React from 'react'
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
              onClose()
              // let the sheet close before navigating / opening another sheet
              setTimeout(a.onPress, 220)
            }}
          />
        ))}
      </ListGroup>
    </Sheet>
  )
}
