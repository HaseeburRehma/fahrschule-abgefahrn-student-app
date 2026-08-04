import { format } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import type { Locale } from '@/lib/types'

const LOCALES = { de, en: enUS }

export function formatDateTime(iso: string, locale: Locale): string {
  try {
    return format(new Date(iso), 'EEE, d. MMM yyyy • HH:mm', {
      locale: LOCALES[locale],
    })
  } catch {
    return iso
  }
}

export function formatDate(iso: string, locale: Locale): string {
  try {
    return format(new Date(iso), 'd. MMM yyyy', { locale: LOCALES[locale] })
  } catch {
    return iso
  }
}

export function formatTime(iso: string, locale: Locale): string {
  try {
    return format(new Date(iso), 'HH:mm', { locale: LOCALES[locale] })
  } catch {
    return iso
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
