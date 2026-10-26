/**
 * Figma "11/Tagesziel" (1530:4365): greeting + HUD, mascot card, daily-goal
 * ring, Mon–Sun dots and "Weiterlernen" into the next topic's quiz.
 */

import React from 'react'
import { Image, View } from 'react-native'
import { router } from 'expo-router'
import { ArrowRight } from 'phosphor-react-native/src/icons/ArrowRight'

import { Button, C, ErrorState, Screen, Skeleton, T, TopBar } from '@/components/ds'
import { ProgressRing } from '@/components/home/progress-ring'
import { Hud, MASCOT, WEEKDAY_LABELS, WeekDots } from '@/components/quiz/ui'
import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { THEORY_CONTENT } from '@/lib/theory-content'
import { DAILY_GOAL, formatXp, todayCount, totalXp, weekDays } from '@/lib/quiz/gamification'
import { useQuizAttempts } from '@/lib/quiz/use-quiz-attempts'

export default function DailyGoalScreen() {
  const { t, locale } = useTranslation()
  const { profile } = useUser()
  const { attempts, loading, error, reload } = useQuizAttempts()

  if (loading) {
    return (
      <Screen glow={-60} header={<TopBar />} gap={20}>
        <Skeleton height={235} radius={24} />
        <Skeleton width={180} height={180} radius={90} style={{ alignSelf: 'center' }} />
        <Skeleton height={60} />
      </Screen>
    )
  }
  if (error) {
    return (
      <Screen glow={-60} header={<TopBar />}>
        <ErrorState onRetry={reload} />
      </Screen>
    )
  }

  const today = todayCount(attempts)
  const pct = Math.min(100, Math.round((today / DAILY_GOAL) * 100))
  // Next topic: the lowest-numbered one without a mastered round yet.
  const mastered = new Set(attempts.filter((a) => a.mastered).map((a) => a.topic_number))
  const nextTopic = Array.from({ length: 14 }, (_, i) => i + 1).find((n) => !mastered.has(n)) ?? 1
  const next = THEORY_CONTENT[nextTopic]
  const nextTitle = next ? (locale === 'en' ? next.short_en : next.short_de) : ''

  return (
    <Screen
      glow={-60}
      header={<TopBar />}
      gap={20}
      footer={
        <Button
          label={t('quiz.v2.goal.cta')}
          iconRight={ArrowRight}
          onPress={() => router.push(`/quiz/${nextTopic}` as any)}
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <T variant="bodyS" color={C.muted}>{t('quiz.v2.goal.hello')}</T>
          <T variant="headingM" numberOfLines={1}>{profile?.first_name ?? ''}</T>
        </View>
        <Hud streak={profile?.streak_days ?? 0} xp={formatXp(totalXp(attempts), locale)} />
      </View>

      {/* Figma: lion head on green — show the top of the full-body artwork (549×900) */}
      <View style={{ height: 235, borderRadius: 24, overflow: 'hidden', backgroundColor: C.celebrate, alignItems: 'center' }}>
        <Image
          source={MASCOT.celebrate}
          resizeMode="cover"
          // fixed height so the head is framed the same at every width; the card's green fills the sides
          style={{ height: 520, aspectRatio: 549 / 900, marginTop: -150 }}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>

      <View style={{ alignItems: 'center', gap: 14 }}>
        <ProgressRing
          percent={pct}
          size={180}
          stroke={18}
          label={`${Math.min(today, DAILY_GOAL)}/${DAILY_GOAL}`}
          caption={t('quiz.v2.goal.lessons')}
        />
        <T variant="titleM" color={C.brand}>
          {pct >= 100 ? t('quiz.v2.goal.done') : t('quiz.v2.goal.label', { pct })}
        </T>
        <T variant="bodyS" color={C.muted}>{t('quiz.v2.goal.next', { title: nextTitle })}</T>
      </View>

      <WeekDots days={weekDays(attempts)} labels={WEEKDAY_LABELS[locale]} />
    </Screen>
  )
}
