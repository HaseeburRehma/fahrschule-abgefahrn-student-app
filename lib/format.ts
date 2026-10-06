import { format } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import type { Locale } from '@/lib/types'

const LOCALES = { de, en: enUS }

/** Parsed date or null — callers render '' instead of "Invalid Date" / epoch for bad input. */
function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

/**
 * date-fns' German abbreviations end in a period ("Fr.", "Okt."); the Figma design
 * writes them without ("Fr, 2. Okt"). Removes periods that don't follow a digit.
 */
export function stripAbbrDots(s: string): string {
  return s.replace(/\./g, (m, i: number, str: string) => (/\d/.test(str[i - 1] ?? '') ? m : ''))
}

export function formatDateTime(iso: string | null | undefined, locale: Locale): string {
  const d = toDate(iso)
  if (!d) return ''
  try {
    return stripAbbrDots(
      format(d, 'EEE, d. MMM yyyy • HH:mm', {
        locale: LOCALES[locale],
      }),
    )
  } catch {
    return ''
  }
}

export function formatDate(iso: string | null | undefined, locale: Locale): string {
  const d = toDate(iso)
  if (!d) return ''
  try {
    return stripAbbrDots(format(d, 'd. MMM yyyy', { locale: LOCALES[locale] }))
  } catch {
    return ''
  }
}

export function formatTime(iso: string | null | undefined, locale: Locale): string {
  const d = toDate(iso)
  if (!d) return ''
  try {
    return format(d, 'HH:mm', { locale: LOCALES[locale] })
  } catch {
    return ''
  }
}

/**
 * Parse an admin-entered "YYYY-MM-DD HH:MM" (or ISO) local datetime into an
 * ISO string. Returns null when unparseable.
 */
export function parseLocalDateTime(input: string): string | null {
  const s = input.trim().replace(' ', 'T')
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return null
  const [, y, mo, d, h, mi] = m
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi))
  if (isNaN(dt.getTime())) return null
  return dt.toISOString()
}

export function formatPrice(eur: number, locale: Locale): string {
  try {
    return new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-GB', {
      style: 'currency',
      currency: 'EUR',
    }).format(eur)
  } catch {
    return `€${eur}`
  }
}
