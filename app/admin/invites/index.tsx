/**
 * Admin → Einladungen: every invited student with code + delivery status, and
 * the history of imported lists. Resend / revoke one or many, copy the invite
 * text (web) or share it (phone, e.g. WhatsApp).
 */

import React, { useCallback, useMemo, useState } from 'react'
import { Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { CheckSquare } from 'phosphor-react-native/src/icons/CheckSquare'
import { Square } from 'phosphor-react-native/src/icons/Square'
import { PaperPlaneTilt } from 'phosphor-react-native/src/icons/PaperPlaneTilt'
import { Prohibit } from 'phosphor-react-native/src/icons/Prohibit'
import { ArrowClockwise } from 'phosphor-react-native/src/icons/ArrowClockwise'
import { Copy } from 'phosphor-react-native/src/icons/Copy'
import { ShareNetwork } from 'phosphor-react-native/src/icons/ShareNetwork'
import { UploadSimple } from 'phosphor-react-native/src/icons/UploadSimple'
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight'

import { useTranslation } from '@/lib/i18n'
import {
  InviteApiError,
  fetchImports,
  fetchInvites,
  isNotDeployed,
  reopenInvites,
  revokeInvites,
  sendInvites,
  type Invite,
  type InviteStatus,
  type StudentImport,
  inviteText,
} from '@/lib/invites'
import { formatDateTime } from '@/lib/format'
import {
  ADMIN_MAX_WIDTH,
  Badge,
  Chip,
  ChipRow,
  Empty,
  GREEN,
  Notice,
  SmallButton,
  Spinner,
  TableHeader,
  confirmAsk,
  copyOrShare,
  notify,
  useWide,
  type Tone,
} from '@/components/admin/kit'

type Tab = 'invites' | 'imports'
type StatusFilter = 'all' | InviteStatus

const STATUS_TONE: Record<InviteStatus, Tone> = {
  pending: 'amber',
  sent: 'blue',
  failed: 'red',
  accepted: 'green',
  revoked: 'gray',
}

export default function InvitesScreen() {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const wide = useWide()

  const [tab, setTab] = useState<Tab>('invites')
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [imports, setImports] = useState<StudentImport[] | null>(null)
  const [notDeployed, setNotDeployed] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const [inv, imp] = await Promise.all([fetchInvites(), fetchImports()])
      setInvites(inv)
      setImports(imp)
      setNotDeployed(false)
      setLoadError(null)
    } catch (e: any) {
      if (isNotDeployed(e)) setNotDeployed(true)
      else setLoadError(e?.message ?? t('common.error'))
      setInvites([])
      setImports([])
    }
  }, [t])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: 0, pending: 0, sent: 0, failed: 0, accepted: 0, revoked: 0 }
    for (const i of invites ?? []) {
      c.all++
      c[i.status]++
    }
    return c
  }, [invites])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (invites ?? []).filter(
      (i) =>
        (status === 'all' || i.status === status) &&
        (!q || `${i.first_name ?? ''} ${i.last_name ?? ''} ${i.email} ${i.student_code}`.toLowerCase().includes(q)),
    )
  }, [invites, status, query])

  const selectable = filtered.filter((i) => i.status !== 'accepted')
  const allSelected = selectable.length > 0 && selectable.every((i) => selected.has(i.id))
  const selectedIds = [...selected].filter((id) => filtered.some((i) => i.id === id))

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map((i) => i.id)))
  }

  async function doSend(ids: string[]) {
    if (!ids.length) return
    setBusy('send')
    try {
      const res = await sendInvites(ids.slice(0, 500))
      const sent = res.tally.sent ?? 0
      const failed = res.tally.failed ?? 0
      if (!res.mail_configured) notify(t('inv.mailOffTitle') + '\n\n' + t('inv.mailOffBody'))
      else notify(t('inv.sendDone', { sent, failed, skipped: (res.tally.skipped ?? 0) + (res.tally.throttled ?? 0) }))
      setSelected(new Set())
      await load()
    } catch (e: any) {
      notify(e instanceof InviteApiError && e.message === 'not_found' ? t('inv.err.notDeployed') : `${t('common.error')} (${e?.message ?? ''})`)
    } finally {
      setBusy(null)
    }
  }

  async function doRevoke(ids: string[]) {
    if (!ids.length) return
    if (!(await confirmAsk(t('inv.revokeConfirm', { n: ids.length }), t('inv.revoke'), t('common.cancel')))) return
    setBusy('revoke')
    try {
      await revokeInvites(ids)
      setSelected(new Set())
      await load()
    } catch (e: any) {
      notify(e?.message ?? t('common.error'))
    } finally {
      setBusy(null)
    }
  }

  async function doReopen(id: string) {
    setBusy(id)
    try {
      await reopenInvites([id])
      await load()
    } catch (e: any) {
      notify(e?.message ?? t('common.error'))
    } finally {
      setBusy(null)
    }
  }

  async function share(i: Invite) {
    const r = await copyOrShare(inviteText(i))
    if (r === 'copied') notify(t('inv.copied'))
  }

  const header = (
    <View className="gap-4">
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <ChipRow>
          <Chip label={t('inv.tab.invites')} active={tab === 'invites'} onPress={() => setTab('invites')} count={counts.all} />
          <Chip label={t('inv.tab.imports')} active={tab === 'imports'} onPress={() => setTab('imports')} count={imports?.length ?? 0} />
        </ChipRow>
        <SmallButton
          label={t('inv.importList')}
          variant="primary"
          icon={<UploadSimple size={16} color="#0A0A0A" />}
          onPress={() => router.push('/admin/students/import' as any)}
        />
      </View>
      {notDeployed ? <Notice title={t('inv.notDeployedTitle')} body={t('inv.notDeployedBody')} /> : null}
      {loadError ? <Notice title={loadError} tone="red" /> : null}
    </View>
  )

  if (invites === null) {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <Stack.Screen options={{ title: t('inv.title') }} />
        <Spinner />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('inv.title') }} />
      <ScrollView
        refreshControl={Platform.OS === 'web' ? undefined : <RefreshControl refreshing={refreshing} tintColor={GREEN} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: '100%', maxWidth: ADMIN_MAX_WIDTH, alignSelf: 'center', padding: 20, gap: 16 }}>
          {header}

          {tab === 'imports' ? (
            <ImportList imports={imports ?? []} wide={wide} locale={locale} onOpen={(id) => router.push(`/admin/invites/${id}` as any)} />
          ) : (
            <>
              <ChipRow>
                {(['all', 'pending', 'sent', 'failed', 'accepted', 'revoked'] as StatusFilter[]).map((s) => (
                  <Chip key={s} label={t(`inv.status.${s}`)} active={status === s} onPress={() => { setStatus(s); setSelected(new Set()) }} count={counts[s]} />
                ))}
              </ChipRow>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('inv.search')}
                placeholderTextColor="#6B7280"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t('inv.search')}
                className="font-m-medium rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-base text-neutral-100"
              />

              {selectable.length ? (
                <View className="flex-row flex-wrap items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 p-3">
                  <Pressable onPress={toggleAll} className="flex-row items-center gap-2 px-1 py-1" accessibilityRole="checkbox" accessibilityState={{ checked: allSelected }}>
                    {allSelected ? <CheckSquare size={20} color={GREEN} weight="fill" /> : <Square size={20} color="#A3A3A3" />}
                    <Text className="font-m-semibold text-[13px] text-neutral-200">
                      {selectedIds.length ? t('inv.selected', { n: selectedIds.length }) : t('inv.selectAll', { n: selectable.length })}
                    </Text>
                  </Pressable>
                  <View className="flex-1" />
                  <SmallButton
                    label={t('inv.sendSelected', { n: selectedIds.length })}
                    variant="primary"
                    disabled={!selectedIds.length}
                    loading={busy === 'send'}
                    icon={<PaperPlaneTilt size={15} color="#0A0A0A" />}
                    onPress={() => doSend(selectedIds)}
                  />
                  <SmallButton
                    label={t('inv.revokeSelected', { n: selectedIds.length })}
                    variant="danger"
                    disabled={!selectedIds.length}
                    loading={busy === 'revoke'}
                    icon={<Prohibit size={15} color="#F87171" />}
                    onPress={() => doRevoke(selectedIds)}
                  />
                </View>
              ) : null}

              {!filtered.length ? (
                <Empty title={counts.all ? t('common.empty') : t('inv.emptyTitle')} body={counts.all ? undefined : t('inv.emptyBody')} />
              ) : wide ? (
                <View className="rounded-2xl border border-neutral-800 bg-neutral-900 pt-3">
                  <TableHeader
                    cols={[
                      { label: '', flex: 0.35 },
                      { label: t('inv.col.name'), flex: 2 },
                      { label: t('inv.col.code'), flex: 1.3 },
                      { label: t('inv.col.status'), flex: 1.3 },
                      { label: t('inv.col.lastSent'), flex: 1.6 },
                      { label: '', flex: 3.6, align: 'right' },
                    ]}
                  />
                  {filtered.map((i) => (
                    <InviteRowWide key={i.id} i={i} t={t} locale={locale} checked={selected.has(i.id)} busy={busy} onToggle={toggle} onSend={doSend} onRevoke={doRevoke} onReopen={doReopen} onShare={share} />
                  ))}
                </View>
              ) : (
                <View className="gap-2">
                  {filtered.map((i) => (
                    <InviteCard key={i.id} i={i} t={t} locale={locale} checked={selected.has(i.id)} busy={busy} onToggle={toggle} onSend={doSend} onRevoke={doRevoke} onReopen={doReopen} onShare={share} />
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ── rows ────────────────────────────────────────────────────────────────────

interface RowProps {
  i: Invite
  t: (k: string, v?: Record<string, string | number>) => string
  locale: 'de' | 'en'
  checked: boolean
  busy: string | null
  onToggle: (id: string) => void
  onSend: (ids: string[]) => void
  onRevoke: (ids: string[]) => void
  onReopen: (id: string) => void
  onShare: (i: Invite) => void
}

const fullName = (i: Invite) => [i.first_name, i.last_name].filter(Boolean).join(' ')

function Actions({ i, t, busy, onSend, onRevoke, onReopen, onShare }: RowProps) {
  const ShareIcon = Platform.OS === 'web' ? Copy : ShareNetwork
  return (
    <View className="flex-row flex-wrap justify-end gap-2">
      {i.status === 'revoked' ? (
        <SmallButton label={t('inv.reopen')} loading={busy === i.id} icon={<ArrowClockwise size={14} color={GREEN} />} onPress={() => onReopen(i.id)} />
      ) : i.status !== 'accepted' ? (
        <>
          <SmallButton
            label={i.send_count ? t('inv.resend') : t('inv.send')}
            icon={<PaperPlaneTilt size={14} color={GREEN} />}
            disabled={busy === 'send'}
            onPress={() => onSend([i.id])}
          />
          <SmallButton label={Platform.OS === 'web' ? t('inv.copy') : t('inv.share')} icon={<ShareIcon size={14} color={GREEN} />} onPress={() => onShare(i)} />
          <SmallButton label={t('inv.revoke')} variant="danger" disabled={busy === 'revoke'} onPress={() => onRevoke([i.id])} />
        </>
      ) : null}
    </View>
  )
}

function Check({ i, checked, onToggle }: Pick<RowProps, 'i' | 'checked' | 'onToggle'>) {
  if (i.status === 'accepted') return <View style={{ width: 20 }} />
  return (
    <Pressable onPress={() => onToggle(i.id)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={i.email}>
      {checked ? <CheckSquare size={20} color={GREEN} weight="fill" /> : <Square size={20} color="#737373" />}
    </Pressable>
  )
}

function lastSentText(i: Invite, t: RowProps['t'], locale: 'de' | 'en'): string {
  if (i.status === 'accepted' && i.accepted_at) return `${t('inv.acceptedAt')} ${formatDateTime(i.accepted_at, locale)}`
  if (i.last_sent_at) return `${formatDateTime(i.last_sent_at, locale)}${i.send_count > 1 ? ` · ${i.send_count}×` : ''}`
  return t('inv.neverSent')
}

function errorText(i: Invite, t: RowProps['t']): string | null {
  if (i.status === 'accepted') return null
  if (i.delivery_status === 'bounced' || i.delivery_status === 'complained') return t(`inv.delivery.${i.delivery_status}`)
  if (!i.last_error) return i.delivery_status === 'delayed' ? t('inv.delivery.delayed') : null
  if (i.last_error === 'mail_not_configured') return t('inv.mail.not_configured')
  if (i.last_error === 'provider_unavailable') return t('inv.mail.queued')
  return i.last_error.startsWith('resend_') ? t('inv.mail.failed') : i.last_error
}

function InviteRowWide(p: RowProps) {
  const { i, t, locale } = p
  const err = errorText(i, t)
  return (
    <View className="flex-row items-center border-b border-neutral-800/60 px-3 py-3">
      <View style={{ flex: 0.35 }}>
        <Check {...p} />
      </View>
      <View style={{ flex: 2 }} className="pr-2">
        <Text className="font-m-semibold text-[13px] text-neutral-100" numberOfLines={1}>{fullName(i) || i.email}</Text>
        <Text className="font-m-regular text-xs text-neutral-400" numberOfLines={1}>{i.email}</Text>
        {err ? <Text className="font-m-regular text-[11px] text-red-400" numberOfLines={1}>{err}</Text> : null}
      </View>
      <View style={{ flex: 1.3 }}>
        <Text className="font-m-bold text-[13px] text-neutral-100" selectable>{i.student_code}</Text>
        <Text className="font-m-regular text-[11px] text-neutral-500">{t(`inv.source.${i.code_source}`)}</Text>
      </View>
      <View style={{ flex: 1.3 }}>
        <Badge label={t(`inv.status.${i.status}`)} tone={STATUS_TONE[i.status]} />
      </View>
      <Text style={{ flex: 1.6 }} className="font-m-regular text-xs text-neutral-400" numberOfLines={2}>
        {lastSentText(i, t, locale)}
      </Text>
      <View style={{ flex: 3.6 }}>
        <Actions {...p} />
      </View>
    </View>
  )
}

function InviteCard(p: RowProps) {
  const { i, t, locale } = p
  const err = errorText(i, t)
  return (
    <View className="gap-2.5 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <View className="flex-row items-start gap-3">
        <View className="pt-0.5">
          <Check {...p} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="font-m-semibold text-[15px] text-neutral-100" numberOfLines={1}>{fullName(i) || i.email}</Text>
          {fullName(i) ? <Text className="font-m-regular text-[13px] text-neutral-400" numberOfLines={1}>{i.email}</Text> : null}
        </View>
        <Badge label={t(`inv.status.${i.status}`)} tone={STATUS_TONE[i.status]} />
      </View>
      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1 pl-8">
        <Text className="font-m-bold text-sm text-neutral-100" selectable>{i.student_code}</Text>
        <Text className="font-m-regular text-xs text-neutral-500">{t(`inv.source.${i.code_source}`)}</Text>
        <Text className="font-m-regular text-xs text-neutral-500">{lastSentText(i, t, locale)}</Text>
      </View>
      {err ? <Text className="font-m-regular pl-8 text-xs text-red-400">{err}</Text> : null}
      <View className="pl-8">
        <Actions {...p} />
      </View>
    </View>
  )
}

function ImportList({ imports, wide, locale, onOpen }: { imports: StudentImport[]; wide: boolean; locale: 'de' | 'en'; onOpen: (id: string) => void }) {
  const { t } = useTranslation()
  if (!imports.length) return <Empty title={t('inv.noImports')} body={t('inv.noImportsBody')} />
  return (
    <View className="gap-2" style={wide ? { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } : undefined}>
      {imports.map((im) => (
        <Pressable
          key={im.id}
          onPress={() => onOpen(im.id)}
          accessibilityRole="button"
          className="gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 active:opacity-80"
          style={wide ? { width: '32%', minWidth: 300, flexGrow: 1 } : undefined}
        >
          <View className="flex-row items-center gap-2">
            <Badge label={im.file_format.toUpperCase()} tone="green" />
            <Text className="font-m-semibold flex-1 text-[14px] text-neutral-100" numberOfLines={1}>{im.file_name}</Text>
            <CaretRight size={16} color="#737373" />
          </View>
          <Text className="font-m-regular text-xs text-neutral-500">{formatDateTime(im.created_at, locale)}</Text>
          <View className="flex-row flex-wrap gap-1.5">
            <Badge label={`${im.invited} ${t('inv.k.invited')}`} tone="green" />
            <Badge label={`${im.emails_sent} ${t('inv.k.sent')}`} tone="blue" />
            {im.already_registered ? <Badge label={`${im.already_registered} ${t('inv.k.registered')}`} tone="gray" /> : null}
            {im.skipped ? <Badge label={`${im.skipped} ${t('inv.k.skipped')}`} tone="amber" /> : null}
            {im.emails_failed ? <Badge label={`${im.emails_failed} ${t('inv.k.failed')}`} tone="red" /> : null}
          </View>
        </Pressable>
      ))}
    </View>
  )
}
