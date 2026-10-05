/**
 * Figma "06/Profil bearbeiten" (1305:2616 · EN 1314:3617).
 * Name (split into first/last on save), email (read-only), phone and — when
 * the optional `profiles.birth_date` column exists — date of birth.
 */

import React, { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useRouter } from 'expo-router'
import { CalendarDots } from 'phosphor-react-native/src/icons/CalendarDots'
import { EnvelopeSimple } from 'phosphor-react-native/src/icons/EnvelopeSimple'
import { PencilSimple } from 'phosphor-react-native/src/icons/PencilSimple'
import { Phone } from 'phosphor-react-native/src/icons/Phone'
import { User } from 'phosphor-react-native/src/icons/User'

import { Button, C, Input, Screen, T, TopBar, useToast } from '@/components/ds'
import { useT } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { updateMyProfile } from '@/lib/data'

/** 'YYYY-MM-DD' → 'DD.MM.YYYY' */
function isoToDisplay(iso?: string | null): string {
  if (!iso) return ''
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ''
}

/** 'DD.MM.YYYY' → 'YYYY-MM-DD' (null if invalid / in the future). */
function displayToIso(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!m) return null
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  if (dt.getTime() > Date.now() || y < 1900) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Auto-insert the dots while typing digits ("14032008" → "14.03.2008"). */
function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}

function isMissingColumn(e: any): boolean {
  const msg = String(e?.message ?? '') + String(e?.details ?? '')
  return /birth_date/.test(msg) && /(column|schema cache|does not exist)/i.test(msg)
}

export default function EditProfile() {
  const t = useT()
  const router = useRouter()
  const toast = useToast()
  const { session, profile, refreshProfile } = useUser()

  const originalName = useMemo(
    () => [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim(),
    [profile?.first_name, profile?.last_name],
  )
  // Only offer the birth date when the column exists (select('*') returns the key).
  const hasBirthColumn = !!profile && Object.prototype.hasOwnProperty.call(profile, 'birth_date')

  const [name, setName] = useState(originalName)
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [birth, setBirth] = useState(isoToDisplay(profile?.birth_date))
  const [busy, setBusy] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [birthError, setBirthError] = useState<string | null>(null)

  const initial = (name.trim() || profile?.email || '?').charAt(0).toUpperCase()

  async function save() {
    const uid = session?.user?.id
    if (!uid || busy) return
    setNameError(null)
    setBirthError(null)

    const trimmed = name.trim().replace(/\s+/g, ' ')
    if (!trimmed) {
      setNameError(t('profile.v2.edit.nameRequired'))
      return
    }
    let birthIso: string | null = null
    if (hasBirthColumn && birth.trim()) {
      birthIso = displayToIso(birth)
      if (!birthIso) {
        setBirthError(t('profile.v2.edit.birthInvalid'))
        return
      }
    }

    // Keep the stored split when the name wasn't touched; otherwise first word
    // = first name, the rest = last name.
    let first_name = profile?.first_name ?? null
    let last_name = profile?.last_name ?? null
    if (trimmed !== originalName) {
      const [f, ...rest] = trimmed.split(' ')
      first_name = f || null
      last_name = rest.join(' ') || null
    }

    const base = { first_name, last_name, phone: phone.trim() || null }
    setBusy(true)
    try {
      if (hasBirthColumn) {
        try {
          await updateMyProfile(uid, { ...base, birth_date: birthIso })
        } catch (e) {
          if (!isMissingColumn(e)) throw e
          await updateMyProfile(uid, base)
        }
      } else {
        await updateMyProfile(uid, base)
      }
      await refreshProfile()
      toast.show(t('profile.v2.edit.saved'), 'success')
      if (router.canGoBack()) router.back()
    } catch {
      toast.show(t('profile.v2.edit.error'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const header = (
    <TopBar
      title={t('profile.v2.edit.title')}
      right={
        <Pressable onPress={save} disabled={busy} hitSlop={10} accessibilityRole="button">
          {({ pressed }) => (
            <T variant="labelL" color={C.brand} style={{ opacity: busy ? 0.5 : pressed ? 0.7 : 1 }}>
              {t('profile.v2.edit.save')}
            </T>
          )}
        </Pressable>
      }
    />
  )

  return (
    <Screen
      glow={-30}
      keyboard
      header={header}
      padded={false}
      gap={20}
      contentStyle={{ paddingHorizontal: 24, paddingTop: 10 }}
      footer={
        <View style={{ marginHorizontal: 4 }}>
          <Button label={t('profile.v2.edit.saveChanges')} onPress={save} loading={busy} />
        </View>
      }
    >
      {/* Avatar */}
      <View style={{ width: 96, height: 96, alignSelf: 'center' }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: C.brand,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: C.brand,
            shadowOpacity: 0.45,
            shadowRadius: 7,
            shadowOffset: { width: 0, height: 0 },
            elevation: 6,
          }}
        >
          <T variant="displayL" color={C.onBrand}>{initial}</T>
        </View>
        <View
          style={{
            position: 'absolute',
            left: 64,
            top: 64,
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: C.surface,
            borderWidth: 3,
            borderColor: C.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PencilSimple size={17} color={C.brand} />
        </View>
      </View>

      <View style={{ gap: 16 }}>
        <Input
          label={t('profile.v2.edit.name')}
          icon={User}
          value={name}
          onChangeText={(v) => {
            setName(v)
            if (nameError) setNameError(null)
          }}
          placeholder={t('profile.v2.edit.namePlaceholder')}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          error={nameError ?? undefined}
        />
        <Input
          label={t('profile.v2.edit.email')}
          icon={EnvelopeSimple}
          value={profile?.email ?? ''}
          editable={false}
          selectTextOnFocus={false}
        />
        <Input
          label={t('profile.v2.edit.phone')}
          icon={Phone}
          value={phone}
          onChangeText={setPhone}
          placeholder={t('profile.v2.edit.phonePlaceholder')}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
        />
        {hasBirthColumn ? (
          <Input
            label={t('profile.v2.edit.birth')}
            icon={CalendarDots}
            value={birth}
            onChangeText={(v) => {
              setBirth(maskDate(v))
              if (birthError) setBirthError(null)
            }}
            placeholder={t('profile.v2.edit.birthPlaceholder')}
            keyboardType="number-pad"
            maxLength={10}
            error={birthError ?? undefined}
          />
        ) : null}
      </View>
    </Screen>
  )
}
