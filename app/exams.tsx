/**
 * Figma "Prüfungen" (1285:1492): theory + practical exam cards with countdown,
 * status, prerequisites checklist, and the "Prüfungstermin eintragen" sheet.
 * Every value comes from the student's profile / topic progress.
 */

import React, { useCallback, useState } from 'react'
import { RefreshControl, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { Car } from 'phosphor-react-native/src/icons/Car'
import { ChatCircleDots } from 'phosphor-react-native/src/icons/ChatCircleDots'
import { Check } from 'phosphor-react-native/src/icons/Check'
import { GraduationCap } from 'phosphor-react-native/src/icons/GraduationCap'
import { X } from 'phosphor-react-native/src/icons/X'

import {
  Button,
  C,
  Card,
  Divider,
  IconTile,
  LinkButton,
  Pill,
  Screen,
  SectionLabel,
  T,
  TopBar,
  useToast,
  type PillTone,
} from '@/components/ds'
import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { fetchMyDoneTopics, fetchTheoryTopics, updateMyProfile } from '@/lib/data'
import { fetchMotivationMessages, buildMotivationItems } from '@/lib/motivation'
import { scheduleReminders } from '@/lib/reminders'
import { ExamDateSheet, type ExamKind } from '@/components/theory/exam-date-sheet'
import { daysUntil, parseIsoDay, shortDate } from '@/components/theory/dates'

/** Mandatory driving lessons before the practical exam (Figma "12 Pflicht-Fahrstunden"). */
const REQUIRED_LESSONS = 12
/** Special drives: Autobahn, Nacht, Überland. */
const REQUIRED_SPECIAL = 3

export default function ExamsScreen() {
  const { t, locale } = useTranslation()
  const { profile, session, refreshProfile } = useUser()
  const toast = useToast()
  const uid: string | null = session?.user?.id ?? null

  const [theoryLeft, setTheoryLeft] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sheet, setSheet] = useState<ExamKind | null>(null)
  const [lastKind, setLastKind] = useState<ExamKind>('theory')
  const [answering, setAnswering] = useState<ExamKind | null>(null)

  const loadTopics = useCallback(async () => {
    try {
      const [topics, done] = await Promise.all([
        fetchTheoryTopics(),
        uid ? fetchMyDoneTopics(uid) : Promise.resolve(new Set<string>()),
      ])
      setTheoryLeft(topics.filter((x) => !done.has(x.id)).length)
    } catch {
      setTheoryLeft(null)
    }
  }, [uid])

  // (Re)schedule the daily motivation pushes for the nearest upcoming exam.
  const rescheduleMotivation = useCallback(async () => {
    const candidates = [profile?.theory_exam_date, profile?.practical_exam_date]
      .filter((d): d is string => !!d && (daysUntil(d) ?? -1) > 0)
      .sort()
    if (!candidates.length) {
      scheduleReminders([], 'motivation') // clear
      return
    }
    try {
      const msgs = await fetchMotivationMessages(true)
      const bodies = msgs.map((m) => (locale === 'de' ? m.body_de : m.body_en))
      const items = buildMotivationItems(parseIsoDay(candidates[0])!, bodies, (days) =>
        t('exam.motivationTitle', { days }),
      )
      scheduleReminders(items, 'motivation')
    } catch {}
  }, [profile?.theory_exam_date, profile?.practical_exam_date, locale, t])

  useFocusEffect(
    useCallback(() => {
      loadTopics()
      rescheduleMotivation()
    }, [loadTopics, rescheduleMotivation]),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([refreshProfile(), loadTopics()])
    } finally {
      setRefreshing(false)
    }
  }, [refreshProfile, loadTopics])

  async function setPassed(kind: ExamKind, passed: boolean) {
    if (!uid || answering) return
    setAnswering(kind)
    try {
      await updateMyProfile(uid, kind === 'theory' ? { theory_passed: passed } : { practical_passed: passed })
      await refreshProfile()
      if (passed) router.push('/success' as any)
    } catch {
      toast.show(t('common.error'), 'error')
    } finally {
      setAnswering(null)
    }
  }

  function openSheet(kind: ExamKind) {
    setLastKind(kind)
    setSheet(kind)
  }

  const theoryPassed = profile?.theory_passed ?? null
  const practicalPassed = profile?.practical_passed ?? null
  const lessons = profile?.driving_lessons_count ?? 0
  const special = [profile?.drive_autobahn, profile?.drive_night, profile?.drive_overland].filter(Boolean).length

  const theoryRemainingText =
    theoryPassed === true || theoryLeft === null
      ? null
      : theoryLeft === 0
        ? t('exams.v2.theoryReady')
        : theoryLeft === 1
          ? t('exams.v2.theoryRemainingOne')
          : t('exams.v2.theoryRemaining', { n: theoryLeft })

  return (
    <Screen
      glow={-20}
      header={<TopBar title={t('exams.v2.title')} />}
      gap={16}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} colors={[C.brand]} />
      }
    >
      <ExamCard
        kind="theory"
        icon={GraduationCap}
        title={t('exams.v2.theory')}
        date={profile?.theory_exam_date ?? null}
        passed={theoryPassed}
        highlight={theoryPassed !== true}
        answering={answering === 'theory'}
        onAnswer={(p) => setPassed('theory', p)}
        onEdit={() => openSheet('theory')}
      >
        {theoryRemainingText ? <T variant="bodyS" color={C.muted}>{theoryRemainingText}</T> : null}
      </ExamCard>

      <ExamCard
        kind="practical"
        icon={Car}
        title={t('exams.v2.practical')}
        date={profile?.practical_exam_date ?? null}
        passed={practicalPassed}
        highlight={theoryPassed === true && practicalPassed !== true}
        answering={answering === 'practical'}
        onAnswer={(p) => setPassed('practical', p)}
        onEdit={() => openSheet('practical')}
      >
        <Divider />
        <SectionLabel>{t('exams.v2.requirements')}</SectionLabel>
        <View style={{ gap: 12 }}>
          <Requirement done={theoryPassed === true} label={t('exams.v2.req.theory')} />
          <Requirement
            done={lessons >= REQUIRED_LESSONS}
            label={
              lessons >= REQUIRED_LESSONS
                ? t('exams.v2.req.lessons', { n: REQUIRED_LESSONS })
                : t('exams.v2.req.lessonsProgress', { n: REQUIRED_LESSONS, count: lessons })
            }
          />
          <Requirement
            done={special >= REQUIRED_SPECIAL}
            label={
              special >= REQUIRED_SPECIAL
                ? t('exams.v2.req.special', { n: REQUIRED_SPECIAL })
                : t('exams.v2.req.specialProgress', { n: REQUIRED_SPECIAL, count: special })
            }
          />
        </View>
      </ExamCard>

      <Button label={t('exams.v2.contact')} iconLeft={ChatCircleDots} onPress={() => router.push('/chat' as any)} />

      <ExamDateSheet visible={sheet !== null} kind={sheet ?? lastKind} onClose={() => setSheet(null)} />
    </Screen>
  )
}

