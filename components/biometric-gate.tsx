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
import { AppState, BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Lock } from 'lucide-react-native'

import { Brand } from '@/components/ui'
import { getBiometricEnabled, authenticate, subscribeBiometricEnabled } from '@/lib/biometric'

export function BiometricGate({ children }: { children: React.ReactNode }) {
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
      const ok = await authenticate('Fahrschule Abgefahrn')
      if (ok) setLockedBoth(false)
    } finally {
      authInFlight.current = false
    }
  }, [setLockedBoth])

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
    if (!locked || Platform.OS !== 'android') return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true)
    return () => sub.remove()
  }, [locked])

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }} importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={locked}>
        {children}
      </View>
      {locked ? (
        <View style={[StyleSheet.absoluteFill, { zIndex: 2000, elevation: 2000 }]} className="items-center justify-center gap-6 bg-black">
          <Brand size={72} />
          <Pressable
            onPress={tryUnlock}
            accessibilityRole="button"
            accessibilityLabel="Entsperren · Unlock"
            className="flex-row items-center gap-2 rounded-2xl bg-brand px-6 py-4"
          >
            <Lock size={18} color="#0A0A0A" />
            <Text className="font-bold text-ink">Entsperren · Unlock</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}
