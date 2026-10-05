import { Linking } from 'react-native'
import * as WebBrowser from 'expo-web-browser'

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

/** One document row by id (null if missing / not visible). */
export async function fetchDocument(id: string): Promise<DocRow | null> {
  const { data, error } = await getSupabase()
    .from('documents')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as DocRow) ?? null
}

/** File sizes (bytes) keyed by storage path. Best-effort: {} on any error. */
export async function fetchDocumentSizes(): Promise<Record<string, number>> {
  try {
    const { data, error } = await getSupabase()
      .storage.from('documents')
      .list('', { limit: 1000 })
    if (error || !data) return {}
    const out: Record<string, number> = {}
    for (const f of data as any[]) {
      const size = f?.metadata?.size
      if (f?.name && typeof size === 'number') out[f.name] = size
    }
    return out
  } catch {
    return {}
  }
}

export type DocKind = 'pdf' | 'image' | 'other'

/** File type from the storage path extension. */
export function docKind(path: string): DocKind {
  const ext = (path.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)) return 'image'
  return 'other'
}

/** Upper-case extension label ("PDF", "JPG"). */
export function docExtLabel(path: string): string {
  const ext = (path.split('.').pop() || '').toUpperCase()
  return ext.length > 0 && ext.length <= 5 ? ext : ''
}

/** Human file size in German/English notation ("240 KB", "1,2 MB"). */
export function formatFileSize(bytes: number, locale: 'de' | 'en' = 'de'): string {
  const fmt = (n: number) =>
    n.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: 1 })
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${fmt(bytes / (1024 * 1024))} MB`
}

/** Short-lived signed URL to view/download a private document. */
export async function getDocumentUrl(path: string): Promise<string> {
  const { data, error } = await getSupabase()
    .storage.from('documents')
    .createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

/** Open a document in the in-app browser (falls back to the system handler).
 * Returns false when no signed URL could be created. */
export async function openDocumentExternally(path: string): Promise<boolean> {
  try {
    const url = await getDocumentUrl(path)
    try {
      await WebBrowser.openBrowserAsync(url)
    } catch {
      await Linking.openURL(url)
    }
    return true
  } catch {
    return false
  }
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
