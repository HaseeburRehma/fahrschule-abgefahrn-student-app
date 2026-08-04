/**
 * Role-based access helpers. Server-side RLS is the real authority — these
 * are UI gating only. Two roles: admin (school staff) and student.
 */

import type { UserRole } from '../types'

export const ROLE_LABELS: Record<UserRole, { de: string; en: string }> = {
  admin: { de: 'Administrator', en: 'Admin' },
  student: { de: 'Fahrschüler', en: 'Student' },
}

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: '#7C3AED', // violet-600
  student: '#22C55E', // brand green
}

/** Normalize anything the DB might return into the two canonical roles. */
export function normalizeRole(raw: string | null | undefined): UserRole {
  const r = (raw ?? 'student').toLowerCase()
  if (r === 'admin' || r === 'administrator') return 'admin'
  // Everything else (including legacy/unknown) is the least-privileged role.
  return 'student'
}

export function isAdmin(role: UserRole | null | undefined) {
  return role === 'admin'
}
export function isStudent(role: UserRole | null | undefined) {
  return role === 'student'
}
export function canManageStudents(role: UserRole | null | undefined) {
  return role === 'admin'
}
export function canSendNotifications(role: UserRole | null | undefined) {
  return role === 'admin'
}
