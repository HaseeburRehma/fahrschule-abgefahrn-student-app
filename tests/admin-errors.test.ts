import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ getSupabase: () => ({}) }))
vi.mock('react-native', () => ({ Linking: {}, Platform: { OS: 'web' } }))
vi.mock('expo-web-browser', () => ({}))

import { AdminFunctionError, adminErrorText, createdText } from '../lib/admin'
import { buildAccessEmail } from '../supabase/functions/_shared/invites'

describe('admin function errors', () => {
  it('maps known codes to readable messages', () => {
    expect(adminErrorText(new AdminFunctionError('email_exists'))).toEqual(['adm.err.email_exists'])
    expect(adminErrorText(new AdminFunctionError('network'))).toEqual(['adm.err.network'])
  })
  it('falls back to a generic message with the code', () => {
    expect(adminErrorText(new AdminFunctionError('create_failed'))).toEqual(['adm.err.generic', { code: 'create_failed' }])
    expect(adminErrorText(new Error('boom'))[0]).toBe('adm.err.generic')
  })
  it('tells the admin whether the password e-mail went out', () => {
    expect(createdText({ access_mail: 'sent' })).toBe('adm.created.mailSent')
    expect(createdText({ access_mail: 'disabled' })).toBe('adm.created.mailOff')
    expect(createdText({ access_mail: 'failed' })).toBe('adm.created.mailFailed')
    expect(createdText({})).toBe('adm.created.mailFailed')
  })
})

describe('access e-mail', () => {
  const base = {
    email: 'anna@example.de',
    link: 'https://example.supabase.co/auth/v1/verify?token=abc&type=recovery&redirect_to=https://app.example/reset-password',
    schoolName: 'Fahrschule Abgefahrn',
    appStoreUrl: 'https://apps.apple.com/x',
    playStoreUrl: 'https://play.google.com/x',
  }
  it('contains the link, the address and a way out when the link expired', () => {
    const m = buildAccessEmail({ ...base, firstName: 'Anna' })
    expect(m.subject).toContain('Fahrschule Abgefahrn')
    expect(m.text).toContain(base.link)
    expect(m.text).toContain('Hallo Anna,')
    expect(m.text).toContain('Passwort vergessen')
    expect(m.html).toContain('Passwort festlegen')
    expect(m.html).toContain('anna@example.de')
  })
  it('escapes names so a crafted name cannot inject HTML', () => {
    const m = buildAccessEmail({ ...base, firstName: '<img src=x onerror=alert(1)>' })
    expect(m.html).not.toContain('<img src=x')
    expect(m.html).toContain('&lt;img')
  })
})
