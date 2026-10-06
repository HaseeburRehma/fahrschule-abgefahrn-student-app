/**
 * Figma "DE/Dokumente" (1288:1563) + "Dokumente Leer" (1305:2516).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, RefreshControl, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { ChatCircleDots } from 'phosphor-react-native/src/icons/ChatCircleDots'
import { DownloadSimple } from 'phosphor-react-native/src/icons/DownloadSimple'
import { FileImage } from 'phosphor-react-native/src/icons/FileImage'
import { FileText } from 'phosphor-react-native/src/icons/FileText'

import { C, ErrorState, Screen, Skeleton, T, TopBar, useToast } from '@/components/ds'
import { useTranslation } from '@/lib/i18n'
import {
  docExtLabel,
  docKind,
  fetchDocumentSizes,
  fetchDocuments,
  formatFileSize,
  openDocumentExternally,
  type DocRow,
} from '@/lib/documents'
import { formatDate } from '@/lib/format'

/** Figma uses file-text for PDFs (contracts/certificates); images get file-image. */
function kindIcon(path: string): PhosphorIcon {
  return docKind(path) === 'image' ? FileImage : FileText
}

function DocCard({
  doc,
  size,
  onPress,
  onDownload,
}: {
  doc: DocRow
  size?: number
  onPress: () => void
  onDownload: () => void
}) {
  const { t, locale } = useTranslation()
  const Icon = kindIcon(doc.path)
  const ext = docExtLabel(doc.path) || t('documents.v2.file')
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: C.card,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: C.tile, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={22} color={C.brand} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <T variant="titleM" numberOfLines={3}>{doc.title || t('documents.v2.file')}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <View style={{ backgroundColor: C.surface, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
            <T variant="caption" color={C.muted}>{ext}</T>
          </View>
          {formatDate(doc.created_at, locale) ? (
            <T variant="caption" color={C.dim}>{formatDate(doc.created_at, locale)}</T>
          ) : null}
          {typeof size === 'number' ? (
            <T variant="caption" color={C.dim}>{formatFileSize(size, locale)}</T>
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={onDownload}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`${t('documents.v2.download')}: ${doc.title}`}
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: C.surface,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <DownloadSimple size={20} color={C.brand} />
      </Pressable>
    </Pressable>
  )
}

function DocumentsEmpty({ onAsk }: { onAsk: () => void }) {
  const { t } = useTranslation()
  return (
    <View style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 27, paddingBottom: 60, gap: 22 }}>
      <View
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: C.card,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: C.line,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FileText size={52} color={C.dim} />
      </View>
      <View style={{ gap: 8, alignItems: 'center', alignSelf: 'stretch' }}>
        <T variant="headingL" style={{ textAlign: 'center' }}>{t('documents.v2.empty.title')}</T>
        <T variant="bodyL" color={C.muted} style={{ textAlign: 'center' }}>{t('documents.v2.empty.body')}</T>
      </View>
      <Pressable
        onPress={onAsk}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderRadius: 28,
          backgroundColor: C.surface,
          borderWidth: 1,
          borderColor: C.line,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <ChatCircleDots size={20} color={C.brand} />
        <T variant="button">{t('documents.v2.empty.action')}</T>
      </Pressable>
    </View>
  )
}

export default function DocumentsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const [rows, setRows] = useState<DocRow[] | null>(null)
  const [sizes, setSizes] = useState<Record<string, number>>({})
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const reqRef = useRef(0)
  const mountedRef = useRef(true)
  const opening = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  /** Returns false when the request failed. Stale responses (refocus while loading) are dropped. */
  const load = useCallback(async (): Promise<boolean> => {
    const req = ++reqRef.current
    try {
      const docs = await fetchDocuments()
      const sz = await fetchDocumentSizes(docs.map((d) => d.path).filter(Boolean))
      if (!mountedRef.current || req !== reqRef.current) return true
      setRows(docs)
      setSizes(sz)
      setError(false)
      return true
    } catch {
      if (mountedRef.current && req === reqRef.current) {
        setError(true)
        setRows((prev) => prev ?? [])
      }
      return false
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const ok = await load()
      if (!ok) toast.show(t('ds.error.refresh'), 'error')
    } finally {
      if (mountedRef.current) setRefreshing(false)
    }
  }, [load, toast, t])

  async function download(doc: DocRow) {
    // a second tap while the in-app browser opens would fall back to an external browser
    if (opening.current) return
    opening.current = true
    try {
      const ok = await openDocumentExternally(doc.path)
      if (!ok) toast.show(t('documents.v2.openError'), 'error')
    } finally {
      opening.current = false
    }
  }

  const empty = rows !== null && rows.length === 0 && !error

  return (
    <Screen
      glow={empty ? -30 : -40}
      header={<TopBar title={t('documents.v2.title')} />}
      gap={10}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
    >
      {rows === null ? (
        <>
          <Skeleton width={190} height={14} />
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.card }}
            >
              <Skeleton width={44} height={44} radius={13} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="45%" height={11} />
              </View>
            </View>
          ))}
        </>
      ) : error && rows.length === 0 ? (
        <ErrorState
          onRetry={() => {
            setRows(null)
            load()
          }}
        />
      ) : empty ? (
        <DocumentsEmpty onAsk={() => router.push('/chat' as any)} />
      ) : (
        <>
          <T variant="bodyS" color={C.muted}>{t('documents.v2.subtitle')}</T>
          {rows.map((d) => (
            <DocCard
              key={d.id}
              doc={d}
              size={sizes[d.path]}
              onPress={() => router.push(`/documents/${d.id}` as any)}
              onDownload={() => download(d)}
            />
          ))}
        </>
      )}
    </Screen>
  )
}
