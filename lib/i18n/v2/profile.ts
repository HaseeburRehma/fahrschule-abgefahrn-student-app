/**
 * i18n keys for the "profile" area of the Figma redesign
 * (Profil, Mitteilungen, Chat, Dokumente, Info). Keep DE and EN in sync.
 */
export const de: Record<string, string> = {
  // Profil
  'profile.v2.title': 'Profil',
  'profile.v2.role': 'Fahrschüler, Klasse {cls}',
  'profile.v2.roleAdmin': 'Fahrschule, Admin',
  'profile.v2.section.account': 'Konto',
  'profile.v2.section.app': 'App',
  'profile.v2.section.school': 'Fahrschule',
  'profile.v2.section.admin': 'Verwaltung',
  'profile.v2.editProfile': 'Profil bearbeiten',
  'profile.v2.exams': 'Prüfungstermine',
  'profile.v2.documents': 'Dokumente',
  'profile.v2.language': 'Sprache',
  'profile.v2.push': 'Push-Benachrichtigungen',
  'profile.v2.pushDenied': 'Push-Benachrichtigungen sind in den Systemeinstellungen blockiert',
  'profile.v2.reminders': 'Erinnerungen',
  'profile.v2.biometric': 'App-Sperre',
  'profile.v2.info': 'Info & Kontakt',
  'profile.v2.chat': 'Nachricht senden',
  'profile.v2.admin': 'Admin-Bereich',
  'profile.v2.logout': 'Abmelden',
  'profile.v2.deleteAccount': 'Konto löschen',
  'profile.v2.version': 'Abgefahrn App   Version {v}',

  // Abmelden-Sheet
  'profile.v2.logout.title': 'Abmelden?',
  'profile.v2.logout.body': 'Du wirst aus der App abgemeldet und musst dich erneut anmelden.',
  'profile.v2.logout.confirm': 'Abmelden',

  // Konto löschen
  'profile.v2.delete.title': 'Konto löschen?',
  'profile.v2.delete.body':
    'Dein Konto und alle zugehörigen Daten werden dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.',
  'profile.v2.delete.confirm': 'Endgültig löschen',
  'profile.v2.delete.error': 'Konto konnte nicht gelöscht werden',

  // Sprache-Sheet
  'profile.v2.lang.title': 'Sprache',
  'profile.v2.lang.de': 'Deutsch',
  'profile.v2.lang.en': 'English',
  'profile.v2.lang.valueDe': 'Deutsch',
  'profile.v2.lang.valueEn': 'Englisch',

  // Profil bearbeiten
  'profile.v2.edit.title': 'Profil bearbeiten',
  'profile.v2.edit.save': 'Speichern',
  'profile.v2.edit.saveChanges': 'Änderungen speichern',
  'profile.v2.edit.name': 'Name',
  'profile.v2.edit.namePlaceholder': 'Vor- und Nachname',
  'profile.v2.edit.nameRequired': 'Bitte gib deinen Namen ein',
  'profile.v2.edit.email': 'E-Mail',
  'profile.v2.edit.phone': 'Telefon',
  'profile.v2.edit.phonePlaceholder': '+49 …',
  'profile.v2.edit.birth': 'Geburtsdatum',
  'profile.v2.edit.birthPlaceholder': 'TT.MM.JJJJ',
  'profile.v2.edit.birthInvalid': 'Bitte im Format TT.MM.JJJJ eingeben',
  'profile.v2.edit.saved': 'Profil gespeichert',
  'profile.v2.edit.error': 'Konnte nicht gespeichert werden',

  // Mitteilungen
  'notifications.v2.title': 'Mitteilungen',
  'notifications.v2.markAll': 'Alle gelesen',
  'notifications.v2.new': 'Neu',
  'notifications.v2.earlier': 'Früher',
  'notifications.v2.empty.title': 'Keine Mitteilungen',
  'notifications.v2.empty.body': 'Neuigkeiten zu Terminen, Theorie und Dokumenten erscheinen hier.',
  'notifications.v2.justNow': 'Gerade eben',
  'notifications.v2.minAgo': 'vor {n} Min',
  'notifications.v2.hoursAgo': 'vor {n} Std',
  'notifications.v2.yesterday': 'Gestern',
  'notifications.v2.deleteConfirm': 'Mitteilung löschen?',
  'notifications.v2.deleted': 'Mitteilung gelöscht',

  // Chat
  'chat.v2.title': 'Fahrschule Abgefahrn',
  'chat.v2.status': 'Antwortet meist schnell',
  'chat.v2.placeholder': 'Nachricht schreiben …',
  'chat.v2.today': 'Heute',
  'chat.v2.yesterday': 'Gestern',
  'chat.v2.empty': 'Noch keine Nachrichten. Schreib der Fahrschule!',
  'chat.v2.sendError': 'Nachricht konnte nicht gesendet werden',
  'chat.v2.call': 'Fahrschule anrufen',
  'chat.v2.send': 'Senden',

  // Dokumente
  'documents.v2.title': 'Dokumente',
  'documents.v2.subtitle': 'Von deiner Fahrschule geteilt',
  'documents.v2.empty.title': 'Noch keine Dokumente',
  'documents.v2.empty.body': 'Deine Fahrschule teilt hier Verträge, Nachweise und Bescheinigungen mit dir.',
  'documents.v2.empty.action': 'Fahrschule fragen',
  'documents.v2.download': 'Herunterladen',
  'documents.v2.share': 'Teilen',
  'documents.v2.tapToOpen': 'Tippen zum Öffnen',
  'documents.v2.openError': 'Dokument konnte nicht geöffnet werden',
  'documents.v2.notFound': 'Dokument nicht gefunden',
  'documents.v2.file': 'Datei',

  // Info & Kontakt
  'info.v2.title': 'Info & Kontakt',
  'info.v2.call': 'Anrufen',
  'info.v2.whatsapp': 'WhatsApp',
  'info.v2.email': 'E-Mail',
  'info.v2.route': 'Route',
  'info.v2.hours': 'Öffnungszeiten',
  'info.v2.closed': 'Geschlossen',
  'info.v2.follow': 'Folge uns',
  'info.v2.legal': 'Rechtliches',
  'info.v2.impressum': 'Impressum',
  'info.v2.privacy': 'Datenschutz',
  'info.v2.website': 'Website',
}

