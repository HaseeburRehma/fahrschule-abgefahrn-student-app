/**
 * Student list import — turns an uploaded file (or pasted text) into rows.
 *
 * Formats: Excel .xlsx, OpenDocument .ods (LibreOffice / Numbers export),
 * .csv (comma or semicolon — German Excel uses ";"), .tsv, .txt and text pasted
 * straight from Excel / Google Sheets (tab-separated) or a plain list of
 * addresses. Old binary Excel .xls is detected and the admin is asked to save
 * as .xlsx or CSV.
 *
 * Runs on web, iOS and Android (no DOM): zip via fflate, XML read with small
 * regexes (only the few tags spreadsheets use), text decoded as UTF-8 with a
 * Windows-1252 fallback for CSVs saved by German Excel.
 */

import { unzipSync, type UnzipFileInfo } from 'fflate'

import {
  MAX_IMPORT_ROWS,
  cleanName,
  cleanPhone,
  isValidCode,
  isValidEmail,
  normalizeCode,
  normalizeEmail,
} from '@/supabase/functions/_shared/invites'

export { MAX_IMPORT_ROWS }

export type ImportFormat = 'xlsx' | 'ods' | 'csv' | 'tsv' | 'txt' | 'paste'
export type Field = 'email' | 'first_name' | 'last_name' | 'full_name' | 'phone' | 'student_code' | 'ignore'
export const FIELDS: Field[] = ['email', 'first_name', 'last_name', 'full_name', 'phone', 'student_code', 'ignore']

export const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_UNZIPPED_BYTES = 60 * 1024 * 1024
const MAX_COLS = 60
const MAX_TABLE_ROWS = MAX_IMPORT_ROWS + 50

export class ImportError extends Error {
  constructor(public code: 'unsupported' | 'xls' | 'too_large' | 'empty' | 'corrupt' | 'too_many_rows') {
    super(code)
  }
}

export const ACCEPTED_EXTENSIONS = ['xlsx', 'ods', 'csv', 'tsv', 'txt'] as const

export const MIME_BY_FORMAT: Record<Exclude<ImportFormat, 'paste'>, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  txt: 'text/plain',
}

/** MIME types for the file picker (plus wildcards some Android pickers need). */
export const PICKER_TYPES = [
  ...Object.values(MIME_BY_FORMAT),
  'application/vnd.ms-excel',
  'text/comma-separated-values',
  'application/csv',
  'text/*',
  'application/octet-stream',
]

export function detectFormat(filename: string, bytes?: Uint8Array): ImportFormat {
  const ext = (filename.split('.').pop() ?? '').toLowerCase()
  // Sniff the content first: extensions lie (".xls" that is really CSV/HTML, ".csv" that is a zip…).
  if (bytes && bytes.length >= 4) {
    const zip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
    const ole = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0
    if (ole) throw new ImportError('xls')
    if (zip) return ext === 'ods' ? 'ods' : 'xlsx'
  }
  if (ext === 'xlsx' || ext === 'ods') return ext
  if (ext === 'tsv') return 'tsv'
  if (ext === 'csv' || ext === 'xls') return 'csv' // text-based .xls exports are really CSV/TSV
  if (ext === 'txt' || ext === '') return 'txt'
  throw new ImportError('unsupported')
}

// ── text decoding ───────────────────────────────────────────────────────────

const CP1252: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰',
  0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•',
  0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
}

function decodeUtf8(b: Uint8Array, start: number): string | null {
  let out = ''
  let i = start
  while (i < b.length) {
    const c = b[i]
    let cp: number
    let n: number
    if (c < 0x80) {
      cp = c
      n = 0
    } else if (c >= 0xc2 && c < 0xe0) {
      cp = c & 0x1f
      n = 1
    } else if (c >= 0xe0 && c < 0xf0) {
      cp = c & 0x0f
      n = 2
    } else if (c >= 0xf0 && c < 0xf5) {
      cp = c & 0x07
      n = 3
    } else return null
    if (i + n >= b.length + (n ? 0 : 1)) return null
    for (let k = 1; k <= n; k++) {
      const cc = b[i + k]
      if (cc === undefined || (cc & 0xc0) !== 0x80) return null
      cp = (cp << 6) | (cc & 0x3f)
    }
    out += String.fromCodePoint(cp)
    i += n + 1
  }
  return out
}

function decodeUtf16(b: Uint8Array, le: boolean): string {
  let out = ''
  for (let i = 2; i + 1 < b.length; i += 2) out += String.fromCharCode(le ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1])
  return out
}

