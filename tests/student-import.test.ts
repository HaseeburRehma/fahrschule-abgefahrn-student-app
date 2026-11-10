import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'

import {
  ImportError,
  buildRows,
  columnIndex,
  decodeText,
  detectDelimiter,
  detectFormat,
  detectMapping,
  formatNumber,
  parseDelimited,
  parseTable,
  previewSummary,
  splitFullName,
} from '../lib/student-import'

function xlsx(sheetXml: string, shared?: string[], opts: { sheetFile?: string } = {}): Uint8Array {
  const sheetFile = opts.sheetFile ?? 'sheet1.xml'
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<Types/>'),
    'xl/workbook.xml': strToU8(
      '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Schüler" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/${sheetFile}"/></Relationships>`,
    ),
    [`xl/worksheets/${sheetFile}`]: strToU8(`<worksheet><sheetData>${sheetXml}</sheetData></worksheet>`),
  }
  if (shared) {
    files['xl/sharedStrings.xml'] = strToU8(
      `<sst>${shared.map((s) => (s.startsWith('<') ? `<si>${s}</si>` : `<si><t>${s}</t></si>`)).join('')}</sst>`,
    )
  }
  return zipSync(files)
}

function ods(rowsXml: string): Uint8Array {
  return zipSync({
    mimetype: strToU8('application/vnd.oasis.opendocument.spreadsheet'),
    'content.xml': strToU8(
      `<office:document-content><office:body><office:spreadsheet><table:table table:name="Tabelle1">${rowsXml}</table:table></office:spreadsheet></office:body></office:document-content>`,
    ),
  })
}

describe('detectFormat', () => {
  it('uses the extension and sniffs zip / old Excel content', () => {
    expect(detectFormat('liste.csv')).toBe('csv')
    expect(detectFormat('liste.TSV')).toBe('tsv')
    expect(detectFormat('liste.txt')).toBe('txt')
    expect(detectFormat('liste.ods', new Uint8Array([0x50, 0x4b, 3, 4]))).toBe('ods')
    expect(detectFormat('liste.csv', new Uint8Array([0x50, 0x4b, 3, 4]))).toBe('xlsx')
    expect(() => detectFormat('alt.xls', new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]))).toThrow(ImportError)
    expect(detectFormat('export.xls', strToU8('a;b'))).toBe('csv')
    expect(() => detectFormat('bild.png')).toThrow(ImportError)
  })
})

describe('decodeText', () => {
  it('reads UTF-8 with and without BOM, UTF-16 and Windows-1252', () => {
    expect(decodeText(strToU8('Jürgen'))).toBe('Jürgen')
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...strToU8('Größe')]))).toBe('Größe')
    // "Jörg" in Windows-1252 (German Excel "CSV (Trennzeichen-getrennt)")
    expect(decodeText(new Uint8Array([0x4a, 0xf6, 0x72, 0x67, 0x80]))).toBe('Jörg€')
    // UTF-16 LE with BOM ("Unicode-Text")
    expect(decodeText(new Uint8Array([0xff, 0xfe, 0x4a, 0, 0xfc, 0]))).toBe('Jü')
  })
})

describe('delimited text', () => {
  it('detects ; , tab and |', () => {
    expect(detectDelimiter('Vorname;Nachname;E-Mail\nMax;Muster;m@x.de')).toBe(';')
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',')
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t')
    expect(detectDelimiter('a|b\n1|2')).toBe('|')
    // commas inside quotes don't count
    expect(detectDelimiter('"Muster, Max";m@x.de\n"Doe, Jane";j@x.de')).toBe(';')
  })

  it('parses quotes, escaped quotes, CRLF and line breaks inside quotes', () => {
    const t = 'Name;Notiz\r\n"Muster, Max";"sagt ""hallo""\nzweite Zeile"\r\nAnna;x'
    expect(parseDelimited(t)).toEqual([
      ['Name', 'Notiz'],
      ['Muster, Max', 'sagt "hallo"\nzweite Zeile'],
      ['Anna', 'x'],
    ])
  })

  it('drops empty lines and trims cells', () => {
    expect(parseTable('csv', strToU8('a , b\n\n , \n c,d\n'))).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })
})

