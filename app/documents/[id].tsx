/**
 * Figma "06/Dokument Vorschau" (1305:2556 · EN 1314:3557).
 * Images render inline; PDFs/other files show a paper-style preview card that
 * opens the file in the in-app browser (react-native-web has no <iframe>).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Image, Linking, Platform, Pressable, Share, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { DownloadSimple } from 'phosphor-react-native/src/icons/DownloadSimple'
import { FileX } from 'phosphor-react-native/src/icons/FileX'
import { PaperPlaneTilt } from 'phosphor-react-native/src/icons/PaperPlaneTilt'

import { Button, C, EmptyState, ErrorState, F, Screen, T, TopBar, useToast } from '@/components/ds'
import { useTranslation } from '@/lib/i18n'
import { docKind, fetchDocument, fetchDocumentSizes, formatFileSize, getDocumentUrl, type DocRow } from '@/lib/documents'
import { formatDate } from '@/lib/format'
import { SCHOOL } from '@/lib/school'

const PAGE_W = 300
const PAGE_H = 400
const LINES = [248, 220, 240, 180, 248, 210, 160, 248, 230, 190]

/** Stylised first page (Figma "page"): document title + school + text lines. */
function PaperPreview({ title }: { title: string }) {
  return (
    <View style={{ gap: 10 }}>
      <T style={{ fontFamily: F.xbold, fontSize: 15, lineHeight: 18, color: '#111111' }} numberOfLines={2}>
        {title.toUpperCase()}
      </T>
      <T style={{ fontFamily: F.medium, fontSize: 10, lineHeight: 12, color: '#555555' }}>{SCHOOL.legalName}</T>
      <View style={{ height: 8 }} />
      {LINES.map((w, i) => (
        <View key={i} style={{ width: w, maxWidth: '100%', height: 7, borderRadius: 3, backgroundColor: '#D7D5CC' }} />
      ))}
      <View style={{ height: 10 }} />
      <View style={{ flexDirection: 'row', gap: 20 }}>
        <View style={{ width: 90, height: 24, borderRadius: 3, backgroundColor: '#E6E4DB' }} />
        <View style={{ width: 90, height: 24, borderRadius: 3, backgroundColor: '#E6E4DB' }} />
      </View>
    </View>
  )
}