/** UTF-8 (with or without BOM), UTF-16 (Excel "Unicode text"), else Windows-1252. */
export function decodeText(b: Uint8Array): string {
  if (b[0] === 0xff && b[1] === 0xfe) return decodeUtf16(b, true)
  if (b[0] === 0xfe && b[1] === 0xff) return decodeUtf16(b, false)
  const bom = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0
  const utf8 = decodeUtf8(b, bom)
  if (utf8 !== null) return utf8
  let out = ''
  for (let i = 0; i < b.length; i++) out += CP1252[b[i]] ?? String.fromCharCode(b[i])
  return out
}

// ── delimited text ──────────────────────────────────────────────────────────

/** Pick the delimiter that splits the first lines most consistently. */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim()).slice(0, 20)
  let best = ','
  let bestScore = 0
  for (const d of ['\t', ';', ',', '|']) {
    const counts = lines.map((l) => {
      let n = 0
      let q = false
      for (const ch of l) {
        if (ch === '"') q = !q
        else if (ch === d && !q) n++
      }
      return n
    })
    const withIt = counts.filter((c) => c > 0)
    if (!withIt.length) continue
    const mode = withIt.sort((a, b) => withIt.filter((x) => x === b).length - withIt.filter((x) => x === a).length)[0]
    const score = counts.filter((c) => c === mode).length * 10 + mode
    if (score > bestScore) {
      best = d
      bestScore = score
    }
  }
  return best
}

/** RFC 4180 parsing (quotes, escaped quotes, line breaks inside quotes). */
export function parseDelimited(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else q = false
      } else cell += ch
      continue
    }
    if (ch === '"' && cell.trim() === '') {
      q = true
      cell = ''
    } else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      if (rows.length > MAX_TABLE_ROWS) throw new ImportError('too_many_rows')
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.map((r) => r.slice(0, MAX_COLS).map((c) => c.trim()))
}

// ── XML helpers (spreadsheet subset) ────────────────────────────────────────

export function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e: string) => {
    const k = e.toLowerCase()
    if (k === 'amp') return '&'
    if (k === 'lt') return '<'
    if (k === 'gt') return '>'
    if (k === 'quot') return '"'
    if (k === 'apos') return "'"
    const cp = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10)
    return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m
  })
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name.replace(':', '\\:')}="([^"]*)"`))
  return m ? decodeXml(m[1]) : null
}

/** All text in <t>…</t> runs (shared strings / inline strings, rich text included). */
function textRuns(xml: string): string {
  let out = ''
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out += decodeXml(m[1])
  return out
}

/** "AB12" → 27 (0-based column). */
export function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? 'A'
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/** Numbers as people typed them: phone 4917612345678 not 4.9176E12, 12 not 12.0. */
export function formatNumber(raw: string): string {
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  if (Number.isInteger(n) && Math.abs(n) < 1e21) return BigInt(Math.round(n)).toString()
  return String(Number(n.toPrecision(15)))
}

function unzip(bytes: Uint8Array, wanted: (name: string) => boolean): Record<string, Uint8Array> {
  let total = 0
  try {
    return unzipSync(bytes, {
      filter: (f: UnzipFileInfo) => {
        if (!wanted(f.name)) return false
        total += f.originalSize
        if (f.originalSize > MAX_UNZIPPED_BYTES || total > MAX_UNZIPPED_BYTES) throw new ImportError('too_large')
        return true
      },
    })
  } catch (e) {
    if (e instanceof ImportError) throw e
    throw new ImportError('corrupt')
  }
}

const utf8 = (b?: Uint8Array) => (b ? decodeText(b) : '')

// ── .xlsx ───────────────────────────────────────────────────────────────────

