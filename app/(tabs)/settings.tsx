import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronRight, LogOut, Globe, ShieldCheck } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { ROLE_LABELS } from '@/lib/rbac/permissions'
import { displayName } from '@/lib/data'
import { Card } from '@/components/ui'
import type { Locale } from '@/lib/types'

export default function SettingsScreen() {
  const { t, locale, setLocale } = useTranslation()
  const { profile, role, isAdmin, signOut } = useUser()
  const router = useRouter()

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <ScrollView contentContainerClassName="p-5 gap-4">
        <Text className="text-2xl font-extrabold text-neutral-100">
          {t('settings.title')}
        </Text>

        {/* Account */}
        <Card className="gap-1">
          <Text className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            {t('settings.account')}
          </Text>
          <Text className="mt-1 text-lg font-bold text-neutral-100">
            {displayName(profile) || '—'}
          </Text>
          {profile?.email ? (
            <Text className="text-sm text-neutral-400">{profile.email}</Text>
          ) : null}
          {role ? (
            <View className="mt-2 self-start rounded-full bg-neutral-800 px-3 py-1">
              <Text className="text-xs font-semibold text-neutral-300">
                {t('settings.role')}: {ROLE_LABELS[role][locale]}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Language */}
        <Card className="gap-3">
          <View className="flex-row items-center gap-2">
            <Globe size={18} color="#22C55E" />
            <Text className="font-semibold text-neutral-100">
              {t('settings.language')}
            </Text>
          </View>
          <View className="flex-row gap-2">
            {(
              [
                ['de', t('settings.german')],
                ['en', t('settings.english')],
              ] as [Locale, string][]
            ).map(([code, label]) => (
              <Pressable
                key={code}
                onPress={() => setLocale(code)}
                className={`flex-1 items-center rounded-xl border py-3 ${
                  locale === code
                    ? 'border-brand bg-brand/10'
                    : 'border-neutral-800 bg-neutral-900'
                }`}
              >
                <Text
                  className={`font-bold ${
                    locale === code ? 'text-brand' : 'text-neutral-400'
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Admin area */}
        {isAdmin ? (
          <Pressable onPress={() => router.push('/admin')}>
            <Card className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-violet-100">
                <ShieldCheck size={20} color="#7C3AED" />
              </View>
              <Text className="flex-1 font-semibold text-neutral-100">
                {t('settings.adminArea')}
              </Text>
              <ChevronRight size={20} color="#9CA3AF" />
            </Card>
          </Pressable>
        ) : null}

        {/* Sign out */}
        <Pressable onPress={signOut}>
          <Card className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-red-50">
              <LogOut size={20} color="#EF4444" />
            </View>
            <Text className="flex-1 font-semibold text-red-500">
              {t('settings.signOut')}
            </Text>
          </Card>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
