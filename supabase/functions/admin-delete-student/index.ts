// @ts-nocheck  — Deno edge function. Checked by `deno check` in CI.
// ============================================================================
// admin-delete-student — permanently deletes a student (admins only, RBAC).
//
// Purges the student's stored files, then deletes the auth user; FK cascades
// remove profile, package links, enrolments and notifications. Admins and the
// caller themself can't be deleted here. The deletion is recorded in the audit
// log by the profiles trigger.
//
//   POST { id: uuid }  →  200 { ok, id } | 400 | 401 | 403 | 404 | 429 | 500
// Deploy:  supabase functions deploy admin-delete-student
// ============================================================================

import { HttpError, badRequest, isUuid, notFound, readJson } from '../_shared/http.ts'
import { enforceRateLimit, purgeStudentFiles, requireAdmin, serve, serviceClient } from '../_shared/serve.ts'

serve('admin-delete-student', {}, async (ctx) => {
  const { user } = await requireAdmin(ctx)
  const body = await readJson(ctx.req, 10_000)
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  if (!isUuid(id)) throw badRequest('invalid_id')
  if (id === user.id) throw badRequest('cannot_delete_self')

  const admin = serviceClient()
  await enforceRateLimit(admin, ctx.log, `admin-delete:${user.id}`, 60, 3600)
  const { data: target } = await admin.from('profiles').select('role').eq('id', id).maybeSingle()
  if (!target) throw notFound()
  if (target.role === 'admin') throw badRequest('cannot_delete_admin')

  try {
    await purgeStudentFiles(admin, ctx.log, id)
  } catch (e) {
    ctx.log.error('file purge failed', { error: e })
  }
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) {
    ctx.log.error('delete user failed', { error: error.message })
    throw new HttpError(500, 'delete_failed')
  }
  ctx.log.info('student deleted', { admin_id: user.id, student_id: id })
  return ctx.json({ ok: true, id })
})
