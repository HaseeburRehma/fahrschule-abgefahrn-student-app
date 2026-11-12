/**
 * Admin dashboard — greeting, four headline numbers, a to-do list built from
 * live data (sign-ups, undelivered invites, inactive / struggling students,
 * exams soon, students without a package), newest students and quick actions.
 * Phones additionally get every admin area as a grouped menu (no sidebar).
 */

import React, { useCallback, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { Users } from 'phosphor-react-native/src/icons/Users'
import { Lightning } from 'phosphor-react-native/src/icons/Lightning'
import { Target } from 'phosphor-react-native/src/icons/Target'
import { CalendarCheck } from 'phosphor-react-native/src/icons/CalendarCheck'
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight'
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft'
import { UploadSimple } from 'phosphor-react-native/src/icons/UploadSimple'
import { UserPlus } from 'phosphor-react-native/src/icons/UserPlus'
import { PaperPlaneTilt } from 'phosphor-react-native/src/icons/PaperPlaneTilt'
import { EnvelopeSimple } from 'phosphor-react-native/src/icons/EnvelopeSimple'
import { Tray } from 'phosphor-react-native/src/icons/Tray'
import { Warning } from 'phosphor-react-native/src/icons/Warning'
import { Moon } from 'phosphor-react-native/src/icons/Moon'
import { GraduationCap } from 'phosphor-react-native/src/icons/GraduationCap'
import { Lifebuoy } from 'phosphor-react-native/src/icons/Lifebuoy'
import { Package } from 'phosphor-react-native/src/icons/Package'
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle'

import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { fetchAdminStats, fetchStudentsWithPlans, type AdminStats, type StudentWithPlan } from '@/lib/admin'
import { fetchInvites, fetchPerformance, type Invite, type StudentPerformance } from '@/lib/invites'
import { derive, kpis } from '@/lib/performance'
import { daysAgo, sortStudents, studentName } from '@/lib/admin-list'
import { useFeatureFlags } from '@/lib/flags'
import { formatDate } from '@/lib/format'
import { ADMIN_MAX_WIDTH, Badge, GREEN, ProgressBar, useSidebar, useWide, type Tone } from '@/components/admin/kit'
import { useAdminNav } from '@/components/admin/nav'

type IconC = React.ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'bold' | 'fill' }>

const TONE_FG: Record<Tone, string> = { green: GREEN, red: '#FF7A7A', amber: '#FFC233', blue: '#7CB8FF', gray: '#A3A3A3' }
const TONE_BG: Record<Tone, string> = {
  green: 'rgba(0,255,36,0.10)',
  red: 'rgba(255,90,90,0.12)',
  amber: 'rgba(255,184,0,0.12)',
  blue: 'rgba(80,160,255,0.12)',
  gray: 'rgba(255,255,255,0.06)',
}

