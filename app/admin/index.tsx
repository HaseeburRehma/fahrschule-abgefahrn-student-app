import React, { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
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
import { Key as KeyRound } from 'phosphor-react-native/src/icons/Key'
import { ShieldCheck } from 'phosphor-react-native/src/icons/ShieldCheck'

import { useTranslation } from '@/lib/i18n'
import { fetchAdminStats, type AdminStats } from '@/lib/admin'
import { Card } from '@/components/ui'

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 rounded-2xl border border-neutral-800 bg-neutral-900 p-3">
      <Text className="text-2xl font-m-xbold text-brand">{value}</Text>
      <Text className="text-[11px] font-m-medium text-neutral-400">{label}</Text>
    </View>
  )
}

export default function AdminHome() {
  const { t } = useTranslation()
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats | null>(null)

  useFocusEffect(
    useCallback(() => {
      fetchAdminStats().then(setStats).catch(() => {})
    }, []),
  )

  const links: { href: string; label: string; icon: React.ReactNode }[] = [
    { href: '/admin/students', label: t('admin.students'), icon: <Users size={20} color="#00FF24" /> },
    { href: '/admin/intake', label: t('admin.intake'), icon: <Inbox size={20} color="#00FF24" /> },
    { href: '/admin/chat', label: t('admin.chat'), icon: <MessageCircle size={20} color="#00FF24" /> },
    { href: '/admin/notify', label: t('admin.notify'), icon: <Send size={20} color="#00FF24" /> },
    { href: '/admin/motivation', label: t('admin.motivation'), icon: <Sparkles size={20} color="#00FF24" /> },
    { href: '/admin/history', label: t('admin.history'), icon: <History size={20} color="#00FF24" /> },
    { href: '/admin/documents', label: t('admin.documents'), icon: <FileText size={20} color="#00FF24" /> },
    { href: '/admin/classes', label: t('admin.classes'), icon: <CalendarPlus size={20} color="#00FF24" /> },
    { href: '/admin/appointments', label: t('admin.appointments'), icon: <CalendarClock size={20} color="#00FF24" /> },
    { href: '/admin/availability', label: t('admin.availability'), icon: <CalendarClock size={20} color="#00FF24" /> },
    { href: '/admin/settings', label: t('admin.v2.signupCode'), icon: <KeyRound size={20} color="#00FF24" /> },
    { href: '/admin/admins', label: t('admin.v2.admins.title'), icon: <ShieldCheck size={20} color="#00FF24" /> },
  ]

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.title') }} />
      <ScrollView contentContainerClassName="p-5 gap-3">
        {/* Stats */}
        <View className="flex-row gap-3">
          <Stat value={stats?.students ?? 0} label={t('admin.students')} />
          <Stat value={stats?.pendingIntake ?? 0} label={t('admin.statPending')} />
          <Stat value={stats?.upcomingClasses ?? 0} label={t('admin.statUpcoming')} />
        </View>

        {links.map((l) => (
          <Pressable key={l.href} onPress={() => router.push(l.href as any)}>
            <Card className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
                {l.icon}
              </View>
              <Text className="flex-1 font-m-semibold text-neutral-100">
                {l.label}
              </Text>
              <ChevronRight size={20} color="#6B7280" />
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}
