import { describe, expect, it, vi } from 'vitest'

// helpers.ts pulls in phosphor icons (react-native-svg); the title logic doesn't need them.
vi.mock('phosphor-react-native/src/icons/BookOpen', () => ({ BookOpen: () => null }))
vi.mock('phosphor-react-native/src/icons/Exam', () => ({ Exam: () => null }))
vi.mock('phosphor-react-native/src/icons/Moon', () => ({ Moon: () => null }))
vi.mock('phosphor-react-native/src/icons/RoadHorizon', () => ({ RoadHorizon: () => null }))
vi.mock('phosphor-react-native/src/icons/SteeringWheel', () => ({ SteeringWheel: () => null }))

import { lessonTitle, storedLessonTitle } from '../components/schedule/helpers'

const DE: Record<string, string> = {
  'schedule.v2.title.lesson': 'Fahrstunde',
  'schedule.v2.type.autobahn': 'Autobahnfahrt',
  'schedule.v2.type.night': 'Nachtfahrt',
  'schedule.v2.type.overland': 'Überlandfahrt',
}
const EN: Record<string, string> = {
  'schedule.v2.title.lesson': 'Lesson',
  'schedule.v2.type.autobahn': 'Highway drive',
  'schedule.v2.type.night': 'Night drive',
  'schedule.v2.type.overland': 'Country road drive',
}
const tDe = (k: string) => DE[k] ?? k
const tEn = (k: string) => EN[k] ?? k

describe('storedLessonTitle', () => {
  it('always stores German titles, whatever the UI language', () => {
    expect(storedLessonTitle('lesson')).toBe('Fahrstunde')
    expect(storedLessonTitle('autobahn')).toBe('Autobahnfahrt')
    expect(storedLessonTitle('night')).toBe('Nachtfahrt')
    expect(storedLessonTitle('overland')).toBe('Überlandfahrt')
  })
})

describe('lessonTitle', () => {
  it('shows German titles in German and translates them to English', () => {
    expect(lessonTitle({ title: 'Fahrstunde' }, tDe, 'de')).toBe('Fahrstunde')
    expect(lessonTitle({ title: 'Autobahnfahrt' }, tEn, 'en')).toBe('Highway drive')
  })

  it('translates titles that were stored in English back to German', () => {
    expect(lessonTitle({ title: 'Driving lesson' }, tDe, 'de')).toBe('Fahrstunde')
    expect(lessonTitle({ title: 'Highway drive' }, tDe, 'de')).toBe('Autobahnfahrt')
    expect(lessonTitle({ title: ' night drive ' }, tDe, 'de')).toBe('Nachtfahrt')
  })

  it('keeps custom titles as the school entered them', () => {
    expect(lessonTitle({ title: 'Probefahrt mit Papa' }, tDe, 'de')).toBe('Probefahrt mit Papa')
    expect(lessonTitle({ title: 'Probefahrt mit Papa' }, tEn, 'en')).toBe('Probefahrt mit Papa')
  })

  it('round-trips every stored title in both languages', () => {
    for (const kind of ['lesson', 'autobahn', 'night', 'overland'] as const) {
      const stored = storedLessonTitle(kind)
      expect(lessonTitle({ title: stored }, tDe, 'de')).toBe(stored)
      expect(lessonTitle({ title: stored }, tEn, 'en')).not.toBe(stored)
    }
  })
})
