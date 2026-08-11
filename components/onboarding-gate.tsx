/**
 * OnboardingGate — a one-time welcome screen with the lion mascot, shown the
 * first time a signed-in user opens the app.
 */

import React, { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { Brand, Logo } from '@/components/ui'

const KEY = 'abgefahrn.onboarded'

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { session } = useUser()
  const [seen, setSeen] = useState<boolean | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setSeen(v === '1'))
      .catch(() => setSeen(true))
  }, [])

  if (seen === null) return <>{children}</>
  if (!session || seen) return <>{children}</>

  const done = () => {
    AsyncStorage.setItem(KEY, '1').catch(() => {})
    setSeen(true)
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 items-center justify-center gap-6 px-8">
        <Brand size={96} />
        <Logo width={240} />
        <Text className="text-center text-2xl font-extrabold text-neutral-100">
          {t('onboarding.welcome')}
        </Text>
        <Text className="text-center text-base text-neutral-400">
          {t('onboarding.subtitle')}
        </Text>
        <Pressable onPress={done} className="mt-4 w-full items-center rounded-2xl bg-brand px-8 py-4">
          <Text className="text-base font-bold text-ink">
            {t('onboarding.start')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
