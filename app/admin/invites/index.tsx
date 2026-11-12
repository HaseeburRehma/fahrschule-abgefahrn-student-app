/**
 * Admin → Einladungen: every invited student with code + delivery status, and
 * the history of imported lists. Status cards, search, filters with counts,
 * sorting and pagination; table on desktop, cards on phones. Resend / revoke
 * one or many, copy the invite text (web) or share it (phone, e.g. WhatsApp).
 * `?status=failed` (etc.) preselects a filter — used by the dashboard.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { CheckSquare } from 'phosphor-react-native/src/icons/CheckSquare'
import { MinusSquare } from 'phosphor-react-native/src/icons/MinusSquare'
import { Square } from 'phosphor-react-native/src/icons/Square'
import { PaperPlaneTilt } from 'phosphor-react-native/src/icons/PaperPlaneTilt'
import { Prohibit } from 'phosphor-react-native/src/icons/Prohibit'
import { ArrowClockwise } from 'phosphor-react-native/src/icons/ArrowClockwise'
import { Copy } from 'phosphor-react-native/src/icons/Copy'
import { ShareNetwork } from 'phosphor-react-native/src/icons/ShareNetwork'
import { UploadSimple } from 'phosphor-react-native/src/icons/UploadSimple'
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight'
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft'
import { MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass'
import { X } from 'phosphor-react-native/src/icons/X'
import { HourglassMedium } from 'phosphor-react-native/src/icons/HourglassMedium'
import { EnvelopeSimple } from 'phosphor-react-native/src/icons/EnvelopeSimple'
import { UserCheck } from 'phosphor-react-native/src/icons/UserCheck'
import { XCircle } from 'phosphor-react-native/src/icons/XCircle'
import { Warning } from 'phosphor-react-native/src/icons/Warning'

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
import {
  INVITE_FILTERS,
  INVITE_SORTS,
  PAGE_SIZES,
  acceptRate,
  inviteCounts,
  inviteName,
  matchesInvite,
  pageWindow,
  paginate,
  sortInvites,
  type InviteFilter,
  type InviteSort,
} from '@/lib/admin-list'
import { formatDateTime } from '@/lib/format'
import {
  ADMIN_MAX_WIDTH,
  Badge,
  Chip,
  ChipRow,
  Empty,
  GREEN,
  Notice,
  PageHeader,
  Pagination,
  SearchField,
  Segmented,
  SmallButton,
  Spinner,
  confirmAsk,
  copyOrShare,
  notify,
  useSidebar,
  useWide,
  type Tone,
} from '@/components/admin/kit'

type Tab = 'invites' | 'imports'
type T = (k: string, v?: Record<string, string | number>) => string
type IconC = React.ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'bold' | 'fill' }>

const STATUS_TONE: Record<InviteStatus, Tone> = {
  pending: 'amber',
  sent: 'blue',
  failed: 'red',
  accepted: 'green',
  revoked: 'gray',
}
const TONE_FG: Record<Tone, string> = { green: GREEN, red: '#FF7A7A', amber: '#FFC233', blue: '#7CB8FF', gray: '#A3A3A3' }
const TONE_BG: Record<Tone, string> = {
  green: 'rgba(0,255,36,0.10)',
  red: 'rgba(255,90,90,0.12)',
  amber: 'rgba(255,184,0,0.12)',
  blue: 'rgba(80,160,255,0.12)',
  gray: 'rgba(255,255,255,0.06)',
}

/** table columns (flex ratios), shared by header and rows */
const COL = { check: 0.4, name: 2.6, code: 1.4, status: 1.5, sent: 1.7, actions: 2.6 }

