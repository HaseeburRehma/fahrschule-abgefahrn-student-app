/**
 * Link gesendet — Figma 05/Link gesendet (1301:2304, EN 1314:3036).
 * Resend has a 60 s cooldown (Supabase also rate-limits recovery mails).
 */

import React, { useEffect, useRef, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { EnvelopeSimple } from 'phosphor-react-native/src/icons/EnvelopeSimple'

import { Button, IconButton, useToast } from '@/components/ds'
import { CenteredHeroScreen, GlowCircle, TextButton } from '@/components/auth/ui'
import { sendRecoveryMail } from '@/lib/auth/recovery'
import { classifyPasswordError, passwordErrorKey } from '@/lib/auth/errors'
import { useT } from '@/lib/i18n'

const COOLDOWN = 60
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LinkSent() {
  const t = useT()
  const toast = useToast()
  const { email: rawEmail } = useLocalSearchParams<{ email?: string }>()
  // The route can be opened by a deep link: only trust a well-formed address.
  const candidate = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
  const email = candidate.length <= 254 && EMAIL_RE.test(candidate) ? candidate : ''
  const [left, setLeft] = useState(COOLDOWN) // a mail was just sent
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  useEffect(() => {
    if (left <= 0) return
    const id = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [left])

  const toLogin = () => router.replace('/(auth)/login' as any)

  async function resend() {
    if (!email || left > 0 || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      await sendRecoveryMail(email)
      toast.show(t('auth.sent.resent'), 'success')
      setLeft(COOLDOWN)
    } catch (e) {
      const kind = classifyPasswordError(e)
      toast.show(t(passwordErrorKey(kind)), 'error')
      if (kind === 'rate_limited') setLeft(COOLDOWN)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <CenteredHeroScreen
      top={
        <IconButton
          tone="plain"
          accessibilityLabel={t('ds.back')}
          onPress={() => (router.canGoBack() ? router.back() : toLogin())}
        />
      }
      hero={<GlowCircle icon={EnvelopeSimple} weight="regular" />}
      line1={t('auth.sent.line1')}
      line2={t('auth.sent.line2')}
      body={email ? t('auth.sent.body', { email }) : t('auth.sent.bodyNoEmail')}
      bottomGap={52}
      actions={
        <>
          <Button label={t('auth.sent.back')} onPress={toLogin} />
          {email ? (
            <TextButton
              label={left > 0 ? t('auth.sent.resendIn', { s: left }) : t('auth.sent.resend')}
              onPress={resend}
              disabled={left > 0 || busy}
            />
          ) : null}
        </>
      }
    />
  )
}