describe('xlsx', () => {
  it('reads shared strings, inline strings, numbers and gaps', () => {
    const file = xlsx(
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>' +
        '<row r="2"><c r="A2" t="s"><v>4</v></c><c r="C2" t="inlineStr"><is><t>max@example.de</t></is></c><c r="D2"><v>4917612345678</v></c></row>' +
        '<row r="4"><c r="A4" t="str"><v>Zoë &amp; Co</v></c><c r="B4" t="s"><v>5</v></c><c r="C4" t="s"><v>6</v></c><c r="E4"><v>1.5</v></c></row>',
      ['Vorname', 'Nachname', 'E-Mail', 'Telefon', 'Max', '<r><t>Mül</t></r><r><t>ler</t></r>', 'zoe@example.de'],
    )
    expect(parseTable('xlsx', file)).toEqual([
      ['Vorname', 'Nachname', 'E-Mail', 'Telefon'],
      ['Max', '', 'max@example.de', '4917612345678'],
      ['Zoë & Co', 'Müller', 'zoe@example.de', '', '1.5'],
    ])
  })

  it('follows the workbook relationship to the first sheet', () => {
    const file = xlsx('<row r="1"><c r="A1" t="inlineStr"><is><t>ok</t></is></c></row>', undefined, { sheetFile: 'sheet7.xml' })
    expect(parseTable('xlsx', file)).toEqual([['ok']])
  })

  it('rejects broken files and empty sheets', () => {
    expect(() => parseTable('xlsx', new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3]))).toThrow(ImportError)
    expect(() => parseTable('xlsx', xlsx(''))).toThrow(/empty/)
  })

  it('maps column letters', () => {
    expect(columnIndex('A1')).toBe(0)
    expect(columnIndex('Z9')).toBe(25)
    expect(columnIndex('AA3')).toBe(26)
    expect(columnIndex('AB12')).toBe(27)
  })

  it('formats numbers the way people typed them', () => {
    expect(formatNumber('4.9176123456780E12')).toBe('4917612345678')
    expect(formatNumber('12')).toBe('12')
    expect(formatNumber('0.30000000000000004')).toBe('0.3')
  })
})

describe('ods', () => {
  it('reads cells, repeated columns/rows and skips trailing padding', () => {
    const file = ods(
      '<table:table-row><table:table-cell office:value-type="string"><text:p>E-Mail</text:p></table:table-cell><table:table-cell><text:p>Name</text:p></table:table-cell><table:table-cell table:number-columns-repeated="16382"/></table:table-row>' +
        '<table:table-row><table:table-cell><text:p>a@b.de</text:p></table:table-cell><table:table-cell><text:p>Anna<text:s/>Beck</text:p></table:table-cell></table:table-row>' +
        '<table:table-row table:number-rows-repeated="1048000"><table:table-cell table:number-columns-repeated="1024"/></table:table-row>',
    )
    expect(parseTable('ods', file)).toEqual([
      ['E-Mail', 'Name'],
      ['a@b.de', 'Anna Beck'],
    ])
  })
})

describe('column mapping', () => {
  it('finds German and English headers, also below a title row', () => {
    const table = [
      ['Fahrschüler Liste November'],
      ['Nr.', 'Vorname', 'Nachname', 'E-Mail-Adresse', 'Handy', 'Schülernummer'],
      ['1', 'Max', 'Muster', 'max@example.de', '0176 123', 'K-1001'],
    ]
    expect(detectMapping(table)).toEqual({
      headerRow: 1,
      columns: ['ignore', 'first_name', 'last_name', 'email', 'phone', 'student_code'],
    })
    expect(detectMapping([['First name', 'Last name', 'Email', 'Student ID'], ['a', 'b', 'a@b.de', 'X1']]).columns).toEqual([
      'first_name',
      'last_name',
      'email',
      'student_code',
    ])
  })

  it('guesses columns without a header by content', () => {
    expect(detectMapping([['Max Muster', 'max@example.de'], ['Anna Beck', 'anna@example.de']])).toEqual({
      headerRow: null,
      columns: ['full_name', 'email'],
    })
    expect(detectMapping([['max@example.de'], ['anna@example.de']])).toEqual({ headerRow: null, columns: ['email'] })
  })

  it('splits full names', () => {
    expect(splitFullName('Muster, Max')).toEqual({ first: 'Max', last: 'Muster' })
    expect(splitFullName('Max Peter Muster')).toEqual({ first: 'Max Peter', last: 'Muster' })
    expect(splitFullName('Cher')).toEqual({ first: 'Cher', last: null })
  })
})