export default function InvitesScreen() {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const wide = useWide()
  const sidebar = useSidebar()
  const params = useLocalSearchParams<{ status?: string; tab?: string }>()
  const paramFilter = INVITE_FILTERS.includes(params.status as InviteFilter) ? (params.status as InviteFilter) : null

  const [tab, setTab] = useState<Tab>(params.tab === 'imports' ? 'imports' : 'invites')
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [imports, setImports] = useState<StudentImport[] | null>(null)
  const [notDeployed, setNotDeployed] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [status, setStatus] = useState<InviteFilter>(paramFilter ?? 'all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<InviteSort>('newest')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [importPage, setImportPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  // one action at a time (a second tap while a send runs must not start another request)
  const inFlight = useRef(false)
  // only the newest load may update the list (an older, slower one must not undo a revoke)
  const loadSeq = useRef(0)

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    try {
      const [inv, imp] = await Promise.all([fetchInvites(), fetchImports()])
      if (seq !== loadSeq.current) return
      setInvites(inv)
      setImports(imp)
      setNotDeployed(false)
      setLoadError(null)
    } catch (e: any) {
      if (seq !== loadSeq.current) return
      if (isNotDeployed(e)) setNotDeployed(true)
      else setLoadError(e?.message ?? t('common.error'))
      setInvites((v) => v ?? [])
      setImports((v) => v ?? [])
    }
  }, [t])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  useEffect(() => {
    setStatus(paramFilter ?? 'all')
  }, [paramFilter])

  // new search / filter / sort / page size → page 1, selection cleared
  useEffect(() => {
    setPage(1)
    setSelected(new Set())
  }, [query, status, sort, pageSize])

  const counts = useMemo(() => inviteCounts(invites ?? []), [invites])
  const rate = acceptRate(counts)
  const filtered = useMemo(
    () => sortInvites((invites ?? []).filter((i) => matchesInvite(i, query, status)), sort),
    [invites, query, status, sort],
  )
  const pg = paginate(filtered, page, pageSize)
  const impPg = paginate(imports ?? [], importPage, 12)

  // selection works across pages: "select all" takes every matching invite
  const selectable = filtered.filter((i) => i.status !== 'accepted' && i.status !== 'revoked')
  const selectedIds = selectable.filter((i) => selected.has(i.id)).map((i) => i.id)
  const allSelected = selectable.length > 0 && selectedIds.length === selectable.length

  const goTo = (p: number) => {
    setPage(p)
    scrollRef.current?.scrollTo({ y: 0, animated: true })
  }

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

  /** Runs one admin action at a time; every action button is disabled while it runs. */
  async function exclusive(key: string, fn: () => Promise<void>) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(key)
    try {
      await fn()
    } finally {
      inFlight.current = false
      setBusy(null)
    }
  }

  async function doSend(ids: string[], key = ids.length === 1 ? ids[0] : 'send') {
    if (!ids.length) return
    await exclusive(key, async () => {
      try {
        const { tally, mail_configured } = await sendInvites(ids) // sent in parts of 500
        if (!mail_configured) notify(t('inv.mailOffTitle') + '\n\n' + t('inv.mailOffBody'))
        else notify(t('inv.sendDone', { sent: tally.sent ?? 0, failed: tally.failed ?? 0, skipped: (tally.skipped ?? 0) + (tally.throttled ?? 0) }))
        setSelected(new Set())
      } catch (e: any) {
        notify(e instanceof InviteApiError && e.message === 'not_found' ? t('inv.err.notDeployed') : `${t('common.error')} (${e?.message ?? ''})`)
      }
      await load()
    })
  }

  async function doRevoke(ids: string[], key = ids.length === 1 ? `revoke:${ids[0]}` : 'revoke') {
    if (!ids.length) return
    if (inFlight.current) return
    if (!(await confirmAsk(t('inv.revokeConfirm', { n: ids.length }), t('inv.revoke'), t('common.cancel')))) return
    await exclusive(key, async () => {
      try {
        await revokeInvites(ids)
        setSelected(new Set())
      } catch (e: any) {
        notify(e?.message ?? t('common.error'))
      }
      await load()
    })
  }

  async function doReopen(id: string) {
    await exclusive(id, async () => {
      try {
        await reopenInvites([id])
      } catch (e: any) {
        notify(e?.message ?? t('common.error'))
      }
      await load()
    })
  }

  async function share(i: Invite) {
    const text = inviteText(i)
    const r = await copyOrShare(text)
    if (r === 'copied') notify(t('inv.copied'))
    // no clipboard access (e.g. blocked by the browser): show the text so it can be copied by hand
    else if (r === 'failed') notify(text)
  }

  const rowProps = { t, locale, busy, onToggle: toggle, onSend: doSend, onRevoke: doRevoke, onReopen: doReopen, onShare: share }

  const stats: { key: InviteFilter; label: string; hint: string; Icon: IconC; tone: Tone }[] = [
    { key: 'sent', label: t('inv.status.sent'), hint: t('inv.stat.sentHint'), Icon: EnvelopeSimple, tone: 'blue' },
    { key: 'accepted', label: t('inv.status.accepted'), hint: rate !== null ? t('inv.stat.acceptedHint', { pct: rate }) : t('inv.stat.acceptedNone'), Icon: UserCheck, tone: 'green' },
    { key: 'failed', label: t('inv.status.failed'), hint: t('inv.stat.failedHint'), Icon: XCircle, tone: 'red' },
    { key: 'pending', label: t('inv.status.pending'), hint: t('inv.stat.pendingHint'), Icon: HourglassMedium, tone: 'amber' },
  ]

  const tabs = (
    <Segmented
      options={[
        { value: 'invites' as Tab, label: `${t('inv.tab.invites')} · ${counts.all}` },
        { value: 'imports' as Tab, label: `${t('inv.tab.imports')} · ${imports?.length ?? 0}` },
      ]}
      value={tab}
      onChange={setTab}
    />
  )

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('inv.title'), headerShown: !sidebar }} />
      {invites === null ? (
        <Spinner />
      ) : (
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            Platform.OS === 'web' ? undefined : (
              <RefreshControl
                refreshing={refreshing}
                tintColor={GREEN}
                onRefresh={async () => {
                  setRefreshing(true)
                  await load()
                  setRefreshing(false)
                }}
              />
            )
          }
        >
          <View style={{ width: '100%', maxWidth: ADMIN_MAX_WIDTH, alignSelf: 'center', padding: wide ? 28 : 16, gap: 16 }}>
            <PageHeader
              title={t('inv.title')}
              subtitle={t('inv.summary', { total: counts.all, accepted: counts.accepted })}
              actions={
                <View style={{ flex: wide ? undefined : 1 }}>
                  <SmallButton
                    label={t('inv.importList')}
                    variant="primary"
                    icon={<UploadSimple size={16} color="#0A0A0A" weight="bold" />}
                    onPress={() => router.push('/admin/students/import' as any)}
                  />
                </View>
              }
            />
            {notDeployed ? <Notice title={t('inv.notDeployedTitle')} body={t('inv.notDeployedBody')} /> : null}
            {loadError ? <Notice title={loadError} tone="red" /> : null}

            {/* status cards — tap to filter */}
            {counts.all ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
                {stats.map((s) => {
                  const on = tab === 'invites' && status === s.key
                  return (
                    <View key={s.key} style={{ width: wide ? '25%' : '50%', padding: 6 }}>
                      <Pressable
                        onPress={() => {
                          setTab('invites')
                          setStatus(on ? 'all' : s.key)
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`${s.label}: ${counts[s.key]}`}
                        style={on ? { flex: 1, borderColor: TONE_FG[s.tone] } : { flex: 1 }}
                        className={`${wide ? 'flex-row items-center' : ''} gap-3 rounded-2xl border bg-neutral-950 p-3.5 ${on ? '' : 'border-neutral-800 hover:border-neutral-700'}`}
                      >
                        <View style={{ backgroundColor: TONE_BG[s.tone] }} className="h-10 w-10 items-center justify-center rounded-xl">
                          <s.Icon size={20} color={TONE_FG[s.tone]} weight="bold" />
                        </View>
                        <View className="flex-1">
                          <Text className="font-m-black text-[22px] text-neutral-50">{counts[s.key]}</Text>
                          <Text className="font-m-semibold text-xs text-neutral-300" numberOfLines={1}>
                            {s.label}
                          </Text>
                          <Text className="font-m-regular text-[11px] text-neutral-500" numberOfLines={wide ? 1 : 2}>
                            {s.hint}
                          </Text>
                        </View>
                      </Pressable>
                    </View>
                  )
                })}
              </View>
            ) : null}

            {tab === 'imports' ? (
              <>
                <View className="flex-row">{tabs}</View>
                <ImportList
                  imports={impPg.items}
                  wide={wide}
                  t={t}
                  locale={locale}
                  onOpen={(id) => router.push(`/admin/invites/${id}` as any)}
                />
                <Pagination
                  page={impPg.page}
                  pages={impPg.pages}
                  from={impPg.from}
                  to={impPg.to}
                  total={impPg.total}
                  onPage={(p) => {
                    setImportPage(p)
                    scrollRef.current?.scrollTo({ y: 0, animated: true })
                  }}
                  window={pageWindow(impPg.page, impPg.pages)}
                  prevIcon={<CaretLeft size={16} color="#E5E5E5" weight="bold" />}
                  nextIcon={<CaretRight size={16} color="#E5E5E5" weight="bold" />}
                  labels={pagerLabels(t, impPg)}
                />
              </>
            ) : (
              <>
                {/* toolbar (only the tabs while there are no invites yet: nothing to search, filter or sort) */}
                {!counts.all ? (
                  <View className="flex-row">{tabs}</View>
                ) : (
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: wide ? 'row' : 'column', flexWrap: wide ? 'wrap' : 'nowrap', gap: 12, alignItems: wide ? 'center' : 'stretch' }}>
                    {!wide ? <View className="flex-row">{tabs}</View> : null}
                    <View style={wide ? { flexGrow: 1, flexBasis: 260, minWidth: 260, maxWidth: 420 } : undefined}>
                      <SearchField
                        value={query}
                        onChange={setQuery}
                        placeholder={t('inv.search')}
                        clearLabel={t('list.clear')}
                        icon={<MagnifyingGlass size={18} color="#737373" />}
                        clearIcon={<X size={16} color="#A3A3A3" />}
                      />
                    </View>
                    {wide ? (
                      <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        {tabs}
                        <Segmented
                          label={t('list.sort')}
                          options={INVITE_SORTS.map((s) => ({ value: s, label: t(`inv.sort.${s}`) }))}
                          value={sort}
                          onChange={setSort}
                        />
                      </View>
                    ) : null}
                  </View>
                  <ChipRow>
                    {INVITE_FILTERS.map((s) => (
                      <Chip key={s} label={t(`inv.status.${s}`)} active={status === s} onPress={() => setStatus(s)} count={counts[s]} />
                    ))}
                  </ChipRow>
                  {!wide ? (
                    <ChipRow>
                      {INVITE_SORTS.map((s) => (
                        <Pressable
                          key={s}
                          onPress={() => setSort(s)}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: sort === s }}
                          className={`rounded-lg px-3 py-1.5 ${sort === s ? 'bg-neutral-800' : ''}`}
                        >
                          <Text className={`font-m-semibold text-xs ${sort === s ? 'text-neutral-50' : 'text-neutral-500'}`}>{t(`inv.sort.${s}`)}</Text>
                        </Pressable>
                      ))}
                    </ChipRow>
                  ) : null}
                </View>
                )}

                {/* bulk actions: only while something is selected (phones: select-all lives here too) */}
                {selectable.length && (selectedIds.length || !wide) ? (
                  <View className={`flex-row flex-wrap items-center gap-2 rounded-2xl border p-2.5 ${selectedIds.length ? 'border-brand/40 bg-brand/5' : 'border-neutral-800 bg-neutral-950'}`}>
                    <Pressable
                      onPress={toggleAll}
                      className="flex-row items-center gap-2 px-1.5 py-1.5"
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: allSelected }}
                    >
                      <SelectIcon all={allSelected} some={selectedIds.length > 0} />
                      <Text className="font-m-semibold text-[13px] text-neutral-200">
                        {selectedIds.length ? t('inv.selected', { n: selectedIds.length }) : t('inv.selectAll', { n: selectable.length })}
                      </Text>
                    </Pressable>
                    <View className="flex-1" />
                    {selectedIds.length ? (
                      <>
                        <SmallButton label={t('inv.clearSelection')} onPress={() => setSelected(new Set())} />
                        <SmallButton
                          label={t('inv.revokeSelected', { n: selectedIds.length })}
                          variant="danger"
                          loading={busy === 'revoke'}
                          disabled={busy !== null}
                          icon={<Prohibit size={15} color="#F87171" />}
                          onPress={() => doRevoke(selectedIds, 'revoke')}
                        />
                        <SmallButton
                          label={t('inv.sendSelected', { n: selectedIds.length })}
                          variant="primary"
                          loading={busy === 'send'}
                          disabled={busy !== null}
                          icon={<PaperPlaneTilt size={15} color="#0A0A0A" weight="bold" />}
                          onPress={() => doSend(selectedIds, 'send')}
                        />
                      </>
                    ) : null}
                  </View>
                ) : null}

                {/* list */}
                {pg.total === 0 ? (
                  <View className="rounded-2xl border border-neutral-800 bg-neutral-950">
                    <Empty
                      title={counts.all ? t('inv.noMatch') : t('inv.emptyTitle')}
                      body={counts.all ? t('stu.noMatchHint') : t('inv.emptyBody')}
                    />
                    <View className="items-center pb-8">
                      {counts.all ? (
                        <SmallButton
                          label={t('stu.reset')}
                          onPress={() => {
                            setQuery('')
                            setStatus('all')
                          }}
                        />
                      ) : (
                        <SmallButton
                          label={t('inv.importList')}
                          variant="primary"
                          icon={<UploadSimple size={16} color="#0A0A0A" weight="bold" />}
                          onPress={() => router.push('/admin/students/import' as any)}
                        />
                      )}
                    </View>
                  </View>
                ) : wide ? (
                  <View className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
                    <View className="flex-row items-center border-b border-neutral-800 bg-neutral-900/60 px-4 py-3">
                      <View style={{ flex: COL.check }}>
                        {selectable.length ? (
                          <Pressable onPress={toggleAll} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: allSelected }} accessibilityLabel={t('inv.selectAll', { n: selectable.length })}>
                            <SelectIcon all={allSelected} some={selectedIds.length > 0} />
                          </Pressable>
                        ) : null}
                      </View>
                      {(
                        [
                          ['name', 'inv.col.name'],
                          ['code', 'inv.col.code'],
                          ['status', 'inv.col.status'],
                          ['sent', 'inv.col.lastSent'],
                        ] as const
                      ).map(([k, label]) => (
                        <Text key={k} style={{ flex: COL[k] }} className="font-m-bold text-[11px] uppercase tracking-wider text-neutral-500" numberOfLines={1}>
                          {t(label)}
                        </Text>
                      ))}
                      <Text style={{ flex: COL.actions, textAlign: 'right' }} className="font-m-bold text-[11px] uppercase tracking-wider text-neutral-500">
                        {t('inv.col.actions')}
                      </Text>
                    </View>
                    {pg.items.map((i, idx) => (
                      <InviteRow key={i.id} i={i} first={idx === 0} checked={selected.has(i.id)} {...rowProps} />
                    ))}
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    {pg.items.map((i) => (
                      <InviteCard key={i.id} i={i} checked={selected.has(i.id)} {...rowProps} />
                    ))}
                  </View>
                )}

                <Pagination
                  page={pg.page}
                  pages={pg.pages}
                  from={pg.from}
                  to={pg.to}
                  total={pg.total}
                  onPage={goTo}
                  pageSize={pageSize}
                  pageSizes={PAGE_SIZES}
                  onPageSize={setPageSize}
                  window={pageWindow(pg.page, pg.pages)}
                  prevIcon={<CaretLeft size={16} color="#E5E5E5" weight="bold" />}
                  nextIcon={<CaretRight size={16} color="#E5E5E5" weight="bold" />}
                  labels={pagerLabels(t, pg)}
                />
              </>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function pagerLabels(t: T, pg: { page: number; pages: number; from: number; to: number; total: number }) {
  return {
    showing: t('list.showing', { from: pg.from, to: pg.to, total: pg.total }),
    perPage: t('list.perPage'),
    prev: t('list.prev'),
    next: t('list.next'),
    page: (n: number) => t('list.page', { n }),
    pageOf: t('list.pageOf', { page: pg.page, pages: pg.pages }),
  }
}

