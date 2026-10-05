/**
 * Push erlauben — Figma 05/Push erlauben (1301:2457, EN 1314:3191).
 * "Benachrichtigungen erlauben" asks the OS and stores the Expo push token; both skips go Home.
 */

import React, { useEffect, useState } from 'react'
import { Platform, Pressable } from 'react-native'
import { router } from 'expo-router'
import { Bell } from 'phosphor-react-native/src/icons/Bell'

import { Button, C, T, useToast } from '@/components/ds'
import { CenteredHeroScreen, GlowCircle, TextButton } from '@/components/auth/ui'
import { markPushPromptShown, registerPushToken, requestPushPermission } from '@/lib/auth/push'
import { useUser } from '@/lib/user-context'
import { useT } from '@/lib/i18n'

export default function PushPermission() {
  const t = useT()
  const toast = useToast()
  const { session } = useUser()
  const [busy, setBusy] = useState(false)

  const home = () => router.replace('/home' as any)
  useEffect(() => {
    markPushPromptShown()
  }, [])

  async function allow() {
    if (Platform.OS === 'web') return home()
    setBusy(true)
    try {
      const granted = await requestPushPermission()
      if (granted) await registerPushToken(session?.user?.id)
      else toast.show(t('auth.push.denied'), 'info')
    } finally {
      setBusy(false)
      home()
    }
  }

  return (
    <CenteredHeroScreen
      top={
        <Pressable
          onPress={home}
          hitSlop={12}
          accessibilityRole="button"
          style={({ pressed }) => ({ alignSelf: 'flex-end', opacity: pressed ? 0.6 : 1 })}
        >
          <T variant="labelL" color={C.dim}>{t('auth.push.skip')}</T>
        </Pressable>
      }
      hero={<GlowCircle icon={Bell} />}
      line1={t('auth.push.line1')}
      line2={t('auth.push.line2')}
      body={t('auth.push.body')}
      bottomGap={28}
      actions={
        <>
          <Button label={t('auth.push.allow')} onPress={allow} loading={busy} />
          <TextButton label={t('auth.push.later')} onPress={home} disabled={busy} />
        </>
      }
    />
  )
}
