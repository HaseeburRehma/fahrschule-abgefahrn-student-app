/**
 * BiometricGate — optional Face ID / fingerprint lock. When the user enables it
 * in Settings, the app locks whenever it goes to the background and prompts to
 * unlock on return. Native only; on web it renders children unchanged.
 */

import React, { useEffect, useRef, useState } from 'react'
import { AppState, Platform, Pressable, Text, View } from 'react-native'
import { Lock } from 'lucide-react-native'

import { Brand } from '@/components/ui'
import { getBiometricEnabled, authenticate } from '@/lib/biometric'

export function BiometricGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false)
  const lockedRef = useRef(false)
  const enabledRef = useRef(false)

  function setLockedBoth(v: boolean) {
    lockedRef.current = v
    setLocked(v)
  }

  async function tryUnlock() {
    const ok = await authenticate('Fahrschule Abgefahrn')
    if (ok) setLockedBoth(false)
  }

  useEffect(() => {
    if (Platform.OS === 'web') return
    let mounted = true
    getBiometricEnabled().then((en) => {
      if (!mounted) return
      enabledRef.current = en
      if (en) {
        setLockedBoth(true)
        tryUnlock()
      }
    })
    const sub = AppState.addEventListener('change', (s) => {
      if (!enabledRef.current) return
      if (s === 'background' || s === 'inactive') setLockedBoth(true)
      else if (s === 'active' && lockedRef.current) tryUnlock()
    })
    return () => {
      mounted = false
      sub.remove()
    }
  }, [])

  if (locked) {
    return (
      <View className="flex-1 items-center justify-center gap-6 bg-black">
        <Brand size={72} />
        <Pressable
          onPress={tryUnlock}
          className="flex-row items-center gap-2 rounded-2xl bg-brand px-6 py-4"
        >
          <Lock size={18} color="#0A0A0A" />
          <Text className="font-bold text-ink">Entsperren · Unlock</Text>
        </Pressable>
      </View>
    )
  }
  return <>{children}</>
}