describe('buildRows', () => {
  const mapping = { headerRow: 0, columns: ['full_name', 'email', 'phone', 'student_code'] as const }

  it('normalises, flags problems and keeps the file row number', () => {
    const table = [
      ['Name', 'E-Mail', 'Telefon', 'Code'],
      ['Muster, Max', ' MAX@Example.de ', '+49 176 1234567', 'k-1001'],
      ['Anna Beck', 'anna@example', '', ''],
      ['Max again', 'max@example.de', '', 'K-2002'],
      ['Tom', 'tom@example.de', '', 'K-1001'],
      ['Eva', 'eva@example.de', '', 'X'],
      ['Ida', 'ida@example.de', '', 'schul-0000'],
      ['Jo Doe', '"Jo Doe" <jo@example.de>', '', ''],
    ]
    const rows = buildRows(table, { ...mapping, columns: [...mapping.columns] }, 'SCHUL-0000')
    expect(rows.map((r) => [r.row, r.email, r.issue])).toEqual([
      [2, 'max@example.de', null],
      [3, 'anna@example', 'invalid_email'],
      [4, 'max@example.de', 'duplicate_email'],
      [5, 'tom@example.de', 'duplicate_code'],
      [6, 'eva@example.de', 'invalid_code'],
      [7, 'ida@example.de', 'school_code'],
      [8, 'jo@example.de', null],
    ])
    expect(rows[0]).toMatchObject({ first_name: 'Max', last_name: 'Muster', phone: '+49 176 1234567', student_code: 'K-1001' })
    expect(rows[6]).toMatchObject({ first_name: 'Jo', last_name: 'Doe' })
    expect(previewSummary(rows)).toEqual({ total: 7, ok: 2, withCode: 1, withoutCode: 1, problems: 5 })
  })

  it('handles a pasted plain list of addresses', () => {
    const table = parseTable('paste', 'a@example.de\nb@example.de\n\nc@example.de')
    const rows = buildRows(table, detectMapping(table))
    expect(rows.map((r) => r.email)).toEqual(['a@example.de', 'b@example.de', 'c@example.de'])
    expect(rows.every((r) => !r.issue)).toBe(true)
  })

  it('stops at the row limit', () => {
    const big = 'email\n' + Array.from({ length: 2101 }, (_, i) => `s${i}@example.de`).join('\n')
    expect(() => buildRows(parseTable('csv', strToU8(big)), { headerRow: 0, columns: ['email'] })).toThrow(/too_many_rows/)
  })
})

describe('load', () => {
  it('parses a 2000-row CSV and xlsx quickly', () => {
    const csv =
      'Vorname;Nachname;E-Mail;Code\n' +
      Array.from({ length: 2000 }, (_, i) => `Vor${i};Nach${i};s${i}@example.de;K-${10000 + i}`).join('\n')
    let t0 = performance.now()
    const table = parseTable('csv', strToU8(csv))
    const rows = buildRows(table, detectMapping(table))
    const csvMs = performance.now() - t0
    expect(rows.filter((r) => !r.issue)).toHaveLength(2000)

    const sheet = Array.from(
      { length: 2001 },
      (_, i) =>
        `<row r="${i + 1}"><c r="A${i + 1}" t="inlineStr"><is><t>${i === 0 ? 'E-Mail' : `s${i}@example.de`}</t></is></c><c r="B${i + 1}" t="inlineStr"><is><t>${i === 0 ? 'Name' : `Name ${i}`}</t></is></c></row>`,
    ).join('')
    t0 = performance.now()
    const xt = parseTable('xlsx', xlsx(sheet))
    const xrows = buildRows(xt, detectMapping(xt))
    const xlsxMs = performance.now() - t0
    expect(xrows.filter((r) => !r.issue)).toHaveLength(2000)
    expect(csvMs).toBeLessThan(1500)
    expect(xlsxMs).toBeLessThan(1500)
  })
})
