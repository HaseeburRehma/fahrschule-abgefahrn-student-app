import React, { useCallback, useState } from 'react'
import { Alert, FlatList, Platform, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { FileText, Trash2, Upload } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import {
  fetchAllDocumentsAdmin,
  uploadDocument,
  deleteDocument,
  base64ToBytes,
  resolveDocumentMime,
  validateDocumentFile,
  DOCUMENT_MIME_TYPES,
  type AdminDocRow,
} from '@/lib/documents'
import { fetchStudents } from '@/lib/admin'
import { displayName } from '@/lib/data'
import { formatDate } from '@/lib/format'
import { Button, Card, ErrorText, Loader, TextField } from '@/components/ui'
import { StudentPicker } from '@/components/admin-pickers'
import type { Profile } from '@/lib/types'

function notify(msg: string) {
  if (Platform.OS === 'web') window.alert(msg)
  else Alert.alert(msg)
}
function confirmMsg(msg: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(msg))
  return new Promise((resolve) =>
    Alert.alert('', msg, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', style: 'destructive', onPress: () => resolve(true) },
    ]),
  )
}

export default function AdminDocuments() {
  const { t, locale } = useTranslation()
  const [rows, setRows] = useState<AdminDocRow[]>([])
  const [students, setStudents] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [studentId, setStudentId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [docs, studs] = await Promise.all([
        fetchAllDocumentsAdmin(),
        fetchStudents().catch(() => [] as Profile[]),
      ])
      setRows(docs)
      setStudents(studs)
    } catch (e: any) {
      setLoadError(e?.message ?? t('admin.v2.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const fileError = (code: string | null | undefined) =>
    code === 'too_large'
      ? t('admin.v2.docTooLarge')
      : code === 'bad_type'
        ? t('admin.v2.docBadType')
        : null

  async function pickAndUpload() {
    if (busy) return
    setError(null)
    if (!title.trim()) {
      setError(t('common.required'))
      return
    }
    setBusy(true)
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [...DOCUMENT_MIME_TYPES],
        copyToCacheDirectory: true,
      })
      if (res.canceled || !res.assets?.[0]) return
      const asset = res.assets[0]
      const name = asset.name ?? 'document.pdf'
      const problem = validateDocumentFile(name, asset.mimeType, asset.size)
      if (problem) {
        setError(fileError(problem))
        return
      }
      let data: Blob | Uint8Array
      if (Platform.OS === 'web') {
        data =
          ((asset as any).file as Blob) ??
          (await (await fetch(asset.uri)).blob())
      } else {
        const b64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        })
        data = base64ToBytes(b64)
      }
      await uploadDocument(
        title.trim(),
        name,
        resolveDocumentMime(name, asset.mimeType) ?? 'application/pdf',
        data,
        studentId,
      )
      setTitle('')
      notify(t('documents.uploaded'))
      load()
    } catch (e: any) {
      setError(fileError(e?.message) ?? e?.message ?? t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(doc: AdminDocRow) {
    if (deletingId) return
    const ok = await confirmMsg(t('common.delete') + '?')
    if (!ok) return
    setDeletingId(doc.id)
    try {
      await deleteDocument(doc)
      setRows((prev) => prev.filter((d) => d.id !== doc.id))
    } catch (e: any) {
      notify(e?.message ?? t('common.error'))
    } finally {
      setDeletingId(null)
    }
  }

  if (loading && !rows.length && !loadError) return <Loader />

  const audience = (d: AdminDocRow) => {
    if (!d.student_id) return t('admin.v2.docAll')
    const s = students.find((p) => p.id === d.student_id)
    return t('admin.v2.docOnlyFor', { name: s ? displayName(s) : '—' })
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.documents') }} />
      <FlatList
        data={rows}
        keyExtractor={(d) => d.id}
        contentContainerClassName="p-5 gap-2"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View className="gap-2">
          <Card className="mb-2 gap-3">
            <TextField
              label={t('documents.docTitle')}
              value={title}
              onChangeText={setTitle}
              editable={!busy}
            />
            <View className="gap-2">
              <Text className="text-sm font-semibold text-neutral-300">
                {t('admin.v2.docFor')}
              </Text>
              <StudentPicker
                students={students}
                selected={studentId}
                onSelect={setStudentId}
                placeholder={t('admin.v2.searchStudent')}
                allLabel={t('admin.v2.docAll')}
                disabled={busy}
              />
              <Text className="text-xs text-neutral-400">
                {studentId ? t('admin.v2.docPersonalHint') : t('admin.v2.docAllHint')}
              </Text>
            </View>
            <Pressable
              onPress={pickAndUpload}
              disabled={busy}
              className={`flex-row items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3.5 ${busy ? 'opacity-50' : ''}`}
            >
              <Upload size={18} color="#0A0A0A" />
              <Text className="font-bold text-ink">
                {busy ? t('common.loading') : t('documents.pickFile')}
              </Text>
            </Pressable>
            <Text className="text-xs text-neutral-400">{t('admin.v2.docLimits')}</Text>
            <ErrorText>{error}</ErrorText>
          </Card>
          <ErrorText>{loadError}</ErrorText>
          {loadError ? (
            <Button label={t('common.retry')} onPress={load} loading={loading} variant="ghost" />
          ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View className="flex-row items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <FileText size={20} color="#00FF24" />
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-neutral-100">{item.title}</Text>
              <Text className="text-xs text-neutral-400">
                {formatDate(item.created_at, locale)}
              </Text>
              <Text
                className={`text-xs font-semibold ${item.student_id ? 'text-brand' : 'text-neutral-500'}`}
              >
                {audience(item)}
              </Text>
            </View>
            <Pressable
              onPress={() => remove(item)}
              disabled={deletingId !== null}
              hitSlop={8}
              className={`p-1 ${deletingId === item.id ? 'opacity-40' : ''}`}
            >
              <Trash2 size={18} color="#EF4444" />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          loadError ? null : <Text className="mt-8 text-center text-neutral-400">
            {t('documents.empty')}
          </Text>
        }
      />
    </SafeAreaView>
  )
}
