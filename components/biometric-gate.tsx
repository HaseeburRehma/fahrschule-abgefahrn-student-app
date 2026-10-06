/**
 * BiometricGate — optional Face ID / fingerprint lock. When the user enables it
 * in Settings, the app locks whenever it goes to the background and prompts to
 * unlock on return. Native only; on web it renders children unchanged.
 *
 * The lock is an overlay: the navigator underneath stays mounted, so returning
 * from the background (or from a system picker / share sheet) keeps the current
 * screen and its state instead of restarting the app at the first route.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, BackHandler, Platform, StyleSheet, View } from 'react-native'
import { LockSimple } from 'phosphor-react-native/src/icons/LockSimple'

import { Button, C, HeroGlow, LinkButton, Logo, T } from '@/components/ds'
import { getBiometricEnabled, authenticateDetailed, setBiometricEnabled, subscribeBiometricEnabled } from '@/lib/biometric'
import { useUser } from '@/lib/user-context'
import { useT } from '@/lib/i18n'

export function BiometricGate({ children }: { children: React.ReactNode }) {
  const t = useT()
  const { session, signOut } = useUser()
  const signedIn = !!session
  const [locked, setLocked] = useState(false)
  const lockedRef = useRef(false)
  const enabledRef = useRef(false)
  const authInFlight = useRef(false)
  const mounted = useRef(true)

  const setLockedBoth = useCallback((v: boolean) => {
    lockedRef.current = v
    if (mounted.current) setLocked(v)
  }, [])

  const tryUnlock = useCallback(async () => {
    // The OS prompt itself makes the app inactive → active; never stack prompts.
    if (authInFlight.current) return
    authInFlight.current = true
    try {
      const res = await authenticateDetailed(t('lock.prompt'))
      if (res.success) setLockedBoth(false)
      else if (res.unusable) {
        // Biometrics/passcode were removed on this device (or Expo Go lacks Face ID):
        // a retry can never succeed → turn the lock off instead of trapping the user.
        await setBiometricEnabled(false)
        setLockedBoth(false)
      }
    } finally {
      authInFlight.current = false
    }
  }, [setLockedBoth, t])

  useEffect(() => {
    if (Platform.OS === 'web') return
    mounted.current = true
    getBiometricEnabled().then((en) => {
      if (!mounted.current) return
      enabledRef.current = en
      if (en) {
        setLockedBoth(true)
        tryUnlock()
      }
    })
    const unsubscribe = subscribeBiometricEnabled((en) => {
      enabledRef.current = en
      if (!en) setLockedBoth(false)
    })
    const sub = AppState.addEventListener('change', (s) => {
      if (!enabledRef.current) return
      // Only a real background transition locks: 'inactive' also fires for the
      // Face ID prompt, permission dialogs, Control Center, etc.
      if (s === 'background') setLockedBoth(true)
      else if (s === 'active' && lockedRef.current) tryUnlock()
    })
    return () => {
      mounted.current = false
      unsubscribe()
      sub.remove()
    }
  }, [setLockedBoth, tryUnlock])

  // While locked, the hardware back button must not navigate the hidden screens.
  useEffect(() => {
    if (!locked || !signedIn || Platform.OS !== 'android') return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true)
    return () => sub.remove()
  }, [locked, signedIn])

  // Nobody signed in → nothing to protect (the login screen asks for the password anyway).
  const showLock = locked && signedIn

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }} importantForAccessibility={showLock ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={showLock}>
        {children}
      </View>
      {showLock ? (
        <View style={[StyleSheet.absoluteFill, { zIndex: 2000, elevation: 2000, backgroundColor: C.bg, overflow: 'hidden' }]}>
          <HeroGlow top={120} />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, paddingHorizontal: 24 }}>
            <Logo width={190} />
            <View style={{ alignItems: 'center', gap: 6 }}>
              <T variant="headingL" style={{ textAlign: 'center' }}>{t('lock.title')}</T>
              <T variant="bodyM" color={C.muted} style={{ textAlign: 'center' }}>{t('lock.body')}</T>
            </View>
            <Button label={t('lock.unlock')} iconLeft={LockSimple} onPress={tryUnlock} style={{ alignSelf: 'stretch' }} />
            <LinkButton
              label={t('lock.signOut')}
              color={C.muted}
              onPress={async () => {
                await setBiometricEnabled(false)
                setLockedBoth(false)
                await signOut()
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  )
}
