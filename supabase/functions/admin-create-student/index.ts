// @ts-nocheck  — Deno edge function. Checked by `deno check` in CI.
// ============================================================================
// admin-create-student — creates a student account (admins only, RBAC).
//
// Server-side validation of every field (the app's checks are only UX):
// e-mail format/length, name/phone limits, UUIDs for topic and packages. Only
// whitelisted fields are copied into the profile (no mass assignment). If a
// later step fails, the half-created auth user is removed again so a retry
// starts clean (compensating action instead of a distributed transaction).
//
//   POST { email, first_name?, last_name?, phone?, current_theory_topic_id?, package_ids? }
//   → 200 { id } | 400 | 401 | 403 | 409 email_exists | 429 | 500
// Deploy:  supabase functions deploy admin-create-student
// ============================================================================

import { HttpError, badRequest, conflict, isUuid, readJson } from '../_shared/http.ts'
import { cleanName, cleanPhone, isValidEmail, normalizeEmail } from '../_shared/invites.ts'
import { enforceRateLimit, requireAdmin, serve, serviceClient } from '../_shared/serve.ts'

serve('admin-create-student', {}, async (ctx) => {
  const { user } = await requireAdmin(ctx)
  const body = await readJson(ctx.req, 20_000)

  const email = normalizeEmail(body.email)
  if (!isValidEmail(email)) throw badRequest('invalid_email')
  const topic = body.current_theory_topic_id ?? null
  if (topic !== null && !isUuid(topic)) throw badRequest('invalid_topic')
  const packageIds = Array.isArray(body.package_ids) ? body.package_ids : []
  if (packageIds.length > 20 || !packageIds.every(isUuid)) throw badRequest('invalid_packages')

  const admin = serviceClient()
  await enforceRateLimit(admin, ctx.log, `admin-create:${user.id}`, 120, 3600)

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { role: 'student' },
  })
  if (createErr || !created?.user) {
    const msg = String(createErr?.message ?? '').toLowerCase()
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) throw conflict('email_exists')
    ctx.log.error('create user failed', { error: createErr?.message })
    throw new HttpError(500, 'create_failed')
  }
  const uid = created.user.id

  const rollback = async (step: string, err: unknown) => {
    ctx.log.error(`${step} failed — rolling back user`, { error: err })
    await admin.auth.admin.deleteUser(uid).catch((e) => ctx.log.error('rollback failed', { error: e }))
    throw new HttpError(500, `${step}_failed`)
  }

  const { error: updErr } = await admin
    .from('profiles')
    .update({
      email,
      first_name: cleanName(body.first_name),
      last_name: cleanName(body.last_name),
      phone: cleanPhone(body.phone),
      role: 'student',
      current_theory_topic_id: topic,
    })
    .eq('id', uid)
  if (updErr) await rollback('profile', updErr.message)

  if (packageIds.length) {
    const rows = [...new Set(packageIds)].map((pid) => ({ student_id: uid, package_id: pid }))
    const { error: pkgErr } = await admin.from('student_packages').insert(rows)
    if (pkgErr) await rollback('packages', pkgErr.message)
  }

  ctx.log.info('student created', { admin_id: user.id, student_id: uid })
  return ctx.json({ id: uid })
})
