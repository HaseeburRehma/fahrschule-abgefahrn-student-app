import { describe, expect, it } from 'vitest'

import {
  acceptRate,
  countByFilter,
  daysAgo,
  inviteCounts,
  matchesInvite,
  matchesStudent,
  pageWindow,
  paginate,
  sortInvites,
  sortStudents,
} from '../lib/admin-list'
import type { Invite } from '../lib/invites'
import type { StudentWithPlan } from '../lib/admin'

const s = (id: string, over: Record<string, unknown> = {}, extra: Partial<StudentWithPlan> = {}): StudentWithPlan =>
  ({
    profile: {
      id,
      email: `${id}@example.de`,
      first_name: id,
      last_name: 'Muster',
      phone: null,
      is_active: true,
      student_code: null,
      created_at: '2026-01-01T00:00:00Z',
      last_active_on: null,
      ...over,
    },
    packages: [],
    topic: null,
    ...extra,
  }) as unknown as StudentWithPlan

describe('paginate', () => {
  const list = Array.from({ length: 76 }, (_, i) => i + 1)

  it('slices pages and reports the range', () => {
    expect(paginate(list, 1, 25)).toMatchObject({ page: 1, pages: 4, total: 76, from: 1, to: 25 })
    const last = paginate(list, 4, 25)
    expect(last.items).toEqual([76])
    expect(last).toMatchObject({ from: 76, to: 76 })
  })

  it('clamps out-of-range and junk page numbers', () => {
    expect(paginate(list, 99, 25).page).toBe(4)
    expect(paginate(list, 0, 25).page).toBe(1)
    expect(paginate(list, NaN, 25).page).toBe(1)
    expect(paginate(list, 2, 0).items).toEqual([2])
  })

  it('handles an empty list', () => {
    expect(paginate([], 3, 25)).toEqual({ items: [], page: 1, pages: 1, total: 0, from: 0, to: 0 })
  })
})

describe('pageWindow', () => {
  it('shows every page when there are few', () => {
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4])
  })
  it('collapses the middle with gaps', () => {
    expect(pageWindow(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12])
    expect(pageWindow(1, 12)).toEqual([1, 2, 3, 4, 'gap', 12])
    expect(pageWindow(12, 12)).toEqual([1, 'gap', 9, 10, 11, 12])
  })
  it('fills a single missing page instead of showing a gap', () => {
    expect(pageWindow(4, 12)).toEqual([1, 2, 3, 4, 5, 'gap', 12])
  })
})

describe('student filters and search', () => {
  const anna = s('anna', { phone: '+49 170 123 4567', student_code: 'ABCD-EFGH' }, { packages: [{ id: 'p' } as any] })
  const ben = s('ben', { is_active: false }, { topic: { id: 't' } as any })

  it('filters by status, package and theory class', () => {
    expect(matchesStudent(ben, '', 'inactive')).toBe(true)
    expect(matchesStudent(anna, '', 'inactive')).toBe(false)
    expect(matchesStudent(anna, '', 'no_package')).toBe(false)
    expect(matchesStudent(ben, '', 'no_package')).toBe(true)
    expect(matchesStudent(anna, '', 'no_topic')).toBe(true)
    expect(countByFilter([anna, ben])).toEqual({ all: 2, active: 1, inactive: 1, no_package: 1, no_topic: 1 })
  })

  it('searches name, e-mail, code and phone (ignoring spacing)', () => {
    expect(matchesStudent(anna, 'ANNA muster', 'all')).toBe(true)
    expect(matchesStudent(anna, 'abcd-efgh', 'all')).toBe(true)
    expect(matchesStudent(anna, '0170 1234', 'all')).toBe(false) // leading 0 vs +49 is not normalised
    expect(matchesStudent(anna, '170 1234', 'all')).toBe(true)
    expect(matchesStudent(anna, 'ben', 'all')).toBe(false)
  })
})

