/**
 * Figma "09/Abzeichen" (1472:4102): 3-column badge grid, unlocked badges with a
 * green (or amber) ring, locked ones greyed with a lock.
 */

import React, { useCallback, useState } from 'react'
import { View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { BookOpen } from 'phosphor-react-native/src/icons/BookOpen'
import { Certificate } from 'phosphor-react-native/src/icons/Certificate'
import { Crown } from 'phosphor-react-native/src/icons/Crown'
import { Fire } from 'phosphor-react-native/src/icons/Fire'
import { GraduationCap } from 'phosphor-react-native/src/icons/GraduationCap'
import { IdentificationCard } from 'phosphor-react-native/src/icons/IdentificationCard'
import { Lightning } from 'phosphor-react-native/src/icons/Lightning'
import { LockSimple } from 'phosphor-react-native/src/icons/LockSimple'
import { MoonStars } from 'phosphor-react-native/src/icons/MoonStars'
import { RoadHorizon } from 'phosphor-react-native/src/icons/RoadHorizon'
import { SealCheck } from 'phosphor-react-native/src/icons/SealCheck'
import { SteeringWheel } from 'phosphor-react-native/src/icons/SteeringWheel'
import { Star } from 'phosphor-react-native/src/icons/Star'
import { Target } from 'phosphor-react-native/src/icons/Target'
import { Trophy } from 'phosphor-react-native/src/icons/Trophy'

import { C, ErrorState, Screen, Skeleton, T, TopBar } from '@/components/ds'
import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { fetchMyDoneTopics, fetchTheoryTopics } from '@/lib/data'
import { badges, type Badge, type BadgeKey } from '@/lib/quiz/gamification'
import { useQuizAttempts } from '@/lib/quiz/use-quiz-attempts'

const ICON: Record<BadgeKey, PhosphorIcon> = {
  registered: IdentificationCard,
  theoryStart: BookOpen,
  firstQuiz: Target,
  streak7: Fire,
  lessons10: SteeringWheel,
  quizPro: SealCheck,
  perfectQuiz: Star,
  night: MoonStars,
  overland: RoadHorizon,
  autobahn: Lightning,
  allTopics: GraduationCap,
  xp1000: Crown,
  theoryExam: Certificate,
  practicalExam: SteeringWheel,
  license: Trophy,
}

export default function BadgesScreen() {
  const { t } = useTranslation()
  const { profile, session } = useUser()
  const uid: string | null = session?.user?.id ?? null
  const quiz = useQuizAttempts()
  const [topics, setTopics] = useState<{ done: number; total: number } | null>(null)
  const [topicsError, setTopicsError] = useState(false)

  useFocusEffect(
    useCallback(() => {
      let alive = true
      Promise.all([fetchTheoryTopics(), uid ? fetchMyDoneTopics(uid) : Promise.resolve(new Set<string>())])
        .then(([all, done]) => alive && setTopics({ done: done.size, total: all.length }))
        .catch(() => alive && setTopicsError(true))
      return () => {
        alive = false
      }
    }, [uid]),
  )

  const loading = quiz.loading || (!topics && !topicsError)
  if (loading || !profile) {
    return (
      <Screen glow={-40} header={<TopBar />} gap={16}>
        <Skeleton width={180} height={30} />
        <Skeleton height={460} radius={18} />
      </Screen>
    )
  }
  if (quiz.error) {
    return (
      <Screen glow={-40} header={<TopBar />}>
        <ErrorState onRetry={quiz.reload} />
      </Screen>
    )
  }

  const list = badges({
    profile,
    attempts: quiz.attempts,
    doneTopics: topics?.done ?? 0,
    totalTopics: topics?.total ?? 0,
  })
  // unlocked first, keeping the defined order inside each group
  const sorted = [...list.filter((b) => b.unlocked), ...list.filter((b) => !b.unlocked)]
  const rows: Badge[][] = []
  for (let i = 0; i < sorted.length; i += 3) rows.push(sorted.slice(i, i + 3))
  const unlocked = list.filter((b) => b.unlocked).length

  return (
    <Screen glow={-40} header={<TopBar />} gap={16}>
      <View style={{ gap: 4 }}>
        <T variant="headingXL" accessibilityRole="header">{t('quiz.v2.badges.title')}</T>
        <T variant="bodyM" color={C.muted}>{t('quiz.v2.badges.count', { n: unlocked, total: list.length })}</T>
      </View>
      <View style={{ gap: 14 }}>
        {rows.map((row, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 14 }}>
            {row.map((b) => (
              <BadgeTile key={b.key} badge={b} label={t(`quiz.v2.badge.${b.key}`)} />
            ))}
            {Array.from({ length: 3 - row.length }, (_, k) => (
              <View key={`pad-${k}`} style={{ flex: 1 }} />
            ))}
          </View>
        ))}
      </View>
    </Screen>
  )
}

function BadgeTile({ badge, label }: { badge: Badge; label: string }) {
  const Icon = badge.unlocked ? ICON[badge.key] : LockSimple
  const gold = badge.tone === 'gold'
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityState={{ disabled: !badge.unlocked }}
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 8,
        backgroundColor: C.card,
        borderColor: C.line,
        borderWidth: 1,
        borderRadius: 18,
        paddingTop: 16,
        paddingBottom: 14,
        paddingHorizontal: 8,
      }}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: badge.unlocked ? (gold ? C.goldBg : C.tile) : C.surface,
          borderWidth: badge.unlocked ? 1.5 : 1,
          borderColor: badge.unlocked ? (gold ? C.gold : C.brand) : C.line,
        }}
      >
        <Icon
          size={badge.unlocked ? 28 : 24}
          color={badge.unlocked ? (gold ? C.gold : C.brand) : C.dim}
          weight={badge.unlocked && (gold || badge.key === 'quizPro' || badge.key === 'lessons10') ? 'fill' : 'regular'}
        />
      </View>
      <T variant="caption" color={badge.unlocked ? C.white : C.dim} style={{ textAlign: 'center' }}>
        {label}
      </T>
    </View>
  )
}