export function parseXlsx(bytes: Uint8Array): string[][] {
  const files = unzip(bytes, (n) => n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels' || n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n))

  // First sheet in workbook order (not necessarily sheet1.xml).
  let sheetPath = 'xl/worksheets/sheet1.xml'
  const wb = utf8(files['xl/workbook.xml'])
  const rels = utf8(files['xl/_rels/workbook.xml.rels'])
  const firstSheet = wb.match(/<sheet\s[^>]*>/)?.[0]
  const rid = firstSheet ? attr(firstSheet, 'r:id') : null
  if (rid && rels) {
    const rel = [...rels.matchAll(/<Relationship\s[^>]*>/g)].map((m) => m[0]).find((r) => attr(r, 'Id') === rid)
    const target = rel ? attr(rel, 'Target') : null
    if (target) {
      const t = target.replace(/^\//, '')
      sheetPath = t.startsWith('xl/') ? t : `xl/${t}`
    }
  }
  const sheetXml = utf8(files[sheetPath] ?? Object.entries(files).find(([n]) => n.startsWith('xl/worksheets/'))?.[1])
  if (!sheetXml) throw new ImportError('corrupt')

  const shared: string[] = []
  const ssXml = utf8(files['xl/sharedStrings.xml'])
  if (ssXml) {
    const re = /<si>([\s\S]*?)<\/si>|<si\/>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(ssXml))) shared.push(m[1] ? textRuns(m[1].replace(/<rPh[\s\S]*?<\/rPh>/g, '')) : '')
  }

  const rows: string[][] = []
  const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g
  let rm: RegExpExecArray | null
  let nextRow = 0
  while ((rm = rowRe.exec(sheetXml))) {
    const rAttr = attr(`<row${rm[1]}>`, 'r')
    const rIndex = rAttr ? Number(rAttr) - 1 : nextRow
    nextRow = rIndex + 1
    if (rIndex >= MAX_TABLE_ROWS) throw new ImportError('too_many_rows')
    const cells: string[] = []
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
    let cm: RegExpExecArray | null
    let nextCol = 0
    while ((cm = cellRe.exec(rm[2]))) {
      const tag = `<c${cm[1]}>`
      const ref = attr(tag, 'r')
      const col = ref ? columnIndex(ref) : nextCol
      nextCol = col + 1
      if (col >= MAX_COLS) continue
      const type = attr(tag, 't')
      const inner = cm[2] ?? ''
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      let value = ''
      if (type === 's') value = shared[Number(v)] ?? ''
      else if (type === 'inlineStr') value = textRuns(inner)
      else if (type === 'b') value = v === '1' ? 'TRUE' : v === '0' ? 'FALSE' : ''
      else if (type === 'str' || type === 'e') value = v ? decodeXml(v) : ''
      else value = v ? formatNumber(decodeXml(v)) : ''
      cells[col] = value.trim()
    }
    rows[rIndex] = Array.from(cells, (c) => c ?? '')
  }
  return Array.from(rows, (r) => r ?? [])
}

// ── .ods ────────────────────────────────────────────────────────────────────

export function parseOds(bytes: Uint8Array): string[][] {
  const files = unzip(bytes, (n) => n === 'content.xml')
  const xml = utf8(files['content.xml'])
  if (!xml) throw new ImportError('corrupt')
  const table = xml.match(/<table:table\b[^>]*>([\s\S]*?)<\/table:table>/)?.[1] ?? ''
  const rows: string[][] = []
  const rowRe = /<table:table-row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:table-row>)/g
  let rm: RegExpExecArray | null
  while ((rm = rowRe.exec(table))) {
    const repeat = Math.min(Number(attr(`<r${rm[1]}>`, 'table:number-rows-repeated') ?? 1) || 1, MAX_TABLE_ROWS)
    const cells: string[] = []
    const cellRe = /<table:(?:covered-)?table-cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:(?:covered-)?table-cell>)/g
    let cm: RegExpExecArray | null
    while ((cm = cellRe.exec(rm[2] ?? ''))) {
      const tag = `<c${cm[1]}>`
      const span = Number(attr(tag, 'table:number-columns-repeated') ?? 1) || 1
      const paras = [...(cm[2] ?? '').matchAll(/<text:p\b[^>]*>([\s\S]*?)<\/text:p>|<text:p\b[^>]*\/>/g)]
      let value = paras
        .map((p) =>
          decodeXml(
            (p[1] ?? '')
              .replace(/<text:s\b[^>]*?(?:text:c="(\d+)")?[^>]*\/>/g, (_m, c) => ' '.repeat(Number(c ?? 1)))
              .replace(/<text:(?:tab|line-break)\b[^>]*\/>/g, ' ')
              .replace(/<[^>]+>/g, ''),
          ),
        )
        .join('\n')
        .trim()
      const officeValue = attr(tag, 'office:value')
      if (officeValue && attr(tag, 'office:value-type') === 'float' && /e/i.test(value)) value = formatNumber(officeValue)
      // trailing repeated empty cells pad to 16384 columns — don't materialise them
      for (let k = 0; k < Math.min(span, MAX_COLS) && cells.length < MAX_COLS; k++) cells.push(value)
    }
    while (cells.length && !cells[cells.length - 1]) cells.pop()
    const isEmpty = cells.length === 0
    for (let k = 0; k < (isEmpty ? Math.min(repeat, 1) : repeat); k++) {
      rows.push(cells.slice())
      if (rows.length > MAX_TABLE_ROWS) throw new ImportError('too_many_rows')
    }
  }
  return rows
}

