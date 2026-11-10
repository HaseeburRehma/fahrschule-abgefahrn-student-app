/**
 * Admin → Fahrschüler → Liste importieren.
 *
 * 1. Source   upload a file (.xlsx .ods .csv .tsv .txt) or paste a list
 * 2. Preview  columns are matched automatically (changeable), every row is
 *             checked; students already in the app / already invited are marked
 * 3. Result   invites saved, codes generated where missing, e-mails sent
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Platform, Switch, Text, TextInput, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { UploadSimple } from 'phosphor-react-native/src/icons/UploadSimple'
import { ClipboardText } from 'phosphor-react-native/src/icons/ClipboardText'
import { DownloadSimple } from 'phosphor-react-native/src/icons/DownloadSimple'
import { FileXls } from 'phosphor-react-native/src/icons/FileXls'
import { ArrowLeft } from 'phosphor-react-native/src/icons/ArrowLeft'

import { useTranslation } from '@/lib/i18n'
import {
  FIELDS,
  ImportError,
  MAX_FILE_BYTES,
  MAX_IMPORT_ROWS,
  buildRows,
  detectFormat,
  detectMapping,
  parseTable,
  previewSummary,
  type Field,
  type ImportFormat,
  type Mapping,
  type PreviewRow,
} from '@/lib/student-import'
import {
  InviteApiError,
  fetchInvites,
  importStudents,
  storeImportFile,
  type ImportResultRow,
  type ImportSummary,
} from '@/lib/invites'
import { fetchSignupCode, fetchStudents, fetchAdmins } from '@/lib/admin'
import { base64ToBytes } from '@/lib/documents'
import { Button } from '@/components/ui'
import { ResultRows } from '@/components/admin/import-rows'
import {
  Badge,
  Chip,
  ChipRow,
  Grid,
  GREEN,
  Kpi,
  Notice,
  Page,
  SectionTitle,
  SmallButton,
  TableHeader,
  downloadText,
  useWide,
  type Tone,
} from '@/components/admin/kit'

const PREVIEW_LIMIT = 300

type Source = { fileName: string; format: ImportFormat; bytes: Uint8Array | null }
type Known = { registered: Set<string>; invited: Set<string> }

const letter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(64 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`)

export default function ImportStudents() {
  const { t } = useTranslation()
  const router = useRouter()
  const wide = useWide()

  const [step, setStep] = useState<'source' | 'preview' | 'result'>('source')
  const [source, setSource] = useState<Source | null>(null)
  const [table, setTable] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Mapping>({ headerRow: null, columns: [] })
  const [paste, setPaste] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [problemsOnly, setProblemsOnly] = useState(false)
  const [send, setSend] = useState(true)
  const [schoolCode, setSchoolCode] = useState<string | null>(null)
  const [known, setKnown] = useState<Known>({ registered: new Set(), invited: new Set() })
  const [result, setResult] = useState<{ summary: ImportSummary; rows: ImportResultRow[]; mailConfigured: boolean; fileStored: boolean; importId: string } | null>(null)

  // Context for the preview: school code + who is already in the app / invited.
  useEffect(() => {
    fetchSignupCode().then(setSchoolCode).catch(() => {})
    Promise.all([fetchStudents().catch(() => []), fetchAdmins().catch(() => []), fetchInvites().catch(() => [])]).then(([s, a, inv]) => {
      setKnown({
        registered: new Set([...s, ...a].map((p) => (p.email ?? '').toLowerCase()).filter(Boolean)),
        invited: new Set(inv.filter((i) => i.status !== 'accepted').map((i) => i.email)),
      })
    })
  }, [])

  const rows = useMemo<PreviewRow[]>(() => {
    if (!table.length || !mapping.columns.includes('email')) return []
    try {
      return buildRows(table, mapping, schoolCode)
    } catch {
      return []
    }
  }, [table, mapping, schoolCode])
  const summary = previewSummary(rows)
  const tooMany = rows.length > MAX_IMPORT_ROWS

  function importErrorText(e: unknown): string {
    if (e instanceof ImportError) return t(`inv.err.${e.code}`)
    return t('inv.err.corrupt')
  }

  function load(src: Source, input: Uint8Array | string) {
    const tbl = parseTable(src.format, input)
    setSource(src)
    setTable(tbl)
    setMapping(detectMapping(tbl))
    setProblemsOnly(false)
    setError(null)
    setStep('preview')
  }

  async function pickFile() {
    setError(null)
    setBusy(true)
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: Platform.OS === 'web' ? ['.xlsx', '.ods', '.csv', '.tsv', '.txt', '.xls'] : ['*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      })
      if (res.canceled || !res.assets?.[0]) return
      const asset = res.assets[0]
      const name = asset.name ?? 'liste.csv'
      if ((asset.size ?? 0) > MAX_FILE_BYTES) throw new ImportError('too_large')
      let bytes: Uint8Array
      if (Platform.OS === 'web') {
        const blob: Blob = (asset as any).file ?? (await (await fetch(asset.uri)).blob())
        bytes = new Uint8Array(await blob.arrayBuffer())
      } else {
        const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
        bytes = base64ToBytes(b64)
      }
      if (bytes.length > MAX_FILE_BYTES) throw new ImportError('too_large')
      const format = detectFormat(name, bytes)
      load({ fileName: name, format, bytes }, bytes)
    } catch (e) {
      setError(importErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  function previewPaste() {
    setError(null)
    try {
      load({ fileName: t('inv.pastedList'), format: 'paste', bytes: null }, paste)
    } catch (e) {
      setError(importErrorText(e))
    }
  }

  function setColumn(col: number, field: Field) {
    setMapping((m) => ({
      ...m,
      columns: m.columns.map((f, i) => (i === col ? field : field !== 'ignore' && f === field ? 'ignore' : f)),
    }))
  }

  function toggleHeader() {
    setMapping((m) => {
      if (m.headerRow !== null) return { ...m, headerRow: null }
      const detected = detectMapping(table)
      return { ...m, headerRow: detected.headerRow ?? 0 }
    })
  }

  async function runImport() {
    if (!source || busy) return
    setBusy(true)
    setError(null)
    try {
      let filePath: string | null = null
      if (source.format !== 'paste' && source.bytes) {
        filePath = await storeImportFile(source.fileName, source.format, source.bytes).catch(() => null)
      }
      const res = await importStudents({ fileName: source.fileName, format: source.format, filePath, rows, send })
      setResult({
        summary: res.summary,
        rows: res.rows,
        mailConfigured: res.mail_configured,
        fileStored: source.format === 'paste' || !!filePath,
        importId: res.import_id,
      })
      setStep('result')
    } catch (e: any) {
      const code = e instanceof InviteApiError ? e.message : ''
      setError(
        code === 'not_found'
          ? t('inv.err.notDeployed')
          : code === 'forbidden'
            ? t('inv.err.forbidden')
            : code === 'too_many_rows'
              ? t('inv.err.too_many_rows')
              : `${t('inv.err.importFailed')}${code ? ` (${code})` : ''}`,
      )
    } finally {
      setBusy(false)
    }
  }

  function downloadTemplate() {
    downloadText(
      'fahrschueler-vorlage.csv',
      '﻿Vorname;Nachname;E-Mail;Telefon;Schülercode\r\nMax;Muster;max.muster@example.de;0176 1234567;K-1001\r\nAnna;Beck;anna.beck@example.de;;\r\n',
    ).catch(() => {})
  }

  function reset() {
    setStep('source')
    setSource(null)
    setTable([])
    setMapping({ headerRow: null, columns: [] })
    setResult(null)
    setPaste('')
    setPasteOpen(false)
    setError(null)
  }

  // ── step 1: source ─────────────────────────────────────────────────────────
  if (step === 'source') {
    return (
      <Page>
        <Stack.Screen options={{ title: t('inv.importTitle') }} />
        <Text className="font-m-regular text-sm leading-6 text-neutral-400">{t('inv.importIntro')}</Text>

        <Grid cols={2} phoneCols={1}>
          <View className="gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-brand/10">
              <UploadSimple size={22} color={GREEN} />
            </View>
            <Text className="font-m-bold text-base text-neutral-100">{t('inv.uploadTitle')}</Text>
            <Text className="font-m-regular text-[13px] leading-5 text-neutral-400">{t('inv.uploadBody')}</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {['XLSX', 'ODS', 'CSV', 'TSV', 'TXT'].map((f) => (
                <Badge key={f} label={f} tone="green" />
              ))}
            </View>
            <SmallButton label={t('inv.chooseFile')} variant="primary" onPress={pickFile} loading={busy} icon={<FileXls size={16} color="#0A0A0A" />} />
          </View>

          <View className="gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-brand/10">
              <ClipboardText size={22} color={GREEN} />
            </View>
            <Text className="font-m-bold text-base text-neutral-100">{t('inv.pasteTitle')}</Text>
            <Text className="font-m-regular text-[13px] leading-5 text-neutral-400">{t('inv.pasteBody')}</Text>
            {pasteOpen ? (
              <>
                <TextInput
                  value={paste}
                  onChangeText={setPaste}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={t('inv.pastePh')}
                  placeholderTextColor="#6B7280"
                  className="font-m-regular min-h-[140px] rounded-xl border border-neutral-700 bg-black p-3 text-[13px] text-neutral-100"
                  style={{ textAlignVertical: 'top' }}
                  accessibilityLabel={t('inv.pasteTitle')}
                />
                <SmallButton label={t('inv.showPreview')} variant="primary" onPress={previewPaste} disabled={!paste.trim()} />
              </>
            ) : (
              <SmallButton label={t('inv.pasteOpen')} onPress={() => setPasteOpen(true)} />
            )}
          </View>
        </Grid>

        {error ? <Notice title={error} tone="red" /> : null}

        <View className="gap-2 rounded-2xl border border-neutral-800 p-4">
          <Text className="font-m-bold text-sm text-neutral-200">{t('inv.howTitle')}</Text>
          <Text className="font-m-regular text-[13px] leading-5 text-neutral-400">{t('inv.howBody')}</Text>
          <View className="flex-row">
            <SmallButton label={t('inv.template')} onPress={downloadTemplate} icon={<DownloadSimple size={16} color={GREEN} />} />
          </View>
        </View>
      </Page>
    )
  }

  // ── step 3: result ─────────────────────────────────────────────────────────
  if (step === 'result' && result) {
    const s = result.summary
    return (
      <Page>
        <Stack.Screen options={{ title: t('inv.resultTitle') }} />
        <Grid cols={5} phoneCols={2}>
          <Kpi label={t('inv.k.invited')} value={s.invited} />
          <Kpi label={t('inv.k.sent')} value={s.emails_sent} tone="green" />
          <Kpi label={t('inv.k.registered')} value={s.already_registered} tone="blue" />
          <Kpi label={t('inv.k.skipped')} value={s.skipped} tone={s.skipped ? 'amber' : 'gray'} />
          <Kpi label={t('inv.k.failed')} value={s.emails_failed} tone={s.emails_failed ? 'red' : 'gray'} />
        </Grid>
        {send && !result.mailConfigured ? <Notice title={t('inv.mailOffTitle')} body={t('inv.mailOffBody')} /> : null}
        {!send ? <Notice title={t('inv.notSentTitle')} body={t('inv.notSentBody')} tone="blue" /> : null}
        {!result.fileStored ? <Notice title={t('inv.fileNotStored')} tone="gray" /> : null}

        <View className="flex-row flex-wrap gap-2">
          <SmallButton label={t('inv.toInvites')} variant="primary" onPress={() => router.replace('/admin/invites' as any)} />
          <SmallButton label={t('inv.toImport')} onPress={() => router.replace(`/admin/invites/${result.importId}` as any)} />
          <SmallButton label={t('inv.importAnother')} onPress={reset} />
        </View>

        <SectionTitle>{t('inv.rowsTitle')}</SectionTitle>
        <ResultRows rows={result.rows} wide={wide} />
      </Page>
    )
  }

  // ── step 2: preview ────────────────────────────────────────────────────────
  const width = mapping.columns.length
  const headerCells = mapping.headerRow !== null ? table[mapping.headerRow] ?? [] : []
  const dataStart = mapping.headerRow === null ? 0 : mapping.headerRow + 1
  const sample = (c: number) => table.slice(dataStart, dataStart + 30).map((r) => r[c]).find((v) => v) ?? ''
  const hasEmail = mapping.columns.includes('email')
  const shown = (problemsOnly ? rows.filter((r) => r.issue) : rows).slice(0, PREVIEW_LIMIT)
  const regCount = rows.filter((r) => !r.issue && known.registered.has(r.email)).length
  const importable = summary.ok

  return (
    <Page>
      <Stack.Screen options={{ title: t('inv.previewTitle') }} />
      <View className="flex-row flex-wrap items-center gap-2">
        <SmallButton label={t('inv.otherFile')} onPress={reset} icon={<ArrowLeft size={16} color={GREEN} />} />
        <Text className="font-m-semibold text-sm text-neutral-200" numberOfLines={1}>
          {source?.fileName}
        </Text>
        <Badge label={(source?.format ?? '').toUpperCase()} tone="green" />
      </View>

      {/* Column matching */}
      <View className="gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <SectionTitle
          right={
            <View className="flex-row items-center gap-2">
              <Text className="font-m-medium text-xs text-neutral-400">{t('inv.hasHeader')}</Text>
              <Switch value={mapping.headerRow !== null} onValueChange={toggleHeader} trackColor={{ true: GREEN }} accessibilityLabel={t('inv.hasHeader')} />
            </View>
          }
        >
          {t('inv.columnsTitle')}
        </SectionTitle>
        <Text className="font-m-regular text-[13px] text-neutral-400">{t('inv.columnsBody')}</Text>
        {Array.from({ length: width }, (_, c) => (
          <View key={c} className="gap-2 border-t border-neutral-800 pt-3" style={wide ? { flexDirection: 'row', alignItems: 'center', gap: 16 } : undefined}>
            <View style={wide ? { width: 260 } : undefined}>
              <View className="flex-row items-center gap-2">
                <Text className="font-m-bold flex-shrink text-[13px] text-neutral-100" numberOfLines={1}>
                  {letter(c)} · {headerCells[c] || t('inv.noHeader')}
                </Text>
                <Text className={`font-m-bold text-[12px] ${mapping.columns[c] === 'ignore' ? 'text-neutral-500' : 'text-brand'}`} numberOfLines={1}>
                  → {t(`inv.field.${mapping.columns[c]}`)}
                </Text>
              </View>
              <Text className="font-m-regular text-xs text-neutral-500" numberOfLines={1}>
                {t('inv.example')}: {sample(c) || '—'}
              </Text>
            </View>
            <View style={wide ? { flex: 1 } : undefined}>
              <ChipRow>
                {FIELDS.map((f) => (
                  <Chip key={f} label={t(`inv.field.${f}`)} active={mapping.columns[c] === f} onPress={() => setColumn(c, f)} />
                ))}
              </ChipRow>
            </View>
          </View>
        ))}
        {!hasEmail ? <Notice title={t('inv.needEmail')} tone="red" /> : null}
      </View>

      {hasEmail ? (
        <>
          <Grid cols={5} phoneCols={2}>
            <Kpi label={t('inv.k.rows')} value={summary.total} tone="gray" />
            <Kpi label={t('inv.k.ok')} value={summary.ok} />
            <Kpi label={t('inv.k.withCode')} value={summary.withCode} tone="blue" hint={t('inv.k.withCodeHint')} />
            <Kpi label={t('inv.k.withoutCode')} value={summary.withoutCode} tone="blue" hint={t('inv.k.withoutCodeHint')} />
            <Kpi label={t('inv.k.problems')} value={summary.problems} tone={summary.problems ? 'red' : 'gray'} hint={summary.problems ? t('inv.k.problemsHint') : undefined} />
          </Grid>
          {regCount ? <Notice title={t('inv.registeredNote', { n: regCount })} body={t('inv.registeredNoteBody')} tone="blue" /> : null}
          {tooMany ? <Notice title={t('inv.err.too_many_rows')} tone="red" /> : null}

          <View className="flex-row flex-wrap items-center justify-between gap-3">
            <ChipRow>
              <Chip label={t('inv.allRows')} active={!problemsOnly} onPress={() => setProblemsOnly(false)} count={rows.length} />
              <Chip label={t('inv.problemRows')} active={problemsOnly} onPress={() => setProblemsOnly(true)} count={summary.problems} />
            </ChipRow>
          </View>

          <PreviewRows rows={shown} wide={wide} known={known} />
          {(problemsOnly ? summary.problems : rows.length) > PREVIEW_LIMIT ? (
            <Text className="font-m-regular text-center text-xs text-neutral-500">{t('inv.previewLimit', { n: PREVIEW_LIMIT })}</Text>
          ) : null}

          <View className="gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="font-m-bold text-sm text-neutral-100">{t('inv.sendNow')}</Text>
                <Text className="font-m-regular text-xs text-neutral-400">{t('inv.sendNowBody')}</Text>
              </View>
              <Switch value={send} onValueChange={setSend} trackColor={{ true: GREEN }} accessibilityLabel={t('inv.sendNow')} />
            </View>
            {error ? <Notice title={error} tone="red" /> : null}
            <Button
              label={importable ? t(send ? 'inv.importSend' : 'inv.importOnly', { n: importable }) : t('inv.nothingToImport')}
              onPress={runImport}
              loading={busy}
              disabled={!importable || tooMany}
            />
          </View>
        </>
      ) : null}
    </Page>
  )
}

