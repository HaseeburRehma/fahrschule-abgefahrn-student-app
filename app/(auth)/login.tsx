/**
 * Login — Figma DE/Login (1295:1821, EN 1296:2335) + error state 05/Login Fehler (1301:2344, EN 1314:3076).
 * Email + password. Students created before passwords existed set one via "Passwort vergessen".
 */

import React, { useRef, useState } from 'react'
import { View, type TextInput } from 'react-native'
import { router } from 'expo-router'
import { ArrowRight } from 'phosphor-react-native/src/icons/ArrowRight'
import { EnvelopeSimple } from 'phosphor-react-native/src/icons/EnvelopeSimple'
import { LockSimple } from 'phosphor-react-native/src/icons/LockSimple'

import { Button, C, HeroTitle, Input, LinkButton, Logo, Screen, T } from '@/components/ds'
import { FooterPrompt, Spacer } from '@/components/auth/ui'
import { getSupabase } from '@/lib/supabase/client'
import { classifyPasswordError, passwordErrorKey } from '@/lib/auth/errors'
import { useT } from '@/lib/i18n'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [emailErr, setEmailErr] = useState<string | null>(null)
  const [pwErr, setPwErr] = useState<string | null>(null)
  /** wrong credentials → both inputs red, message under the password (Figma "Login Fehler") */
  const [badCreds, setBadCreds] = useState(false)
  const pwRef = useRef<TextInput>(null)

  const clear = () => {
    setEmailErr(null)
    setPwErr(null)
    setBadCreds(false)
  }

  const goForgot = () => {
    const clean = email.trim().toLowerCase()
    router.push({ pathname: '/(auth)/forgot', params: clean ? { email: clean } : {} } as any)
  }

  async function submit() {
    clear()
    const cleanEmail = email.trim().toLowerCase()
    let ok = true
    if (!cleanEmail) {
      setEmailErr(t('auth.val.emailRequired'))
      ok = false
    } else if (!EMAIL_RE.test(cleanEmail)) {
      setEmailErr(t('auth.val.emailInvalid'))
      ok = false
    }
    if (!password) {
      setPwErr(t('auth.val.passwordRequired'))
      ok = false
    }
    if (!ok) return

    setBusy(true)
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email: cleanEmail, password })
      if (error) throw error
      // AuthGuard sees the new session and routes to Home.
    } catch (e) {
      const kind = classifyPasswordError(e)
      if (kind === 'invalid_credentials') setBadCreds(true)
      setPwErr(t(passwordErrorKey(kind)))
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
      contentStyle={{ paddingHorizontal: 24, paddingTop: 16 }}
      footer={
        <FooterPrompt
          text={t('auth.login.noAccount')}
          link={t('auth.login.signup')}
          onPress={() => router.push('/(auth)/signup' as any)}
        />
      }
    >
      <Logo width={170} />
      <Spacer h={40} />
      <HeroTitle line1={t('auth.login.line1')} line2={t('auth.login.line2')} />
      <Spacer h={12} />
      <T variant="bodyL" color={C.muted}>{t('auth.login.body')}</T>
      <Spacer h={26} />

      <View style={{ gap: 16 }}>
        <Input
          label={t('auth.field.email')}
          icon={EnvelopeSimple}
          placeholder={t('auth.field.emailPh')}
          value={email}
          onChangeText={(v) => {
            setEmail(v)
            if (emailErr || badCreds) clear()
          }}
          error={emailErr ?? badCreds}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="username"
          keyboardType="email-address"
          inputMode="email"
          returnKeyType="next"
          onSubmitEditing={() => pwRef.current?.focus()}
          submitBehavior="submit"
        />
        <Input
          {...({ ref: pwRef } as object)}
          label={t('auth.field.password')}
          icon={LockSimple}
          placeholder={t('auth.field.passwordPh')}
          value={password}
          onChangeText={(v) => {
            setPassword(v)
            if (pwErr || badCreds) {
              setPwErr(null)
              setBadCreds(false)
            }
          }}
          error={pwErr ?? badCreds}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <LinkButton label={t('auth.login.forgot')} align="right" onPress={goForgot} />
      </View>

      <Spacer h={10} />
      <Button label={t('auth.login.submit')} iconRight={ArrowRight} onPress={submit} loading={busy} />
      <Spacer h={18} />
      <T variant="caption" color={C.dim} style={{ textAlign: 'center', paddingHorizontal: 8 }}>
        {t('auth.login.legacyHint')}
      </T>
    </Screen>
  )
}
