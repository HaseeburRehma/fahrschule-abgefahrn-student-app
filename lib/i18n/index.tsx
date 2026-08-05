/**
 * Lightweight i18n — German default, English translation. No dependency.
 *
 * A single flat DICTIONARY keyed by dot-path. Convention: add a key here when
 * a string is shared in 3+ places; otherwise components inline strings via the
 * local `L(de, en)` helper (see useL below). The chosen locale persists in
 * AsyncStorage under `abgefahrn.locale`; German is the default.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

import type { Locale } from '@/lib/types'

const STORAGE_KEY = 'abgefahrn.locale'

type Dict = Record<string, string>

const DE: Dict = {
  // App chrome
  'app.name': 'Fahrschule Abgefahrn',
  'common.loading': 'Wird geladen…',
  'common.retry': 'Erneut versuchen',
  'common.save': 'Speichern',
  'common.cancel': 'Abbrechen',
  'common.close': 'Schließen',
  'common.back': 'Zurück',
  'common.next': 'Weiter',
  'common.send': 'Senden',
  'common.search': 'Suchen',
  'common.none': 'Keine',
  'common.empty': 'Nichts vorhanden',
  'common.error': 'Etwas ist schiefgelaufen.',
  'common.required': 'Pflichtfeld',
  'common.optional': 'Optional',
  'common.saved': 'Gespeichert.',

  // Tabs
  'tabs.home': 'Start',
  'tabs.notifications': 'Mitteilungen',
  'tabs.theory': 'Theorie',
  'tabs.schedule': 'Termine',
  'tabs.settings': 'Einstellungen',

  // Auth (passwordless OTP)
  'auth.title': 'Anmelden',
  'auth.subtitle': 'Melde dich mit deiner E-Mail-Adresse an.',
  'auth.email': 'E-Mail-Adresse',
  'auth.emailPlaceholder': 'name@beispiel.de',
  'auth.sendCode': 'Code senden',
  'auth.codeSentTitle': 'Code eingeben',
  'auth.codeSentSubtitle': 'Wir haben dir einen 6-stelligen Code an {email} geschickt.',
  'auth.code': '6-stelliger Code',
  'auth.verify': 'Anmelden',
  'auth.resend': 'Code erneut senden',
  'auth.changeEmail': 'E-Mail ändern',
  'auth.checkSpam': 'Keine E-Mail erhalten? Sieh auch im Spam-Ordner nach.',
  'auth.err.notRegistered':
    'Diese E-Mail ist nicht registriert. Bitte wende dich an deine Fahrschule.',
  'auth.err.invalidCode': 'Der Code ist ungültig oder abgelaufen.',
  'auth.err.rateLimited': 'Zu viele Versuche. Bitte warte einen Moment.',
  'auth.err.network': 'Keine Verbindung. Bitte prüfe dein Internet.',
  'auth.err.generic': 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.',

  // Home
  'home.greeting': 'Hallo, {name}!',
  'home.greetingNoName': 'Willkommen!',
  'home.yourPackage': 'Dein Paket',
  'home.yourPackages': 'Deine Pakete',
  'home.noPackage': 'Noch kein Paket zugewiesen.',
  'home.currentTopic': 'Aktuelle Theorieklasse',
  'home.noTopic': 'Noch keine Theorieklasse zugewiesen.',
  'home.nextAppointment': 'Nächster Termin',
  'home.noAppointment': 'Kein Termin geplant.',
  'home.unread': '{count} neue Mitteilungen',
  'home.viewAll': 'Alle ansehen',

  // Notifications
  'notif.title': 'Mitteilungen',
  'notif.empty': 'Keine Mitteilungen.',
  'notif.markAllRead': 'Alle als gelesen markieren',
  'notif.new': 'Neu',

  // Theory
  'theory.title': 'Theoriethemen',
  'theory.subtitle': 'Die 14 Pflicht-Theoriethemen der Grundausbildung.',
  'theory.current': 'Aktuell',
  'theory.topicN': 'Thema {n}',

  // Schedule
  'schedule.title': 'Deine Termine',
  'schedule.empty': 'Keine anstehenden Termine.',
  'schedule.past': 'Vergangen',
  'schedule.upcoming': 'Anstehend',
  'schedule.at': 'um',
  'schedule.location': 'Ort',

  // Settings
  'settings.title': 'Einstellungen',
  'settings.language': 'Sprache',
  'settings.german': 'Deutsch',
  'settings.english': 'Englisch',
  'settings.account': 'Konto',
  'settings.signOut': 'Abmelden',
  'settings.role': 'Rolle',
  'settings.adminArea': 'Admin-Bereich',

  // Admin
  'admin.title': 'Administration',
  'admin.students': 'Fahrschüler',
  'admin.intake': 'Anmeldungen',
  'admin.notify': 'Mitteilung senden',
  'admin.classes': 'Theorieklassen',
  'admin.addStudent': 'Fahrschüler hinzufügen',
  'admin.editStudent': 'Fahrschüler bearbeiten',
  'admin.firstName': 'Vorname',
  'admin.lastName': 'Nachname',
  'admin.phone': 'Telefon',
  'admin.assignPackages': 'Pakete zuweisen',
  'admin.assignTopic': 'Theorieklasse zuweisen',
  'admin.active': 'Aktiv',
  'admin.noStudents': 'Noch keine Fahrschüler.',
  'admin.intakeEmpty': 'Keine offenen Anmeldungen von der Website.',
  'admin.convert': 'In Fahrschüler umwandeln',
  'admin.dismiss': 'Verwerfen',
  'admin.notifyTo': 'Empfänger',
  'admin.notifyAll': 'Alle Fahrschüler',
  'admin.notifyTitle': 'Titel',
  'admin.notifyBody': 'Nachricht',
  'admin.notifySent': 'Mitteilung gesendet.',
  // Classes
  'admin.newClass': 'Neue Theorieklasse',
  'admin.classTitleDe': 'Titel (Deutsch)',
  'admin.classTitleEn': 'Titel (Englisch)',
  'admin.startsAt': 'Beginn',
  'admin.startsAtHint': 'Format: JJJJ-MM-TT SS:MM (z. B. 2026-08-20 18:30)',
  'admin.location': 'Ort',
  'admin.topic': 'Thema',
  'admin.createClass': 'Klasse erstellen',
  'admin.noClasses': 'Noch keine Theorieklassen.',
  'admin.enrolled': 'Angemeldete Fahrschüler',
  'admin.badDate': 'Ungültiges Datum. Bitte JJJJ-MM-TT SS:MM verwenden.',
  'admin.plan': 'Paket',
  'admin.noPlan': 'Kein Paket',
  'admin.noTopic': 'Keine Theorieklasse',
  'admin.delete': 'Fahrschüler löschen',
  'admin.deleteConfirm':
    'Diesen Fahrschüler und alle seine Daten wirklich löschen? Das kann nicht rückgängig gemacht werden.',
  'admin.deleted': 'Gelöscht.',
  'admin.enrolledClasses': 'Angemeldete Klassen',
  'admin.noClassesEnrolled': 'In keiner Klasse angemeldet.',
  'admin.searchStudents': 'Fahrschüler suchen…',
  'common.delete': 'Löschen',
}

const EN: Dict = {
  'app.name': 'Fahrschule Abgefahrn',
  'common.loading': 'Loading…',
  'common.retry': 'Try again',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.send': 'Send',
  'common.search': 'Search',
  'common.none': 'None',
  'common.empty': 'Nothing here',
  'common.error': 'Something went wrong.',
  'common.required': 'Required',
  'common.optional': 'Optional',
  'common.saved': 'Saved.',

  'tabs.home': 'Home',
  'tabs.notifications': 'Notifications',
  'tabs.theory': 'Theory',
  'tabs.schedule': 'Schedule',
  'tabs.settings': 'Settings',

  'auth.title': 'Sign in',
  'auth.subtitle': 'Sign in with your email address.',
  'auth.email': 'Email address',
  'auth.emailPlaceholder': 'name@example.com',
  'auth.sendCode': 'Send code',
  'auth.codeSentTitle': 'Enter code',
  'auth.codeSentSubtitle': 'We sent a 6-digit code to {email}.',
  'auth.code': '6-digit code',
  'auth.verify': 'Sign in',
  'auth.resend': 'Resend code',
  'auth.changeEmail': 'Change email',
  'auth.checkSpam': "Didn't get an email? Check your spam folder too.",
  'auth.err.notRegistered':
    'This email is not registered. Please contact your driving school.',
  'auth.err.invalidCode': 'The code is invalid or has expired.',
  'auth.err.rateLimited': 'Too many attempts. Please wait a moment.',
  'auth.err.network': 'No connection. Please check your internet.',
  'auth.err.generic': 'Sign-in failed. Please try again.',

  'home.greeting': 'Hi, {name}!',
  'home.greetingNoName': 'Welcome!',
  'home.yourPackage': 'Your package',
  'home.yourPackages': 'Your packages',
  'home.noPackage': 'No package assigned yet.',
  'home.currentTopic': 'Current theory class',
  'home.noTopic': 'No theory class assigned yet.',
  'home.nextAppointment': 'Next appointment',
  'home.noAppointment': 'No appointment scheduled.',
  'home.unread': '{count} new notifications',
  'home.viewAll': 'View all',

  'notif.title': 'Notifications',
  'notif.empty': 'No notifications.',
  'notif.markAllRead': 'Mark all as read',
  'notif.new': 'New',

  'theory.title': 'Theory topics',
  'theory.subtitle': 'The 14 mandatory theory topics of basic training.',
  'theory.current': 'Current',
  'theory.topicN': 'Topic {n}',

  'schedule.title': 'Your appointments',
  'schedule.empty': 'No upcoming appointments.',
  'schedule.past': 'Past',
  'schedule.upcoming': 'Upcoming',
  'schedule.at': 'at',
  'schedule.location': 'Location',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.german': 'German',
  'settings.english': 'English',
  'settings.account': 'Account',
  'settings.signOut': 'Sign out',
  'settings.role': 'Role',
  'settings.adminArea': 'Admin area',

  'admin.title': 'Administration',
  'admin.students': 'Students',
  'admin.intake': 'Sign-ups',
  'admin.notify': 'Send notification',
  'admin.classes': 'Theory classes',
  'admin.addStudent': 'Add student',
  'admin.editStudent': 'Edit student',
  'admin.firstName': 'First name',
  'admin.lastName': 'Last name',
  'admin.phone': 'Phone',
  'admin.assignPackages': 'Assign packages',
  'admin.assignTopic': 'Assign theory class',
  'admin.active': 'Active',
  'admin.noStudents': 'No students yet.',
  'admin.intakeEmpty': 'No pending sign-ups from the website.',
  'admin.convert': 'Convert to student',
  'admin.dismiss': 'Dismiss',
  'admin.notifyTo': 'Recipient',
  'admin.notifyAll': 'All students',
  'admin.notifyTitle': 'Title',
  'admin.notifyBody': 'Message',
  'admin.notifySent': 'Notification sent.',
  'admin.newClass': 'New theory class',
  'admin.classTitleDe': 'Title (German)',
  'admin.classTitleEn': 'Title (English)',
  'admin.startsAt': 'Starts at',
  'admin.startsAtHint': 'Format: YYYY-MM-DD HH:MM (e.g. 2026-08-20 18:30)',
  'admin.location': 'Location',
  'admin.topic': 'Topic',
  'admin.createClass': 'Create class',
  'admin.noClasses': 'No theory classes yet.',
  'admin.enrolled': 'Enrolled students',
  'admin.badDate': 'Invalid date. Please use YYYY-MM-DD HH:MM.',
  'admin.plan': 'Package',
  'admin.noPlan': 'No package',
  'admin.noTopic': 'No theory class',
  'admin.delete': 'Delete student',
  'admin.deleteConfirm':
    'Delete this student and all their data? This cannot be undone.',
  'admin.deleted': 'Deleted.',
  'admin.enrolledClasses': 'Enrolled classes',
  'admin.noClassesEnrolled': 'Not enrolled in any class.',
  'admin.searchStudents': 'Search students…',
  'common.delete': 'Delete',
}

const DICTIONARY: Record<Locale, Dict> = { de: DE, en: EN }

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] != null ? String(vars[k]) : `{${k}}`,
  )
}

interface I18nContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('de') // German default

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((s) => {
      if (s === 'de' || s === 'en') setLocaleState(s)
    })
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {})
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const raw = DICTIONARY[locale][key] ?? DICTIONARY.en[key] ?? key
      return interpolate(raw, vars)
    },
    [locale],
  )

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    // Safe fallback (German) if used outside the provider.
    return {
      locale: 'de',
      setLocale: () => {},
      t: (key) => DICTIONARY.de[key] ?? key,
    }
  }
  return ctx
}

/**
 * Convenience for inline strings that don't warrant a dictionary key.
 * const L = useL(); L('Hallo', 'Hello')
 */
export function useL() {
  const { locale } = useTranslation()
  return (de: string, en: string) => (locale === 'de' ? de : en)
}
