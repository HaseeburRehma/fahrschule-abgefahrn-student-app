import React, { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { Users, Inbox, Send, CalendarPlus, ChevronRight } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { fetchAdminStats, type AdminStats } from '@/lib/admin'
import { Card } from '@/components/ui'

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 rounded-2xl border border-neutral-800 bg-neutral-900 p-3">
      <Text className="text-2xl font-extrabold text-brand">{value}</Text>
      <Text className="text-[11px] font-medium text-neutral-400">{label}</Text>
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
    { href: '/admin/students', label: t('admin.students'), icon: <Users size={20} color="#22C55E" /> },
    { href: '/admin/intake', label: t('admin.intake'), icon: <Inbox size={20} color="#22C55E" /> },
    { href: '/admin/notify', label: t('admin.notify'), icon: <Send size={20} color="#22C55E" /> },
    { href: '/admin/classes', label: t('admin.classes'), icon: <CalendarPlus size={20} color="#22C55E" /> },
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
              <Text className="flex-1 font-semibold text-neutral-100">
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
