import React, { useCallback, useState } from 'react'
import { Alert, FlatList, Platform, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useFocusEffect } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { FileText, Trash2, Upload } from 'lucide-react-native'

import { useTranslation } from '@/lib/i18n'
import {
  fetchDocuments,
  uploadDocument,
  deleteDocument,
  base64ToBytes,
  type DocRow,
} from '@/lib/documents'
import { formatDate } from '@/lib/format'
import { Card, ErrorText, Loader, TextField } from '@/components/ui'

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
  const [rows, setRows] = useState<DocRow[] | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchDocuments()
      .then(setRows)
      .catch(() => setRows([]))
  }, [])
  useFocusEffect(useCallback(() => load(), [load]))

  async function pickAndUpload() {
    setError(null)
    if (!title.trim()) {
      setError(t('common.required'))
      return
    }
    const res = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    })
    if (res.canceled || !res.assets?.[0]) return
    const asset = res.assets[0]
    setBusy(true)
    try {
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
        asset.name ?? 'document.pdf',
        asset.mimeType ?? 'application/pdf',
        data,
      )
      setTitle('')
      notify(t('documents.uploaded'))
      load()
    } catch (e: any) {
      setError(e?.message ?? t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(doc: DocRow) {
    const ok = await confirmMsg(t('common.delete') + '?')
    if (!ok) return
    try {
      await deleteDocument(doc)
      setRows((prev) => (prev ?? []).filter((d) => d.id !== doc.id))
    } catch (e: any) {
      notify(e?.message ?? t('common.error'))
    }
  }

  if (rows === null) return <Loader />

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: t('admin.documents') }} />
      <FlatList
        data={rows}
        keyExtractor={(d) => d.id}
        contentContainerClassName="p-5 gap-2"
        ListHeaderComponent={
          <Card className="mb-2 gap-3">
            <TextField
              label={t('documents.docTitle')}
              value={title}
              onChangeText={setTitle}
            />
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
            <ErrorText>{error}</ErrorText>
          </Card>
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
            </View>
            <Pressable onPress={() => remove(item)} hitSlop={8} className="p-1">
              <Trash2 size={18} color="#EF4444" />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <Text className="mt-8 text-center text-neutral-400">
            {t('documents.empty')}
          </Text>
        }
      />
    </SafeAreaView>
  )
}
