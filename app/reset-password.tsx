/**
 * Neues Passwort — no Figma frame; built in the visual language of "05/Passwort vergessen".
 * Opened from the recovery mail:
 *   - web:    detectSessionInUrl signs the user in (AuthGuard also redirects PASSWORD_RECOVERY here)
 *   - native: abgefahrn://reset-password#access_token=…&refresh_token=…&type=recovery  (or ?code=…)
 * Then auth.updateUser({ password }) → Home.
 */

import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform, View, type TextInput } from 'react-native'
import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import { FloppyDisk } from 'phosphor-react-native/src/icons/FloppyDisk'
import { LinkBreak } from 'phosphor-react-native/src/icons/LinkBreak'
import { LockSimple } from 'phosphor-react-native/src/icons/LockSimple'

import { Button, C, EmptyState, Input, Screen, T, TopBar, useToast } from '@/components/ds'
import { AuthTitle, Spacer } from '@/components/auth/ui'
import { getSupabase } from '@/lib/supabase/client'
import { classifyPasswordError, passwordErrorKey } from '@/lib/auth/errors'
import { parseAuthParams } from '@/lib/auth/recovery'
import { useT } from '@/lib/i18n'

type Phase = 'checking' | 'ready' | 'invalid'

async function establishSession(url: string | null): Promise<boolean> {
  const auth = getSupabase().auth
  const p = parseAuthParams(url)
  if (p.error || p.error_code || p.error_description) return false

  if (p.access_token && p.refresh_token) {
    const { error } = await auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token })
    return !error
  }

  const { data } = await auth.getSession()
  if (data?.session) return true

  if (p.code) {
    const { data: ex, error } = await auth.exchangeCodeForSession(p.code)
    return !error && !!ex?.session
  }
  return false
}

export default function ResetPassword() {
  const t = useT()
  const toast = useToast()
  const linkUrl = Linking.useURL()
  const [phase, setPhase] = useState<Phase>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwErr, setPwErr] = useState<string | null>(null)
  const [confirmErr, setConfirmErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const handled = useRef<string | null>(null)
  const confirmRef = useRef<TextInput>(null)

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    ;(async () => {
      const url =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.href
          : linkUrl ?? (await Linking.getInitialURL().catch(() => null))
      const key = url ?? '(none)'
      if (!alive || handled.current === key) return
      handled.current = key
      setPhase('checking')
      // Never spin forever (bad link, offline, …).
      timer = setTimeout(() => alive && setPhase((ph) => (ph === 'checking' ? 'invalid' : ph)), 10000)
      try {
        const ok = await establishSession(url)
        if (alive) setPhase(ok ? 'ready' : 'invalid')
      } catch {
        if (alive) setPhase('invalid')
      } finally {
        clearTimeout(timer)
      }
    })()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [linkUrl])

  async function save() {
    setPwErr(null)
    setConfirmErr(null)
    if (password.length < 8) return setPwErr(t(password ? 'auth.val.passwordShort' : 'auth.val.passwordRequired'))
    if (confirm !== password) return setConfirmErr(t('auth.val.passwordMismatch'))
    setBusy(true)
    try {
      const { error } = await getSupabase().auth.updateUser({ password })
      if (error) throw error
      toast.show(t('auth.reset.saved'), 'success')
      router.replace('/home' as any)
    } catch (e) {
      setPwErr(t(passwordErrorKey(classifyPasswordError(e))))
    } finally {
      setBusy(false)
    }
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(auth)/login' as any))

  if (phase !== 'ready') {
    return (
      <Screen glow={-20} header={<TopBar title={t('auth.reset.title')} onBack={back} />} scroll={false}>
        {phase === 'checking' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <ActivityIndicator color={C.brand} size="large" />
            <T variant="bodyS" color={C.muted}>{t('auth.reset.checking')}</T>
          </View>
        ) : (
          <EmptyState
            icon={LinkBreak}
            title={t('auth.reset.invalidTitle')}
            body={t('auth.reset.invalidBody')}
            action={t('auth.reset.invalidAction')}
            onAction={() => router.replace('/(auth)/forgot' as any)}
          />
        )}
      </Screen>
    )
  }

  return (
    <Screen
      glow={-20}
      keyboard
      padded={false}
      gap={0}
      header={<TopBar title={t('auth.reset.title')} onBack={back} />}
      contentStyle={{ paddingHorizontal: 24, paddingTop: 24 }}
    >
      <AuthTitle line1={t('auth.reset.line1')} line2={t('auth.reset.line2')} gap={0} />
      <Spacer h={12} />
      <T variant="bodyL" color={C.muted}>{t('auth.reset.body')}</T>
      <Spacer h={28} />
      <View style={{ gap: 16 }}>
        <Input
          label={t('auth.reset.password')}
          icon={LockSimple}
          placeholder={t('auth.field.passwordNewPh')}
          value={password}
          onChangeText={(v) => {
            setPassword(v)
            if (pwErr) setPwErr(null)
          }}
          error={pwErr ?? undefined}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
        <Input
          {...({ ref: confirmRef } as object)}
          label={t('auth.reset.confirm')}
          icon={LockSimple}
          placeholder={t('auth.reset.confirmPh')}
          value={confirm}
          onChangeText={(v) => {
            setConfirm(v)
            if (confirmErr) setConfirmErr(null)
          }}
          error={confirmErr ?? undefined}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={save}
        />
      </View>
      <Spacer h={12} />
      <Button label={t('auth.reset.submit')} iconRight={FloppyDisk} onPress={save} loading={busy} />
    </Screen>
  )
}
