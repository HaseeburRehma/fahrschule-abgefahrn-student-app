import { getSupabase } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

export interface ChatMessage {
  id: string
  student_id: string
  sender_id: string
  from_admin: boolean
  body: string
  created_at: string
  read_at: string | null
}

export async function fetchThread(studentId: string): Promise<ChatMessage[]> {
  const { data, error } = await getSupabase()
    .from('chat_messages')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ChatMessage[]
}

export async function sendMessage(params: {
  studentId: string
  senderId: string
  fromAdmin: boolean
  body: string
}): Promise<ChatMessage> {
  const { data, error } = await getSupabase()
    .from('chat_messages')
    .insert({
      student_id: params.studentId,
      sender_id: params.senderId,
      from_admin: params.fromAdmin,
      body: params.body,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as ChatMessage
}

/** Mark the other side's unread messages as read. */
export async function markThreadRead(
  studentId: string,
  readerIsAdmin: boolean,
): Promise<void> {
  await getSupabase()
    .from('chat_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('student_id', studentId)
    .eq('from_admin', !readerIsAdmin) // read the opposite side
    .is('read_at', null)
}

export interface Conversation {
  student: Profile | null
  studentId: string
  lastBody: string
  lastAt: string
  unread: number // messages from the student not yet read by admin
}

/** Admin: one row per student who has any messages, newest first. */
export async function fetchConversations(): Promise<Conversation[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('chat_messages')
    .select('student_id, from_admin, body, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw error

  const byStudent = new Map<string, Conversation>()
  for (const m of (data ?? []) as any[]) {
    let conv = byStudent.get(m.student_id)
    if (!conv) {
      conv = {
        student: null,
        studentId: m.student_id,
        lastBody: m.body,
        lastAt: m.created_at, // first seen = newest (desc order)
        unread: 0,
      }
      byStudent.set(m.student_id, conv)
    }
    if (!m.from_admin && !m.read_at) conv.unread += 1
  }

  const ids = [...byStudent.keys()]
  if (ids.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('*')
      .in('id', ids)
    for (const p of (profs ?? []) as Profile[]) {
      const c = byStudent.get(p.id)
      if (c) c.student = p
    }
  }
  return [...byStudent.values()]
}
