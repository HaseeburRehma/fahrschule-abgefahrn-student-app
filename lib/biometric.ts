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

export type AuthResult = { success: boolean; unusable: boolean }

/**
 * Errors after which a retry can never succeed on this device right now
 * (biometrics removed / passcode off / Expo Go without Face ID entitlement).
 * The lock must then step aside instead of trapping the user.
 */
const UNUSABLE = new Set(['not_enrolled', 'not_available', 'passcode_not_set', 'missing_usage_description'])

export async function authenticateDetailed(reason: string): Promise<AuthResult> {
  if (Platform.OS === 'web') return { success: true, unusable: false }
  try {
    if (!(await isBiometricAvailable())) {
      // no biometrics any more → fall back to the device passcode if there is one
      const level = await LocalAuthentication.getEnrolledLevelAsync().catch(() => LocalAuthentication.SecurityLevel.NONE)
      if (level === LocalAuthentication.SecurityLevel.NONE) return { success: false, unusable: true }
    }
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      disableDeviceFallback: false,
    })
    if (res.success) return { success: true, unusable: false }
    return { success: false, unusable: UNUSABLE.has((res as { error?: string }).error ?? '') }
  } catch {
    return { success: false, unusable: false }
  }
}

export async function authenticate(reason: string): Promise<boolean> {
  return (await authenticateDetailed(reason)).success
}
