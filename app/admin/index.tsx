import React, { useCallback, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { Users } from 'phosphor-react-native/src/icons/Users'
import { Tray as Inbox } from 'phosphor-react-native/src/icons/Tray'
import { PaperPlaneTilt as Send } from 'phosphor-react-native/src/icons/PaperPlaneTilt'
import { ChatCircle as MessageCircle } from 'phosphor-react-native/src/icons/ChatCircle'
import { CalendarPlus } from 'phosphor-react-native/src/icons/CalendarPlus'
import { CalendarCheck as CalendarClock } from 'phosphor-react-native/src/icons/CalendarCheck'
import { ClockCounterClockwise as History } from 'phosphor-react-native/src/icons/ClockCounterClockwise'
import { FileText } from 'phosphor-react-native/src/icons/FileText'
import { Sparkle as Sparkles } from 'phosphor-react-native/src/icons/Sparkle'
import { CaretRight as ChevronRight } from 'phosphor-react-native/src/icons/CaretRight'
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft'
import { Key as KeyRound } from 'phosphor-react-native/src/icons/Key'
import { ShieldCheck } from 'phosphor-react-native/src/icons/ShieldCheck'
import { UploadSimple } from 'phosphor-react-native/src/icons/UploadSimple'
import { EnvelopeSimple } from 'phosphor-react-native/src/icons/EnvelopeSimple'
import { ChartLineUp } from 'phosphor-react-native/src/icons/ChartLineUp'
import { UserPlus } from 'phosphor-react-native/src/icons/UserPlus'

import { useTranslation } from '@/lib/i18n'
import { fetchAdminStats, type AdminStats } from '@/lib/admin'
import { fetchInvites, fetchPerformance, type Invite, type StudentPerformance } from '@/lib/invites'
import { derive, kpis } from '@/lib/performance'
import { useFeatureFlags } from '@/lib/flags'
import { Grid, GREEN, Kpi, Page, SectionTitle } from '@/components/admin/kit'

/** Admin dashboard — KPIs, quick actions and every admin area (web + phone). */
export default function AdminHome() {
  const { t } = useTranslation()
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [perf, setPerf] = useState<StudentPerformance[] | null>(null)
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const { flags } = useFeatureFlags()

  useFocusEffect(
    useCallback(() => {
      fetchAdminStats().then(setStats).catch(() => {})
      fetchPerformance().then(setPerf).catch(() => setPerf(null))
      fetchInvites().then(setInvites).catch(() => setInvites(null))
    }, []),
  )

  const k = useMemo(() => (perf ? kpis(perf.map((p) => ({ p, d: derive(p) }))) : null), [perf])
  const openInvites = invites?.filter((i) => i.status === 'pending' || i.status === 'sent' || i.status === 'failed').length
  const failedInvites = invites?.filter((i) => i.status === 'failed').length ?? 0

  // Feature flags: switched-off areas disappear from the quick actions.
  const quick: { href: string; label: string; hint: string; icon: React.ReactNode }[] = [
    flags.student_import && { href: '/admin/students/import', label: t('inv.importList'), hint: t('admin.dash.importHint'), icon: <UploadSimple size={22} color="#0A0A0A" /> },
    { href: '/admin/invites', label: t('inv.title'), hint: t('admin.dash.invitesHint'), icon: <EnvelopeSimple size={22} color="#0A0A0A" /> },
    flags.performance_dashboard && { href: '/admin/performance', label: t('perf.title'), hint: t('admin.dash.perfHint'), icon: <ChartLineUp size={22} color="#0A0A0A" /> },
    { href: '/admin/students/new', label: t('admin.addStudent'), hint: t('admin.dash.addHint'), icon: <UserPlus size={22} color="#0A0A0A" /> },
  ].filter(Boolean) as { href: string; label: string; hint: string; icon: React.ReactNode }[]

  const links: { href: string; label: string; icon: React.ReactNode }[] = [
    { href: '/admin/students', label: t('admin.students'), icon: <Users size={20} color={GREEN} /> },
    { href: '/admin/intake', label: t('admin.intake'), icon: <Inbox size={20} color={GREEN} /> },
    { href: '/admin/chat', label: t('admin.chat'), icon: <MessageCircle size={20} color={GREEN} /> },
    { href: '/admin/notify', label: t('admin.notify'), icon: <Send size={20} color={GREEN} /> },
    { href: '/admin/motivation', label: t('admin.motivation'), icon: <Sparkles size={20} color={GREEN} /> },
    { href: '/admin/history', label: t('admin.history'), icon: <History size={20} color={GREEN} /> },
    { href: '/admin/documents', label: t('admin.documents'), icon: <FileText size={20} color={GREEN} /> },
    { href: '/admin/classes', label: t('admin.classes'), icon: <CalendarPlus size={20} color={GREEN} /> },
    { href: '/admin/appointments', label: t('admin.appointments'), icon: <CalendarClock size={20} color={GREEN} /> },
    { href: '/admin/availability', label: t('admin.availability'), icon: <CalendarClock size={20} color={GREEN} /> },
    { href: '/admin/settings', label: t('admin.v2.signupCode'), icon: <KeyRound size={20} color={GREEN} /> },
    { href: '/admin/admins', label: t('admin.v2.admins.title'), icon: <ShieldCheck size={20} color={GREEN} /> },
  ]

  return (
    <Page>
      <Stack.Screen
        options={{
          title: t('admin.title'),
          // first screen of the nested admin stack: the native header has nothing to go back to,
          // so give it an explicit way back to the profile tab
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

      <Grid cols={6} phoneCols={2}>
        <Kpi label={t('admin.students')} value={k?.students ?? stats?.students ?? 0} />
        <Kpi label={t('perf.k.activeWeek')} value={k ? k.activeWeek : '—'} hint={k && k.students ? `${Math.round((100 * k.activeWeek) / k.students)} %` : undefined} />
        <Kpi label={t('perf.k.accuracy')} value={k?.avgAccuracy != null ? `${k.avgAccuracy} %` : '—'} tone="blue" />
        <Kpi label={t('admin.dash.openInvites')} value={openInvites ?? '—'} tone={failedInvites ? 'red' : 'amber'} hint={failedInvites ? t('admin.dash.failed', { n: failedInvites }) : undefined} />
        <Kpi label={t('admin.statPending')} value={stats?.pendingIntake ?? 0} tone="amber" />
        <Kpi label={t('admin.statUpcoming')} value={stats?.upcomingClasses ?? 0} tone="gray" />
      </Grid>

      <SectionTitle>{t('admin.dash.quick')}</SectionTitle>
      <Grid cols={4} phoneCols={2}>
        {quick.map((q) => (
          <Pressable
            key={q.href}
            onPress={() => router.push(q.href as any)}
            accessibilityRole="button"
            accessibilityLabel={q.label}
            className="gap-2 rounded-2xl bg-brand p-4 active:opacity-85"
            style={{ minHeight: 120 }}
          >
            {q.icon}
            <Text className="font-m-xbold text-[15px] text-ink" numberOfLines={2}>{q.label}</Text>
            <Text className="font-m-medium text-xs text-ink/70" numberOfLines={2}>{q.hint}</Text>
          </Pressable>
        ))}
      </Grid>

      <SectionTitle>{t('admin.dash.areas')}</SectionTitle>
      <Grid cols={3} phoneCols={1} gap={10}>
        {links.map((l) => (
          <Pressable
            key={l.href}
            onPress={() => router.push(l.href as any)}
            accessibilityRole="button"
            className="flex-row items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 active:opacity-80"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">{l.icon}</View>
            <Text className="font-m-semibold flex-1 text-neutral-100" numberOfLines={1}>{l.label}</Text>
            <ChevronRight size={20} color="#6B7280" />
          </Pressable>
        ))}
      </Grid>
    </Page>
  )
}
