import { randomBytes as nodeRandom } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  CODE_ALPHABET,
  buildInviteEmail,
  cleanName,
  cleanPhone,
  escapeHtml,
  generateCode,
  isValidCode,
  isValidEmail,
  normalizeCode,
  planImport,
  type ExistingState,
} from '../supabase/functions/_shared/invites'

const rnd = (n: number) => new Uint8Array(nodeRandom(n))

function state(partial: Partial<ExistingState> = {}): ExistingState {
  return {
    profilesByEmail: new Map(),
    invitesByEmail: new Map(),
    codeOwners: new Map(),
    schoolCode: 'SCHUL-0000',
    ...partial,
  }
}

describe('codes', () => {
  it('generates XXXX-XXXX codes from the look-alike-free alphabet', () => {
    for (let i = 0; i < 500; i++) {
      const c = generateCode(rnd)
      expect(c).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/)
      expect(isValidCode(c)).toBe(true)
    }
    expect(CODE_ALPHABET).toHaveLength(32)
    expect(CODE_ALPHABET).not.toMatch(/[01IO]/)
  })

  it('avoids taken codes and gives up instead of looping forever', () => {
    const fixed = () => new Uint8Array(8) // always "2222-2222"
    expect(() => generateCode(fixed, new Set(['2222-2222']))).toThrow(/could_not_generate/)
    let n = 0
    const seq = () => new Uint8Array(8).fill(n++)
    expect(generateCode(seq, new Set(['2222-2222']))).toBe('3333-3333')
  })

  it('is uniformly spread (no modulo bias)', () => {
    const counts = new Map<string, number>()
    for (let i = 0; i < 4000; i++) for (const ch of generateCode(rnd).replace('-', '')) counts.set(ch, (counts.get(ch) ?? 0) + 1)
    const vals = [...counts.values()]
    expect(counts.size).toBe(32)
    expect(Math.max(...vals) / Math.min(...vals)).toBeLessThan(1.35)
  })

  it('normalises and validates file codes', () => {
    expect(normalizeCode(' k 10 01 ')).toBe('K1001')
    expect(isValidCode('K-1001')).toBe(true)
    expect(isValidCode('AB')).toBe(false)
    expect(isValidCode('-ABC')).toBe(false)
    expect(isValidCode('A'.repeat(33))).toBe(false)
    expect(isValidCode("AB'; DROP")).toBe(false)
  })
})

describe('field cleaning', () => {
  it('validates e-mails', () => {
    expect(isValidEmail('max.muster+fs@example.co.uk')).toBe(true)
    expect(isValidEmail('max@example')).toBe(false)
    expect(isValidEmail('max muster@example.de')).toBe(false)
    expect(isValidEmail('<script>@x.de')).toBe(false)
  })

  it('cleans names and phones', () => {
    expect(cleanName('  Max \n  Peter ')).toBe('Max Peter')
    expect(cleanName('')).toBeNull()
    expect(cleanName('x'.repeat(100))).toHaveLength(60)
    expect(cleanPhone('+49 (176) 123-4567')).toBe('+49 (176) 123-4567')
    expect(cleanPhone('n/a')).toBeNull()
    expect(cleanPhone('=HYPERLINK("x")0176123')).toBe('0176123')
  })
})

