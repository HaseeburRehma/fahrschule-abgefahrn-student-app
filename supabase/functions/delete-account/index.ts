// @ts-nocheck  — Deno edge function. Checked by `deno check` in CI.
// ============================================================================
// delete-account — a signed-in user deletes THEIR OWN account (App Store /
// Play Store requirement, GDPR right to erasure).
//
// The caller comes from their verified JWT (never from the body), so nobody
// can delete someone else (no IDOR). Stored files are purged first, then the
// auth user is deleted; FK cascades remove profile, packages, enrolments,
// notifications. Admins can't self-delete here (keeps the school from locking
// itself out). Rate limited: 5 / hour per user.
//
//   200 { ok } | 400 admin_cannot_self_delete | 401 | 429 | 500
// Deploy:  supabase functions deploy delete-account
// ============================================================================

import { HttpError, badRequest } from '../_shared/http.ts'
import { authenticate, enforceRateLimit, purgeStudentFiles, serve, serviceClient } from '../_shared/serve.ts'

serve('delete-account', {}, async (ctx) => {
  const { user } = await authenticate(ctx)
  const admin = serviceClient()
  await enforceRateLimit(admin, ctx.log, `delete-account:${user.id}`, 5, 3600)

  const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (prof?.role === 'admin') throw badRequest('admin_cannot_self_delete')

  try {
    await purgeStudentFiles(admin, ctx.log, user.id)
  } catch (e) {
    // Don't block the deletion on storage — log it so the files can be cleaned up by hand.
    ctx.log.error('file purge failed', { error: e })
  }
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    ctx.log.error('delete user failed', { error: error.message })
    throw new HttpError(500, 'delete_failed')
  }
  ctx.log.info('account deleted', { user_id: user.id })
  return ctx.json({ ok: true })
})
