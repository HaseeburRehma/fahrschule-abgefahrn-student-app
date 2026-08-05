import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'
import { Users, Inbox, Send, CalendarPlus, ChevronRight } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { Card } from '@/components/ui'

export default function AdminHome() {
  const { t } = useTranslation()
  const router = useRouter()

  const links: {
    href: string
    label: string
    icon: React.ReactNode
  }[] = [
    {
      href: '/admin/students',
      label: t('admin.students'),
      icon: <Users size={20} color="#22C55E" />,
    },
    {
      href: '/admin/intake',
      label: t('admin.intake'),
      icon: <Inbox size={20} color="#22C55E" />,
    },
    {
      href: '/admin/notify',
      label: t('admin.notify'),
      icon: <Send size={20} color="#22C55E" />,
    },
    {
      href: '/admin/classes',
      label: t('admin.classes'),
      icon: <CalendarPlus size={20} color="#22C55E" />,
    },
  ]

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.title') }} />
      <ScrollView contentContainerClassName="p-5 gap-3">
        {links.map((l) => (
          <Pressable key={l.href} onPress={() => router.push(l.href as any)}>
            <Card className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
                {l.icon}
              </View>
              <Text className="flex-1 font-semibold text-neutral-100">
                {l.label}
              </Text>
              <ChevronRight size={20} color="#9CA3AF" />
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}
