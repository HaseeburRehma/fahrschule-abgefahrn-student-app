/**
 * Small shared state for the auth flow so AuthGuard knows where to send a
 * freshly signed-in user (e.g. sign-up → "Konto erstellt" instead of Home),
 * and whether the one-time onboarding pager has been seen.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

const ONBOARDED_KEY = 'abgefahrn.onboarded'

let postAuthRoute: string | null = null

/** Call right before signing in when the next screen should not be Home. */
export function setPostAuthRoute(route: string | null) {
  postAuthRoute = route
}

/** Read-and-clear. */
export function takePostAuthRoute(): string | null {
  const r = postAuthRoute
  postAuthRoute = null
  return r
}

export function peekPostAuthRoute(): string | null {
  return postAuthRoute
}

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDED_KEY)) === '1'
  } catch {
    return true
  }
}

export async function markOnboardingSeen() {
  try {
    await AsyncStorage.setItem(ONBOARDED_KEY, '1')
  } catch {}
}

/** Routes a signed-in user may stay on even though they belong to the auth flow. */
export const SIGNED_IN_AUTH_ROUTES = ['account-created', 'push-permission', 'reset-password']
/** Routes a signed-out user may open outside the (auth) group. */
export const PUBLIC_ROUTES = ['reset-password']
