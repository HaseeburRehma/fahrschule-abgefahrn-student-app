/**
 * Figma "DE/Profil" (1290:1595): account header, settings groups, log out.
 * Keeps all former settings features: language, push, reminders, biometric
 * lock, admin entry, delete account, sign out, app version.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Platform, Pressable, View } from 'react-native'
import { useRouter } from 'expo-router'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight'
import { ChatCircleDots } from 'phosphor-react-native/src/icons/ChatCircleDots'
import { ClockCountdown } from 'phosphor-react-native/src/icons/ClockCountdown'
import { FileText } from 'phosphor-react-native/src/icons/FileText'
import { Fingerprint } from 'phosphor-react-native/src/icons/Fingerprint'
import { Globe } from 'phosphor-react-native/src/icons/Globe'
import { GraduationCap } from 'phosphor-react-native/src/icons/GraduationCap'
import { Info } from 'phosphor-react-native/src/icons/Info'
import { ShieldCheck } from 'phosphor-react-native/src/icons/ShieldCheck'
import { SignOut } from 'phosphor-react-native/src/icons/SignOut'
import { Trash } from 'phosphor-react-native/src/icons/Trash'
import { User } from 'phosphor-react-native/src/icons/User'
import { Bell } from 'phosphor-react-native/src/icons/Bell'

import { C, ListGroup, ListRow, Screen, SectionLabel, T, Toggle, useToast } from '@/components/ds'
import { LogoutSheet, DeleteAccountSheet } from '@/components/profile/logout-sheet'
import { LanguageSheet } from '@/components/profile/language-sheet'
import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { displayName, deleteMyAccount } from '@/lib/data'
import { isBiometricAvailable, getBiometricEnabled, setBiometricEnabled, authenticate } from '@/lib/biometric'
import { getRemindersEnabled, setRemindersEnabled } from '@/lib/reminders'
import { getPushEnabled, setPushEnabled } from '@/lib/notifications/push'

function initialOf(name: string): string {
  const c = name.trim().charAt(0)
  return c ? c.toUpperCase() : '?'
}

export default function ProfileScreen() {
  const { t, locale } = useTranslation()
  const toast = useToast()
  const router = useRouter()
  const { session, profile, isAdmin, isStudent, signOut } = useUser()
  const uid: string | null = session?.user?.id ?? null

  const [langOpen, setLangOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [push, setPush] = useState(true)
  const [reminders, setReminders] = useState(true)
  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioEnabled, setBioEnabled] = useState(false)
  /** which setting is being written (toggles are disabled meanwhile — no overlapping writes) */
  const [busyToggle, setBusyToggle] = useState<'push' | 'reminders' | 'bio' | null>(null)
  const busyRef = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  async function runToggle(key: 'push' | 'reminders' | 'bio', fn: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusyToggle(key)
    try {
      await fn()
    } catch {
      toast.show(t('ds.error.save'), 'error')
    } finally {
      busyRef.current = false
      if (alive.current) setBusyToggle(null)
    }
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      let pushOn = await getPushEnabled()
      if (pushOn && Platform.OS !== 'web') {
        try {
          const perm = await Notifications.getPermissionsAsync()
          // Only reflect a hard OS block; "undetermined" still counts as on.
          if (perm.status === 'denied') pushOn = false
        } catch {}
      }
      const [rem, bioAvail, bioOn] = await Promise.all([
        getRemindersEnabled(),
        isBiometricAvailable(),
        getBiometricEnabled(),
      ])
      if (!alive) return
      setPush(pushOn)
      setReminders(rem)
      setBioAvailable(bioAvail)
      setBioEnabled(bioOn)
    })()
    return () => {
      alive = false
    }
  }, [])

  function togglePush(next: boolean) {
    return runToggle('push', async () => {
      setPush(next)
      try {
        const effective = await setPushEnabled(uid, next)
        if (alive.current) setPush(effective)
        if (next && !effective) toast.show(t('profile.v2.pushDenied'), 'error')
      } catch (e) {
        if (alive.current) setPush(!next)
        throw e
      }
    })
  }

  function toggleReminders(next: boolean) {
    return runToggle('reminders', async () => {
      setReminders(next)
      await setRemindersEnabled(next)
    })
  }

  function toggleBiometric(next: boolean) {
    return runToggle('bio', async () => {
      if (next) {
        const ok = await authenticate('Fahrschule Abgefahrn')
        if (!ok) return
      }
      await setBiometricEnabled(next)
      if (alive.current) setBioEnabled(next)
    })
  }

  async function confirmLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await signOut()
    } finally {
      if (alive.current) {
        setLoggingOut(false)
        setLogoutOpen(false)
      }
    }
  }

  async function confirmDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteMyAccount()
      setDeleteOpen(false)
      await signOut()
    } catch {
      // raw server/edge-function messages are not user-facing — show the localized one
      toast.show(t('profile.v2.delete.error'), 'error')
    } finally {
      if (alive.current) setDeleting(false)
    }
  }

  const name = displayName(profile) || '—'
  const roleLabel = isAdmin
    ? t('profile.v2.roleAdmin')
    : t('profile.v2.role', { cls: profile?.license_class || 'B' })
  const version = Constants.expoConfig?.version ?? '1.0'
  const go = (path: string) => () => router.push(path as any)

  return (
    <Screen glow={-50} tabBar gap={14} contentStyle={{ paddingTop: 8 }}>
      <T variant="headingXL">{t('profile.v2.title')}</T>

      {/* Header card → Profil bearbeiten */}
      <Pressable
        onPress={go('/edit-profile')}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 16,
          borderRadius: 20,
          backgroundColor: C.card,
          borderWidth: 1,
          borderColor: C.lineGreen,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: C.brand,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: C.brand,
            shadowOpacity: 0.4,
            shadowRadius: 5,
            shadowOffset: { width: 0, height: 0 },
            elevation: 5,
          }}
        >
          <T variant="headingL" color={C.onBrand}>{initialOf(profile?.first_name || name)}</T>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4, alignItems: 'flex-start' }}>
          <T variant="headingM" numberOfLines={1}>{name}</T>
          {profile?.email ? (
            <T variant="bodyS" color={C.muted} numberOfLines={1}>{profile.email}</T>
          ) : null}
          <View style={{ backgroundColor: C.tile, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <T variant="labelM" color={C.brand} numberOfLines={1}>{roleLabel}</T>
          </View>
        </View>
        <CaretRight size={22} color={C.dim} />
      </Pressable>

      <SectionLabel>{t('profile.v2.section.account')}</SectionLabel>
      <ListGroup>
        <ListRow icon={User} title={t('profile.v2.editProfile')} onPress={go('/edit-profile')} />
        <ListRow icon={GraduationCap} title={t('profile.v2.exams')} onPress={go('/exams')} />
        <ListRow icon={FileText} title={t('profile.v2.documents')} onPress={go('/documents')} />
      </ListGroup>

      <SectionLabel>{t('profile.v2.section.app')}</SectionLabel>
      <ListGroup>
        <ListRow
          icon={Globe}
          title={t('profile.v2.language')}
          value={locale === 'de' ? t('profile.v2.lang.valueDe') : t('profile.v2.lang.valueEn')}
          onPress={() => setLangOpen(true)}
        />
        <ListRow icon={Bell} title={t('profile.v2.push')} right={<Toggle value={push} onChange={togglePush} disabled={busyToggle !== null} accessibilityLabel={t('profile.v2.push')} />} />
        <ListRow
          icon={ClockCountdown}
          title={t('profile.v2.reminders')}
          right={<Toggle value={reminders} onChange={toggleReminders} disabled={busyToggle !== null} accessibilityLabel={t('profile.v2.reminders')} />}
        />
        {bioAvailable ? (
          <ListRow
            icon={Fingerprint}
            title={t('profile.v2.biometric')}
            right={<Toggle value={bioEnabled} onChange={toggleBiometric} disabled={busyToggle !== null} accessibilityLabel={t('profile.v2.biometric')} />}
          />
        ) : null}
      </ListGroup>

      <SectionLabel>{t('profile.v2.section.school')}</SectionLabel>
      <ListGroup>
        <ListRow icon={Info} title={t('profile.v2.info')} onPress={go('/info')} />
        <ListRow icon={ChatCircleDots} title={t('profile.v2.chat')} onPress={go('/chat')} />
      </ListGroup>

      {isAdmin ? (
        <>
          <SectionLabel>{t('profile.v2.section.admin')}</SectionLabel>
          <ListGroup>
            <ListRow icon={ShieldCheck} title={t('profile.v2.admin')} onPress={go('/admin')} />
          </ListGroup>
        </>
      ) : null}

      <ListGroup>
        <ListRow icon={SignOut} title={t('profile.v2.logout')} danger onPress={() => setLogoutOpen(true)} />
        {isStudent ? (
          <ListRow icon={Trash} title={t('profile.v2.deleteAccount')} danger onPress={() => setDeleteOpen(true)} />
        ) : null}
      </ListGroup>

      <T variant="caption" color={C.dim}>{t('profile.v2.version', { v: version })}</T>

      <LanguageSheet visible={langOpen} onClose={() => setLangOpen(false)} />
      <LogoutSheet
        visible={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={confirmLogout}
        loading={loggingOut}
      />
      <DeleteAccountSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </Screen>
  )
}
