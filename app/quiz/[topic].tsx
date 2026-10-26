/**
 * Theorie-Quiz for one Grundstoff topic.
 * Figma: 09/Quiz Intro (1466:3736), Quiz Schild (1466:3797), Wahr-Falsch (1466:3842),
 * Multiple Choice (1469:3803), Feedback Richtig/Falsch (1469:3844 / 1469:3897),
 * 11/Lektion gemeistert (1530:4492).
 */

import React, { useRef, useState } from 'react'
import { Animated, Image, Pressable, ScrollView, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle'
import { Heart } from 'phosphor-react-native/src/icons/Heart'
import { Info } from 'phosphor-react-native/src/icons/Info'
import { SignOut } from 'phosphor-react-native/src/icons/SignOut'
import { X } from 'phosphor-react-native/src/icons/X'
import { XCircle } from 'phosphor-react-native/src/icons/XCircle'

import { Button, C, F, GreenLight, Sheet, SheetHero, T, useFill, useToast } from '@/components/ds'
import {
  MASCOT,
  MascotAvatar,
  MascotBackdrop,
  PaperButton,
  PaperCard,
  PaperStats,
  PaperTitle,
  SpeechBubble,
} from '@/components/quiz/ui'
import { useTranslation } from '@/lib/i18n'
import { useUser } from '@/lib/user-context'
import { THEORY_CONTENT } from '@/lib/theory-content'
import { buildRound, isCorrect, isTrueFalse, LIVES, text, type QuizQuestion } from '@/lib/quiz/bank'
import { QUIZ_IMAGES } from '@/lib/quiz/images'
import { recordQuizAttempt, type RecordedAttempt } from '@/lib/quiz/api'
import { formatDuration } from '@/lib/quiz/gamification'

type Phase = 'intro' | 'go' | 'play' | 'result'

export default function QuizScreen() {
  const { topic: topicParam } = useLocalSearchParams<{ topic: string }>()
  const topic = Math.min(14, Math.max(1, parseInt(String(topicParam), 10) || 1))
  const { t, locale } = useTranslation()
  const { refreshProfile, profile } = useUser()
  const toast = useToast()
  const insets = useSafeAreaInsets()

  const [round, setRound] = useState<QuizQuestion[]>(() => buildRound(topic))
  const [phase, setPhase] = useState<Phase>('intro')
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [checked, setChecked] = useState(false)
  const [wrong, setWrong] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [confirmExit, setConfirmExit] = useState(false)
  const [saved, setSaved] = useState<RecordedAttempt | null>(null)
  const [answered, setAnswered] = useState(0)
  const startedAt = useRef(0)
  const durationMs = useRef(0)

  const content = THEORY_CONTENT[topic]
  const topicName = content ? (locale === 'en' ? content.short_en : content.short_de) : ''
  const q = round[idx]
  const lives = Math.max(0, LIVES - wrong)
  // Figma "Vollgas": the top bar fills smoothly after each answer (hook must run on every render)
  const progressFill = useFill(round.length ? Math.max(0.04, (idx + (checked ? 1 : 0)) / round.length) : 0, 500)
  // Best possible XP for this round — same rule as record_quiz_attempt (10/answer + 20 perfect bonus).
  const maxXp = round.length * 10 + 20

  const close = () => (router.canGoBack() ? router.back() : router.replace('/home'))

  function restart() {
    setRound(buildRound(topic))
    setIdx(0)
    setSelected([])
    setChecked(false)
    setWrong(0)
    setCorrect(0)
    setAnswered(0)
    setSaved(null)
    setPhase('intro')
  }

  async function finish(finalCorrect: number, finalAnswered: number) {
    durationMs.current = Date.now() - startedAt.current
    setPhase('result')
    try {
      const res = await recordQuizAttempt({
        topic,
        total: Math.max(1, finalAnswered),
        correct: finalCorrect,
        durationMs: durationMs.current,
      })
      setSaved(res)
      refreshProfile?.()
    } catch (e: any) {
      toast.show(e?.code === '54000' ? t('quiz.v2.res.limit') : t('quiz.v2.res.saveError'), 'error')
    }
  }

  function onCheck() {
    if (!q || !selected.length) return
    const ok = isCorrect(q, selected)
    setChecked(true)
    setAnswered((n) => n + 1)
    if (ok) setCorrect((n) => n + 1)
    else setWrong((n) => n + 1)
  }

  function onContinue() {
    const nextCorrect = correct
    const nextAnswered = answered
    if (lives <= 0 || idx >= round.length - 1) {
      finish(nextCorrect, nextAnswered)
      return
    }
    setIdx((i) => i + 1)
    setSelected([])
    setChecked(false)
  }

  function toggle(id: string) {
    if (checked || !q) return
    if (q.correct.length > 1) {
      setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
    } else {
      setSelected((s) => (s[0] === id ? [] : [id]))
    }
  }

  /* ---------------------------------------------------------------- intro */
  if (phase === 'intro') {
    return (
      <View style={{ flex: 1, backgroundColor: '#FEFBFA' }}>
        <MascotBackdrop source={MASCOT.wave} />
        <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', height: 52 + insets.top }}>
          <CloseButton onPress={close} label={t('ds.close')} />
          <T variant="headingL" color={C.paperInk} style={{ flex: 1, textAlign: 'center', marginRight: 40 }}>
            {t('quiz.v2.intro.title')}
          </T>
        </View>
        <SpeechBubble style={{ marginLeft: 40, marginTop: 8 }}>
          {t('quiz.v2.intro.speech', { n: round.length })}
        </SpeechBubble>
        <View style={{ flex: 1 }} />
        <PaperCard style={{ marginHorizontal: 16, marginBottom: Math.max(insets.bottom, 16) + 8 }}>
          <View style={{ gap: 2 }}>
            <T style={{ fontFamily: F.tomorrowSemibold, fontSize: 12, letterSpacing: 1 }} color={C.paperGreen}>
              {t('quiz.v2.intro.kicker', { n: topic })}
            </T>
            <T style={{ fontFamily: F.tomorrowBold, fontSize: 22 }} color={C.paperInk} accessibilityRole="header">
              {topicName}
            </T>
          </View>
          <PaperStats
            items={[
              { value: String(round.length), label: t('quiz.v2.intro.questions'), tone: 'green' },
              { value: String(LIVES), label: t('quiz.v2.intro.lives'), tone: 'pink' },
              { value: `+${maxXp}`, label: t('quiz.v2.intro.points'), tone: 'gold' },
            ]}
          />
          <PaperButton
            label={t('quiz.v2.start')}
            onPress={() => setPhase('go')}
          />
        </PaperCard>
      </View>
    )
  }

  /* ------------------------------------------------- "Grünes Licht" countdown */
  if (phase === 'go') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <GreenLight
          onDone={() => {
            startedAt.current = Date.now()
            setPhase('play')
          }}
        />
      </View>
    )
  }

  /* ---------------------------------------------------------------- result */
  if (phase === 'result') {
    const total = Math.max(1, answered)
    const pct = Math.round((correct / total) * 100)
    const mastered = saved ? saved.mastered : correct * 5 >= total * 4
    const xp = saved?.xp ?? correct * 10 + (correct === total ? 20 : 0)
    const streak = saved?.streak_days ?? profile?.streak_days ?? 0
    return (
      <View style={{ flex: 1, backgroundColor: mastered ? C.celebrate : C.bg }}>
        {mastered ? (
          <MascotBackdrop source={MASCOT.celebrate} style={{ bottom: 220 }} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top + 20, gap: 12 }}>
            <Image source={MASCOT.think} resizeMode="contain" style={{ width: 200, height: 260 }} accessibilityElementsHidden />
          </View>
        )}
        <View style={{ flex: mastered ? 1 : 0 }} />
        <PaperCard style={{ marginHorizontal: 16, marginBottom: Math.max(insets.bottom, 16) + 8, gap: 14 }}>
          <PaperTitle
            title={mastered ? t('quiz.v2.res.mastered') : t('quiz.v2.res.failed')}
            subtitle={t('quiz.v2.res.topic', { n: topic, title: topicName })}
          />
          {!mastered ? (
            <T style={{ fontFamily: F.tomorrowMedium, fontSize: 14, textAlign: 'center' }} color={C.paperSub}>
              {t('quiz.v2.res.failedBody')}
            </T>
          ) : null}
          <View style={{ alignSelf: 'center', backgroundColor: C.brand, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
            <T style={{ fontFamily: F.tomorrowBold, fontSize: 15 }} color={C.paperDeep}>
              {t('quiz.v2.res.xp', { n: xp })}
            </T>
          </View>
          <PaperStats
            tint="green"
            items={[
              { value: String(streak), label: t('quiz.v2.res.streak'), tone: 'green' },
              { value: `${pct}%`, label: t('quiz.v2.res.correct'), tone: 'green' },
              { value: formatDuration(durationMs.current), label: t('quiz.v2.res.time'), tone: 'pink' },
            ]}
          />
          <PaperButton label={t('quiz.v2.continue')} onPress={close} />
          {!mastered ? <PaperButton variant="soft" label={t('quiz.v2.res.again')} onPress={restart} /> : null}
        </PaperCard>
      </View>
    )
  }

  /* ---------------------------------------------------------------- play */
  if (!q) return null
  const multi = q.correct.length > 1
  const tf = isTrueFalse(q)
  const ok = checked && isCorrect(q, selected)
  const correctAnswer = q.options.filter((o) => q.correct.includes(o.id)).map((o) => text(o, locale)).join(' · ')
  const progress = (idx + (checked ? 1 : 0)) / round.length
  const isLastStep = lives <= 0 || idx >= round.length - 1

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      {/* Top bar: close · progress · hearts */}
      <View style={{ height: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <CloseButton onPress={() => setConfirmExit(true)} label={t('quiz.v2.exit')} />
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={t('quiz.v2.q.progress', { n: idx + 1, total: round.length })}
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
          style={{ flex: 1, height: 14, borderRadius: 7, backgroundColor: C.surface, overflow: 'hidden' }}
        >
          <Animated.View
            style={{
              width: progressFill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              height: 14,
              borderRadius: 7,
              backgroundColor: C.brand,
              shadowColor: C.brand,
              shadowOpacity: 0.5,
              shadowRadius: 8,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }} accessible accessibilityLabel={t('quiz.v2.q.lives', { n: lives })}>
          <Heart size={24} color={C.heart} weight="fill" />
          <T variant="headingM">{String(lives)}</T>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 220, gap: 20 }}>
        {tf ? (
          <>
            <T variant="headingL" accessibilityRole="header">{t('quiz.v2.q.trueFalse')}</T>
            <View style={{ backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 18 }}>
              <T variant="titleM">{text(q.q, locale)}</T>
            </View>
          </>
        ) : (
          <T variant="headingL" accessibilityRole="header">{text(q.q, locale)}</T>
        )}

        {q.image && QUIZ_IMAGES[q.image] ? (
          q.kind === 'sign' ? (
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 140, height: 140, borderRadius: 24, backgroundColor: '#fff', padding: 8, overflow: 'hidden' }}>
                <Image
                  source={QUIZ_IMAGES[q.image]}
                  resizeMode="contain"
                  style={{ width: '100%', height: '100%' }}
                  accessibilityLabel={t('quiz.v2.q.sign')}
                />
              </View>
            </View>
          ) : (
            <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.line, aspectRatio: 16 / 10 }}>
              <Image source={QUIZ_IMAGES[q.image]} resizeMode="cover" style={{ width: '100%', height: '100%' }} accessible={false} />
            </View>
          )
        ) : null}

        {multi ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -6 }}>
            <Info size={18} color={C.brand} />
            <T variant="bodyS" color={C.muted} style={{ flex: 1 }}>{t('quiz.v2.q.multi')}</T>
          </View>
        ) : null}

        {tf ? (
          <View style={{ flexDirection: 'row', gap: 12 }} accessibilityRole="radiogroup">
            {q.options.map((o) => {
              const positive = /^(ja|richtig|wahr)\b/i.test(o.de.trim())
              return (
                <TrueFalseTile
                  key={o.id}
                  label={text(o, locale)}
                  positive={positive}
                  state={optionState(q, o.id, selected, checked)}
                  onPress={() => toggle(o.id)}
                />
              )
            })}
          </View>
        ) : (
          <View style={{ gap: 12 }} accessibilityRole={multi ? undefined : 'radiogroup'}>
            {q.options.map((o) => (
              <OptionRow
                key={o.id}
                label={text(o, locale)}
                multi={multi}
                state={optionState(q, o.id, selected, checked)}
                onPress={() => toggle(o.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {!checked ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 8, paddingTop: 12, backgroundColor: C.bg }}>
          <Button label={t('quiz.v2.check')} onPress={onCheck} disabled={!selected.length} />
        </View>
      ) : (
        <FeedbackSheet
          correct={ok}
          title={ok ? t('quiz.v2.fb.correct') : t('quiz.v2.fb.wrong')}
          correctLine={ok ? undefined : t('quiz.v2.fb.correctIs', { answer: correctAnswer })}
          body={text(q.explain, locale)}
          button={isLastStep ? t('quiz.v2.fb.toResult') : t('quiz.v2.continue')}
          onContinue={onContinue}
          bottomInset={insets.bottom}
        />
      )}

      <Sheet visible={confirmExit} onClose={() => setConfirmExit(false)}>
        <SheetHero icon={SignOut} tone="danger" title={t('quiz.v2.exitTitle')} body={t('quiz.v2.exitBody')} />
        <Button label={t('quiz.v2.keepGoing')} onPress={() => setConfirmExit(false)} />
        <Button
          label={t('quiz.v2.exit')}
          variant="dangerSoft"
          onPress={() => {
            setConfirmExit(false)
            close()
          }}
        />
      </Sheet>
    </View>
  )
}

/* ------------------------------------------------------------------ pieces */

type OptState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dim'

function optionState(q: QuizQuestion, id: string, selected: string[], checked: boolean): OptState {
  const isSel = selected.includes(id)
  if (!checked) return isSel ? 'selected' : 'idle'
  if (q.correct.includes(id)) return 'correct'
  if (isSel) return 'wrong'
  return 'dim'
}

const OPT_STYLE: Record<OptState, { bg: string; border: string; fg: string; width: number }> = {
  idle: { bg: '#121412', border: C.line, fg: C.white, width: 1.5 },
  selected: { bg: C.tile, border: C.brand, fg: C.brand, width: 2 },
  correct: { bg: C.tile, border: C.brand, fg: C.brand, width: 2 },
  wrong: { bg: C.dangerBg, border: C.danger, fg: C.danger, width: 2 },
  dim: { bg: '#121412', border: C.line, fg: C.dim, width: 1.5 },
}

function OptionRow({ label, multi, state, onPress }: { label: string; multi: boolean; state: OptState; onPress: () => void }) {
  const s = OPT_STYLE[state]
  const checked = state === 'selected' || state === 'correct' || state === 'wrong'
  return (
    <Pressable
      onPress={onPress}
      disabled={state === 'correct' || state === 'wrong' || state === 'dim'}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: state === 'selected' || state === 'wrong' || (state === 'correct' && checked) }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderRadius: 18,
          borderWidth: s.width,
          borderColor: s.border,
          backgroundColor: s.bg,
          paddingVertical: 18,
          paddingLeft: 20,
          paddingRight: 18,
        },
        pressed && state === 'idle' ? { opacity: 0.85 } : null,
      ]}
    >
      {multi && (state === 'idle' || state === 'selected') ? (
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            borderWidth: 1.5,
            borderColor: state === 'selected' ? C.brand : C.lineStrong,
            backgroundColor: state === 'selected' ? C.brand : 'transparent',
          }}
        />
      ) : null}
      <T variant="titleM" color={s.fg} style={{ flex: 1 }}>{label}</T>
      {state === 'correct' ? <CheckCircle size={24} color={C.brand} weight="fill" /> : null}
      {state === 'wrong' ? <XCircle size={24} color={C.danger} /> : null}
    </Pressable>
  )
}