// ── entry ───────────────────────────────────────────────────────────────────

/** File bytes (or pasted text) → table of trimmed strings, empty rows removed. */
export function parseTable(format: ImportFormat, input: Uint8Array | string): string[][] {
  if (typeof input !== 'string' && input.length > MAX_FILE_BYTES) throw new ImportError('too_large')
  let table: string[][]
  if (format === 'xlsx') table = parseXlsx(input as Uint8Array)
  else if (format === 'ods') table = parseOds(input as Uint8Array)
  else {
    const text = typeof input === 'string' ? input : decodeText(input)
    table = parseDelimited(text, format === 'tsv' ? '\t' : undefined)
  }
  const cleaned = table.map((r) => r.map((c) => (c ?? '').trim())).filter((r) => r.some((c) => c))
  if (!cleaned.length) throw new ImportError('empty')
  return cleaned
}

// ── column mapping ──────────────────────────────────────────────────────────

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '')

const SYNONYMS: Record<Exclude<Field, 'ignore'>, string[]> = {
  email: ['email', 'emailadresse', 'mail', 'emailaddress', 'mailadresse', 'kontaktemail', 'emailschueler', 'emailschuelerin'],
  first_name: ['vorname', 'firstname', 'givenname', 'first', 'rufname', 'forename'],
  last_name: ['nachname', 'lastname', 'surname', 'familienname', 'familyname', 'last', 'zuname'],
  full_name: ['name', 'fullname', 'vollername', 'schueler', 'schuelerin', 'fahrschueler', 'fahrschuelerin', 'student', 'kunde', 'teilnehmer', 'vornamenachname', 'namevorname'],
  phone: ['telefon', 'phone', 'tel', 'handy', 'mobil', 'mobile', 'mobilnummer', 'telefonnummer', 'handynummer', 'phonenumber', 'mobilephone', 'rufnummer'],
  student_code: ['code', 'schuelercode', 'studentcode', 'schuelernummer', 'schuelernr', 'kundennummer', 'kundennr', 'studentid', 'studentnumber', 'personalcode', 'einladungscode', 'invitecode', 'zugangscode', 'kennung', 'matrikelnummer', 'referenz'],
}

export function guessField(header: string): Field | null {
  const h = fold(header)
  if (!h) return null
  for (const [field, words] of Object.entries(SYNONYMS) as [Field, string[]][]) if (words.includes(h)) return field
  if (h.includes('mail')) return 'email'
  if (h.includes('vorname') || h.includes('firstname')) return 'first_name'
  if (h.includes('nachname') || h.includes('lastname') || h.includes('surname')) return 'last_name'
  if (h.includes('telefon') || h.includes('phone') || h.includes('handy') || h.includes('mobil')) return 'phone'
  // not plain "Nr" / "Nummer": that is usually a running row number
  if (h.includes('code') || h.includes('kundennummer') || h.includes('schuelernummer')) return 'student_code'
  if (h.includes('name')) return 'full_name'
  return null
}

const EMAIL_IN_TEXT = /[^\s<>(),;:"]+@[^\s<>(),;:"]+\.[a-z]{2,}/i

export interface Mapping {
  /** index of the header row, or null when the file has no header */
  headerRow: number | null
  columns: Field[]
}

/** Find the header row (first 10 rows) and map its columns; else guess by content. */
export function detectMapping(table: string[][]): Mapping {
  const width = Math.min(Math.max(0, ...table.slice(0, 50).map((r) => r.length)), MAX_COLS)
  for (let i = 0; i < Math.min(10, table.length); i++) {
    const guesses = Array.from({ length: width }, (_, c) => guessField(table[i][c] ?? ''))
    const hasEmail = guesses.includes('email')
    const known = guesses.filter(Boolean).length
    const rowHasAddress = table[i].some((c) => EMAIL_IN_TEXT.test(c))
    if (!rowHasAddress && (hasEmail || known >= 2)) {
      const used = new Set<Field>()
      const columns = guesses.map((g) => {
        if (!g || used.has(g)) return 'ignore' as Field
        used.add(g)
        return g
      })
      if (!columns.includes('email')) {
        const byContent = emailColumnByContent(table.slice(i + 1), width)
        if (byContent >= 0) columns[byContent] = 'email'
      }
      return { headerRow: i, columns }
    }
  }
  const columns: Field[] = Array.from({ length: width }, () => 'ignore')
  const e = emailColumnByContent(table, width)
  if (e >= 0) columns[e] = 'email'
  // no header: a single other text column before the address is most likely the name
  const others = columns.map((c, i) => (c === 'ignore' ? i : -1)).filter((i) => i >= 0)
  if (e >= 0 && others.length === 1) columns[others[0]] = 'full_name'
  if (e >= 0 && others.length === 2 && others[1] < e) {
    columns[others[0]] = 'first_name'
    columns[others[1]] = 'last_name'
  }
  return { headerRow: null, columns }
}

