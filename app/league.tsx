/**
 * Figma "09/Liga" (1472:3898): weekly learner league — tier pill, time left,
 * ranked list with medals for the top 3, "Aufstiegszone" divider, you highlighted.
 */

import React, { useCallback, useState } from 'react'
import { RefreshControl, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Clock } from 'phosphor-react-native/src/icons/Clock'
import { Crown } from 'phosphor-react-native/src/icons/Crown'
import { Lightning } from 'phosphor-react-native/src/icons/Lightning'
import { Medal } from 'phosphor-react-native/src/icons/Medal'
import { Trophy } from 'phosphor-react-native/src/icons/Trophy'

import { C, EmptyState, ErrorState, Screen, Skeleton, T, TopBar } from '@/components/ds'
import { useTranslation } from '@/lib/i18n'
import { invalidateCache } from '@/lib/cache'
import { fetchLeague, type LeagueRow } from '@/lib/quiz/api'
import { daysLeftInWeek, formatXp, leagueTier, PROMOTION_ZONE, totalXp } from '@/lib/quiz/gamification'
import { useQuizAttempts } from '@/lib/quiz/use-quiz-attempts'
import { useRequestGuard } from '@/lib/use-request-guard'

const MEDAL = ['#FFC83D', '#C9D1D9', '#D08A4E']

export default function LeagueScreen() {
  const { t, locale } = useTranslation()
  const { attempts } = useQuizAttempts()
  const guard = useRequestGuard()
  const [rows, setRows] = useState<LeagueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const req = guard.begin()
    try {
      const data = await fetchLeague()
      if (!guard.isCurrent(req)) return
      setRows(data)
      setError(false)
    } catch {
      if (guard.isCurrent(req)) setError(true)
    } finally {
      if (guard.isCurrent(req)) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [guard])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const tier = leagueTier(totalXp(attempts))
  const days = daysLeftInWeek()

  const header = (
    <View style={{ gap: 8 }}>
      <T variant="headingXL" accessibilityRole="header">{t('quiz.v2.league.title')}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.goldBg, borderRadius: 999, paddingLeft: 10, paddingRight: 12, paddingVertical: 6 }}>
          <Crown size={18} color={C.gold} weight="fill" />
          <T variant="labelM" color={C.gold}>{t(`quiz.v2.league.tier.${tier}`)}</T>
        </View>
        <View style={{ flex: 1 }} />
        <Clock size={16} color={C.muted} />
        <T variant="bodyS" color={C.muted}>
          {days <= 1 ? t('quiz.v2.league.endsInOne') : t('quiz.v2.league.endsIn', { n: days })}
        </T>
      </View>
    </View>
  )

  return (
    <Screen
      glow={-60}
      header={<TopBar />}
      gap={16}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={C.brand}
          onRefresh={() => {
            setRefreshing(true)
            invalidateCache('quiz:')
            load()
          }}
        />
      }
    >
      {header}
      {loading ? (
        <Skeleton height={420} radius={20} />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Trophy} title={t('quiz.v2.league.empty.title')} body={t('quiz.v2.league.empty.body')} />
      ) : (
        <View style={{ backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 20, paddingVertical: 6, overflow: 'hidden' }}>
          {rows.map((r, i) => (
            <React.Fragment key={`${r.rank}-${r.display_name}`}>
              {/* Promotion-zone divider after the top ranks (only if someone is below it) */}
              {i > 0 && rows[i - 1].rank === PROMOTION_ZONE && r.rank > PROMOTION_ZONE ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 6 }}>
                  <View style={{ flex: 1, height: 2, backgroundColor: C.brand }} />
                  <T variant="labelM" color={C.brand}>{t('quiz.v2.league.zone')}</T>
                  <View style={{ flex: 1, height: 2, backgroundColor: C.brand }} />
                </View>
              ) : null}
              <LeagueRowView row={r} you={t('quiz.v2.league.you', { name: r.display_name })} xp={formatXp(r.xp, locale)} />
            </React.Fragment>
          ))}
        </View>
      )}
    </Screen>
  )
}

function LeagueRowView({ row, you, xp }: { row: LeagueRow; you: string; xp: string }) {
  const medal = row.rank <= 3 ? MEDAL[row.rank - 1] : null
  return (
    <View
      accessible
      accessibilityLabel={`${row.rank}. ${row.is_me ? you : row.display_name}, ${xp} XP`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingLeft: 14,
        paddingRight: 16,
        paddingVertical: 12,
        backgroundColor: row.is_me ? C.tile : 'transparent',
      }}
    >
      <View style={{ width: 30, alignItems: 'center' }}>
        {medal ? <Medal size={26} color={medal} weight="fill" /> : <T variant="headingM" color={C.muted}>{String(row.rank)}</T>}
      </View>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          backgroundColor: row.is_me ? C.brand : C.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <T variant="titleM" color={row.is_me ? C.onBrand : C.white}>{row.initial}</T>
      </View>
      <T variant="titleM" color={row.is_me ? C.brand : C.white} style={{ flex: 1 }} numberOfLines={1}>
        {row.is_me ? you : row.display_name}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Lightning size={17} color={C.brand} weight="fill" />
        <T variant="labelL">{xp}</T>
      </View>
    </View>
  )
}
