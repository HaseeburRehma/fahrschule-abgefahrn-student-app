/**
 * Sign-up — Figma DE/SignUp (1295:1932). Name, email, password, school code + AGB/Datenschutz.
 * Calls the `signup-with-code` edge function, then signs in → AuthGuard → /account-created.
 */

import React, { useRef, useState } from 'react'
import { Linking, Pressable, View, type TextInput } from 'react-native'
import { router } from 'expo-router'
import { ArrowRight } from 'phosphor-react-native/src/icons/ArrowRight'
import { EnvelopeSimple } from 'phosphor-react-native/src/icons/EnvelopeSimple'
import { IdentificationCard } from 'phosphor-react-native/src/icons/IdentificationCard'
import { LockSimple } from 'phosphor-react-native/src/icons/LockSimple'
import { User } from 'phosphor-react-native/src/icons/User'

import { Button, C, Checkbox, HeroTitle, Input, LinkButton, Logo, Screen, T, useToast } from '@/components/ds'
import { FooterPrompt, FormError, Spacer } from '@/components/auth/ui'
import { getSupabase } from '@/lib/supabase/client'
import { classifyPasswordError, passwordErrorKey, readFunctionError } from '@/lib/auth/errors'
import { setPostAuthRoute } from '@/lib/auth/flow'
import { PASSWORD_MAX, passwordIssue, passwordIssueKey } from '@/lib/auth/password'
import { useT, useTranslation } from '@/lib/i18n'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** The school site has no dedicated AGB page (checked: /agb/ → 404) — fall back to the homepage. */
const TERMS_URL = 'https://fahrschule-abgefahrn.de/'
const PRIVACY_URL = 'https://fahrschule-abgefahrn.de/datenschutz/'
const NAME_MAX = 60
const CODE_MAX = 32

type Field = 'name' | 'email' | 'password' | 'code' | 'terms'