describe('sortStudents', () => {
  const a = s('Zoe', { created_at: '2026-03-01T00:00:00Z', last_active_on: '2026-11-01' })
  const b = s('anton', { created_at: '2026-05-01T00:00:00Z', last_active_on: null })
  const c = s('Mia', { created_at: '2026-04-01T00:00:00Z', last_active_on: '2026-11-10' })

  it('sorts newest, oldest, by name and by last activity', () => {
    const ids = (l: StudentWithPlan[]) => l.map((x) => x.profile.id)
    expect(ids(sortStudents([a, b, c], 'newest'))).toEqual(['anton', 'Mia', 'Zoe'])
    expect(ids(sortStudents([a, b, c], 'oldest'))).toEqual(['Zoe', 'Mia', 'anton'])
    expect(ids(sortStudents([a, b, c], 'name'))).toEqual(['anton', 'Mia', 'Zoe'])
    expect(ids(sortStudents([a, b, c], 'last_active'))).toEqual(['Mia', 'Zoe', 'anton'])
  })

  it('does not mutate the input', () => {
    const list = [a, b, c]
    sortStudents(list, 'name')
    expect(list.map((x) => x.profile.id)).toEqual(['Zoe', 'anton', 'Mia'])
  })
})

describe('daysAgo', () => {
  const now = new Date('2026-11-11T12:00:00Z')
  it('counts whole days and handles junk', () => {
    expect(daysAgo('2026-11-08T12:00:00Z', now)).toBe(3)
    expect(daysAgo('2026-12-01', now)).toBe(0)
    expect(daysAgo(null, now)).toBeNull()
    expect(daysAgo('nope', now)).toBeNull()
  })
})

const inv = (id: string, over: Partial<Invite> = {}): Invite =>
  ({
    id,
    import_id: null,
    email: `${id}@example.de`,
    first_name: id,
    last_name: null,
    phone: null,
    student_code: `CODE-${id.toUpperCase()}`,
    code_source: 'generated',
    status: 'pending',
    send_count: 0,
    last_sent_at: null,
    last_error: null,
    accepted_at: null,
    profile_id: null,
    created_at: '2026-11-01T00:00:00Z',
    ...over,
  }) as Invite

describe('invites', () => {
  const a = inv('anna', { status: 'sent', last_sent_at: '2026-11-05T10:00:00Z', created_at: '2026-11-02T00:00:00Z' })
  const b = inv('Ben', { status: 'failed', last_sent_at: '2026-11-08T10:00:00Z', created_at: '2026-11-01T00:00:00Z' })
  const c = inv('carla', { status: 'accepted', created_at: '2026-11-03T00:00:00Z' })
  const d = inv('dora', { status: 'revoked' })

  it('filters by status and searches name, e-mail and code', () => {
    expect(matchesInvite(b, '', 'failed')).toBe(true)
    expect(matchesInvite(a, '', 'failed')).toBe(false)
    expect(matchesInvite(a, 'code-anna', 'all')).toBe(true)
    expect(matchesInvite(a, 'ANNA@EXAMPLE', 'sent')).toBe(true)
    expect(matchesInvite(a, 'ben', 'all')).toBe(false)
  })

  it('sorts by newest, name and last sent (never sent last)', () => {
    const ids = (l: Invite[]) => l.map((x) => x.id)
    expect(ids(sortInvites([a, b, c], 'newest'))).toEqual(['carla', 'anna', 'Ben'])
    expect(ids(sortInvites([c, b, a], 'name'))).toEqual(['anna', 'Ben', 'carla'])
    expect(ids(sortInvites([c, a, b], 'last_sent'))).toEqual(['Ben', 'anna', 'carla'])
  })

  it('counts per status and the sign-up rate without revoked invites', () => {
    const counts = inviteCounts([a, b, c, d])
    expect(counts).toEqual({ all: 4, pending: 0, sent: 1, failed: 1, accepted: 1, revoked: 1 })
    expect(acceptRate(counts)).toBe(33)
    expect(acceptRate(inviteCounts([d]))).toBeNull()
  })
})