function SelectIcon({ all, some }: { all: boolean; some: boolean }) {
  if (all) return <CheckSquare size={20} color={GREEN} weight="fill" />
  if (some) return <MinusSquare size={20} color={GREEN} weight="fill" />
  return <Square size={20} color="#737373" />
}

// ── rows ────────────────────────────────────────────────────────────────────

interface RowProps {
  i: Invite
  t: T
  locale: 'de' | 'en'
  checked: boolean
  busy: string | null
  first?: boolean
  onToggle: (id: string) => void
  onSend: (ids: string[]) => void
  onRevoke: (ids: string[]) => void
  onReopen: (id: string) => void
  onShare: (i: Invite) => void
}

function Actions({ i, t, busy, onSend, onRevoke, onReopen, onShare }: RowProps) {
  const ShareIcon = Platform.OS === 'web' ? Copy : ShareNetwork
  if (i.status === 'accepted') return null
  if (i.status === 'revoked') {
    return (
      <View className="flex-row flex-wrap justify-end gap-2">
        <SmallButton label={t('inv.reopen')} loading={busy === i.id} disabled={busy !== null} icon={<ArrowClockwise size={14} color={GREEN} />} onPress={() => onReopen(i.id)} />
      </View>
    )
  }
  return (
    <View className="flex-row flex-wrap items-center justify-end gap-2">
      <SmallButton
        label={i.send_count ? t('inv.resend') : t('inv.send')}
        variant={i.status === 'pending' || i.status === 'failed' ? 'primary' : 'ghost'}
        icon={<PaperPlaneTilt size={14} color={i.status === 'pending' || i.status === 'failed' ? '#0A0A0A' : GREEN} weight="bold" />}
        loading={busy === i.id}
        disabled={busy !== null}
        onPress={() => onSend([i.id])}
      />
      <IconBtn label={Platform.OS === 'web' ? t('inv.copy') : t('inv.share')} onPress={() => onShare(i)}>
        <ShareIcon size={16} color="#D4D4D4" />
      </IconBtn>
      <IconBtn label={t('inv.revoke')} onPress={() => onRevoke([i.id])} danger disabled={busy !== null}>
        <Prohibit size={16} color="#F87171" />
      </IconBtn>
    </View>
  )
}

