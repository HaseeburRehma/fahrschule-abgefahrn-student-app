/**
 * Figma "09/Streak" (1472:4023): full-bleed mascot on green with the white
 * celebration card — "{n} Tage Streak", Mon–Sun dots, "Weiter so!".
 */

import React from 'react'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'phosphor-react-native/src/icons/X'

import { C } from '@/components/ds'
import { MascotStage, PaperButton, PaperCard, PaperTitle, WEEKDAY_LABELS, WeekDots } from '@/components/quiz/ui'
import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { weekDays } from '@/lib/quiz/gamification'
import { useQuizAttempts } from '@/lib/quiz/use-quiz-attempts'

export default function StreakScreen() {
  const { t, locale } = useTranslation()
  const { profile } = useUser()
  const { attempts } = useQuizAttempts()
  const insets = useSafeAreaInsets()
  const streak = profile?.streak_days ?? 0
  const close = () => (router.canGoBack() ? router.back() : router.replace('/home'))

  const title =
    streak <= 0 ? t('quiz.v2.streak.none') : streak === 1 ? t('quiz.v2.streak.titleOne') : t('quiz.v2.streak.title', { n: streak })

  return (
    <View style={{ flex: 1, backgroundColor: C.celebrate }}>
      <MascotStage />
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 20 }}>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t('ds.close')}
          style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={22} color={C.white} />
        </Pressable>
      </View>
      <View style={{ flex: 1 }} />
      <PaperCard style={{ gap: 14 }}>
        <PaperTitle title={title} subtitle={t('quiz.v2.streak.body')} />
        <WeekDots light days={weekDays(attempts)} labels={WEEKDAY_LABELS[locale]} />
        <PaperButton label={t('quiz.v2.streak.cta')} onPress={close} />
      </PaperCard>
    </View>
  )
}
