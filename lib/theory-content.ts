/**
 * Bundled content for the 14 mandatory theory topics (Grundstoff Klasse B).
 * Summarised from Fahrschule Abgefahrn's own topic PDFs (Thema 01–14).
 *
 * Used as a fallback when the DB columns `description_*` / `learn_points_*`
 * (migration 20261005000001) are empty or not yet applied. The same content is
 * seeded by supabase/migrations/20261005000002_theory_content.sql — keep both in sync.
 *
 * `short_*` are the compact titles used in the Figma list / detail screens.
 */

import type { Locale, TheoryTopic } from '@/lib/types'

export type TopicContent = {
  short_de: string
  short_en: string
  description_de: string
  description_en: string
  learn_points_de: string[]
  learn_points_en: string[]
}

export const THEORY_CONTENT: Record<number, TopicContent> = {
  1: {
    short_de: 'Persönliche Voraussetzungen',
    short_en: 'Personal requirements',
    description_de:
      'Hier lernst du, wann du körperlich und geistig fit genug zum Fahren bist – und was dich fahruntüchtig macht: schlechte Sicht, Krankheit, Müdigkeit, Ablenkung, Alkohol, Drogen und Medikamente.',
    description_en:
      'Learn when you are physically and mentally fit to drive – and what makes you unfit: poor eyesight, illness, fatigue, distraction, alcohol, drugs and medication.',
    learn_points_de: [
      'Sehtest und Mindest-Sehschärfe',
      'Alarmsignale für Müdigkeit erkennen',
      'Handy-Regeln und Ablenkung vermeiden',
      'Promillegrenzen und Alkoholabbau',
      'Drogen und Medikamente am Steuer',
    ],
    learn_points_en: [
      'Eye test and minimum visual acuity',
      'Recognise the warning signs of fatigue',
      'Phone rules and avoiding distraction',
      'Blood-alcohol limits and how alcohol breaks down',
      'Drugs and medication behind the wheel',
    ],
  },
  2: {
    short_de: 'Risikofaktor Mensch',
    short_en: 'Human risk factor',
    description_de:
      'Die größte Gefahr beim Fahren ist der Mensch selbst. Du lernst, wo die Grenzen von Reaktion und Wahrnehmung liegen und wie du Emotionen am Steuer im Griff behältst.',
    description_en:
      'The biggest risk when driving is the driver. Learn where the limits of reaction and perception lie and how to keep your emotions under control behind the wheel.',
    learn_points_de: [
      'Reaktionszeit und Reaktionsweg',
      'Grenzen der Sinneswahrnehmung',
      'Emotionen erkennen und kontrollieren',
      'Selbstbild, Fremdbild und Fahrerrollen',
    ],
    learn_points_en: [
      'Reaction time and reaction distance',
      'Limits of sensory perception',
      'Recognising and controlling emotions',
      'Self-image, external image and driver roles',
    ],
  },
  3: {
    short_de: 'Rechtliche Rahmenbedingungen',
    short_en: 'Legal framework',
    description_de:
      'Das rechtliche Fundament für alles auf der Straße: die Grundregel der StVO, Führerschein und Fahrerlaubnis, Probezeit, Punkte in Flensburg und die Hauptuntersuchung.',
    description_en:
      'The legal foundation for everything on the road: the basic rule of the StVO, licence and driving permit, probation period, penalty points and the vehicle inspection.',
    learn_points_de: [
      'Aufbau und Grundregel der StVO',
      'Führerscheinklasse B und ihre Varianten',
      'Probezeit mit A- und B-Verstößen',
      'Punkte im Fahreignungsregister',
      'Hauptuntersuchung und Betriebssicherheit',
    ],
    learn_points_en: [
      'Structure and basic rule of the StVO',
      'Licence class B and its variants',
      'Probation period with A and B offences',
      'Points in the driving aptitude register',
      'Vehicle inspection and roadworthiness',
    ],
  },
  4: {
    short_de: 'Straßenverkehrssystem & Bahnübergänge',
    short_en: 'Road system & level crossings',
    description_de:
      'Wie das Straßensystem aufgebaut ist und welche Regeln wo gelten – von Fahrbahnmarkierungen über die Autobahn bis zum sicheren Verhalten an Bahnübergängen.',
    description_en:
      'How the road system is built and which rules apply where – from road markings and the motorway to behaving safely at level crossings.',
    learn_points_de: [
      'Fahrbahnmarkierungen und Rechtsfahrgebot',
      'Auf die Autobahn einfahren und überholen',
      'Stau, Panne und Rettungsgasse',
      'Bahnübergänge und Andreaskreuz',
    ],
    learn_points_en: [
      'Road markings and keeping right',
      'Joining the motorway and overtaking',
      'Traffic jams, breakdowns and emergency corridors',
      'Level crossings and the St Andrew’s cross',
    ],
  },
  5: {
    short_de: 'Vorfahrt & Verkehrsregelungen',
    short_en: 'Right of way & traffic rules',
    description_de:
      'Vorfahrtfehler gehören zu den häufigsten Unfallursachen. Hier lernst du die Rangfolge von Polizei über Ampel und Schilder bis Rechts vor Links – inklusive Kreisverkehr.',
    description_en:
      'Right-of-way errors are among the most common causes of accidents. Learn the order from police and traffic lights to signs and right before left – including roundabouts.',
    learn_points_de: [
      'Rangfolge der Vorfahrtregelungen',
      'Rechts vor Links sicher anwenden',
      'Vorfahrtschilder und Stoppschild',
      'Kreisverkehr richtig ein- und ausfahren',
      'Ampelphasen und grüner Pfeil',
    ],
    learn_points_en: [
      'Hierarchy of right-of-way rules',
      'Applying right before left',
      'Right-of-way signs and the stop sign',
      'Entering and leaving roundabouts',
      'Traffic light phases and the green arrow',
    ],
  },
  6: {
    short_de: 'Verkehrszeichen & Einrichtungen',
    short_en: 'Traffic signs & devices',
    description_de:
      'Über 400 Verkehrszeichen – aber wer das System aus Form und Farbe kennt, muss nicht alle auswendig lernen. Du lernst die Logik hinter Gefahr-, Vorschrift- und Richtzeichen.',
    description_en:
      'Over 400 traffic signs – but once you know the system of shape and colour you don’t have to memorise them all. Learn the logic behind warning, regulatory and direction signs.',
    learn_points_de: [
      'Form und Farbe der Zeichen verstehen',
      'Gefahrzeichen richtig deuten',
      'Verbote und Gebote erkennen',
      'Richtzeichen, Sinnbilder und Zusatzzeichen',
    ],
    learn_points_en: [
      'Understanding sign shapes and colours',
      'Reading warning signs correctly',
      'Recognising prohibitions and mandatory signs',
      'Direction signs, symbols and supplementary signs',
    ],
  },
  7: {
    short_de: 'Verkehrsteilnehmer',
    short_en: 'Road users',
    description_de:
      'Im Straßenverkehr bist du nie allein. Du lernst, wie du dich gegenüber Fußgängern, Radfahrern, Bussen, Motorrädern und Lkw richtig verhältst.',
    description_en:
      'You are never alone on the road. Learn how to behave correctly towards pedestrians, cyclists, buses, motorcycles and lorries.',
    learn_points_de: [
      'Fußgänger und Zebrastreifen',
      'Busse, Straßenbahnen und Schulbusse',
      'Sicherheitsabstand zu Radfahrern',
      'Lkw und der tote Winkel',
      'Tempo-30-Zone und Spielstraße',
    ],
    learn_points_en: [
      'Pedestrians and zebra crossings',
      'Buses, trams and school buses',
      'Safe passing distance to cyclists',
      'Lorries and the blind spot',
      '30 km/h zones and play streets',
    ],
  },
  8: {
    short_de: 'Geschwindigkeit',
    short_en: 'Speed',
    description_de:
      'Das Thema mit den meisten Rechenaufgaben in der Prüfung. Mit den Faustformeln für Reaktionsweg, Bremsweg und Anhalteweg löst du fast alle Fragen sicher.',
    description_en:
      'The topic with the most calculation questions in the exam. With the rules of thumb for reaction, braking and stopping distance you can solve almost every question.',
    learn_points_de: [
      'Reaktions-, Brems- und Anhalteweg berechnen',
      'Sicherheitsabstand richtig einschätzen',
      'Tempolimits innerorts und außerorts',
      'Umweltbewusst und spritsparend fahren',
    ],
    learn_points_en: [
      'Calculating reaction, braking and stopping distance',
      'Judging a safe following distance',
      'Speed limits in and outside towns',
      'Eco-friendly, fuel-saving driving',
    ],
  },
  9: {
    short_de: 'Verkehrsbeobachtung & Fahrmanöver',
    short_en: 'Observation & manoeuvres',
    description_de:
      'Fahrmanöver sind der häufigste Stolperstein – meist wegen eines vergessenen Schulterblicks. Du lernst jeden Schritt beim Einfahren, Überholen, Abbiegen und Wenden.',
    description_en:
      'Manoeuvres are the most common stumbling block – usually because of a forgotten shoulder check. Learn every step of pulling out, overtaking, turning and reversing.',
    learn_points_de: [
      'Spiegel, Schulterblick und toter Winkel',
      'Sicher anfahren und einfahren',
      'Überholen: Regeln und Verbote',
      'Abbiegen Schritt für Schritt',
      'Rückwärtsfahren und Wenden',
    ],
    learn_points_en: [
      'Mirrors, shoulder checks and the blind spot',
      'Pulling away and merging safely',
      'Overtaking: rules and prohibitions',
      'Turning step by step',
      'Reversing and turning around',
    ],
  },
  10: {
    short_de: 'Ruhender Verkehr',
    short_en: 'Stationary traffic',
    description_de:
      'Hier lernst du alles rund ums Parken und Halten: wo du halten darfst, wo Parken verboten ist und welche Abstände gelten.',
    description_en:
      'Learn everything about parking and stopping: where you may stop, where parking is forbidden and which distances apply.',
    learn_points_de: [
      'Halten und Parken unterscheiden',
      'Halt- und Parkverbote erkennen',
      'Abstände zu Kreuzungen & Einfahrten',
      'Parken an Steigung und Gefälle',
    ],
    learn_points_en: [
      'Tell stopping and parking apart',
      'Recognise no-stopping & no-parking zones',
      'Distances to junctions & driveways',
      'Parking on slopes and inclines',
    ],
  },
  11: {
    short_de: 'Verhalten in besonderen Situationen',
    short_en: 'Special situations',
    description_de:
      'Von der Nebelschlussleuchte bis zur Ersten Hilfe: Du lernst, wie du in Situationen richtig handelst, in denen es um Sicherheit und manchmal um Leben geht.',
    description_en:
      'From the rear fog light to first aid: learn how to act correctly in situations where safety – and sometimes lives – are at stake.',
    learn_points_de: [
      'Richtige Beleuchtung je nach Situation',
      'Blaulicht und Einsatzfahrzeuge',
      'Verhalten nach einem Unfall',
      'Fahren im Tunnel',
      'Erste Hilfe – die Grundmaßnahmen',
    ],
    learn_points_en: [
      'The right lights for every situation',
      'Blue lights and emergency vehicles',
      'What to do after an accident',
      'Driving through tunnels',
      'First aid – the basics',
    ],
  },
  12: {
    short_de: 'Sicherheit durch Lernen',
    short_en: 'Safety through learning',
    description_de:
      'Sicherheit ist kein Zustand, sondern muss aktiv erhalten werden. Du lernst, wer im Verkehr besonders gefährdet ist, warum – und was Fahranfänger dagegen tun können.',
    description_en:
      'Safety isn’t a state – it has to be maintained. Learn who is most at risk on the road, why – and what new drivers can do about it.',
    learn_points_de: [
      'Unfallstatistik richtig lesen',
      'Risikogruppe Fahranfänger',
      'Probezeit und Regeln für junge Fahrer',
      'Lebenslanges Lernen und Fahrsicherheitstraining',
    ],
    learn_points_en: [
      'Understanding accident statistics',
      'New drivers as a risk group',
      'Probation and rules for young drivers',
      'Lifelong learning and safety training',
    ],
  },
  13: {
    short_de: 'Technik, Beförderung & Umwelt',
    short_en: 'Technology, transport & environment',
    description_de:
      'Von ABS über ESP bis zur Knautschzone: Du lernst, wie dein Fahrzeug funktioniert, wie du es verkehrssicher hältst und was beim Umweltschutz gilt.',
    description_en:
      'From ABS and ESP to the crumple zone: learn how your car works, how to keep it roadworthy and what the rules on environmental protection are.',
    learn_points_de: [
      'Abfahrtkontrolle nach WOLKEN',
      'Bremsen und Reifen prüfen',
      'Fahrphysik, aktive und passive Sicherheit',
      'Fahrerassistenzsysteme wie ABS und ESP',
      'Umweltzonen und Verkehrsverbote',
    ],
    learn_points_en: [
      'Pre-drive check (WOLKEN)',
      'Checking brakes and tyres',
      'Driving physics, active and passive safety',
      'Driver-assistance systems such as ABS and ESP',
      'Low-emission zones and traffic bans',
    ],
  },
  14: {
    short_de: 'Solofahrzeuge & Kombinationen',
    short_en: 'Solo vehicles & combinations',
    description_de:
      'Das letzte Theoriethema: Fahren mit und ohne Anhänger. Du lernst, was beim Anhängerbetrieb, in Kurven, im Gefälle und beim Transport von Personen und Ladung gilt.',
    description_en:
      'The last theory topic: driving with and without a trailer. Learn what applies when towing, in bends, on downhill slopes and when carrying passengers and cargo.',
    learn_points_de: [
      'Anhänger: Führerschein und Gewichte',
      'Schlingern erkennen und abfangen',
      'Kurven, Gefälle und Winterbedingungen',
      'Kindersitze und Airbag',
      'Ladung richtig sichern',
    ],
    learn_points_en: [
      'Trailers: licence and weights',
      'Recognising and controlling trailer sway',
      'Bends, downhill slopes and winter conditions',
      'Child seats and airbags',
      'Securing your load properly',
    ],
  },
}

