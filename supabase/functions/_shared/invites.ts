// ============================================================================
// Student invites — pure logic shared by the `admin-invite-students` and
// `signup-with-code` edge functions (Deno) and the admin import screen (app).
// No imports and no runtime globals, so it runs everywhere and is unit tested
// in tests/invites-shared.test.ts.
// ============================================================================

export const MAX_IMPORT_ROWS = 2000
export const MAX_SEND_PER_CALL = 500

/** Same rule as the database check constraint on student codes. */
export const CODE_RE = /^[A-Z0-9][A-Z0-9._/-]{2,31}$/
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/
/** Generated codes: no look-alike characters (0/O, 1/I). */
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

export function normalizeEmail(input: unknown): string {
  return String(input ?? '')
    .trim()
    .replace(/^mailto:/i, '')
    .toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email)
}

/** Uppercase, no whitespace. "abg 12 34" → "ABG1234". */
export function normalizeCode(input: unknown): string {
  return String(input ?? '')
    .replace(/\s+/g, '')
    .toUpperCase()
}

export function isValidCode(code: string): boolean {
  return CODE_RE.test(code)
}

/** Trim, collapse inner whitespace, cap length. Empty → null. */
export function cleanName(input: unknown, max = 60): string | null {
  const s = String(input ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
  return s || null
}

/** Keep digits, +, spaces, slashes, dashes, brackets. Empty → null. */
export function cleanPhone(input: unknown): string | null {
  const s = String(input ?? '')
    .replace(/[^\d+ ()/-]/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
  return /\d{3,}/.test(s.replace(/\D/g, '')) ? s : null
}

/**
 * Random XXXX-XXXX code. `randomBytes(n)` must return n cryptographically random
 * bytes (crypto.getRandomValues in Deno / browsers). 32 symbols → 5 bits/char,
 * 32 divides 256 so `% 32` has no modulo bias.
 */
export function generateCode(randomBytes: (n: number) => Uint8Array, taken?: Set<string>): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const b = randomBytes(8)
    let s = ''
    for (let i = 0; i < 8; i++) s += CODE_ALPHABET[b[i] % 32]
    const code = `${s.slice(0, 4)}-${s.slice(4)}`
    if (!taken?.has(code)) return code
  }
  throw new Error('could_not_generate_code')
}

// ── import planning ─────────────────────────────────────────────────────────

export interface ImportRowInput {
  /** 1-based row number in the uploaded file (for the admin's reference). */
  row: number
  email: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  student_code?: string | null
}

export type RowOutcome =
  | 'invite_new' //       new invite created
  | 'invite_update' //    an earlier invite (not yet accepted) was updated / reopened
  | 'registered' //       already has an account — no invite, code kept or set
  | 'skipped' //          not imported, see reason

export type RowReason =
  | 'invalid_email'
  | 'duplicate_email' // same e-mail earlier in the file
  | 'invalid_code' //    code from the file doesn't fit the format
  | 'duplicate_code' //  same code earlier in the file
  | 'code_taken' //      code already belongs to another student / invite
  | 'school_code' //     code equals the shared school sign-up code
  | 'is_admin' //        address belongs to an admin account
  | 'code_generated' //  info: no code in the file → generated
  | 'code_updated' //    info: registered student got the code from the file
  | 'code_kept' //       info: registered student keeps their code

export interface PlannedRow {
  row: number
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  student_code: string | null
  code_source: 'file' | 'generated' | 'profile' | null
  outcome: RowOutcome
  reason: RowReason | null
  /** invite id to update (invite_update) or profile id (registered) */
  target_id: string | null
}

export interface ExistingState {
  profilesByEmail: Map<string, { id: string; student_code: string | null; role: string }>
  invitesByEmail: Map<string, { id: string; student_code: string; status: string }>
  /** code → e-mail that owns it (profiles and invites) */
  codeOwners: Map<string, string>
  schoolCode: string | null
}