function emailColumnByContent(rows: string[][], width: number): number {
  let best = -1
  let bestHits = 0
  for (let c = 0; c < width; c++) {
    const sample = rows.slice(0, 200).map((r) => r[c] ?? '').filter(Boolean)
    const hits = sample.filter((v) => EMAIL_IN_TEXT.test(v)).length
    if (hits > bestHits && hits >= Math.max(1, sample.length * 0.5)) {
      best = c
      bestHits = hits
    }
  }
  return best
}

/** "Muster, Max" → Max / Muster;  "Max Peter Muster" → Max Peter / Muster. */
export function splitFullName(full: string): { first: string | null; last: string | null } {
  const s = full.replace(/\s+/g, ' ').trim()
  if (!s) return { first: null, last: null }
  if (s.includes(',')) {
    const [last, first] = s.split(',', 2).map((x) => x.trim())
    return { first: first || null, last: last || null }
  }
  const parts = s.split(' ')
  if (parts.length === 1) return { first: parts[0], last: null }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
}

// ── rows + preview checks ───────────────────────────────────────────────────

export type RowIssue = 'invalid_email' | 'duplicate_email' | 'invalid_code' | 'duplicate_code' | 'school_code'

export interface PreviewRow {
  row: number
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  student_code: string | null
  issue: RowIssue | null
}

export function buildRows(table: string[][], mapping: Mapping, schoolCode?: string | null): PreviewRow[] {
  const start = mapping.headerRow === null ? 0 : mapping.headerRow + 1
  const col = (f: Field) => mapping.columns.indexOf(f)
  const ci = { email: col('email'), first: col('first_name'), last: col('last_name'), full: col('full_name'), phone: col('phone'), code: col('student_code') }
  const seenEmail = new Set<string>()
  const seenCode = new Set<string>()
  const school = schoolCode ? normalizeCode(schoolCode) : null
  const out: PreviewRow[] = []

  for (let i = start; i < table.length; i++) {
    const r = table[i]
    if (!r.some((c) => c)) continue
    const get = (k: number) => (k >= 0 ? (r[k] ?? '').trim() : '')
    let rawEmail = get(ci.email)
    let nameFromEmailCell: string | null = null
    // "Max Muster <max@example.de>" in one cell
    const angle = rawEmail.match(/^(.*?)<([^>]+)>\s*$/)
    if (angle) {
      nameFromEmailCell = angle[1].replace(/["']/g, '').trim() || null
      rawEmail = angle[2]
    } else if (!isValidEmail(normalizeEmail(rawEmail))) {
      const found = rawEmail.match(EMAIL_IN_TEXT)?.[0]
      if (found) rawEmail = found
    }
    const email = normalizeEmail(rawEmail)

    let first = cleanName(get(ci.first))
    let last = cleanName(get(ci.last))
    const full = get(ci.full) || nameFromEmailCell
    if ((!first || !last) && full) {
      const split = splitFullName(full)
      first = first ?? cleanName(split.first)
      last = last ?? cleanName(split.last)
    }
    const code = normalizeCode(get(ci.code)) || null

    let issue: RowIssue | null = null
    if (!isValidEmail(email)) issue = 'invalid_email'
    else if (seenEmail.has(email)) issue = 'duplicate_email'
    else if (code && !isValidCode(code)) issue = 'invalid_code'
    else if (code && school && code === school) issue = 'school_code'
    else if (code && seenCode.has(code)) issue = 'duplicate_code'
    if (!issue) {
      seenEmail.add(email)
      if (code) seenCode.add(code)
    }
    out.push({ row: i + 1, email, first_name: first, last_name: last, phone: cleanPhone(get(ci.phone)), student_code: code, issue })
    if (out.length > MAX_IMPORT_ROWS) throw new ImportError('too_many_rows')
  }
  return out
}

export function previewSummary(rows: PreviewRow[]) {
  const ok = rows.filter((r) => !r.issue)
  return {
    total: rows.length,
    ok: ok.length,
    withCode: ok.filter((r) => r.student_code).length,
    withoutCode: ok.filter((r) => !r.student_code).length,
    problems: rows.length - ok.length,
  }
}
