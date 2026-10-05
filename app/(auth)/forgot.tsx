/**
 * Passwort vergessen — Figma 05/Passwort vergessen (1301:2258, EN 1314:2990).
 * Sends a Supabase recovery mail whose link opens /reset-password (web) or abgefahrn://reset-password.
 */

import React, { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { EnvelopeSimple } from 'phosphor-react-native/src/icons/EnvelopeSimple'
import { PaperPlaneTilt } from 'phosphor-react-native/src/icons/PaperPlaneTilt'

import { Button, C, Input, Screen, T, TopBar } from '@/components/ds'
import { AuthTitle, Spacer, withWeight } from '@/components/auth/ui'
import { sendRecoveryMail } from '@/lib/auth/recovery'
import { classifyPasswordError, passwordErrorKey } from '@/lib/auth/errors'
import { useT } from '@/lib/i18n'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PlaneFill = withWeight(PaperPlaneTilt, 'fill')

export default function Forgot() {
  const t = useT()
  const params = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setErr(null)
    const clean = email.trim().toLowerCase()
    if (!clean) return setErr(t('auth.val.emailRequired'))
    if (!EMAIL_RE.test(clean)) return setErr(t('auth.val.emailInvalid'))
    setBusy(true)
    try {
      await sendRecoveryMail(clean)
      router.push({ pathname: '/(auth)/link-sent', params: { email: clean } } as any)
    } catch (e) {
      setErr(t(passwordErrorKey(classifyPasswordError(e))))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen
      glow={-20}
      keyboard
      padded={false}
      gap={0}
      header={
        <TopBar
          title={t('auth.forgot.title')}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login' as any))}
        />
      }
      contentStyle={{ paddingHorizontal: 24, paddingTop: 24 }}
    >
      <AuthTitle line1={t('auth.forgot.line1')} line2={t('auth.forgot.line2')} gap={0} />
      <Spacer h={12} />
      <T variant="bodyL" color={C.muted}>{t('auth.forgot.body')}</T>
      <Spacer h={28} />
      <Input
        label={t('auth.field.email')}
        icon={EnvelopeSimple}
        placeholder={t('auth.field.emailPh')}
        value={email}
        onChangeText={(v) => {
          setEmail(v)
          if (err) setErr(null)
        }}
        error={err ?? undefined}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        inputMode="email"
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      <Spacer h={12} />
      <Button label={t('auth.forgot.submit')} iconRight={PlaneFill} onPress={submit} loading={busy} />
    </Screen>
  )
}