/**
 * Decide, row by row, what an import does. Pure: the caller loads the current
 * state, applies the plan and keeps the result rows for the import history.
 */
export function planImport(
  rows: ImportRowInput[],
  state: ExistingState,
  randomBytes: (n: number) => Uint8Array,
): PlannedRow[] {
  const seenEmails = new Set<string>()
  const seenCodes = new Map<string, string>() // code → email within this file
  const taken = new Set<string>(state.codeOwners.keys())
  const school = state.schoolCode ? normalizeCode(state.schoolCode) : null
  const out: PlannedRow[] = []

  for (const r of rows) {
    const email = normalizeEmail(r.email)
    const base = {
      row: r.row,
      email,
      first_name: cleanName(r.first_name),
      last_name: cleanName(r.last_name),
      phone: cleanPhone(r.phone),
    }
    const skip = (reason: RowReason, code: string | null = null): PlannedRow => ({
      ...base,
      student_code: code,
      code_source: null,
      outcome: 'skipped',
      reason,
      target_id: null,
    })

    if (!isValidEmail(email)) {
      out.push(skip('invalid_email'))
      continue
    }
    if (seenEmails.has(email)) {
      out.push(skip('duplicate_email'))
      continue
    }
    seenEmails.add(email)

    const rawCode = normalizeCode(r.student_code)
    let fileCode: string | null = null
    if (rawCode) {
      if (!isValidCode(rawCode)) {
        out.push(skip('invalid_code', rawCode))
        continue
      }
      if (school && rawCode === school) {
        out.push(skip('school_code', rawCode))
        continue
      }
      const inFile = seenCodes.get(rawCode)
      if (inFile && inFile !== email) {
        out.push(skip('duplicate_code', rawCode))
        continue
      }
      const owner = state.codeOwners.get(rawCode)
      if (owner && owner !== email) {
        out.push(skip('code_taken', rawCode))
        continue
      }
      fileCode = rawCode
      seenCodes.set(rawCode, email)
    }

    const profile = state.profilesByEmail.get(email)
    if (profile) {
      if (profile.role === 'admin') {
        out.push(skip('is_admin'))
        continue
      }
      // Already in the app: no invite. Adopt the school's code from the file if it differs.
      const code = fileCode ?? profile.student_code
      const reason: RowReason =
        fileCode && fileCode !== profile.student_code ? 'code_updated' : 'code_kept'
      if (code) taken.add(code)
      out.push({
        ...base,
        student_code: code ?? null,
        code_source: fileCode ? 'file' : 'profile',
        outcome: 'registered',
        reason,
        target_id: profile.id,
      })
      continue
    }

    // An earlier invite (any status — an accepted one whose account was deleted
    // included) is reopened instead of creating a second row for the address.
    const invite = state.invitesByEmail.get(email)
    let code = fileCode
    let source: 'file' | 'generated' = 'file'
    let reason: RowReason | null = null
    if (!code) {
      if (invite) {
        code = invite.student_code
        source = 'generated'
      } else {
        code = generateCode(randomBytes, taken)
        source = 'generated'
        reason = 'code_generated'
      }
    }
    taken.add(code)
    seenCodes.set(code, email)
    out.push({
      ...base,
      student_code: code,
      code_source: source,
      outcome: invite ? 'invite_update' : 'invite_new',
      reason,
      target_id: invite?.id ?? null,
    })
  }
  return out
}

// ── invite e-mail ───────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface InviteMailInput {
  email: string
  firstName: string | null
  code: string
  schoolName: string
  appStoreUrl: string
  playStoreUrl: string
  webUrl?: string | null
  supportEmail?: string | null
}