export default function SignUp() {
  const t = useT()
  const { locale } = useTranslation()
  const toast = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errs, setErrs] = useState<Partial<Record<Field, string>>>({})
  const [formErr, setFormErr] = useState<string | null>(null)
  const [emailExists, setEmailExists] = useState(false)

  const emailRef = useRef<TextInput>(null)
  const pwRef = useRef<TextInput>(null)
  const codeRef = useRef<TextInput>(null)
  // Sync guard against double submits (button + keyboard "done" before `busy` re-renders).
  const busyRef = useRef(false)

  const clearField = (f: Field) => {
    if (errs[f]) setErrs((e) => ({ ...e, [f]: undefined }))
    if (formErr) setFormErr(null)
    if (f === 'email' && emailExists) setEmailExists(false)
  }

  async function submit() {
    if (busyRef.current) return
    setFormErr(null)
    setEmailExists(false)
    const cleanName = name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX)
    const cleanEmail = email.trim().toLowerCase()
    const cleanCode = code.replace(/\s+/g, '').toUpperCase()

    const e: Partial<Record<Field, string>> = {}
    if (!cleanName) e.name = t('auth.val.nameRequired')
    if (!cleanEmail) e.email = t('auth.val.emailRequired')
    else if (!EMAIL_RE.test(cleanEmail)) e.email = t('auth.val.emailInvalid')
    const pwIssue = passwordIssue(password)
    if (pwIssue) e.password = t(passwordIssueKey(pwIssue))
    if (!cleanCode) e.code = t('auth.val.codeRequired')
    if (!accepted) e.terms = t('auth.val.termsRequired')
    setErrs(e)
    if (Object.keys(e).length) return

    // Single "Name" field in Figma → split on the first space.
    const sp = cleanName.indexOf(' ')
    const first_name = sp === -1 ? cleanName : cleanName.slice(0, sp)
    const last_name = sp === -1 ? '' : cleanName.slice(sp + 1)

    busyRef.current = true
    setBusy(true)
    try {
      const supabase = getSupabase()
      const { error } = await supabase.functions.invoke('signup-with-code', {
        body: { first_name, last_name, email: cleanEmail, password, school_code: cleanCode, locale },
      })
      if (error) {
        const fe = await readFunctionError(error)
        if (fe.network) setFormErr(t('auth.err.network'))
        else if (fe.code === 'weak_password') setErrs({ password: t('auth.val.passwordRule') })
        else if (fe.status === 403 || fe.code === 'invalid_code') setErrs({ code: t('auth.signup.errCode') })
        else if (fe.status === 409 || fe.code === 'email_exists') {
          setErrs({ email: t('auth.signup.errExists') })
          setEmailExists(true)
        } else if (fe.status === 429 || fe.code === 'rate_limited') setFormErr(t('auth.err.rateLimited'))
        else if (fe.status === 400 && fe.code === 'invalid_input') setFormErr(t('auth.signup.errInvalid'))
        else setFormErr(t('auth.err.generic'))
        return
      }

      // Account exists now → sign in; AuthGuard picks up the session and opens "Konto erstellt".
      setPostAuthRoute('/account-created')
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
      if (signInErr) {
        setPostAuthRoute(null)
        const kind = classifyPasswordError(signInErr)
        toast.show(kind === 'network' ? t(passwordErrorKey(kind)) : t('auth.signup.errSignIn'), 'info')
        router.replace('/(auth)/login' as any)
      }
    } catch (err) {
      setPostAuthRoute(null)
      setFormErr(t(passwordErrorKey(classifyPasswordError(err))))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const open = (url: string) => Linking.openURL(url).catch(() => {})

  return (
    <Screen
      glow={-20}
      keyboard
      padded={false}
      gap={0}
      contentStyle={{ paddingHorizontal: 24 }}
      footer={
        <FooterPrompt
          text={t('auth.signup.haveAccount')}
          link={t('auth.signup.login')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login' as any))}
        />
      }
    >
      <Logo width={150} />
      <Spacer h={24} />
      <HeroTitle line1={t('auth.signup.line1')} line2={t('auth.signup.line2')} />
      <Spacer h={18} />

      <View style={{ gap: 14 }}>
        <Input
          label={t('auth.field.name')}
          icon={User}
          placeholder={t('auth.field.namePh')}
          value={name}
          onChangeText={(v) => {
            setName(v)
            clearField('name')
          }}
          error={errs.name}
          autoCapitalize="words"
          maxLength={NAME_MAX}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <View style={{ gap: 6 }}>
          <Input
            {...({ ref: emailRef } as object)}
            label={t('auth.field.email')}
            icon={EnvelopeSimple}
            placeholder={t('auth.field.emailPh')}
            value={email}
            onChangeText={(v) => {
              setEmail(v)
              clearField('email')
            }}
            error={errs.email}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            maxLength={254}
            textContentType="emailAddress"
            keyboardType="email-address"
            inputMode="email"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => pwRef.current?.focus()}
          />
          {emailExists ? (
            <LinkButton label={t('auth.signup.toForgot')} align="left" onPress={() => router.push('/(auth)/forgot' as any)} />
          ) : null}
        </View>
        <Input
          {...({ ref: pwRef } as object)}
          label={t('auth.field.password')}
          icon={LockSimple}
          placeholder={t('auth.field.passwordNewPh')}
          value={password}
          onChangeText={(v) => {
            setPassword(v)
            clearField('password')
          }}
          error={errs.password}
          hint={t('auth.field.passwordHint')}
          maxLength={PASSWORD_MAX}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => codeRef.current?.focus()}
        />
        <Input
          {...({ ref: codeRef } as object)}
          label={t('auth.field.code')}
          icon={IdentificationCard}
          placeholder={t('auth.field.codePh')}
          value={code}
          onChangeText={(v) => {
            setCode(v)
            clearField('code')
          }}
          error={errs.code}
          autoCapitalize="characters"
          maxLength={CODE_MAX}
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submit}
        />

        <View style={{ gap: 6 }}>
          <Pressable
            onPress={() => {
              setAccepted((a) => !a)
              clearField('terms')
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
          >
            <Checkbox
              value={accepted}
              size={24}
              onChange={(v) => {
                setAccepted(v)
                clearField('terms')
              }}
            />
            <T variant="bodyS" color={C.muted} style={{ flex: 1 }}>
              {t('auth.signup.termsPre')}
              <T variant="bodyS" color={C.muted} style={{ textDecorationLine: 'underline' }} onPress={() => open(TERMS_URL)}>
                {t('auth.signup.terms')}
              </T>
              {t('auth.signup.termsMid')}
              <T variant="bodyS" color={C.muted} style={{ textDecorationLine: 'underline' }} onPress={() => open(PRIVACY_URL)}>
                {t('auth.signup.privacy')}
              </T>
              {t('auth.signup.termsPost')}
            </T>
          </Pressable>
          {errs.terms ? <FormError message={errs.terms} /> : null}
        </View>
      </View>

      <Spacer h={8} />
      {formErr ? (
        <View style={{ marginBottom: 12 }}>
          <FormError message={formErr} />
        </View>
      ) : null}
      <Button label={t('auth.signup.submit')} iconRight={ArrowRight} onPress={submit} loading={busy} />
    </Screen>
  )
}
