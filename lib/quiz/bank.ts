/**
 * Theorie-Quiz question bank (Klasse B, DE/EN).
 *
 * bank.json is exported from the Fahrschule Mocktest question catalogue and
 * assigned to the 14 Grundstoff topics by keyword rules (see the export script
 * notes in docs/QUIZ.md). The school can re-assign questions by editing
 * `topic` in bank.json.
 */

import type { Locale } from '@/lib/types'
import raw from './bank.json'

export type QuizKind = 'sign' | 'scene' | 'text'

export interface QuizOption {
  id: string
  de: string
  en: string
}

export interface QuizQuestion {
  id: string
  /** Grundstoff topic number 1–14 (matches theory_topics.number) */
  topic: number
  points: number
  kind: QuizKind
  /** file name in assets/quiz (see QUIZ_IMAGES) */
  image?: string
  q: { de: string; en: string }
  options: QuizOption[]
  correct: string[]
  explain: { de: string; en: string }
}

export const BANK: QuizQuestion[] = raw as QuizQuestion[]

/** Questions per round (Figma: "Schaffst du alle 10 Fragen am Stück?"). */
export const ROUND_SIZE = 10
/** Lives per round (Figma hearts). */
export const LIVES = 5

/**
 * Topics with only a handful of questions borrow from closely related ones so
 * a round is never trivially short.
 */
const RELATED: Record<number, number[]> = {
  1: [2],
  2: [1, 12],
  3: [12],
  12: [2, 3],
}
const MIN_OWN = 6

export function questionsForTopic(topic: number): QuizQuestion[] {
  return BANK.filter((q) => q.topic === topic)
}

/** Fisher–Yates with an injectable RNG (tests pass a seeded one). */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** A round for one topic: own questions first, related topics top up thin ones. */
export function buildRound(topic: number, size = ROUND_SIZE, rng: () => number = Math.random): QuizQuestion[] {
  const own = shuffle(questionsForTopic(topic), rng)
  if (own.length >= Math.min(size, MIN_OWN) || !RELATED[topic]) return own.slice(0, size)
  const extra = shuffle(
    BANK.filter((q) => RELATED[topic].includes(q.topic)),
    rng,
  )
  return [...own, ...extra].slice(0, size)
}

export function text(t: { de: string; en: string }, locale: Locale): string {
  return (locale === 'en' ? t.en : t.de) || t.de
}

export function isCorrect(q: QuizQuestion, selected: readonly string[]): boolean {
  if (selected.length !== q.correct.length) return false
  const s = new Set(selected)
  return q.correct.every((id) => s.has(id))
}

/** Figma "Richtig oder falsch?" layout: exactly two options that read as yes/no. */
export function isTrueFalse(q: QuizQuestion): boolean {
  if (q.options.length !== 2 || q.correct.length !== 1) return false
  const words = q.options.map((o) => o.de.trim().toLowerCase())
  return words.every((w) => /^(ja|nein|richtig|falsch|wahr)\b/.test(w))
}
