/** Result rows of a student import (import screen + import detail). */

import React, { useState } from 'react'
import { Text, View } from 'react-native'

import { useTranslation } from '@/lib/i18n'
import type { ImportResultRow } from '@/lib/invites'
import { Badge, Chip, ChipRow, TableHeader, type Tone } from '@/components/admin/kit'

export function outcomeBadge(t: (k: string) => string, r: Pick<ImportResultRow, 'outcome' | 'reason'>): { label: string; tone: Tone } {
  if (r.outcome === 'skipped') return { label: t(`inv.reason.${r.reason ?? 'unknown'}`), tone: 'red' }
  if (r.outcome === 'registered') return { label: r.reason === 'code_updated' ? t('inv.out.codeUpdated') : t('inv.out.registered'), tone: 'blue' }
  return { label: t(r.outcome === 'invite_update' ? 'inv.out.reinvited' : 'inv.out.invited'), tone: 'green' }
}

export function mailBadge(t: (k: string) => string, mail: ImportResultRow['mail']): { label: string; tone: Tone } | null {
  if (!mail || mail === 'skipped') return null
  const tone: Tone = mail === 'sent' ? 'green' : mail === 'failed' ? 'red' : mail === 'not_configured' ? 'amber' : 'gray'
  return { label: t(`inv.mail.${mail}`), tone }
}

export function ResultRows({ rows, wide }: { rows: ImportResultRow[]; wide: boolean }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<'all' | 'invited' | 'registered' | 'skipped'>('all')
  const counts = {
    all: rows.length,
    invited: rows.filter((r) => r.outcome === 'invite_new' || r.outcome === 'invite_update').length,
    registered: rows.filter((r) => r.outcome === 'registered').length,
    skipped: rows.filter((r) => r.outcome === 'skipped').length,
  }
  const shown = rows
    .filter((r) =>
      filter === 'all' ? true : filter === 'invited' ? r.outcome === 'invite_new' || r.outcome === 'invite_update' : r.outcome === filter,
    )
    .slice(0, 500)
  const name = (r: ImportResultRow) => [r.first_name, r.last_name].filter(Boolean).join(' ') || '—'

  return (
    <View className="gap-3">
      <ChipRow>
        {(['all', 'invited', 'registered', 'skipped'] as const).map((k) => (
          <Chip key={k} label={t(`inv.rf.${k}`)} active={filter === k} onPress={() => setFilter(k)} count={counts[k]} />
        ))}
      </ChipRow>
      {wide ? (
        <View className="rounded-2xl border border-neutral-800 bg-neutral-900 pt-3">
          <TableHeader
            cols={[
              { label: t('inv.col.row'), flex: 0.5 },
              { label: t('inv.col.name'), flex: 2 },
              { label: t('inv.col.email'), flex: 3 },
              { label: t('inv.col.code'), flex: 1.4 },
              { label: t('inv.col.result'), flex: 2.2 },
              { label: t('inv.col.mail'), flex: 1.8 },
            ]}
          />
          {shown.map((r) => {
            const o = outcomeBadge(t, r)
            const m = mailBadge(t, r.mail)
            return (
              <View key={`${r.row}-${r.email}`} className="flex-row items-center border-b border-neutral-800/60 px-3 py-2.5">
                <Text style={{ flex: 0.5 }} className="font-m-regular text-xs text-neutral-500">{r.row}</Text>
                <Text style={{ flex: 2 }} className="font-m-semibold text-[13px] text-neutral-100" numberOfLines={1}>{name(r)}</Text>
                <Text style={{ flex: 3 }} className="font-m-regular text-[13px] text-neutral-300" numberOfLines={1}>{r.email}</Text>
                <Text style={{ flex: 1.4 }} className="font-m-bold text-[13px] text-neutral-200" numberOfLines={1}>{r.student_code ?? '—'}</Text>
                <View style={{ flex: 2.2 }}><Badge label={o.label} tone={o.tone} /></View>
                <View style={{ flex: 1.8 }}>{m ? <Badge label={m.label} tone={m.tone} /> : <Text className="text-neutral-600">—</Text>}</View>
              </View>
            )
          })}
        </View>
      ) : (
        <View className="gap-2">
          {shown.map((r) => {
            const o = outcomeBadge(t, r)
            const m = mailBadge(t, r.mail)
            return (
              <View key={`${r.row}-${r.email}`} className="gap-1.5 rounded-2xl border border-neutral-800 bg-neutral-900 p-3.5">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="font-m-semibold flex-1 text-[14px] text-neutral-100" numberOfLines={1}>{name(r)}</Text>
                  <Text className="font-m-regular text-[11px] text-neutral-500">{t('inv.col.row')} {r.row}</Text>
                </View>
                <Text className="font-m-regular text-[13px] text-neutral-300" numberOfLines={1}>{r.email}</Text>
                <View className="flex-row flex-wrap items-center gap-2">
                  {r.student_code ? <Text className="font-m-bold text-xs text-neutral-200">{r.student_code}</Text> : null}
                  <Badge label={o.label} tone={o.tone} />
                  {m ? <Badge label={m.label} tone={m.tone} /> : null}
                </View>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
