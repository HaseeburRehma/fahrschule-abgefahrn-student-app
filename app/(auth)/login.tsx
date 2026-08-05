import React, { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getSupabase } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n'
import { classifyAuthError, authErrorKey } from '@/lib/auth/errors'
import { Logo, Button, TextField, ErrorText } from '@/components/ui'
import type { Locale } from '@/lib/types'

type Step = 'email' | 'code'

export default function Login() {
  const { t, locale, setLocale } = useTranslation()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cleanEmail = email.trim().toLowerCase()

  async function sendCode() {
    setError(null)
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError(t('common.required'))
      return
    }
    setBusy(true)
    try {
      const supabase = getSupabase()
      const { error: err } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        // Only admin-provisioned emails may sign in.
        options: { shouldCreateUser: false },
      })
      if (err) throw err
      setStep('code')
    } catch (e) {
      setError(t(authErrorKey(classifyAuthError(e))))
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    setError(null)
    if (code.trim().length < 6) {
      setError(t('auth.err.invalidCode'))
      return
    }
    setBusy(true)
    try {
      const supabase = getSupabase()
      const { error: err } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: code.trim(),
        type: 'email',
      })
      if (err) throw err
      // AuthGuard reacts to the new session and routes onward.
    } catch (e) {
      setError(t(authErrorKey(classifyAuthError(e))))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-ink">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-10"
          keyboardShouldPersistTaps="handled"
        >
          {/* Language toggle */}
          <View className="mb-8 flex-row justify-end gap-2">
            {(['de', 'en'] as Locale[]).map((l) => (
              <Pressable
                key={l}
                onPress={() => setLocale(l)}
                className={`rounded-full px-3 py-1 ${
                  locale === l ? 'bg-brand' : 'bg-neutral-800'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    locale === l ? 'text-ink' : 'text-neutral-300'
                  }`}
                >
                  {l.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="items-center">
            <Logo width={280} />
          </View>

          <View className="mt-10 rounded-3xl bg-neutral-900 p-6">
            {step === 'email' ? (
              <View className="gap-4">
                <View>
                  <Text className="text-xl font-bold text-neutral-100">
                    {t('auth.title')}
                  </Text>
                  <Text className="mt-1 text-sm text-neutral-400">
                    {t('auth.subtitle')}
                  </Text>
                </View>
                <TextField
                  label={t('auth.email')}
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  inputMode="email"
                  onSubmitEditing={sendCode}
                  returnKeyType="send"
                />
                <ErrorText>{error}</ErrorText>
                <Button label={t('auth.sendCode')} onPress={sendCode} loading={busy} />
              </View>
            ) : (
              <View className="gap-4">
                <View>
                  <Text className="text-xl font-bold text-neutral-100">
                    {t('auth.codeSentTitle')}
                  </Text>
                  <Text className="mt-1 text-sm text-neutral-400">
                    {t('auth.codeSentSubtitle', { email: cleanEmail })}
                  </Text>
                </View>
                <TextField
                  label={t('auth.code')}
                  placeholder="123456"
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={6}
                  onSubmitEditing={verify}
                  returnKeyType="done"
                />
                <ErrorText>{error}</ErrorText>
                <Button label={t('auth.verify')} onPress={verify} loading={busy} />
                <View className="flex-row justify-between">
                  <Pressable onPress={sendCode} disabled={busy}>
                    <Text className="text-sm font-semibold text-brand">
                      {t('auth.resend')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setStep('email')
                      setCode('')
                      setError(null)
                    }}
                    disabled={busy}
                  >
                    <Text className="text-sm font-semibold text-neutral-400">
                      {t('auth.changeEmail')}
                    </Text>
                  </Pressable>
                </View>
                <Text className="text-xs text-neutral-400">{t('auth.checkSpam')}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
