/**
 * Figma "07/Abmelden" (1306:2758 · EN 1315:3584): danger confirm sheet.
 * Also reused for "Konto löschen" with a trash icon.
 */

import React from 'react'
import { View } from 'react-native'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { SignOut } from 'phosphor-react-native/src/icons/SignOut'
import { Trash } from 'phosphor-react-native/src/icons/Trash'

import { Button, C, Sheet, T } from '@/components/ds'
import { useT } from '@/lib/i18n'

/** Centered danger hero + two stacked buttons; every row 18 apart (Figma gap). */
export function DangerConfirmSheet({
  visible,
  onClose,
  onConfirm,
  icon: Icon,
  title,
  body,
  confirmLabel,
  loading,
}: {
  visible: boolean
  onClose: () => void
  onConfirm: () => void
  icon: PhosphorIcon
  title: string
  body: string
  confirmLabel: string
  loading?: boolean
}) {
  const t = useT()
  return (
    <Sheet visible={visible} onClose={() => !loading && onClose()} dismissable={!loading}>
      <View style={{ alignItems: 'center', gap: 18 }}>
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 38,
            backgroundColor: C.dangerBg,
            borderWidth: 1.5,
            borderColor: C.danger,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={40} color={C.danger} />
        </View>
        <T variant="headingL" style={{ textAlign: 'center', alignSelf: 'stretch' }}>
          {title}
        </T>
        <T variant="bodyL" color={C.muted} style={{ textAlign: 'center', alignSelf: 'stretch' }}>
          {body}
        </T>
      </View>
      <Button variant="danger" label={confirmLabel} onPress={onConfirm} loading={loading} />
      <Button variant="ghost" label={t('ds.cancel')} onPress={onClose} disabled={loading} />
    </Sheet>
  )
}

export function LogoutSheet({
  visible,
  onClose,
  onConfirm,
  loading,
}: {
  visible: boolean
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}) {
  const t = useT()
  return (
    <DangerConfirmSheet
      visible={visible}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={loading}
      icon={SignOut}
      title={t('profile.v2.logout.title')}
      body={t('profile.v2.logout.body')}
      confirmLabel={t('profile.v2.logout.confirm')}
    />
  )
}

export function DeleteAccountSheet({
  visible,
  onClose,
  onConfirm,
  loading,
}: {
  visible: boolean
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}) {
  const t = useT()
  return (
    <DangerConfirmSheet
      visible={visible}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={loading}
      icon={Trash}
      title={t('profile.v2.delete.title')}
      body={t('profile.v2.delete.body')}
      confirmLabel={t('profile.v2.delete.confirm')}
    />
  )
}
