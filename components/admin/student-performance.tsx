/**
 * Performance section on the admin student detail screen: personal code,
 * KPIs, accuracy per theory topic (1–14) and the latest quiz rounds.
 */

import React, { useEffect, useState } from 'react'
import { Platform, Text, View } from 'react-native'
import { Copy } from 'phosphor-react-native/src/icons/Copy'
import { ShareNetwork } from 'phosphor-react-native/src/icons/ShareNetwork'

import { useTranslation } from '@/lib/i18n'
import {
  fetchPerformance,
  fetchRecentAttempts,
  fetchTopicStats,
  isNotDeployed,
  type QuizAttemptRow,
  type StudentPerformance,
  type TopicStat,
} from '@/lib/invites'
import { TOPIC_COUNT, derive } from '@/lib/performance'
import { formatDateTime } from '@/lib/format'
import type { TheoryTopic } from '@/lib/types'
import { Badge, Grid, GREEN, Kpi, Notice, ProgressBar, SmallButton, copyOrShare, notify, type Tone } from '@/components/admin/kit'

export function StudentPerformanceSection({ studentId, topics, code }: { studentId: string; topics: TheoryTopic[]; code?: string | null }) {
  const { t, locale } = useTranslation()
  const [perf, setPerf] = useState<StudentPerformance | null>(null)
  const [stats, setStats] = useState<TopicStat[]>([])
  const [attempts, setAttempts] = useState<QuizAttemptRow[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'not_deployed' | 'error'>('loading')

  useEffect(() => {
    let alive = true
    Promise.all([fetchPerformance(), fetchTopicStats(studentId), fetchRecentAttempts(studentId, 10)])
      .then(([all, s, a]) => {
        if (!alive) return
        setPerf(all.find((p) => p.student_id === studentId) ?? null)
        setStats(s)
        setAttempts(a)
        setState('ready')
      })
      .catch((e) => alive && setState(isNotDeployed(e) ? 'not_deployed' : 'error'))
    return () => {
      alive = false
    }
  }, [studentId])

  const shownCode = perf?.student_code ?? code ?? null

  async function shareCode() {
    if (!shownCode) return
    const r = await copyOrShare(shownCode)
    if (r === 'copied') notify(t('inv.copied'))
  }

  const title = (n: number) => {
    const tp = topics.find((x) => x.number === n)
    return tp ? (locale === 'de' ? tp.title_de : tp.title_en) : `${t('perf.topic')} ${n}`
  }

  return (
    <View className="gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="font-m-xbold text-base text-neutral-100">{t('perf.studentTitle')}</Text>
        {shownCode ? (
          <View className="flex-row items-center gap-2">
            <Text className="font-m-regular text-xs text-neutral-400">{t('perf.code')}</Text>
            <Text className="font-m-bold text-sm text-neutral-100" selectable>
              {shownCode}
            </Text>
            <SmallButton
              label={Platform.OS === 'web' ? t('inv.copy') : t('inv.share')}
              icon={Platform.OS === 'web' ? <Copy size={14} color={GREEN} /> : <ShareNetwork size={14} color={GREEN} />}
              onPress={shareCode}
            />
          </View>
        ) : null}
      </View>

      {state === 'loading' ? <Text className="font-m-regular text-sm text-neutral-500">{t('common.loading')}</Text> : null}
      {state === 'not_deployed' ? <Notice title={t('inv.notDeployedTitle')} body={t('inv.notDeployedBody')} /> : null}
      {state === 'error' ? <Notice title={t('common.error')} tone="red" /> : null}

      {state === 'ready' && perf ? Body({ perf, stats, attempts, title }) : null}
      {state === 'ready' && !perf ? <Text className="font-m-regular text-sm text-neutral-500">{t('perf.noData')}</Text> : null}
    </View>
  )

  function Body({ perf: p, stats: s, attempts: a, title: tt }: { perf: StudentPerformance; stats: TopicStat[]; attempts: QuizAttemptRow[]; title: (n: number) => string }) {
    const d = derive(p)
    const byTopic = new Map(s.map((x) => [x.topic_number, x]))
    const tone = (pct: number): Tone => (pct >= 80 ? 'green' : pct >= 60 ? 'amber' : 'red')
    return (
      <View className="gap-4">
        <Grid cols={4} phoneCols={2}>
          <Kpi label={t('perf.col.readiness')} value={`${d.readiness} %`} tone={d.readiness >= 75 ? 'green' : d.readiness >= 45 ? 'amber' : 'red'} />
          <Kpi label={t('perf.col.accuracy')} value={d.accuracy === null ? '—' : `${d.accuracy} %`} tone="blue" hint={t('perf.answers', { n: p.quiz_questions })} />
          <Kpi label={t('perf.col.mastered')} value={`${p.topics_mastered}/${TOPIC_COUNT}`} hint={t('perf.topicsDoneHint', { n: p.topics_done })} />
          <Kpi label={t('perf.col.streak')} value={p.streak_days} tone="amber" hint={`${p.xp_week} XP ${t('perf.thisWeek')}`} />
        </Grid>
        {d.flags.length ? (
          <View className="flex-row flex-wrap gap-1.5">
            {d.flags.map((f) => (
              <Badge key={f} label={t(`perf.flag.${f}`)} tone={f === 'ready' ? 'green' : f === 'struggling' ? 'red' : f === 'exam_soon' ? 'amber' : f === 'new' ? 'blue' : 'gray'} />
            ))}
          </View>
        ) : null}

        <View className="gap-2">
          <Text className="font-m-bold text-sm text-neutral-200">{t('perf.byTopic')}</Text>
          {Array.from({ length: TOPIC_COUNT }, (_, i) => i + 1).map((n) => {
            const st = byTopic.get(n)
            const pct = st && st.questions ? Math.round((100 * st.correct) / st.questions) : null
            return (
              <View key={n} className="gap-1">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="font-m-medium flex-1 text-[13px] text-neutral-300" numberOfLines={1}>
                    {n}. {tt(n)}
                  </Text>
                  {st?.mastered ? <Badge label={t('perf.masteredBadge')} tone="green" /> : null}
                  <Text className="font-m-bold w-24 text-right text-[12px] text-neutral-200">
                    {pct === null ? t('perf.notPlayed') : `${pct} % · ${st!.rounds}×`}
                  </Text>
                </View>
                <ProgressBar pct={pct ?? 0} tone={pct === null ? 'gray' : tone(pct)} height={5} />
              </View>
            )
          })}
        </View>

        {a.length ? (
          <View className="gap-1.5">
            <Text className="font-m-bold text-sm text-neutral-200">{t('perf.recent')}</Text>
            {a.map((x) => (
              <View key={x.id} className="flex-row items-center justify-between gap-2 border-b border-neutral-800/60 py-1.5">
                <Text className="font-m-regular flex-1 text-[13px] text-neutral-300" numberOfLines={1}>
                  {x.topic_number}. {tt(x.topic_number)}
                </Text>
                <Text className="font-m-bold text-[13px] text-neutral-100">
                  {x.correct}/{x.total}
                </Text>
                <Text className="font-m-regular w-36 text-right text-[11px] text-neutral-500">{formatDateTime(x.created_at, locale)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    )
  }
}
