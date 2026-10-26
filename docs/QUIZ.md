# Theorie-Quiz & Gamification

Figma: "09 · Spielerisch & Maskottchen" and "11 · Mehr Spielerisch" (page *Mobile App*).

## Screens

| Route | Figma |
|---|---|
| `/quiz/[topic]` | Quiz Intro → Schild / Wahr-Falsch / Multiple Choice → Feedback Richtig/Falsch → Lektion gemeistert |
| `/daily-goal` | 11/Tagesziel |
| `/streak` | 09/Streak |
| `/league` | 09/Liga |
| `/badges` | 09/Abzeichen |

Entry points: Theorie detail ("Quiz zu diesem Thema"), Home Schnellzugriff (Theorie-Quiz, Liga),
the streak chip on Home, Fortschritt (Liga, Abzeichen).

## Questions

`lib/quiz/bank.json` holds 238 Klasse-B questions (DE/EN) exported from the Fahrschule Mocktest
catalogue (video questions excluded). Each question was assigned to one of the 14 Grundstoff topics by
keyword rules over the German text; check the assignment and change `topic` in `bank.json` where needed.
Images live in `assets/quiz` (re-encoded to ≤720 px JPEG) and are mapped in `lib/quiz/images.ts`.

Topic 12 (Sicherheit durch Lernen) has very few questions, so its rounds borrow from topics 2 and 3
(see `RELATED` in `lib/quiz/bank.ts`).

## Rules

- 10 questions per round, 5 lives; a round ends early when the lives run out.
- XP: 10 per correct answer, +20 for a perfect round. "Gemeistert" = at least 80 % correct.
- XP and "gemeistert" are computed by the database (`record_quiz_attempt`), max. 40 rounds per day.
- Tagesziel: 2 rounds per day. Liga: weekly XP, Monday–Sunday (Europe/Berlin), top 20 + you,
  only first name + last-name initial are shown, and only students who played this week.
- Abzeichen are all derived from real data (profile flags, topics done, quiz history).

## Database

Apply `supabase/migrations/20261026000001_quiz_gamification.sql`. Until it is applied, the quiz
still runs but results can't be saved, and Liga shows an error.
