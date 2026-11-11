/**
 * Admin → Einladungen → one import: what happened to every row of the uploaded
 * list, the original file, and resending the invites that didn't go out.
 */

import React, { useCallback, useState } from 'react'
import { Text, View } from 'react-native'
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { FileArrowDown } from 'phosphor-react-native/src/icons/FileArrowDown'
import { PaperPlaneTilt } from 'phosphor-react-native/src/icons/PaperPlaneTilt'

import { useTranslation } from '@/lib/i18n'
import { fetchImport, fetchInvites, importFileUrl, sendInvites, type Invite, type StudentImport } from '@/lib/invites'
import { formatDateTime } from '@/lib/format'
import { ResultRows } from '@/components/admin/import-rows'
import { Badge, Grid, GREEN, Kpi, Notice, Page, SectionTitle, SmallButton, Spinner, notify, openUrl, useWide } from '@/components/admin/kit'

export default function ImportDetail() {
  const { t, locale } = useTranslation()
  const wide = useWide()
  const { importId } = useLocalSearchParams<{ importId: string }>()
  const [imp, setImp] = useState<StudentImport | null | undefined>(undefined)
  const [invites, setInvites] = useState<Invite[]>([])
  const [busy, setBusy] = useState<'file' | 'send' | null>(null)

  const load = useCallback(async () => {
    try {
      const [i, inv] = await Promise.all([fetchImport(importId), fetchInvites({ importId })])
      setImp(i)
      setInvites(inv)
    } catch {
      setImp(null)
    }
  }, [importId])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  if (imp === undefined) return <Spinner />
  if (imp === null) {
    return (
      <Page>
        <Stack.Screen options={{ title: t('inv.importDetail') }} />
        <Notice title={t('inv.importMissing')} tone="red" />
      </Page>
    )
  }

  const unsent = invites.filter((i) => i.status === 'pending' || i.status === 'failed')

  async function openFile() {
    if (!imp?.file_path) return
    setBusy('file')
    try {
      await openUrl(await importFileUrl(imp.file_path))
    } catch {
      notify(t('inv.fileOpenError'))
    } finally {
      setBusy(null)
    }
  }

  async function resendUnsent() {
    setBusy('send')
    try {
      const res = await sendInvites(unsent.map((i) => i.id).slice(0, 500))
      if (!res.mail_configured) notify(t('inv.mailOffTitle') + '\n\n' + t('inv.mailOffBody'))
      else notify(t('inv.sendDone', { sent: res.tally.sent ?? 0, failed: res.tally.failed ?? 0, skipped: (res.tally.skipped ?? 0) + (res.tally.throttled ?? 0) }))
      await load()
    } catch (e: any) {
      notify(`${t('common.error')} (${e?.message ?? ''})`)
    } finally {
      setBusy(null)
    }
  }

  // Live: invites from this list that have signed up since.
  const accepted = invites.filter((i) => i.status === 'accepted').length

  return (
    <Page>
      <Stack.Screen options={{ title: t('inv.importDetail') }} />
      <View className="gap-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Badge label={imp.file_format.toUpperCase()} tone="green" />
          <Text className="font-m-bold flex-shrink text-base text-neutral-100" numberOfLines={2}>{imp.file_name}</Text>
        </View>
        <Text className="font-m-regular text-xs text-neutral-500">{formatDateTime(imp.created_at, locale)}</Text>
      </View>

      <Grid cols={6} phoneCols={2}>
        <Kpi label={t('inv.k.rows')} value={imp.total_rows} tone="gray" />
        <Kpi label={t('inv.k.invited')} value={imp.invited} />
        <Kpi label={t('inv.k.accepted')} value={accepted} hint={t('inv.k.acceptedHint')} />
        <Kpi label={t('inv.k.sent')} value={imp.emails_sent} tone="blue" />
        <Kpi label={t('inv.k.registered')} value={imp.already_registered} tone="blue" />
        <Kpi label={t('inv.k.skipped')} value={imp.skipped} tone={imp.skipped ? 'amber' : 'gray'} />
      </Grid>

      <View className="flex-row flex-wrap gap-2">
        {imp.file_path ? (
          <SmallButton label={t('inv.openFile')} loading={busy === 'file'} icon={<FileArrowDown size={16} color={GREEN} />} onPress={openFile} />
        ) : null}
        {unsent.length ? (
          <SmallButton
            label={t('inv.sendUnsent', { n: unsent.length })}
            variant="primary"
            loading={busy === 'send'}
            icon={<PaperPlaneTilt size={15} color="#0A0A0A" />}
            onPress={resendUnsent}
          />
        ) : null}
      </View>

      <SectionTitle>{t('inv.rowsTitle')}</SectionTitle>
      <ResultRows rows={imp.rows ?? []} wide={wide} />
    </Page>
  )
}
