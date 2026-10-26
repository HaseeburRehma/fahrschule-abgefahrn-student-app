import { describe, expect, it } from 'vitest'
import { BANK, buildRound, isCorrect, isTrueFalse, questionsForTopic, ROUND_SIZE, shuffle } from '@/lib/quiz/bank'
import { QUIZ_IMAGES } from '@/lib/quiz/images'

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32
    return seed / 2 ** 32
  }
}

describe('question bank', () => {
  it('is well-formed: DE+EN text, valid answers, unique ids', () => {
    const ids = new Set<string>()
    for (const q of BANK) {
      expect(ids.has(q.id), q.id).toBe(false)
      ids.add(q.id)
      expect(q.topic).toBeGreaterThanOrEqual(1)
      expect(q.topic).toBeLessThanOrEqual(14)
      expect(q.q.de && q.q.en, q.id).toBeTruthy()
      expect(q.options.length).toBeGreaterThanOrEqual(2)
      const optIds = new Set(q.options.map((o) => o.id))
      expect(q.correct.length).toBeGreaterThan(0)
      for (const c of q.correct) expect(optIds.has(c), `${q.id} → ${c}`).toBe(true)
      for (const o of q.options) expect(o.de && o.en, `${q.id}/${o.id}`).toBeTruthy()
    }
  })

  it('every referenced image is bundled', () => {
    for (const q of BANK) if (q.image) expect(QUIZ_IMAGES[q.image], q.image).toBeDefined()
  })

  it('every topic can build a round of at least 6 questions', () => {
    for (let topic = 1; topic <= 14; topic++) {
      const round = buildRound(topic, ROUND_SIZE, seeded(topic))
      expect(round.length, `topic ${topic}`).toBeGreaterThanOrEqual(6)
      expect(round.length).toBeLessThanOrEqual(ROUND_SIZE)
      expect(new Set(round.map((q) => q.id)).size).toBe(round.length)
    }
  })

  it('prefers the topic\'s own questions', () => {
    const own = questionsForTopic(8)
    const round = buildRound(8, ROUND_SIZE, seeded(1))
    expect(round.every((q) => q.topic === 8)).toBe(own.length >= ROUND_SIZE)
  })
})

describe('answer checking', () => {
  const multi = BANK.find((q) => q.correct.length > 1)!
  it('needs the exact set of correct options', () => {
    expect(isCorrect(multi, multi.correct)).toBe(true)
    expect(isCorrect(multi, [...multi.correct].reverse())).toBe(true)
    expect(isCorrect(multi, multi.correct.slice(1))).toBe(false)
    expect(isCorrect(multi, [])).toBe(false)
    const wrongOpt = multi.options.find((o) => !multi.correct.includes(o.id))
    if (wrongOpt) expect(isCorrect(multi, [...multi.correct, wrongOpt.id])).toBe(false)
  })

  it('only treats two-option yes/no questions as true/false', () => {
    expect(isTrueFalse(multi)).toBe(false)
    const tf = BANK.filter(isTrueFalse)
    for (const q of tf) expect(q.options).toHaveLength(2)
  })

  it('shuffle keeps every element', () => {
    const a = Array.from({ length: 50 }, (_, i) => i)
    expect(shuffle(a, seeded(7)).sort((x, y) => x - y)).toEqual(a)
  })
})