// ── rows ────────────────────────────────────────────────────────────────────

function useIssueBadge() {
  const { t } = useTranslation()
  return (r: PreviewRow, known: Known): { label: string; tone: Tone } => {
    if (r.issue) return { label: t(`inv.issue.${r.issue}`), tone: 'red' }
    if (known.registered.has(r.email)) return { label: t('inv.st.registered'), tone: 'gray' }
    if (known.invited.has(r.email)) return { label: t('inv.st.reinvite'), tone: 'amber' }
    return r.student_code ? { label: t('inv.st.fileCode'), tone: 'green' } : { label: t('inv.st.newCode'), tone: 'blue' }
  }
}

function PreviewRows({ rows, wide, known }: { rows: PreviewRow[]; wide: boolean; known: Known }) {
  const { t } = useTranslation()
  const badge = useIssueBadge()
  const name = (r: PreviewRow) => [r.first_name, r.last_name].filter(Boolean).join(' ') || '—'
  if (!rows.length) return <Text className="font-m-regular py-6 text-center text-sm text-neutral-500">{t('common.empty')}</Text>
  if (wide) {
    return (
      <View className="rounded-2xl border border-neutral-800 bg-neutral-900 pt-3">
        <TableHeader
          cols={[
            { label: t('inv.col.row'), flex: 0.5 },
            { label: t('inv.col.name'), flex: 2 },
            { label: t('inv.col.email'), flex: 3 },
            { label: t('inv.col.phone'), flex: 1.6 },
            { label: t('inv.col.code'), flex: 1.4 },
            { label: t('inv.col.status'), flex: 2.2 },
          ]}
        />
        {rows.map((r) => {
          const b = badge(r, known)
          return (
            <View key={`${r.row}-${r.email}`} className="flex-row items-center border-b border-neutral-800/60 px-3 py-2.5">
              <Text style={{ flex: 0.5 }} className="font-m-regular text-xs text-neutral-500">{r.row}</Text>
              <Text style={{ flex: 2 }} className="font-m-semibold text-[13px] text-neutral-100" numberOfLines={1}>{name(r)}</Text>
              <Text style={{ flex: 3 }} className="font-m-regular text-[13px] text-neutral-300" numberOfLines={1}>{r.email || '—'}</Text>
              <Text style={{ flex: 1.6 }} className="font-m-regular text-[13px] text-neutral-400" numberOfLines={1}>{r.phone ?? '—'}</Text>
              <Text style={{ flex: 1.4 }} className="font-m-bold text-[13px] text-neutral-200" numberOfLines={1}>{r.student_code ?? '—'}</Text>
              <View style={{ flex: 2.2 }}><Badge label={b.label} tone={b.tone} /></View>
            </View>
          )
        })}
      </View>
    )
  }
  return (
    <View className="gap-2">
      {rows.map((r) => {
        const b = badge(r, known)
        return (
          <View key={`${r.row}-${r.email}`} className="gap-1.5 rounded-2xl border border-neutral-800 bg-neutral-900 p-3.5">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="font-m-semibold flex-1 text-[14px] text-neutral-100" numberOfLines={1}>{name(r)}</Text>
              <Text className="font-m-regular text-[11px] text-neutral-500">{t('inv.col.row')} {r.row}</Text>
            </View>
            <Text className="font-m-regular text-[13px] text-neutral-300" numberOfLines={1}>{r.email || '—'}</Text>
            <View className="flex-row flex-wrap items-center gap-2">
              {r.student_code ? <Text className="font-m-bold text-xs text-neutral-200">{r.student_code}</Text> : null}
              <Badge label={b.label} tone={b.tone} />
            </View>
          </View>
        )
      })}
    </View>
  )
}
