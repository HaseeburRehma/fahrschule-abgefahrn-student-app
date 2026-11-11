/**
 * Admin → Leistung: performance of every student at a glance.
 * KPIs, filters (inaktiv, Prüfung bald, braucht Hilfe, prüfungsreif, neu),
 * search, sorting, table on wide screens / cards on phones, CSV export.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Export } from 'phosphor-react-native/src/icons/Export'
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight'
import { Fire } from 'phosphor-react-native/src/icons/Fire'

import { useTranslation } from '@/lib/i18n'
import { fetchPerformance, isNotDeployed, type StudentPerformance } from '@/lib/invites'
import {
  TOPIC_COUNT,
  derive,
  kpis,
  matches,
  sortRows,
  berlinDay,
  toCsv,
  type Derived,
  type FilterKey,
  type Flag,
  type SortKey,
} from '@/lib/performance'
import { formatDate } from '@/lib/format'
import {
  ADMIN_MAX_WIDTH,
  Badge,
  Chip,
  ChipRow,
  Empty,
  Grid,
  GREEN,
  Kpi,
  Notice,
  ProgressBar,
  SmallButton,
  Spinner,
  downloadText,
  useWide,
  type Tone,
} from '@/components/admin/kit'

type Row = { p: StudentPerformance; d: Derived }

const FLAG_TONE: Record<Flag, Tone> = {
  inactive: 'gray',
  exam_soon: 'amber',
  struggling: 'red',
  ready: 'green',
  new: 'blue',
}

export default function PerformanceScreen() {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const wide = useWide()

  const [data, setData] = useState<StudentPerformance[] | null>(null)
  const [notDeployed, setNotDeployed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // the dashboard's to-do list links here with ?filter=inactive|exam_soon|struggling|…
  const params = useLocalSearchParams<{ filter?: string }>()
  const FILTERS: FilterKey[] = ['all', 'inactive', 'exam_soon', 'struggling', 'ready', 'new']
  const paramFilter = FILTERS.includes(params.filter as FilterKey) ? (params.filter as FilterKey) : null
  const [filter, setFilter] = useState<FilterKey>(paramFilter ?? 'all')
  useEffect(() => {
    if (paramFilter) setFilter(paramFilter)
  }, [paramFilter])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('readiness')
  const [desc, setDesc] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showInactiveAccounts, setShowInactiveAccounts] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await fetchPerformance())
      setNotDeployed(false)
      setError(null)
    } catch (e: any) {
      if (isNotDeployed(e)) setNotDeployed(true)
      else setError(e?.message ?? t('common.error'))
      setData([])
    }
  }, [t])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const rows = useMemo<Row[]>(() => (data ?? []).map((p) => ({ p, d: derive(p) })), [data])
  const k = useMemo(() => kpis(rows), [rows])
  const flagCounts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: 0, inactive: 0, exam_soon: 0, struggling: 0, ready: 0, new: 0 }
    for (const r of rows) {
      if (!r.p.is_active) continue
      c.all++
      for (const f of r.d.flags) c[f]++
    }
    return c
  }, [rows])
  const shown = useMemo(
    () => sortRows(rows.filter((r) => (showInactiveAccounts || r.p.is_active) && matches(r.p, r.d, query, filter)), sort, desc),
    [rows, query, filter, sort, desc, showInactiveAccounts],
  )

  function pickSort(key: SortKey) {
    if (key === sort) setDesc((d) => !d)
    else {
      setSort(key)
      setDesc(key !== 'name' && key !== 'activity' && key !== 'exam')
    }
  }

  function exportCsv() {
    const header = [
      t('perf.col.name'), 'E-Mail', t('perf.col.code'), t('perf.col.readiness'), t('perf.col.accuracy'),
      t('perf.col.topicsDone'), t('perf.col.mastered'), t('perf.col.rounds'), 'XP', t('perf.col.xpWeek'),
      t('perf.col.streak'), t('perf.col.lastActive'), t('perf.col.lessons'), t('perf.col.lessonsDone'),
      t('perf.col.theoryExam'), t('perf.col.practicalExam'), t('perf.col.flags'),
    ]
    const body = shown.map(({ p, d }) => [
      d.name, p.email, p.student_code, d.readiness, d.accuracy ?? '', p.topics_done, p.topics_mastered, p.quiz_rounds,
      p.xp_total, p.xp_week, p.streak_days, d.daysSinceActive ?? '', p.driving_lessons, p.lessons_completed,
      p.theory_exam_date ?? '', p.practical_exam_date ?? '', d.flags.map((f) => t(`perf.flag.${f}`)).join(', '),
    ])
    downloadText(`leistung-${berlinDay(new Date())}.csv`, toCsv(header, body)).catch(() => {})
  }

  if (data === null) {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <Stack.Screen options={{ title: t('perf.title') }} />
        <Spinner />
      </SafeAreaView>
    )
  }

  const sortKeys: SortKey[] = ['readiness', 'accuracy', 'activity', 'xp_week', 'lessons', 'exam', 'name']

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('perf.title') }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={Platform.OS === 'web' ? undefined : <RefreshControl refreshing={refreshing} tintColor={GREEN} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }} />}
      >
        <View style={{ width: '100%', maxWidth: ADMIN_MAX_WIDTH, alignSelf: 'center', padding: 20, gap: 16 }}>
          {notDeployed ? <Notice title={t('inv.notDeployedTitle')} body={t('inv.notDeployedBody')} /> : null}
          {error ? <Notice title={error} tone="red" /> : null}

          <Grid cols={6} phoneCols={2}>
            <Kpi label={t('perf.k.students')} value={k.students} />
            <Kpi label={t('perf.k.activeWeek')} value={k.activeWeek} hint={k.students ? `${Math.round((100 * k.activeWeek) / k.students)} %` : undefined} />
            <Kpi label={t('perf.k.accuracy')} value={k.avgAccuracy === null ? '—' : `${k.avgAccuracy} %`} tone="blue" />
            <Kpi label={t('perf.k.xpWeek')} value={k.xpWeek} tone="blue" />
            <Kpi label={t('perf.k.examsSoon')} value={k.examsSoon} tone={k.examsSoon ? 'amber' : 'gray'} hint={t('perf.k.examsSoonHint')} />
            <Kpi label={t('perf.k.inactive')} value={k.inactive} tone={k.inactive ? 'red' : 'gray'} hint={t('perf.k.inactiveHint')} />
          </Grid>

          <ChipRow>
            {(['all', 'inactive', 'exam_soon', 'struggling', 'ready', 'new'] as FilterKey[]).map((f) => (
              <Chip key={f} label={f === 'all' ? t('perf.all') : t(`perf.flag.${f}`)} active={filter === f} onPress={() => setFilter(f)} count={flagCounts[f]} />
            ))}
          </ChipRow>

          <View className="gap-3" style={wide ? { flexDirection: 'row', alignItems: 'center' } : undefined}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('perf.search')}
              placeholderTextColor="#6B7280"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t('perf.search')}
              className="font-m-medium rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-base text-neutral-100"
              style={wide ? { flex: 1 } : undefined}
            />
            <View className="flex-row flex-wrap gap-2">
              <SmallButton label={t('perf.export')} icon={<Export size={15} color={GREEN} />} onPress={exportCsv} disabled={!shown.length} />
              <SmallButton
                label={showInactiveAccounts ? t('perf.hideDeactivated') : t('perf.showDeactivated')}
                onPress={() => setShowInactiveAccounts((v) => !v)}
              />
            </View>
          </View>

          {!wide ? (
            <ChipRow>
              {sortKeys.map((s) => (
                <Chip key={s} label={`${t(`perf.sort.${s}`)}${sort === s ? (desc ? ' ↓' : ' ↑') : ''}`} active={sort === s} onPress={() => pickSort(s)} />
              ))}
            </ChipRow>
          ) : null}

          {!shown.length ? (
            <Empty title={rows.length ? t('common.empty') : t('perf.emptyTitle')} body={rows.length ? undefined : t('perf.emptyBody')} />
          ) : wide ? (
            <View className="rounded-2xl border border-neutral-800 bg-neutral-900 pt-3">
              <SortableHeader sort={sort} desc={desc} onSort={pickSort} />
              {shown.map((r) => (
                <WideRow key={r.p.student_id} r={r} onOpen={() => router.push(`/admin/students/${r.p.student_id}` as any)} />
              ))}
            </View>
          ) : (
            <View className="gap-2">
              {shown.map((r) => (
                <Card key={r.p.student_id} r={r} locale={locale} onOpen={() => router.push(`/admin/students/${r.p.student_id}` as any)} />
              ))}
            </View>
          )}
          <Text className="font-m-regular text-center text-[11px] text-neutral-600">{t('perf.readinessHelp')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function SortableHeader({ sort, desc, onSort }: { sort: SortKey; desc: boolean; onSort: (k: SortKey) => void }) {
  const { t } = useTranslation()
  const cols: { key: SortKey | null; label: string; flex: number }[] = [
    { key: 'name', label: t('perf.col.name'), flex: 2.4 },
    { key: 'readiness', label: t('perf.sort.readiness'), flex: 1.5 },
    { key: 'accuracy', label: t('perf.col.accuracy'), flex: 1 },
    { key: null, label: t('perf.col.topics'), flex: 1.4 },
    { key: 'xp_week', label: t('perf.col.xpWeek'), flex: 0.9 },
    { key: 'activity', label: t('perf.col.lastActive'), flex: 1.1 },
    { key: 'lessons', label: t('perf.col.lessonsShort'), flex: 1 },
    { key: 'exam', label: t('perf.sort.exam'), flex: 1.3 },
    { key: null, label: '', flex: 1.8 },
  ]
  return (
    <View className="flex-row border-b border-neutral-800 px-3 pb-2">
      {cols.map((c, i) =>
        c.key ? (
          <Pressable key={i} style={{ flex: c.flex }} onPress={() => onSort(c.key!)} accessibilityRole="button" accessibilityLabel={`${t('perf.sortBy')} ${c.label}`}>
            <Text className={`font-m-bold text-[11px] uppercase tracking-wide ${sort === c.key ? 'text-brand' : 'text-neutral-500'}`} numberOfLines={1}>
              {c.label}
              {sort === c.key ? (desc ? ' ↓' : ' ↑') : ''}
            </Text>
          </Pressable>
        ) : (
          <View key={i} style={{ flex: c.flex }}>
            <TableHeaderLabel label={c.label} />
          </View>
        ),
      )}
    </View>
  )
}

function TableHeaderLabel({ label }: { label: string }) {
  return <Text className="font-m-bold text-[11px] uppercase tracking-wide text-neutral-500" numberOfLines={1}>{label}</Text>
}

function activityText(t: (k: string, v?: Record<string, string | number>) => string, days: number | null): string {
  if (days === null) return t('perf.never')
  if (days === 0) return t('perf.today')
  if (days === 1) return t('perf.yesterday')
  return t('perf.daysAgo', { n: days })
}

function examText(t: (k: string, v?: Record<string, string | number>) => string, d: Derived): string {
  if (!d.nextExam) return '—'
  const kind = t(d.nextExam.kind === 'theory' ? 'perf.theory' : 'perf.practical')
  return `${kind} · ${d.nextExam.inDays === 0 ? t('perf.today') : t('perf.inDays', { n: d.nextExam.inDays })}`
}

function readinessTone(n: number): Tone {
  return n >= 75 ? 'green' : n >= 45 ? 'amber' : 'red'
}

function Flags({ d, p }: Row) {
  const { t } = useTranslation()
  return (
    <View className="flex-row flex-wrap gap-1">
      {!p.is_active ? <Badge label={t('perf.deactivated')} tone="red" /> : null}
      {d.flags.map((f) => (
        <Badge key={f} label={t(`perf.flag.${f}`)} tone={FLAG_TONE[f]} />
      ))}
    </View>
  )
}

function WideRow({ r, onOpen }: { r: Row; onOpen: () => void }) {
  const { t } = useTranslation()
  const { p, d } = r
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={d.name} className="flex-row items-center border-b border-neutral-800/60 px-3 py-3 active:bg-neutral-800/50">
      <View style={{ flex: 2.4 }} className="pr-2">
        <Text className="font-m-semibold text-[13px] text-neutral-100" numberOfLines={1}>{d.name}</Text>
        <Text className="font-m-regular text-[11px] text-neutral-500" numberOfLines={1}>{p.student_code ?? p.email}</Text>
      </View>
      <View style={{ flex: 1.5 }} className="gap-1 pr-3">
        <Text className="font-m-bold text-[13px] text-neutral-100">{d.readiness} %</Text>
        <ProgressBar pct={d.readiness} tone={readinessTone(d.readiness)} />
      </View>
      <Text style={{ flex: 1 }} className="font-m-semibold text-[13px] text-neutral-200">{d.accuracy === null ? '—' : `${d.accuracy} %`}</Text>
      <Text style={{ flex: 1.4 }} className="font-m-regular text-[13px] text-neutral-300">
        {p.topics_mastered}/{TOPIC_COUNT} <Text className="text-neutral-500">· {p.topics_done} {t('perf.done')}</Text>
      </Text>
      <Text style={{ flex: 0.9 }} className="font-m-semibold text-[13px] text-neutral-200">{p.xp_week}</Text>
      <Text style={{ flex: 1.1 }} className="font-m-regular text-[13px] text-neutral-300" numberOfLines={1}>{activityText(t, d.daysSinceActive)}</Text>
      <Text style={{ flex: 1 }} className="font-m-regular text-[13px] text-neutral-300">{Math.max(p.driving_lessons, p.lessons_completed)}</Text>
      <Text style={{ flex: 1.3 }} className="font-m-regular text-[12px] text-neutral-300" numberOfLines={2}>{examText(t, d)}</Text>
      <View style={{ flex: 1.8 }}>
        <Flags {...r} />
      </View>
    </Pressable>
  )
}

function Card({ r, locale, onOpen }: { r: Row; locale: 'de' | 'en'; onOpen: () => void }) {
  const { t } = useTranslation()
  const { p, d } = r
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={d.name} className="gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 active:opacity-80">
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="font-m-semibold text-[15px] text-neutral-100" numberOfLines={1}>{d.name}</Text>
          <Text className="font-m-regular text-xs text-neutral-500" numberOfLines={1}>
            {p.student_code ?? p.email} · {activityText(t, d.daysSinceActive)}
          </Text>
        </View>
        {p.streak_days > 1 ? (
          <View className="flex-row items-center gap-1">
            <Fire size={14} color="#FFC233" weight="fill" />
            <Text className="font-m-bold text-xs text-amber-300">{p.streak_days}</Text>
          </View>
        ) : null}
        <CaretRight size={16} color="#737373" />
      </View>
      <View className="gap-1.5">
        <View className="flex-row justify-between">
          <Text className="font-m-medium text-xs text-neutral-400">{t('perf.col.readiness')}</Text>
          <Text className="font-m-bold text-xs text-neutral-100">{d.readiness} %</Text>
        </View>
        <ProgressBar pct={d.readiness} tone={readinessTone(d.readiness)} />
      </View>
      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        <Stat label={t('perf.col.accuracy')} value={d.accuracy === null ? '—' : `${d.accuracy} %`} />
        <Stat label={t('perf.col.mastered')} value={`${p.topics_mastered}/${TOPIC_COUNT}`} />
        <Stat label={t('perf.col.xpWeek')} value={String(p.xp_week)} />
        <Stat label={t('perf.col.lessons')} value={String(Math.max(p.driving_lessons, p.lessons_completed))} />
        {d.nextExam ? <Stat label={t('perf.col.exam')} value={`${formatDate(d.nextExam.date, locale)}`} /> : null}
      </View>
      {d.flags.length || !p.is_active ? <Flags {...r} /> : null}
    </Pressable>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="font-m-bold text-[13px] text-neutral-100">{value}</Text>
      <Text className="font-m-regular text-[11px] text-neutral-500">{label}</Text>
    </View>
  )
}
