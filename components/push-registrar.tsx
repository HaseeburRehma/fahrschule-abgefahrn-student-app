/**
 * Signed-in background duties: push-token registration (lib/notifications/push.ts)
 * and keeping profiles.locale in sync with the app language, so server-generated
 * notifications (appointment confirmations etc.) arrive in the student's language.
 */

import { useEffect } from 'react'

import { usePushRegistration } from '@/lib/notifications/push'
import { useUser } from '@/lib/user-context'
import { useTranslation } from '@/lib/i18n'
import { getSupabase } from '@/lib/supabase/client'

export function PushRegistrar() {
  usePushRegistration()
  const { profile } = useUser()
  const { locale } = useTranslation()
  const uid = profile?.id
  const stored = profile?.locale
  useEffect(() => {
    if (!uid || !stored || stored === locale) return
    getSupabase().from('profiles').update({ locale }).eq('id', uid).then(() => {}, () => {})
  }, [uid, stored, locale])
  return null
}