export default function DocumentPreview() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t, locale } = useTranslation()
  const toast = useToast()
  const [doc, setDoc] = useState<DocRow | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [size, setSize] = useState<number | undefined>(undefined)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [imageFailed, setImageFailed] = useState(false)
  /** when the signed URL was created — it expires after an hour */
  const urlAt = useRef(0)
  const busy = useRef(false)
  const reqRef = useRef(0)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(async () => {
    const req = ++reqRef.current
    const current = () => mountedRef.current && req === reqRef.current
    const docId = Array.isArray(id) ? id[0] : id
    if (!docId) {
      setState('missing')
      return
    }
    setState('loading')
    setImageFailed(false)
    try {
      const d = await fetchDocument(String(docId))
      if (!current()) return
      if (!d) {
        setState('missing')
        return
      }
      setDoc(d)
      const [signed, sizes] = await Promise.all([
        getDocumentUrl(d.path).catch(() => null),
        fetchDocumentSizes([d.path]),
      ])
      if (!current()) return
      setUrl(signed)
      urlAt.current = signed ? Date.now() : 0
      setSize(sizes[d.path])
      setState('ready')
    } catch {
      if (current()) setState('error')
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function freshUrl(): Promise<string | null> {
    // signed URLs live 3600 s — re-sign after 50 min instead of handing out a dead link
    if (url && Date.now() - urlAt.current < 50 * 60_000) return url
    if (!doc) return null
    try {
      const u = await getDocumentUrl(doc.path)
      if (mountedRef.current) setUrl(u)
      urlAt.current = Date.now()
      return u
    } catch {
      return null
    }
  }

  /** One open/share at a time (a second in-app browser call rejects and would fall back to the system browser). */
  async function exclusive(fn: () => Promise<void>) {
    if (busy.current) return
    busy.current = true
    try {
      await fn()
    } finally {
      busy.current = false
    }
  }

  const download = () => exclusive(openDoc)

  async function openDoc() {
    const u = await freshUrl()
    if (!u) {
      toast.show(t('documents.v2.openError'), 'error')
      return
    }
    try {
      await WebBrowser.openBrowserAsync(u)
    } catch {
      await Linking.openURL(u).catch(() => toast.show(t('documents.v2.openError'), 'error'))
    }
  }

  const share = () => exclusive(shareDoc)

  async function shareDoc() {
    const u = await freshUrl()
    if (!u || !doc) {
      toast.show(t('documents.v2.openError'), 'error')
      return
    }
    try {
      if (Platform.OS === 'web') {
        const nav: any = typeof navigator !== 'undefined' ? navigator : null
        if (nav?.share) await nav.share({ title: doc.title, url: u })
        else await openDoc()
        return
      }
      await Share.share(Platform.OS === 'ios' ? { url: u, title: doc.title } : { message: `${doc.title}\n${u}`, title: doc.title })
    } catch {
      // user cancelled
    }
  }

  const kind = doc ? docKind(doc.path) : 'other'
  const ready = state === 'ready' && doc

  const header = (
    <TopBar
      title={doc?.title ?? t('documents.v2.title')}
      right={
        ready ? (
          <Pressable
            onPress={download}
            accessibilityRole="button"
            accessibilityLabel={t('documents.v2.download')}
            hitSlop={6}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: C.surface,
              borderWidth: 1,
              borderColor: C.line,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <DownloadSimple size={22} color={C.brand} />
          </Pressable>
        ) : undefined
      }
    />
  )

  const footer = ready ? (
    <View style={{ flexDirection: 'row', gap: 12, marginHorizontal: 4 }}>
      <Button label={t('documents.v2.download')} iconLeft={DownloadSimple} onPress={download} style={{ flex: 1 }} />
      <Pressable
        onPress={share}
        accessibilityRole="button"
        accessibilityLabel={t('documents.v2.share')}
        style={({ pressed }) => ({
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: C.surface,
          borderWidth: 1,
          borderColor: C.line,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <PaperPlaneTilt size={22} color={C.white} />
      </Pressable>
    </View>
  ) : undefined

  const meta = doc
    ? [formatDate(doc.created_at, locale), typeof size === 'number' ? formatFileSize(size, locale) : null]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <Screen glow={-30} header={header} footer={footer} gap={30} contentStyle={{ alignItems: 'center', paddingTop: 44 }}>
      {state === 'loading' ? (
        <View style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.brand} />
        </View>
      ) : state === 'missing' ? (
        <EmptyState icon={FileX} title={t('documents.v2.notFound')} />
      ) : state === 'error' || !doc ? (
        <ErrorState onRetry={() => load()} />
      ) : (
        <>
          <Pressable
            onPress={download}
            accessibilityRole="button"
            accessibilityLabel={t('documents.v2.tapToOpen')}
            style={({ pressed }) => ({
              width: PAGE_W,
              maxWidth: '100%',
              height: PAGE_H,
              borderRadius: 8,
              overflow: 'hidden',
              backgroundColor: kind === 'image' ? C.surface : '#F4F3EE',
              paddingHorizontal: kind === 'image' ? 0 : 26,
              paddingVertical: kind === 'image' ? 0 : 28,
              shadowColor: '#000',
              shadowOpacity: 0.5,
              shadowRadius: 15,
              shadowOffset: { width: 0, height: 12 },
              elevation: 10,
              opacity: pressed ? 0.92 : 1,
            })}
          >
            {kind === 'image' && url && !imageFailed ? (
              <Image
                source={{ uri: url }}
                resizeMode="contain"
                style={{ width: '100%', height: '100%' }}
                onError={() => setImageFailed(true)}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <PaperPreview title={doc.title} />
            )}
          </Pressable>
          <View style={{ backgroundColor: C.surface, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
            <T variant="labelM" color={C.muted}>
              {kind === 'image' ? meta : `${t('documents.v2.tapToOpen')}${meta ? ` · ${meta}` : ''}`}
            </T>
          </View>
        </>
      )}
    </Screen>
  )
}