function TrueFalseTile({ label, positive, state, onPress }: { label: string; positive: boolean; state: OptState; onPress: () => void }) {
  const s = OPT_STYLE[state]
  const Icon = positive ? CheckCircle : X
  const iconColor = state === 'idle' ? C.muted : s.fg
  return (
    <Pressable
      onPress={onPress}
      disabled={state === 'correct' || state === 'wrong' || state === 'dim'}
      accessibilityRole="radio"
      accessibilityState={{ checked: state === 'selected' }}
      accessibilityLabel={label}
      style={{
        flex: 1,
        height: 130,
        borderRadius: 20,
        borderWidth: s.width,
        borderColor: s.border,
        backgroundColor: s.bg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <Icon size={36} color={iconColor} />
      <T variant="headingM" color={state === 'idle' ? C.white : s.fg}>{label}</T>
    </Pressable>
  )
}

function FeedbackSheet({
  correct,
  title,
  correctLine,
  body,
  button,
  onContinue,
  bottomInset,
}: {
  correct: boolean
  title: string
  correctLine?: string
  body: string
  button: string
  onContinue: () => void
  bottomInset: number
}) {
  return (
    <View
      accessibilityLiveRegion="assertive"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: correct ? C.lineGreen : C.dangerLine,
        backgroundColor: correct ? C.sheetGreen : C.dangerToast,
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: Math.max(bottomInset, 16) + 20,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <MascotAvatar pose={correct ? 'thumbs' : 'think'} />
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="headingL" color={correct ? C.brand : C.danger}>{title}</T>
          {correctLine ? <T variant="bodyS">{correctLine}</T> : null}
          <T variant="bodyS" color={C.muted} numberOfLines={5}>{body}</T>
        </View>
      </View>
      <Button label={button} variant={correct ? 'primary' : 'danger'} onPress={onContinue} />
    </View>
  )
}

function CloseButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        { width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
        pressed ? { opacity: 0.8 } : null,
      ]}
    >
      <X size={22} color={C.white} />
    </Pressable>
  )
}