function IconBtn({ label, onPress, children, danger, disabled }: { label: string; onPress: () => void; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      // web: native tooltip on hover
      {...(Platform.OS === 'web' ? ({ title: label } as any) : {})}
      className={`h-[38px] w-[38px] items-center justify-center rounded-xl border ${
        danger ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/15' : 'border-neutral-700 bg-neutral-900 hover:bg-neutral-800'
      } ${disabled ? 'opacity-50' : 'active:opacity-80'}`}
    >
      {children}
    </Pressable>
  )
}

function Check({ i, checked, onToggle }: Pick<RowProps, 'i' | 'checked' | 'onToggle'>) {
  if (i.status === 'accepted' || i.status === 'revoked') return <View style={{ width: 20 }} />
  return (
    <Pressable onPress={() => onToggle(i.id)} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={i.email}>
      {checked ? <CheckSquare size={20} color={GREEN} weight="fill" /> : <Square size={20} color="#737373" />}
    </Pressable>
  )
}

function lastSentText(i: Invite, t: T, locale: 'de' | 'en'): string {
  if (i.status === 'accepted' && i.accepted_at) return `${t('inv.acceptedAt')} ${formatDateTime(i.accepted_at, locale)}`
  if (i.last_sent_at) return `${formatDateTime(i.last_sent_at, locale)}${i.send_count > 1 ? ` · ${i.send_count}×` : ''}`
  return t('inv.neverSent')
}

