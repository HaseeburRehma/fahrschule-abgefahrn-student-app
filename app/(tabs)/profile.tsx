/**
 * Figma "DE/Profil" (1290:1595): account header, settings groups, log out.
 * Keeps all former settings features: language, push, reminders, biometric
 * lock, admin entry, delete account, sign out, app version.
 */

import React, { useEffect, useState } from 'react'
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

  async function togglePush(next: boolean) {
    setPush(next)
    const effective = await setPushEnabled(uid, next)
    setPush(effective)
    if (next && !effective) toast.show(t('profile.v2.pushDenied'), 'error')
  }

  async function toggleReminders(next: boolean) {
    setReminders(next)
    await setRemindersEnabled(next)
  }

  async function toggleBiometric(next: boolean) {
    if (next) {
      const ok = await authenticate('Fahrschule Abgefahrn')
      if (!ok) return
    }
    await setBiometricEnabled(next)
    setBioEnabled(next)
  }

  async function confirmLogout() {
    setLoggingOut(true)
    try {
      await signOut()
    } finally {
      setLoggingOut(false)
      setLogoutOpen(false)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await deleteMyAccount()
      setDeleteOpen(false)
      await signOut()
    } catch (e: any) {
      toast.show(e?.message || t('profile.v2.delete.error'), 'error')
    } finally {
      setDeleting(false)
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
        <View style={{ flex: 1, gap: 4, alignItems: 'flex-start' }}>
          <T variant="headingM" numberOfLines={1}>{name}</T>
          {profile?.email ? (
            <T variant="bodyS" color={C.muted} numberOfLines={1}>{profile.email}</T>
          ) : null}
          <View style={{ backgroundColor: C.tile, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <T variant="labelM" color={C.brand}>{roleLabel}</T>
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
        <ListRow icon={Bell} title={t('profile.v2.push')} right={<Toggle value={push} onChange={togglePush} />} />
        <ListRow
          icon={ClockCountdown}
          title={t('profile.v2.reminders')}
          right={<Toggle value={reminders} onChange={toggleReminders} />}
        />
        {bioAvailable ? (
          <ListRow
            icon={Fingerprint}
            title={t('profile.v2.biometric')}
            right={<Toggle value={bioEnabled} onChange={toggleBiometric} />}
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
