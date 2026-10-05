/**
 * Genuine Fahrschule Abgefahrn contact + legal info (from the official site,
 * fahrschule-abgefahrn.de/impressum). Facts only; the legal pages themselves
 * are linked, not reproduced.
 */

export const SCHOOL = {
  legalName: 'Hashtag Fahrschule Abgefahrn GmbH',
  street: 'Ellerstraße 53',
  city: '40227 Düsseldorf',
  phone: '0211 41 60 91 12',
  phoneTel: '+4921141609112',
  mobile: '+49 173 6192716',
  mobileTel: '+491736192716',
  whatsapp: '491736192716', // wa.me format (no +)
  email: 'info@fahrschule-abgefahrn.de',
  hours: [
    { de: 'Montag – Freitag', en: 'Monday – Friday', time: '10:30 – 19:00' },
    { de: 'Samstag', en: 'Saturday', time: '10:30 – 15:00' },
    { de: 'Sonntag', en: 'Sunday', time: 'geschlossen / closed', closed: true },
  ],
  impressumUrl: 'https://fahrschule-abgefahrn.de/impressum/',
  datenschutzUrl: 'https://fahrschule-abgefahrn.de/datenschutz/',
  websiteUrl: 'https://fahrschule-abgefahrn.de/',
  /** Official social profiles (linked from fahrschule-abgefahrn.de). */
  social: {
    instagram: 'https://www.instagram.com/fahrschule_abgefahrn/',
    facebook: 'https://www.facebook.com/Fahrschuleabgefahrn',
    tiktok: 'https://www.tiktok.com/@fahrschule_abgefahrn',
    youtube: 'https://www.youtube.com/@fahrschuleabgefahrn',
  },
}

export const mapsUrl = () =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${SCHOOL.legalName}, ${SCHOOL.street}, ${SCHOOL.city}`,
  )}`

export const whatsappUrl = () => `https://wa.me/${SCHOOL.whatsapp}`