export function buildInviteEmail(m: InviteMailInput): { subject: string; html: string; text: string } {
  const name = m.firstName ? cleanName(m.firstName, 60) : null
  const hiDe = name ? `Hallo ${name},` : 'Hallo,'
  const hiEn = name ? `Hi ${name},` : 'Hi,'
  const subject = `Deine Einladung zur App von ${m.schoolName}`

  const text = [
    hiDe,
    '',
    `${m.schoolName} lädt dich in die Fahrschul-App ein: Theorie lernen, Quiz üben, Fahrstunden und Prüfungstermine im Blick.`,
    '',
    `Dein persönlicher Code: ${m.code}`,
    '',
    'So geht’s:',
    `1. App laden – iPhone: ${m.appStoreUrl}`,
    `   Android: ${m.playStoreUrl}`,
    ...(m.webUrl ? [`   oder im Browser: ${m.webUrl}`] : []),
    '2. „Registrieren“ antippen.',
    `3. Mit dieser E-Mail-Adresse (${m.email}) und deinem Code ein Konto anlegen.`,
    '',
    'Der Code funktioniert nur zusammen mit dieser E-Mail-Adresse.',
    ...(m.supportEmail ? ['', `Fragen? ${m.supportEmail}`] : []),
    '',
    '—',
    '',
    hiEn,
    `${m.schoolName} invites you to the driving school app. Your personal code: ${m.code}`,
    `Download the app, tap "Sign up" and register with this e-mail address (${m.email}) and your code.`,
  ].join('\n')

  const e = escapeHtml
  const btn = (href: string, label: string) =>
    `<a href="${e(href)}" style="display:inline-block;margin:4px 6px 4px 0;padding:12px 18px;border-radius:12px;background:#00FF24;color:#0A0A0A;font-weight:700;text-decoration:none">${e(label)}</a>`

  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(subject)}</title></head>
<body style="margin:0;background:#0A0A0A;font-family:Helvetica,Arial,sans-serif;color:#F5F5F5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A"><tr><td align="center" style="padding:24px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141414;border:1px solid #262626;border-radius:20px">
<tr><td style="padding:28px 24px">
<p style="margin:0 0 12px;font-size:18px;font-weight:700">${e(hiDe)}</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#D4D4D4">${e(m.schoolName)} lädt dich in die Fahrschul-App ein: Theorie lernen, Quiz üben, Fahrstunden und Prüfungstermine im Blick.</p>
<p style="margin:0 0 6px;font-size:13px;color:#A3A3A3">Dein persönlicher Code</p>
<p style="margin:0 0 20px;font-size:28px;font-weight:800;letter-spacing:3px;color:#00FF24;font-family:Menlo,Consolas,monospace">${e(m.code)}</p>
<p style="margin:0 0 8px;font-size:15px;font-weight:700">So geht’s</p>
<ol style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.6;color:#D4D4D4">
<li>App laden</li>
<li>„Registrieren“ antippen</li>
<li>Mit <strong style="color:#F5F5F5">${e(m.email)}</strong> und deinem Code ein Konto anlegen</li>
</ol>
<p style="margin:0 0 16px">${btn(m.appStoreUrl, 'App Store')}${btn(m.playStoreUrl, 'Google Play')}${m.webUrl ? btn(m.webUrl, 'Im Browser öffnen') : ''}</p>
<p style="margin:0 0 4px;font-size:13px;color:#A3A3A3">Der Code funktioniert nur zusammen mit dieser E-Mail-Adresse.</p>
${m.supportEmail ? `<p style="margin:0;font-size:13px;color:#A3A3A3">Fragen? <a href="mailto:${e(m.supportEmail)}" style="color:#00FF24">${e(m.supportEmail)}</a></p>` : ''}
<hr style="border:none;border-top:1px solid #262626;margin:24px 0">
<p style="margin:0 0 8px;font-size:13px;color:#A3A3A3">${e(hiEn)} ${e(m.schoolName)} invites you to the driving school app. Your personal code: <strong style="color:#F5F5F5">${e(m.code)}</strong>. Download the app, tap “Sign up” and register with this e-mail address and your code.</p>
</td></tr></table>
</td></tr></table>
</body></html>`

  return { subject, html, text }
}
