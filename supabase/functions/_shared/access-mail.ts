// Sends a student whose account the school created (admin "add student",
// website intake form) a one-time link to choose a password. Without it those
// accounts exist but nobody can sign in to them.
import { fetchWithRetry } from './http.ts'
import { buildAccessEmail } from './invites.ts'

export type AccessMailResult = 'sent' | 'disabled' | 'not_configured' | 'failed'

export const SCHOOL = {
  name: 'Fahrschule Abgefahrn',
  appStoreUrl: 'https://apps.apple.com/de/app/fahrschule-abgefahrn/id6827141269',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=de.fahrschuleabgefahrn.app',
}

interface Ctx {
  env: (k: string) => string | undefined
  log: { info: (m: string, d?: unknown) => void; error: (m: string, d?: unknown) => void }
}

export async function sendAccessMail(
  ctx: Ctx,
  db: any,
  opts: { email: string; firstName: string | null; userId: string },
): Promise<AccessMailResult> {
  // Same switch as the invite e-mails (Einstellungen → "Einladungs-E-Mails").
  const { data: flag } = await db.from('app_settings').select('value').eq('key', 'feature.invite_emails').maybeSingle()
  if (flag?.value !== 'on') return 'disabled'

  const key = ctx.env('RESEND_API_KEY')
  const from = ctx.env('MAIL_FROM')
  const webUrl = (ctx.env('APP_WEB_URL') ?? '').replace(/\/+$/, '')
  if (!key || !from || !webUrl) return 'not_configured'
  const replyTo = ctx.env('MAIL_REPLY_TO') || undefined

  const { data, error } = await db.auth.admin.generateLink({
    type: 'recovery',
    email: opts.email,
    options: { redirectTo: `${webUrl}/reset-password` },
  })
  const link: string | undefined = data?.properties?.action_link
  if (error || !link) {
    ctx.log.error('access link failed', { error: error?.message })
    return 'failed'
  }

  const mail = buildAccessEmail({
    email: opts.email,
    firstName: opts.firstName,
    link,
    schoolName: SCHOOL.name,
    appStoreUrl: SCHOOL.appStoreUrl,
    playStoreUrl: SCHOOL.playStoreUrl,
    supportEmail: replyTo ?? null,
  })
  try {
    const res = await fetchWithRetry(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          // one access mail per account and hour, even if a request is retried
          'Idempotency-Key': `access-${opts.userId}-${Math.floor(Date.now() / 3_600_000)}`,
        },
        body: JSON.stringify({ from, to: [opts.email], subject: mail.subject, html: mail.html, text: mail.text, ...(replyTo ? { reply_to: replyTo } : {}) }),
      },
      { retries: 2, timeoutMs: 15_000 },
    )
    if (!res.ok) {
      ctx.log.error('access mail failed', { status: res.status, body: (await res.text()).slice(0, 300) })
      return 'failed'
    }
    ctx.log.info('access mail sent', { user_id: opts.userId })
    return 'sent'
  } catch (e) {
    ctx.log.error('access mail unreachable', { error: String((e as Error)?.message ?? e).slice(0, 300) })
    return 'failed'
  }
}