export const en: Record<string, string> = {
  // Profile
  'profile.v2.title': 'Profile',
  'profile.v2.role': 'Learner, Class {cls}',
  'profile.v2.roleAdmin': 'Driving school, Admin',
  'profile.v2.section.account': 'Account',
  'profile.v2.section.app': 'App',
  'profile.v2.section.school': 'Driving school',
  'profile.v2.section.admin': 'Administration',
  'profile.v2.editProfile': 'Edit profile',
  'profile.v2.exams': 'Exam dates',
  'profile.v2.documents': 'Documents',
  'profile.v2.language': 'Language',
  'profile.v2.push': 'Push notifications',
  'profile.v2.pushDenied': 'Push notifications are blocked in your system settings',
  'profile.v2.reminders': 'Reminders',
  'profile.v2.biometric': 'App lock',
  'profile.v2.info': 'Info & Contact',
  'profile.v2.chat': 'Send message',
  'profile.v2.admin': 'Admin area',
  'profile.v2.logout': 'Log out',
  'profile.v2.deleteAccount': 'Delete account',
  'profile.v2.version': 'Abgefahrn App   Version {v}',

  // Log out sheet
  'profile.v2.logout.title': 'Log out?',
  'profile.v2.logout.body': "You'll be logged out and need to sign in again.",
  'profile.v2.logout.confirm': 'Log out',

  // Delete account
  'profile.v2.delete.title': 'Delete account?',
  'profile.v2.delete.body':
    'Your account and all related data will be permanently deleted. This cannot be undone.',
  'profile.v2.delete.confirm': 'Delete permanently',
  'profile.v2.delete.error': "Couldn't delete the account",

  // Language sheet
  'profile.v2.lang.title': 'Language',
  'profile.v2.lang.de': 'Deutsch',
  'profile.v2.lang.en': 'English',
  'profile.v2.lang.valueDe': 'German',
  'profile.v2.lang.valueEn': 'English',

  // Edit profile
  'profile.v2.edit.title': 'Edit profile',
  'profile.v2.edit.save': 'Save',
  'profile.v2.edit.saveChanges': 'Save changes',
  'profile.v2.edit.name': 'Name',
  'profile.v2.edit.namePlaceholder': 'First and last name',
  'profile.v2.edit.nameRequired': 'Please enter your name',
  'profile.v2.edit.email': 'Email',
  'profile.v2.edit.phone': 'Phone',
  'profile.v2.edit.phonePlaceholder': '+49 …',
  'profile.v2.edit.birth': 'Date of birth',
  'profile.v2.edit.birthPlaceholder': 'DD.MM.YYYY',
  'profile.v2.edit.birthInvalid': 'Please use the format DD.MM.YYYY',
  'profile.v2.edit.saved': 'Profile saved',
  'profile.v2.edit.error': "Couldn't be saved",

  // Notifications
  'notifications.v2.title': 'Notifications',
  'notifications.v2.markAll': 'Mark all read',
  'notifications.v2.new': 'New',
  'notifications.v2.earlier': 'Earlier',
  'notifications.v2.empty.title': 'No notifications',
  'notifications.v2.empty.body': 'Updates about appointments, theory and documents show up here.',
  'notifications.v2.justNow': 'Just now',
  'notifications.v2.minAgo': '{n} min ago',
  'notifications.v2.hoursAgo': '{n} h ago',
  'notifications.v2.yesterday': 'Yesterday',
  'notifications.v2.deleteConfirm': 'Delete notification?',
  'notifications.v2.deleted': 'Notification deleted',

  // Chat
  'chat.v2.title': 'Fahrschule Abgefahrn',
  'chat.v2.status': 'Usually replies quickly',
  'chat.v2.placeholder': 'Write a message …',
  'chat.v2.today': 'Today',
  'chat.v2.yesterday': 'Yesterday',
  'chat.v2.empty': 'No messages yet. Message the school!',
  'chat.v2.sendError': "Message couldn't be sent",
  'chat.v2.call': 'Call the school',
  'chat.v2.send': 'Send',

  // Documents
  'documents.v2.title': 'Documents',
  'documents.v2.subtitle': 'Shared by your driving school',
  'documents.v2.empty.title': 'No documents yet',
  'documents.v2.empty.body': 'Your driving school shares contracts, records and certificates here.',
  'documents.v2.empty.action': 'Ask the school',
  'documents.v2.download': 'Download',
  'documents.v2.share': 'Share',
  'documents.v2.tapToOpen': 'Tap to open',
  'documents.v2.openError': "Couldn't open the document",
  'documents.v2.notFound': 'Document not found',
  'documents.v2.file': 'File',

  // Info & Contact
  'info.v2.title': 'Info & Contact',
  'info.v2.call': 'Call',
  'info.v2.whatsapp': 'WhatsApp',
  'info.v2.email': 'Email',
  'info.v2.route': 'Directions',
  'info.v2.hours': 'Opening hours',
  'info.v2.closed': 'Closed',
  'info.v2.follow': 'Follow us',
  'info.v2.legal': 'Legal',
  'info.v2.impressum': 'Imprint',
  'info.v2.privacy': 'Privacy policy',
  'info.v2.website': 'Website',
}
