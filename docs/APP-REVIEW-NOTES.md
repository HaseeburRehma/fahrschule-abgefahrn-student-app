# App Review notes — reply to Guideline 2.1 (Information Needed), 2026-10-31

Paste the block below into App Store Connect → version 1.0.0 → App Review Information → **Notes**
(limit 4,000 characters) and attach the screen recording under **Attachment**.
Before recording / resubmitting, re-run the demo SQL (`supabase/scripts/demo_student_for_app_review.local.sql`)
so the demo student's lesson, streak and quiz history are current again.

---

SCREEN RECORDING
Attached: recorded on an iPhone running the latest iOS with TestFlight build 1.0.0. It starts at app launch and shows sign-up, login, the main features (progress, theory topics + quiz, appointments, booking, exams, chat, documents) and account deletion (Profil > Konto löschen).

1. PURPOSE AND AUDIENCE
Fahrschule Abgefahrn is the official companion app of a driving school in Düsseldorf, Germany (Verkehrsfahrschule Abgefahrn 5.0 Düsseldorf GmbH). It is for learner drivers training for a German class B licence. Students see their progress through the licence steps, learn the 14 theory topics with a quiz (daily goal, streak, badges, weekly league), see and request driving lessons, track exam dates, receive school notifications and documents, and chat with the school. It replaces paper booklets, phone calls and WhatsApp for organising the training.

2. ACCESS AND SETUP
Demo account (student with sample data): see Sign-In Information.
- Login: Anmelden > e-mail + password from Sign-In Information.
- Sign-up: Registrieren needs the school code the school gives its students at enrolment. School code for review: ABG-2026. The demo account already contains everything, so sign-up is optional for review.
- Main areas: tabs Start, Theorie, Termine, Fortschritt, Profil. Theorie-Quiz and Liga are on the Start tab (Schnellzugriff).
- Account deletion: Profil > Konto löschen > confirm. It permanently deletes the account and all its data (profile, lessons, quiz results, notifications).
No sample files are needed.

3. EXTERNAL SERVICES
- Supabase: authentication, database, file storage for documents, server functions, realtime chat.
- Expo Push Service / Apple Push Notification service: lesson and school notifications.
- Have I Been Pwned "Pwned Passwords" range API: our server rejects known-breached passwords at sign-up; only a 5-character hash prefix is sent (k-anonymity).
- Links that open outside the app: Google Maps (route to the school), Google Calendar (add a lesson), WhatsApp, phone/e-mail, the school website and its social media pages.
No payments, ads, analytics or AI services.

4. REGIONS
The app works the same in every region. It is in German and English; content is about the German driving licence.

5. CONTENT AND RIGHTS
The app is operated by the driving school itself (copyright holder above). Traffic-sign graphics are official German traffic signs (public domain under § 5 UrhG); quiz questions and texts were written for the app. No regulated services are sold in the app.

6. USER-GENERATED CONTENT
There is no public user-generated content. The chat is a private conversation between one student and the driving school's staff. The weekly quiz league shows other students only as first name + initial and XP. Students cannot message or share content with other students.

GUIDELINE 3.2
The app is for the school's current and future students. New students find and install it from the App Store themselves before or at enrolment, which is why it is publicly listed. If you prefer, we can switch to Unlisted App Distribution.

---

# Recording script (iPhone, latest iOS, TestFlight build 12)

Before you start
1. Re-run `supabase/scripts/demo_student_for_app_review.local.sql` in the Supabase SQL editor
   (the demo lesson was 30 Oct and is in the past now; this refreshes lesson, streak and quiz data).
2. Install build 12 from TestFlight (build 11 drops button and card styles on iOS — do not record on it). Have the school sign-up code and a throw-away e-mail
   address ready (e.g. a `+test` alias of your own) for the registration part.
3. Control Center → add Screen Recording if it isn't there. Do Not Disturb on (no private notifications in the video).

Record (one take, ~3 minutes; Apple wants it to start at app launch)
1. Start recording on the home screen, tap the Abgefahrn icon (cold launch).
2. Welcome slides → Registrieren → fill name, throw-away e-mail, password, school code, accept AGB → Konto erstellen
   → "Konto erstellt" → allow notifications → Start screen.
3. Show the main flow quickly: Start → Theorie → open a topic → "Quiz zu diesem Thema" → Quiz starten
   → answer one question → Prüfen → Weiter → close. Termine → "+" booking form (don't send).
   Fortschritt. Profil.
4. Profil → Konto löschen → confirm → app returns to the welcome/login screen (account deletion, required by Apple).
5. Anmelden with the demo account (appreview@fahrschule-abgefahrn.de — not an admin account; the reviewer must not see Admin-Bereich or real student data) → show Start with data,
   Theorie-Quiz/Tagesziel, Liga, a booked lesson in Termine, Chat.
6. Stop recording. Send the original file from Photos (AirDrop / Files), not via WhatsApp — WhatsApp shrinks it to 384×848.