export default function AdminHome() {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const wide = useWide()
  const sidebar = useSidebar()
  const { profile } = useUser()
  const { flags } = useFeatureFlags()
  const nav = useAdminNav()

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [perf, setPerf] = useState<StudentPerformance[] | null>(null)
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [students, setStudents] = useState<StudentWithPlan[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    await Promise.all([
      fetchAdminStats().then(setStats).catch(() => {}),
      fetchPerformance().then(setPerf).catch(() => setPerf(null)),
      fetchInvites().then(setInvites).catch(() => setInvites(null)),
      fetchStudentsWithPlans().then(setStudents).catch(() => setStudents(null)),
    ])
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const rows = useMemo(() => (perf ? perf.map((p) => ({ p, d: derive(p) })) : null), [perf])
  const k = useMemo(() => (rows ? kpis(rows) : null), [rows])
  const struggling = rows?.filter((r) => r.p.is_active && r.d.flags.includes('struggling')).length ?? 0
  const failedInvites = invites?.filter((i) => i.status === 'failed').length ?? 0
  const openInvites = invites?.filter((i) => i.status === 'pending' || i.status === 'sent').length ?? 0
  const noPackage = students?.filter((s) => s.profile.is_active && !s.packages.length).length ?? 0
  const recent = useMemo(() => sortStudents(students ?? [], 'newest').slice(0, wide ? 6 : 4), [students, wide])

  const hour = new Date().getHours()
  const hello = t(hour < 11 ? 'dash.hello.morning' : hour < 18 ? 'dash.hello.day' : 'dash.hello.evening')
  const firstName = profile?.first_name?.trim()
  const today = formatDate(new Date().toISOString(), locale)

  const studentsTotal = k?.students ?? stats?.students ?? 0
  const activePct = k && k.students ? Math.round((100 * k.activeWeek) / k.students) : null

  const perfHref = (f: string) => (flags.performance_dashboard ? `/admin/performance?filter=${f}` : '/admin/students')
  type Todo = { n: number; label: string; href: string; Icon: IconC; tone: Tone }
  const allTodo: Todo[] = [
    { n: stats?.pendingIntake ?? 0, label: t('dash.att.intake'), href: '/admin/intake', Icon: Tray, tone: 'amber' },
    { n: failedInvites, label: t('dash.att.failed'), href: '/admin/invites?status=failed', Icon: Warning, tone: 'red' },
    { n: k?.examsSoon ?? 0, label: t('dash.att.examSoon'), href: perfHref('exam_soon'), Icon: GraduationCap, tone: 'blue' },
    { n: struggling, label: t('dash.att.struggling'), href: perfHref('struggling'), Icon: Lifebuoy, tone: 'red' },
    { n: k?.inactive ?? 0, label: t('dash.att.inactive'), href: perfHref('inactive'), Icon: Moon, tone: 'gray' },
    { n: noPackage, label: t('dash.att.noPackage'), href: '/admin/students?filter=no_package', Icon: Package, tone: 'gray' },
    { n: openInvites, label: t('dash.att.openInvites'), href: '/admin/invites', Icon: EnvelopeSimple, tone: 'gray' },
  ]
  const todo = allTodo.filter((x) => x.n > 0)

  const quick: { href: string; label: string; Icon: IconC; primary?: boolean }[] = [
    { href: '/admin/students/new', label: t('admin.addStudent'), Icon: UserPlus, primary: true },
    ...(flags.student_import ? [{ href: '/admin/students/import', label: t('inv.importList'), Icon: UploadSimple }] : []),
    { href: '/admin/notify', label: t('admin.notify'), Icon: PaperPlaneTilt },
    { href: '/admin/invites', label: t('inv.title'), Icon: EnvelopeSimple },
  ]

  const go = (href: string) => router.push(href as any)

  // ── pieces ──────────────────────────────────────────────────────────────

  const kpiCards = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
      {[
        { label: t('admin.students'), value: String(studentsTotal), hint: k ? t('dash.studentsHint', { n: k.activeWeek }) : undefined, Icon: Users, tone: 'green' as Tone, href: '/admin/students' },
        {
          label: t('perf.k.activeWeek'),
          value: k ? String(k.activeWeek) : '—',
          hint: activePct !== null ? t('dash.activeShare', { pct: activePct }) : undefined,
          Icon: Lightning,
          tone: 'amber' as Tone,
          bar: activePct,
          href: flags.performance_dashboard ? '/admin/performance' : undefined,
        },
        {
          label: t('perf.k.accuracy'),
          value: k?.avgAccuracy != null ? `${k.avgAccuracy} %` : '—',
          hint: t('dash.quizHint'),
          Icon: Target,
          tone: 'blue' as Tone,
          bar: k?.avgAccuracy ?? null,
          href: flags.performance_dashboard ? '/admin/performance' : undefined,
        },
        { label: t('admin.classes'), value: String(stats?.upcomingClasses ?? 0), hint: t('dash.upcomingHint'), Icon: CalendarCheck, tone: 'gray' as Tone, href: '/admin/classes' },
      ].map((c) => (
        <View key={c.label} style={{ width: wide ? '25%' : '50%', padding: 6, flexDirection: 'column' }}>
          <Pressable
            onPress={c.href ? () => go(c.href!) : undefined}
            disabled={!c.href}
            accessibilityRole={c.href ? 'link' : undefined}
            className="gap-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-4 hover:border-neutral-700"
            style={{ flex: 1, minHeight: wide ? 138 : 128 }}
          >
            <View className="flex-row items-center justify-between">
              <View style={{ backgroundColor: TONE_BG[c.tone] }} className="h-9 w-9 items-center justify-center rounded-xl">
                <c.Icon size={18} color={TONE_FG[c.tone]} weight="bold" />
              </View>
            </View>
            <View className="gap-0.5">
              <Text className="font-m-black text-[26px] text-neutral-50" numberOfLines={1}>
                {c.value}
              </Text>
              <Text className="font-m-semibold text-xs text-neutral-300" numberOfLines={1}>
                {c.label}
              </Text>
            </View>
            {'bar' in c && c.bar != null ? <ProgressBar pct={c.bar} tone={c.tone} height={4} /> : null}
            {c.hint ? (
              <Text className="font-m-regular -mt-1 text-[11px] text-neutral-500" numberOfLines={1}>
                {c.hint}
              </Text>
            ) : null}
          </Pressable>
        </View>
      ))}
    </View>
  )

  const todoCard = (
    <Card title={t('dash.attention')} count={todo.length || undefined}>
      {todo.length === 0 ? (
        <View className="flex-row items-center gap-3 px-4 py-5">
          <CheckCircle size={22} color={GREEN} weight="fill" />
          <Text className="font-m-medium flex-1 text-sm text-neutral-300">{t('dash.allGood')}</Text>
        </View>
      ) : (
        todo.map((x, i) => (
          <Pressable
            key={x.label}
            onPress={() => go(x.href)}
            accessibilityRole="link"
            className={`flex-row items-center gap-3 px-4 py-3 hover:bg-neutral-900 active:bg-neutral-900 ${i ? 'border-t border-neutral-900' : ''}`}
          >
            <View style={{ backgroundColor: TONE_BG[x.tone] }} className="h-9 w-9 items-center justify-center rounded-xl">
              <x.Icon size={18} color={TONE_FG[x.tone]} weight="bold" />
            </View>
            <Text className="font-m-semibold flex-1 text-[13px] text-neutral-200" numberOfLines={2}>
              {x.label}
            </Text>
            <Text style={{ color: TONE_FG[x.tone] }} className="font-m-black text-base">
              {x.n}
            </Text>
            <CaretRight size={14} color="#525252" />
          </Pressable>
        ))
      )}
    </Card>
  )

  const quickCard = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }}>
      {quick.map((q) => (
        <View key={q.href} style={{ width: '50%', padding: 5 }}>
          <Pressable
            onPress={() => go(q.href)}
            accessibilityRole="button"
            accessibilityLabel={q.label}
            className={`min-h-[76px] justify-between gap-2 rounded-2xl border p-3.5 active:opacity-85 ${
              q.primary ? 'border-brand bg-brand' : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
            }`}
          >
            <q.Icon size={20} color={q.primary ? '#0A0A0A' : GREEN} weight="bold" />
            <Text className={`font-m-bold text-[13px] ${q.primary ? 'text-ink' : 'text-neutral-100'}`} numberOfLines={2}>
              {q.label}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  )

  const recentCard = (
    <Card
      title={t('dash.recent')}
      right={
        <Pressable onPress={() => go('/admin/students')} accessibilityRole="link" hitSlop={8} className="flex-row items-center gap-1">
          <Text className="font-m-bold text-xs text-brand">{t('dash.viewAll')}</Text>
          <CaretRight size={12} color={GREEN} weight="bold" />
        </Pressable>
      }
    >
      {students === null ? (
        <Text className="font-m-regular px-4 py-5 text-sm text-neutral-500">…</Text>
      ) : recent.length === 0 ? (
        <Text className="font-m-regular px-4 py-5 text-sm text-neutral-500">{t('admin.noStudents')}</Text>
      ) : (
        recent.map((s, i) => {
          const name = studentName(s) || s.profile.email || '—'
          const age = daysAgo(s.profile.created_at)
          return (
            <Pressable
              key={s.profile.id}
              onPress={() => go(`/admin/students/${s.profile.id}`)}
              accessibilityRole="link"
              className={`flex-row items-center gap-3 px-4 py-3 hover:bg-neutral-900 active:bg-neutral-900 ${i ? 'border-t border-neutral-900' : ''}`}
            >
              <View className="h-9 w-9 items-center justify-center rounded-full bg-brand/10">
                <Text className="font-m-black text-xs text-brand">{name.charAt(0).toUpperCase()}</Text>
              </View>
              <View className="flex-1">
                <Text className="font-m-semibold text-[13px] text-neutral-100" numberOfLines={1}>
                  {name}
                </Text>
                <Text className="font-m-regular text-[11px] text-neutral-500" numberOfLines={1}>
                  {s.profile.email ?? ''}
                </Text>
              </View>
              {wide ? (
                s.packages.length ? (
                  <Badge label={s.packages.map((p) => (locale === 'de' ? p.name_de : p.name_en)).join(', ')} tone="green" />
                ) : (
                  <Badge label={t('admin.noPlan')} />
                )
              ) : null}
              <Text className="font-m-medium w-[86px] text-right text-[11px] text-neutral-500" numberOfLines={1}>
                {age === null ? '' : age === 0 ? t('stu.today') : age === 1 ? t('stu.yesterday') : t('stu.daysAgo', { n: age })}
              </Text>
            </Pressable>
          )
        })
      )}
    </Card>
  )

  const menu = (
    <View style={{ gap: 18 }}>
      <Text className="font-m-xbold text-lg text-neutral-100">{t('dash.menu')}</Text>
      {nav.map((g) => (
        <View key={g.title} style={{ gap: 6 }}>
          <Text className="font-m-bold px-1 text-[10px] uppercase tracking-widest text-neutral-500">{g.title}</Text>
          <View className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
            {g.items.map((it, i) => (
              <Pressable
                key={it.href}
                onPress={() => go(it.href)}
                accessibilityRole="link"
                className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-neutral-900 ${i ? 'border-t border-neutral-900' : ''}`}
              >
                <it.Icon size={20} color={GREEN} />
                <Text className="font-m-semibold flex-1 text-[15px] text-neutral-100" numberOfLines={1}>
                  {it.label}
                </Text>
                <CaretRight size={16} color="#525252" />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  )

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: t('admin.title'),
          headerShown: !sidebar,
          // first screen of the nested admin stack: nothing to go back to → back to the profile tab
          headerLeft: () => (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile' as any))}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              style={{ paddingRight: 8 }}
            >
              <CaretLeft size={24} color="#FFFFFF" weight="bold" />
            </Pressable>
          ),
        }}
      />
      <ScrollView
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
        <View style={{ width: '100%', maxWidth: ADMIN_MAX_WIDTH, alignSelf: 'center', padding: wide ? 28 : 16, gap: wide ? 24 : 18 }}>
          {/* greeting */}
          <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'flex-end' : 'flex-start', gap: 12 }}>
            <View style={{ flex: wide ? 1 : undefined, gap: 4 }}>
              <Text className="font-m-bold text-xs uppercase tracking-widest text-neutral-500">{today}</Text>
              <Text accessibilityRole="header" className={`font-m-black text-neutral-50 ${wide ? 'text-[30px]' : 'text-[24px]'}`}>
                {firstName ? `${hello}, ${firstName}` : hello}
              </Text>
              <Text className="font-m-medium text-sm text-neutral-400">{t('dash.subtitle')}</Text>
            </View>
          </View>

          {kpiCards}

          {wide ? (
            <View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-start' }}>
              <View style={{ flex: 1.6, gap: 20 }}>{recentCard}</View>
              <View style={{ flex: 1, gap: 20 }}>
                {todoCard}
                {quickCard}
              </View>
            </View>
          ) : (
            <>
              {todoCard}
              {quickCard}
              {recentCard}
              {!sidebar ? menu : null}
            </>
          )}
          {wide && !sidebar ? menu : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Card({ title, right, count, children }: { title: string; right?: React.ReactNode; count?: number; children: React.ReactNode }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
      <View className="flex-row items-center justify-between gap-3 border-b border-neutral-900 px-4 py-3.5">
        <View className="flex-row items-center gap-2">
          <Text className="font-m-xbold text-[15px] text-neutral-100">{title}</Text>
          {count ? (
            <View className="rounded-full bg-neutral-800 px-2 py-0.5">
              <Text className="font-m-bold text-[11px] text-neutral-300">{count}</Text>
            </View>
          ) : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  )
}
