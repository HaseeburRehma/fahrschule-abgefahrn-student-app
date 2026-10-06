import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as LocalAuthentication from 'expo-local-authentication'

const KEY = 'abgefahrn.biometricLock'

/** Device supports biometrics AND the user has one enrolled (native only). */
export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false
  try {
    const hw = await LocalAuthentication.hasHardwareAsync()
    const enrolled = await LocalAuthentication.isEnrolledAsync()
    return hw && enrolled
  } catch {
    return false
  }
}

export async function getBiometricEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1'
  } catch {
    return false
  }
}

const listeners = new Set<(v: boolean) => void>()

/** Notified whenever the preference changes (BiometricGate reacts without an app restart). */
export function subscribeBiometricEnabled(fn: (v: boolean) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export async function setBiometricEnabled(v: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, v ? '1' : '0')
  } catch {}
  listeners.forEach((fn) => {
    try {
      fn(v)
    } catch {}
  })
}

export async function authenticate(reason: string): Promise<boolean> {
  if (Platform.OS === 'web') return true
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      disableDeviceFallback: false,
    })
    return res.success
  } catch {
    return false
  }
}