describe('planImport', () => {
  it('creates invites, generates missing codes and keeps file codes', () => {
    const plan = planImport(
      [
        { row: 2, email: 'max@example.de', first_name: 'Max', student_code: 'k-1001' },
        { row: 3, email: 'anna@example.de', first_name: 'Anna' },
      ],
      state(),
      rnd,
    )
    expect(plan[0]).toMatchObject({ outcome: 'invite_new', student_code: 'K-1001', code_source: 'file', reason: null })
    expect(plan[1]).toMatchObject({ outcome: 'invite_new', code_source: 'generated', reason: 'code_generated' })
    expect(isValidCode(plan[1].student_code!)).toBe(true)
  })

  it('handles students who already have an account', () => {
    const s = state({
      profilesByEmail: new Map([
        ['old@example.de', { id: 'p1', student_code: 'AAAA-BBBB', role: 'student' }],
        ['keep@example.de', { id: 'p2', student_code: 'CCCC-DDDD', role: 'student' }],
        ['boss@example.de', { id: 'p3', student_code: null, role: 'admin' }],
      ]),
      codeOwners: new Map([
        ['AAAA-BBBB', 'old@example.de'],
        ['CCCC-DDDD', 'keep@example.de'],
      ]),
    })
    const plan = planImport(
      [
        { row: 1, email: 'old@example.de', student_code: 'K-7' },
        { row: 2, email: 'keep@example.de' },
        { row: 3, email: 'boss@example.de' },
      ],
      s,
      rnd,
    )
    expect(plan.map((p) => [p.outcome, p.reason, p.student_code])).toEqual([
      ['registered', 'code_updated', 'K-7'],
      ['registered', 'code_kept', 'CCCC-DDDD'],
      ['skipped', 'is_admin', null],
    ])
  })

  it('reopens earlier invites and keeps their code', () => {
    const s = state({
      invitesByEmail: new Map([['re@example.de', { id: 'i1', student_code: 'EEEE-FFFF', status: 'revoked' }]]),
      codeOwners: new Map([['EEEE-FFFF', 're@example.de']]),
    })
    const [p] = planImport([{ row: 1, email: 're@example.de' }], s, rnd)
    expect(p).toMatchObject({ outcome: 'invite_update', student_code: 'EEEE-FFFF', target_id: 'i1' })
  })

  it('skips bad rows with a reason', () => {
    const s = state({ codeOwners: new Map([['TAKEN-1', 'other@example.de']]) })
    const plan = planImport(
      [
        { row: 1, email: 'not-an-email' },
        { row: 2, email: 'a@example.de', student_code: 'X1' },
        { row: 3, email: 'b@example.de', student_code: 'schul-0000' },
        { row: 4, email: 'c@example.de', student_code: 'taken-1' },
        { row: 5, email: 'd@example.de', student_code: 'SAME-1' },
        { row: 6, email: 'e@example.de', student_code: 'SAME-1' },
        { row: 7, email: 'D@Example.de' },
      ],
      s,
      rnd,
    )
    expect(plan.map((p) => p.reason)).toEqual([
      'invalid_email',
      'invalid_code',
      'school_code',
      'code_taken',
      null,
      'duplicate_code',
      'duplicate_email',
    ])
  })

  it('never hands out the same generated code twice in one import', () => {
    const rows = Array.from({ length: 2000 }, (_, i) => ({ row: i + 1, email: `s${i}@example.de` }))
    const t0 = performance.now()
    const plan = planImport(rows, state(), rnd)
    expect(performance.now() - t0).toBeLessThan(1000)
    expect(new Set(plan.map((p) => p.student_code)).size).toBe(2000)
  })
})

describe('invite e-mail', () => {
  const base = {
    email: 'max@example.de',
    code: 'K7QM-2PXD',
    schoolName: 'Fahrschule Abgefahrn',
    appStoreUrl: 'https://apps.apple.com/de/app/id1',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=x',
  }

  it('contains the code, the address and both store links', () => {
    const m = buildInviteEmail({ ...base, firstName: 'Max' })
    expect(m.subject).toContain('Fahrschule Abgefahrn')
    for (const s of ['Hallo Max,', 'K7QM-2PXD', 'max@example.de', base.appStoreUrl, base.playStoreUrl]) {
      expect(m.text).toContain(s)
      expect(m.html).toContain(s)
    }
  })

  it('escapes names so a list entry cannot inject HTML', () => {
    const m = buildInviteEmail({ ...base, firstName: '<img src=x onerror=alert(1)>' })
    expect(m.html).not.toContain('<img')
    expect(m.html).toContain('&lt;img')
    expect(escapeHtml(`"'&<>`)).toBe('&quot;&#39;&amp;&lt;&gt;')
  })

  it('greets neutrally without a name and adds optional links', () => {
    const m = buildInviteEmail({ ...base, firstName: null, webUrl: 'https://app.example.de', supportEmail: 'info@example.de' })
    expect(m.text.startsWith('Hallo,')).toBe(true)
    expect(m.html).toContain('https://app.example.de')
    expect(m.html).toContain('mailto:info@example.de')
  })
})
