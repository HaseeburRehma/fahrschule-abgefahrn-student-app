/**
 * Admin → Fahrschüler. Search, filters with counts, sorting and pagination.
 * Desktop: table. Phone: compact cards. `?filter=no_package` etc. preselects
 * a filter (used by the dashboard's to-do list).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { UserPlus } from 'phosphor-react-native/src/icons/UserPlus'
import { UploadSimple } from 'phosphor-react-native/src/icons/UploadSimple'
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight'
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft'
import { BookOpen } from 'phosphor-react-native/src/icons/BookOpen'
import { MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass'
import { X } from 'phosphor-react-native/src/icons/X'

import { useTranslation } from '@/lib/i18n'
import { fetchStudentsWithPlans, type StudentWithPlan } from '@/lib/admin'
import {
  PAGE_SIZES,
  STUDENT_FILTERS,
  STUDENT_SORTS,
  countByFilter,
  daysAgo,
  matchesStudent,
  pageWindow,
  paginate,
  sortStudents,
  studentName,
  type StudentFilter,
  type StudentSort,
} from '@/lib/admin-list'
import {
  ADMIN_MAX_WIDTH,
  Badge,
  Chip,
  ChipRow,
  Empty,
  GREEN,
  PageHeader,
  Pagination,
  SearchField,
  Segmented,
  SmallButton,
  Spinner,
  useSidebar,
  useWide,
} from '@/components/admin/kit'

const COLS = [
  { key: 'student', flex: 3.2 },
  { key: 'code', flex: 1.3 },
  { key: 'package', flex: 1.7 },
  { key: 'topic', flex: 2.2 },
  { key: 'lastActive', flex: 1.3 },
  { key: 'status', flex: 1.1 },
] as const

export default function StudentsList() {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const wide = useWide()
  const sidebar = useSidebar()
  const params = useLocalSearchParams<{ filter?: string }>()
  const initialFilter = STUDENT_FILTERS.includes(params.filter as StudentFilter) ? (params.filter as StudentFilter) : 'all'

  const [rows, setRows] = useState<StudentWithPlan[] | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StudentFilter>(initialFilter)
  const [sort, setSort] = useState<StudentSort>('newest')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [refreshing, setRefreshing] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  const load = useCallback(async () => {
    try {
      setRows(await fetchStudentsWithPlans())
    } catch {
      setRows((r) => r ?? [])
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  // the dashboard links here with ?filter=…
  useEffect(() => {
    if (params.filter && STUDENT_FILTERS.includes(params.filter as StudentFilter)) setFilter(params.filter as StudentFilter)
  }, [params.filter])

  // new search / filter / sort / page size → back to page 1
  useEffect(() => setPage(1), [query, filter, sort, pageSize])

  const counts = useMemo(() => countByFilter(rows ?? []), [rows])
  const visible = useMemo(
    () => sortStudents((rows ?? []).filter((r) => matchesStudent(r, query, filter)), sort),
    [rows, query, filter, sort],
  )
  const pg = paginate(visible, page, pageSize)

  const goTo = (p: number) => {
    setPage(p)
    scrollRef.current?.scrollTo({ y: 0, animated: true })
  }

  const lastActive = (iso: string | null | undefined) => {
    const d = daysAgo(iso)
    if (d === null) return t('stu.never')
    if (d === 0) return t('stu.today')
    if (d === 1) return t('stu.yesterday')
    return t('stu.daysAgo', { n: d })
  }
  const pkgName = (s: StudentWithPlan) => s.packages.map((p) => (locale === 'de' ? p.name_de : p.name_en)).join(', ')
  const topicName = (s: StudentWithPlan) =>
    s.topic ? `${s.topic.number}. ${locale === 'de' ? s.topic.title_de : s.topic.title_en}` : ''

  const open = (id: string) => router.push(`/admin/students/${id}` as any)

  const actions = (
    <>
      <View style={{ flex: wide ? undefined : 1 }}>
        <SmallButton label={wide ? t('inv.importList') : t('stu.importShort')} icon={<UploadSimple size={16} color={GREEN} />} onPress={() => router.push('/admin/students/import' as any)} />
      </View>
      <View style={{ flex: wide ? undefined : 1 }}>
        <SmallButton variant="primary" label={wide ? t('admin.addStudent') : t('stu.addShort')} icon={<UserPlus size={16} color="#0A0A0A" weight="bold" />} onPress={() => router.push('/admin/students/new')} />
      </View>
    </>
  )

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.students'), headerShown: !sidebar }} />
      {rows === null ? (
        <Spinner />
      ) : (
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={GREEN}
              onRefresh={async () => {
                setRefreshing(true)
                await load()
                setRefreshing(false)
              }}
            />
          }
        >
          <View style={{ width: '100%', maxWidth: ADMIN_MAX_WIDTH, alignSelf: 'center', padding: wide ? 28 : 16, gap: 16 }}>
            <PageHeader
              title={t('admin.students')}
              subtitle={t('stu.summary', { total: counts.all, active: counts.active })}
              actions={actions}
            />

            {/* toolbar */}
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: wide ? 'row' : 'column', gap: 12, alignItems: wide ? 'center' : 'stretch' }}>
                <View style={{ flex: wide ? 1 : undefined, maxWidth: wide ? 460 : undefined }}>
                  <SearchField
                    value={query}
                    onChange={setQuery}
                    placeholder={t('stu.search')}
                    clearLabel={t('list.clear')}
                    icon={<MagnifyingGlass size={18} color="#737373" />}
                    clearIcon={<X size={16} color="#A3A3A3" />}
                  />
                </View>
                {wide ? (
                  <View style={{ marginLeft: 'auto' }}>
                    <Segmented
                      label={t('list.sort')}
                      options={STUDENT_SORTS.map((s) => ({ value: s, label: t(`stu.sort.${s}`) }))}
                      value={sort}
                      onChange={setSort}
                    />
                  </View>
                ) : null}
              </View>
              <ChipRow>
                {STUDENT_FILTERS.map((f) => (
                  <Chip key={f} label={t(`stu.filter.${f}`)} count={counts[f]} active={filter === f} onPress={() => setFilter(f)} />
                ))}
              </ChipRow>
              {!wide ? (
                <ChipRow>
                  {STUDENT_SORTS.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setSort(s)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: sort === s }}
                      className={`rounded-lg px-3 py-1.5 ${sort === s ? 'bg-neutral-800' : ''}`}
                    >
                      <Text className={`font-m-semibold text-xs ${sort === s ? 'text-neutral-50' : 'text-neutral-500'}`}>{t(`stu.sort.${s}`)}</Text>
                    </Pressable>
                  ))}
                </ChipRow>
              ) : null}
            </View>

            {/* list */}
            {pg.total === 0 ? (
              <View className="rounded-2xl border border-neutral-800 bg-neutral-950">
                <Empty
                  title={rows.length ? t('stu.noMatch') : t('admin.noStudents')}
                  body={rows.length ? t('stu.noMatchHint') : undefined}
                />
                {rows.length && (query || filter !== 'all') ? (
                  <View className="items-center pb-8">
                    <SmallButton
                      label={t('stu.reset')}
                      onPress={() => {
                        setQuery('')
                        setFilter('all')
                      }}
                    />
                  </View>
                ) : null}
              </View>
            ) : wide ? (
              <View className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
                <View className="flex-row border-b border-neutral-800 bg-neutral-900/60 px-4 py-3">
                  {COLS.map((c) => (
                    <Text key={c.key} style={{ flex: c.flex }} className="font-m-bold text-[11px] uppercase tracking-wider text-neutral-500" numberOfLines={1}>
                      {t(`stu.col.${c.key}`)}
                    </Text>
                  ))}
                  <View style={{ width: 20 }} />
                </View>
                {pg.items.map((s, i) => {
                  const p = s.profile
                  const name = studentName(s) || p.email || '—'
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => open(p.id)}
                      accessibilityRole="link"
                      accessibilityLabel={name}
                      className={`flex-row items-center px-4 py-3 hover:bg-neutral-900 active:bg-neutral-900 ${i ? 'border-t border-neutral-900' : ''}`}
                    >
                      <View style={{ flex: COLS[0].flex }} className="flex-row items-center gap-3 pr-3">
                        <Avatar name={name} muted={!p.is_active} />
                        <View className="flex-1">
                          <Text className="font-m-semibold text-sm text-neutral-100" numberOfLines={1}>
                            {name}
                          </Text>
                          {p.email ? (
                            <Text className="font-m-regular text-xs text-neutral-500" numberOfLines={1}>
                              {p.email}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <Text style={{ flex: COLS[1].flex }} className="font-m-semibold pr-3 text-xs text-neutral-300" numberOfLines={1}>
                        {p.student_code ?? '—'}
                      </Text>
                      <View style={{ flex: COLS[2].flex }} className="pr-3">
                        {s.packages.length ? <Badge label={pkgName(s)} tone="green" /> : <Text className="font-m-regular text-xs text-neutral-600">—</Text>}
                      </View>
                      <Text style={{ flex: COLS[3].flex }} className={`font-m-regular pr-3 text-xs ${s.topic ? 'text-neutral-300' : 'text-neutral-600'}`} numberOfLines={1}>
                        {topicName(s) || '—'}
                      </Text>
                      <Text style={{ flex: COLS[4].flex }} className="font-m-regular pr-3 text-xs text-neutral-400" numberOfLines={1}>
                        {lastActive(p.last_active_on)}
                      </Text>
                      <View style={{ flex: COLS[5].flex }}>
                        <Badge label={p.is_active ? t('stu.active') : t('stu.inactive')} tone={p.is_active ? 'green' : 'red'} />
                      </View>
                      <CaretRight size={16} color="#525252" />
                    </Pressable>
                  )
                })}
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {pg.items.map((s) => {
                  const p = s.profile
                  const name = studentName(s) || p.email || '—'
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => open(p.id)}
                      accessibilityRole="link"
                      accessibilityLabel={name}
                      className="flex-row items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-3.5 active:opacity-80"
                    >
                      <Avatar name={name} muted={!p.is_active} />
                      <View className="flex-1 gap-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="font-m-semibold flex-shrink text-[15px] text-neutral-100" numberOfLines={1}>
                            {name}
                          </Text>
                          {!p.is_active ? <Badge label={t('stu.inactive')} tone="red" /> : null}
                        </View>
                        {p.email ? (
                          <Text className="font-m-regular text-xs text-neutral-500" numberOfLines={1}>
                            {p.email}
                          </Text>
                        ) : null}
                        <View className="mt-0.5 flex-row flex-wrap items-center gap-1.5">
                          {s.packages.length ? <Badge label={pkgName(s)} tone="green" /> : null}
                          {p.student_code ? <Badge label={p.student_code} /> : null}
                        </View>
                        {s.topic ? (
                          <View className="flex-row items-center gap-1">
                            <BookOpen size={12} color="#737373" />
                            <Text className="font-m-regular flex-1 text-[11px] text-neutral-400" numberOfLines={1}>
                              {topicName(s)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <CaretRight size={18} color="#525252" />
                    </Pressable>
                  )
                })}
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
              labels={{
                showing: t('list.showing', { from: pg.from, to: pg.to, total: pg.total }),
                perPage: t('list.perPage'),
                prev: t('list.prev'),
                next: t('list.next'),
                page: (n) => t('list.page', { n }),
                pageOf: t('list.pageOf', { page: pg.page, pages: pg.pages }),
              }}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function Avatar({ name, muted }: { name: string; muted?: boolean }) {
  return (
    <View className={`h-10 w-10 items-center justify-center rounded-full ${muted ? 'bg-neutral-800' : 'bg-brand/10'}`}>
      <Text className={`font-m-black text-sm ${muted ? 'text-neutral-500' : 'text-brand'}`}>{(name || '?').charAt(0).toUpperCase()}</Text>
    </View>
  )
}
