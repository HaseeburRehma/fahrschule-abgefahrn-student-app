import React, { useEffect, useState } from 'react'
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  ChevronRight,
  LogOut,
  Globe,
  ShieldCheck,
  UserCog,
  Trash2,
  Info,
  Fingerprint,
} from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { ROLE_LABELS } from '@/lib/rbac/permissions'
import { displayName, deleteMyAccount } from '@/lib/data'
import {
  isBiometricAvailable,
  getBiometricEnabled,
  setBiometricEnabled,
  authenticate,
} from '@/lib/biometric'
import { Card } from '@/components/ui'
import type { Locale } from '@/lib/types'

function confirmMsg(msg: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(msg))
  return new Promise((resolve) =>
    Alert.alert('', msg, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', style: 'destructive', onPress: () => resolve(true) },
    ]),
  )
}

export default function SettingsScreen() {
  const { t, locale, setLocale } = useTranslation()
  const { profile, role, isAdmin, isStudent, signOut } = useUser()
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioEnabled, setBioEnabled] = useState(false)

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable)
    getBiometricEnabled().then(setBioEnabled)
  }, [])

  async function toggleBiometric(next: boolean) {
    if (next) {
      const ok = await authenticate('Fahrschule Abgefahrn')
      if (!ok) return
    }
    await setBiometricEnabled(next)
    setBioEnabled(next)
  }

  async function removeAccount() {
    const ok = await confirmMsg(t('settings.deleteAccountConfirm'))
    if (!ok) return
    setDeleting(true)
    try {
      await deleteMyAccount()
      await signOut()
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert(e?.message ?? t('common.error'))
      else Alert.alert(e?.message ?? t('common.error'))
      setDeleting(false)
    }
  }

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

        {/* Edit profile */}
        <Pressable onPress={() => router.push('/edit-profile' as any)}>
          <Card className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <UserCog size={20} color="#22C55E" />
            </View>
            <Text className="flex-1 font-semibold text-neutral-100">
              {t('settings.editProfile')}
            </Text>
            <ChevronRight size={20} color="#6B7280" />
          </Card>
        </Pressable>

        {/* Info & contact */}
        <Pressable onPress={() => router.push('/info' as any)}>
          <Card className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <Info size={20} color="#22C55E" />
            </View>
            <Text className="flex-1 font-semibold text-neutral-100">
              {t('settings.info')}
            </Text>
            <ChevronRight size={20} color="#6B7280" />
          </Card>
        </Pressable>

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

        {/* Biometric lock (native, when available) */}
        {bioAvailable ? (
          <Card className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <Fingerprint size={20} color="#22C55E" />
            </View>
            <Text className="flex-1 font-semibold text-neutral-100">
              {t('settings.biometric')}
            </Text>
            <Switch
              value={bioEnabled}
              onValueChange={toggleBiometric}
              trackColor={{ true: '#22C55E', false: '#3F3F46' }}
            />
          </Card>
        ) : null}

        {/* Admin area */}
        {isAdmin ? (
          <Pressable onPress={() => router.push('/admin')}>
            <Card className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-violet-500/15">
                <ShieldCheck size={20} color="#A78BFA" />
              </View>
              <Text className="flex-1 font-semibold text-neutral-100">
                {t('settings.adminArea')}
              </Text>
              <ChevronRight size={20} color="#6B7280" />
            </Card>
          </Pressable>
        ) : null}

        {/* Sign out */}
        <Pressable onPress={signOut}>
          <Card className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-red-500/15">
              <LogOut size={20} color="#EF4444" />
            </View>
            <Text className="flex-1 font-semibold text-red-500">
              {t('settings.signOut')}
            </Text>
          </Card>
        </Pressable>

        {/* Delete account (students; admins are removed from the dashboard) */}
        {isStudent ? (
          <Pressable onPress={removeAccount} disabled={deleting}>
            <Card
              className={`flex-row items-center gap-3 ${deleting ? 'opacity-50' : ''}`}
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-red-500/15">
                <Trash2 size={20} color="#EF4444" />
              </View>
              <Text className="flex-1 font-semibold text-red-500">
                {t('settings.deleteAccount')}
              </Text>
            </Card>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}