function errorText(i: Invite, t: T): string | null {
  if (i.status === 'accepted') return null
  if (i.delivery_status === 'bounced' || i.delivery_status === 'complained') return t(`inv.delivery.${i.delivery_status}`)
  if (!i.last_error) return i.delivery_status === 'delayed' ? t('inv.delivery.delayed') : null
  if (i.last_error === 'mail_not_configured') return t('inv.mail.not_configured')
  if (i.last_error === 'provider_unavailable') return t('inv.mail.queued')
  return i.last_error.startsWith('resend_') ? t('inv.mail.failed') : i.last_error
}

function Avatar({ name, tone }: { name: string; tone: Tone }) {
  return (
    <View style={{ backgroundColor: TONE_BG[tone] }} className="h-9 w-9 items-center justify-center rounded-full">
      <Text style={{ color: TONE_FG[tone] }} className="font-m-black text-xs">
        {(name || '?').charAt(0).toUpperCase()}
      </Text>
    </View>
  )
}

function InviteRow(p: RowProps) {
  const { i, t, locale, checked, first } = p
  const err = errorText(i, t)
  const name = inviteName(i)
  return (
    <View className={`flex-row items-center px-4 py-3 ${checked ? 'bg-brand/5' : 'hover:bg-neutral-900'} ${first ? '' : 'border-t border-neutral-900'}`}>
      <View style={{ flex: COL.check }}>
        <Check {...p} />
      </View>
      <View style={{ flex: COL.name }} className="flex-row items-center gap-3 pr-3">
        <Avatar name={name || i.email} tone={STATUS_TONE[i.status]} />
        <View className="flex-1">
          <Text className="font-m-semibold text-sm text-neutral-100" numberOfLines={1}>
            {name || i.email}
          </Text>
          {name ? (
            <Text className="font-m-regular text-xs text-neutral-500" numberOfLines={1}>
              {i.email}
            </Text>
          ) : null}
          {err ? (
            <View className="mt-0.5 flex-row items-center gap-1">
              <Warning size={12} color="#F87171" weight="fill" />
              <Text className="font-m-medium flex-1 text-[11px] text-red-400" numberOfLines={1}>
                {err}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={{ flex: COL.code }} className="pr-3">
        <Text className="font-m-bold text-[13px] tracking-wide text-neutral-100" selectable numberOfLines={1}>
          {i.student_code}
        </Text>
        <Text className="font-m-regular text-[11px] text-neutral-500" numberOfLines={1}>
          {t(`inv.source.${i.code_source}`)}
        </Text>
      </View>
      <View style={{ flex: COL.status }} className="pr-3">
        <Badge label={t(`inv.status.${i.status}`)} tone={STATUS_TONE[i.status]} />
      </View>
      <Text style={{ flex: COL.sent }} className="font-m-regular pr-3 text-xs text-neutral-400" numberOfLines={2}>
        {lastSentText(i, t, locale)}
      </Text>
      <View style={{ flex: COL.actions }}>
        <Actions {...p} />
      </View>
    </View>
  )
}

function InviteCard(p: RowProps) {
  const { i, t, locale, checked } = p
  const err = errorText(i, t)
  const name = inviteName(i)
  return (
    <View className={`gap-3 rounded-2xl border p-3.5 ${checked ? 'border-brand/40 bg-brand/5' : 'border-neutral-800 bg-neutral-900'}`}>
      <View className="flex-row items-center gap-3">
        <Check {...p} />
        <View className="flex-1 gap-0.5">
          <Text className="font-m-semibold text-[15px] text-neutral-100" numberOfLines={1}>
            {name || i.email}
          </Text>
          {name ? (
            <Text className="font-m-regular text-xs text-neutral-500" numberOfLines={1}>
              {i.email}
            </Text>
          ) : null}
        </View>
        <Badge label={t(`inv.status.${i.status}`)} tone={STATUS_TONE[i.status]} />
      </View>
      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1 pl-8">
        <Badge label={i.student_code} />
        <Text className="font-m-regular text-[11px] text-neutral-500">{lastSentText(i, t, locale)}</Text>
      </View>
      {err ? (
        <View className="flex-row items-center gap-1.5 pl-8">
          <Warning size={13} color="#F87171" weight="fill" />
          <Text className="font-m-medium flex-1 text-xs text-red-400">{err}</Text>
        </View>
      ) : null}
      {i.status !== 'accepted' ? (
        <View className="pl-8">
          <Actions {...p} />
        </View>
      ) : null}
    </View>
  )
}

// ── imports ─────────────────────────────────────────────────────────────────

function ImportList({
  imports,
  wide,
  t,
  locale,
  onOpen,
}: {
  imports: StudentImport[]
  wide: boolean
  t: T
  locale: 'de' | 'en'
  onOpen: (id: string) => void
}) {
  if (!imports.length) {
    return (
      <View className="rounded-2xl border border-neutral-800 bg-neutral-950">
        <Empty title={t('inv.noImports')} body={t('inv.noImportsBody')} />
      </View>
    )
  }
  const num = (n: number, tone: Tone) => (
    <Text style={{ color: n ? TONE_FG[tone] : '#525252' }} className="font-m-bold text-[13px]">
      {n}
    </Text>
  )
  if (wide) {
    const cols = [
      { label: t('inv.imp.file'), flex: 3 },
      { label: t('inv.imp.date'), flex: 1.8 },
      { label: t('inv.imp.invited'), flex: 1 },
      { label: t('inv.imp.sent'), flex: 1 },
      { label: t('inv.imp.registered'), flex: 1 },
      { label: t('inv.imp.skipped'), flex: 1.1 },
      { label: t('inv.imp.failed'), flex: 0.9 },
    ]
    return (
      <View className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
        <View className="flex-row border-b border-neutral-800 bg-neutral-900/60 px-4 py-3">
          {cols.map((c) => (
            <Text key={c.label} style={{ flex: c.flex }} className="font-m-bold pr-2 text-[11px] uppercase tracking-wider text-neutral-500" numberOfLines={1}>
              {c.label}
            </Text>
          ))}
          <View style={{ width: 16 }} />
        </View>
        {imports.map((im, idx) => (
          <Pressable
            key={im.id}
            onPress={() => onOpen(im.id)}
            accessibilityRole="link"
            accessibilityLabel={im.file_name}
            className={`flex-row items-center px-4 py-3.5 hover:bg-neutral-900 active:bg-neutral-900 ${idx ? 'border-t border-neutral-900' : ''}`}
          >
            <View style={{ flex: 3 }} className="flex-row items-center gap-2 pr-3">
              <Badge label={im.file_format.toUpperCase()} tone="green" />
              <Text className="font-m-semibold flex-1 text-sm text-neutral-100" numberOfLines={1}>
                {im.file_name}
              </Text>
            </View>
            <Text style={{ flex: 1.8 }} className="font-m-regular pr-3 text-xs text-neutral-400" numberOfLines={1}>
              {formatDateTime(im.created_at, locale)}
            </Text>
            <View style={{ flex: 1 }}>{num(im.invited, 'green')}</View>
            <View style={{ flex: 1 }}>{num(im.emails_sent, 'blue')}</View>
            <View style={{ flex: 1 }}>{num(im.already_registered, 'gray')}</View>
            <View style={{ flex: 1.1 }}>{num(im.skipped, 'amber')}</View>
            <View style={{ flex: 0.9 }}>{num(im.emails_failed, 'red')}</View>
            <CaretRight size={16} color="#525252" />
          </Pressable>
        ))}
      </View>
    )
  }
  return (
    <View style={{ gap: 8 }}>
      {imports.map((im) => (
        <Pressable
          key={im.id}
          onPress={() => onOpen(im.id)}
          accessibilityRole="link"
          accessibilityLabel={im.file_name}
          className="gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 p-3.5 active:opacity-80"
        >
          <View className="flex-row items-center gap-2">
            <Badge label={im.file_format.toUpperCase()} tone="green" />
            <Text className="font-m-semibold flex-1 text-[15px] text-neutral-100" numberOfLines={1}>
              {im.file_name}
            </Text>
            <CaretRight size={16} color="#525252" />
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
