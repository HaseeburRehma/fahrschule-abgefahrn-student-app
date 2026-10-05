/**
 * Konto erstellt — Figma 05/Konto erstellt (1301:2495, EN 1314:3229).
 * Shown once after self sign-up; continues to the push opt-in (native) or Home (web / already granted).
 */

import React, { useState } from 'react'
import { Platform } from 'react-native'
import { router } from 'expo-router'
import { ArrowRight } from 'phosphor-react-native/src/icons/ArrowRight'
import { Confetti } from 'phosphor-react-native/src/icons/Confetti'

import { Button } from '@/components/ds'
import { CenteredHeroScreen, GlowCircle } from '@/components/auth/ui'
import { hasPushPermission } from '@/lib/auth/push'
import { useUser } from '@/lib/user-context'
import { useT } from '@/lib/i18n'

export default function AccountCreated() {
  const t = useT()
  const { profile, session } = useUser()
  const [busy, setBusy] = useState(false)
  const name = String(profile?.first_name ?? session?.user?.user_metadata?.first_name ?? '').trim()

  async function next() {
    setBusy(true)
    try {
      const skipPush = Platform.OS === 'web' || (await hasPushPermission())
      router.replace((skipPush ? '/home' : '/push-permission') as any)
    } finally {
      setBusy(false)
    }
  }

  return (
    <CenteredHeroScreen
      hero={<GlowCircle icon={Confetti} />}
      line1={t('auth.created.line1')}
      line2={name ? t('auth.created.line2', { name }) : t('auth.created.line2NoName')}
      body={t('auth.created.body')}
      bottomGap={92}
      actions={<Button label={t('auth.created.cta')} iconRight={ArrowRight} onPress={next} loading={busy} />}
    />
  )
}