/** Compact title (Figma) for a topic, falling back to the DB title. */
export function topicTitle(topic: Pick<TheoryTopic, 'number' | 'title_de' | 'title_en'>, locale: Locale): string {
  const c = THEORY_CONTENT[topic.number]
  if (c) return locale === 'de' ? c.short_de : c.short_en
  return (locale === 'de' ? topic.title_de : topic.title_en) || topic.title_de || topic.title_en || ''
}

/** Description + learn points: DB values when present, bundled content otherwise. */
export function topicDetail(
  topic: TheoryTopic,
  locale: Locale,
): { description: string | null; learnPoints: string[] } {
  const c = THEORY_CONTENT[topic.number]
  const dbDesc = locale === 'de' ? topic.description_de : topic.description_en
  const dbPoints = locale === 'de' ? topic.learn_points_de : topic.learn_points_en
  const description = (typeof dbDesc === 'string' ? dbDesc.trim() : '') || (c ? (locale === 'de' ? c.description_de : c.description_en) : null)
  const learnPoints =
    Array.isArray(dbPoints) && dbPoints.length ? dbPoints.filter((x) => typeof x === 'string' && x.trim()) : c ? (locale === 'de' ? c.learn_points_de : c.learn_points_en) : []
  return { description, learnPoints }
}
