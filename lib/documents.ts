import { getSupabase } from '@/lib/supabase/client'

export interface DocRow {
  id: string
  title: string
  path: string
  created_at: string
}

export async function fetchDocuments(): Promise<DocRow[]> {
  const { data, error } = await getSupabase()
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DocRow[]
}

/** Short-lived signed URL to view/download a private document. */
export async function getDocumentUrl(path: string): Promise<string> {
  const { data, error } = await getSupabase()
    .storage.from('documents')
    .createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

/** Upload a picked file (Blob/ArrayBuffer/Uint8Array) + record its metadata. */
export async function uploadDocument(
  title: string,
  filename: string,
  mime: string,
  data: Blob | ArrayBuffer | Uint8Array,
): Promise<void> {
  const supabase = getSupabase()
  const ext = (filename.split('.').pop() || 'pdf').toLowerCase()
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(path, data as any, { contentType: mime, upsert: false })
  if (upErr) throw upErr
  const { error: insErr } = await supabase
    .from('documents')
    .insert({ title, path })
  if (insErr) throw insErr
}

export async function deleteDocument(doc: DocRow): Promise<void> {
  const supabase = getSupabase()
  await supabase.storage.from('documents').remove([doc.path])
  const { error } = await supabase.from('documents').delete().eq('id', doc.id)
  if (error) throw error
}

/** base64 → bytes (native upload path; avoids atob/Buffer availability issues). */
export function base64ToBytes(b64: string): Uint8Array {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const lookup = new Uint8Array(256)
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i
  let len = b64.length * 0.75
  if (b64[b64.length - 1] === '=') {
    len--
    if (b64[b64.length - 2] === '=') len--
  }
  const bytes = new Uint8Array(len)
  let p = 0
  for (let i = 0; i < b64.length; i += 4) {
    const e1 = lookup[b64.charCodeAt(i)]
    const e2 = lookup[b64.charCodeAt(i + 1)]
    const e3 = lookup[b64.charCodeAt(i + 2)]
    const e4 = lookup[b64.charCodeAt(i + 3)]
    bytes[p++] = (e1 << 2) | (e2 >> 4)
    if (b64[i + 2] !== '=') bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2)
    if (b64[i + 3] !== '=') bytes[p++] = ((e3 & 3) << 6) | e4
  }
  return bytes
}
