/**
 * Pure list helpers for the admin tables (students list): filtering, sorting
 * and pagination. No React, no Supabase — unit tested in tests/admin-list.test.ts.
 */

import type { StudentWithPlan } from '@/lib/admin'

// ── pagination ──────────────────────────────────────────────────────────────

export const PAGE_SIZES = [10, 25, 50, 100] as const

export interface PageInfo<T> {
  items: T[]
  /** 1-based, clamped into [1, pages] */
  page: number
  pages: number
  total: number
  /** 1-based index of the first / last item shown (0 when empty) */
  from: number
  to: number
}

export function paginate<T>(list: T[], page: number, size: number): PageInfo<T> {
  const per = Math.max(1, Math.floor(size) || 1)
  const total = list.length
  const pages = Math.max(1, Math.ceil(total / per))
  const p = Math.min(pages, Math.max(1, Math.floor(page) || 1))
  const start = (p - 1) * per
  const items = list.slice(start, start + per)
  return { items, page: p, pages, total, from: total ? start + 1 : 0, to: start + items.length }
}

/**
 * Page buttons to show: always the first and last page, the current page with
 * one neighbour on each side, and 'gap' where pages are left out.
 * e.g. (6, 12) → [1, 'gap', 5, 6, 7, 'gap', 12]
 */
export function pageWindow(page: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const keep = new Set([1, pages, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((n) => keep.add(n))
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((n) => keep.add(n))
  const nums = [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push(n - nums[i - 1] === 2 ? n - 1 : 'gap')
    out.push(n)
  })
  return out
}

// ── students ────────────────────────────────────────────────────────────────

export type StudentFilter = 'all' | 'active' | 'inactive' | 'no_package' | 'no_topic'
export type StudentSort = 'newest' | 'oldest' | 'name' | 'last_active'

export const STUDENT_FILTERS: StudentFilter[] = ['all', 'active', 'inactive', 'no_package', 'no_topic']
export const STUDENT_SORTS: StudentSort[] = ['newest', 'name', 'last_active', 'oldest']

export function studentName(s: StudentWithPlan): string {
  return [s.profile.first_name, s.profile.last_name].filter(Boolean).join(' ').trim()
}

export function matchesStudent(s: StudentWithPlan, query: string, filter: StudentFilter): boolean {
  const p = s.profile
  if (filter === 'active' && !p.is_active) return false
  if (filter === 'inactive' && p.is_active) return false
  if (filter === 'no_package' && s.packages.length) return false
  if (filter === 'no_topic' && s.topic) return false
  const q = query.trim().toLowerCase()
  if (!q) return true
  // digits-only queries also match phone numbers written with spaces / dashes
  const digits = q.replace(/\D/g, '')
  const phone = (p.phone ?? '').replace(/\D/g, '')
  if (digits.length >= 3 && digits === q.replace(/[\s+\-()/]/g, '') && phone.includes(digits)) return true
  return `${studentName(s)} ${p.email ?? ''} ${p.student_code ?? ''} ${p.phone ?? ''}`.toLowerCase().includes(q)
}

const time = (iso: string | null | undefined) => {
  const t = iso ? new Date(iso).getTime() : NaN
  return isNaN(t) ? null : t
}

export function sortStudents(list: StudentWithPlan[], sort: StudentSort): StudentWithPlan[] {
  const out = [...list]
  const byNewest = (a: StudentWithPlan, b: StudentWithPlan) => (time(b.profile.created_at) ?? 0) - (time(a.profile.created_at) ?? 0)
  switch (sort) {
    case 'oldest':
      return out.sort((a, b) => -byNewest(a, b))
    case 'name':
      return out.sort((a, b) => {
        const an = studentName(a) || a.profile.email || ''
        const bn = studentName(b) || b.profile.email || ''
        return an.localeCompare(bn, 'de', { sensitivity: 'base' })
      })
    case 'last_active':
      // never-active students go last, ties fall back to newest first
      return out.sort((a, b) => {
        const ta = time(a.profile.last_active_on)
        const tb = time(b.profile.last_active_on)
        if (ta === tb) return byNewest(a, b)
        if (ta === null) return 1
        if (tb === null) return -1
        return tb - ta
      })
    default:
      return out.sort(byNewest)
  }
}

export function countByFilter(list: StudentWithPlan[]): Record<StudentFilter, number> {
  const out = { all: 0, active: 0, inactive: 0, no_package: 0, no_topic: 0 } as Record<StudentFilter, number>
  for (const s of list) for (const f of STUDENT_FILTERS) if (matchesStudent(s, '', f)) out[f]++
  return out
}

/** "vor 3 Tagen" style age in whole days (null when unknown / in the future). */
export function daysAgo(iso: string | null | undefined, now = new Date()): number | null {
  const t = time(iso)
  if (t === null) return null
  const d = Math.floor((now.getTime() - t) / 86_400_000)
  return d < 0 ? 0 : d
}
