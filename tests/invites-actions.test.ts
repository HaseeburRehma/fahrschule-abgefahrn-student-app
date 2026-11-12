import { beforeEach, describe, expect, it, vi } from 'vitest'

// Minimal fake of the Supabase client: records edge-function calls and table updates.
const calls: { invoke: any[]; updates: { ids: string[] }[] } = { invoke: [], updates: [] }
let mailConfigured = true

const builder = () => {
  const b: any = {
    ids: [] as string[],
    update: () => b,
    in: (_col: string, ids: string[]) => ((b.ids = ids), b),
    neq: () => b,
    eq: () => b,
    then: (res: (v: any) => void) => {
      calls.updates.push({ ids: b.ids })
      res({ error: null })
    },
  }
  return b
}

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({
    from: () => builder(),
    functions: {
      invoke: async (_name: string, { body }: any) => {
        calls.invoke.push(body)
        const results = Object.fromEntries(body.invite_ids.map((id: string) => [id, 'sent']))
        return { data: { results, tally: { sent: body.invite_ids.length }, mail_configured: mailConfigured }, error: null }
      },
    },
  }),
}))
vi.mock('react-native', () => ({ Linking: {}, Platform: { OS: 'web' } }))
vi.mock('expo-web-browser', () => ({}))

import { reopenInvites, revokeInvites, sendInvites } from '../lib/invites'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`)

beforeEach(() => {
  calls.invoke = []
  calls.updates = []
  mailConfigured = true
})

describe('invite actions on large selections', () => {
  it('sends more than 500 invites in parts and merges the results', async () => {
    const res = await sendInvites(ids(1201))
    expect(calls.invoke.map((b) => b.invite_ids.length)).toEqual([500, 500, 201])
    expect(res.tally.sent).toBe(1201)
    expect(Object.keys(res.results)).toHaveLength(1201)
    expect(res.mail_configured).toBe(true)
  })

  it('stops after the first part when mail is not configured', async () => {
    mailConfigured = false
    const res = await sendInvites(ids(900))
    expect(calls.invoke).toHaveLength(1)
    expect(res.mail_configured).toBe(false)
  })

  it('revokes and reopens in URL-safe chunks', async () => {
    await revokeInvites(ids(320))
    expect(calls.updates.map((u) => u.ids.length)).toEqual([150, 150, 20])
    calls.updates = []
    await reopenInvites(ids(10))
    expect(calls.updates.map((u) => u.ids.length)).toEqual([10])
  })
})