/* ------------------------------------------------------------------ pieces */

function ExamCard({
  kind,
  icon,
  title,
  date,
  passed,
  highlight,
  answering,
  onAnswer,
  onEdit,
  children,
}: {
  kind: ExamKind
  icon: PhosphorIcon
  title: string
  date: string | null
  passed: boolean | null
  highlight: boolean
  answering: boolean
  onAnswer: (passed: boolean) => void
  onEdit: () => void
  children?: React.ReactNode
}) {
  const { t, locale } = useTranslation()
  const day = parseIsoDay(date)
  const left = date ? daysUntil(date) : null
  const awaitingResult = day !== null && left !== null && left < 0 && passed === null

  const status: { label: string; tone: PillTone } =
    passed === true
      ? { label: t('exams.v2.status.passed'), tone: 'green' }
      : passed === false
        ? { label: t('exams.v2.status.failed'), tone: 'danger' }
        : day
          ? { label: t('exams.v2.status.registered'), tone: 'green' }
          : { label: t('exams.v2.status.open'), tone: 'neutral' }

  const tileTone = highlight || passed === true ? 'green' : 'surface'

  return (
    <Card
      highlight={highlight}
      radius={22}
      padding={20}
      style={[{ gap: 14 }, highlight ? { shadowOpacity: 0.16, shadowRadius: 20 } : null]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile icon={icon} size={44} iconSize={24} radius={14} tone={tileTone} />
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="titleM" numberOfLines={1}>{title}</T>
          <T variant="bodyS" color={C.muted} numberOfLines={1}>
            {day ? shortDate(day, locale, true) : t('exams.v2.noDate')}
          </T>
        </View>
        <Pill label={status.label} tone={status.tone} />
      </View>

      {/* Countdown */}
      {day && passed === null && left !== null && left >= 0 ? (
        left === 0 ? (
          <T variant="headingL" color={C.brand}>{t('exams.v2.today')}</T>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <T
              variant="displayL"
              color={C.brand}
              style={{ fontSize: 44, lineHeight: 46, letterSpacing: -0.88 }}
            >
              {String(left)}
            </T>
            <T variant="headingL" color={C.muted}>
              {left === 1 ? t('exams.v2.day') : t('exams.v2.days')}
            </T>
          </View>
        )
      ) : null}

      {/* Result prompt once the exam date has passed */}
      {awaitingResult ? (
        <View style={{ gap: 10 }}>
          <T variant="titleM">{t('exams.v2.passedQ')}</T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              label={t('exams.v2.passedYes')}
              iconLeft={Check}
              onPress={() => onAnswer(true)}
              loading={answering}
              compact
              style={{ flex: 1, alignSelf: 'auto' }}
            />
            <Button
              label={t('exams.v2.passedNo')}
              iconLeft={X}
              variant="ghost"
              onPress={() => onAnswer(false)}
              disabled={answering}
              compact
              style={{ alignSelf: 'auto' }}
            />
          </View>
        </View>
      ) : null}

      {passed === false ? <T variant="bodyS" color={C.muted}>{t('exams.v2.failedBody')}</T> : null}

      {kind === 'theory' ? children : null}

      {passed !== true ? (
        <LinkButton align="left" label={day ? t('exams.v2.editDate') : t('exams.v2.addDate')} onPress={onEdit} />
      ) : null}

      {kind === 'practical' ? children : null}
    </Card>
  )
}

function Requirement({ done, label }: { done: boolean; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: done ? C.brand : C.surface,
          borderWidth: done ? 0 : 1,
          borderColor: C.line,
        }}
      >
        {done ? <Check size={14} color={C.onBrand} weight="bold" /> : null}
      </View>
      <T variant="bodyL" color={done ? C.white : C.muted} style={{ flex: 1 }}>
        {label}
      </T>
    </View>
  )
}
