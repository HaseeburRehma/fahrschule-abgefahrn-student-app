-- Theory topic detail content (Theorie Detail screen): description + "Das lernst du" points.
-- Summarised from Fahrschule Abgefahrn's own topic PDFs (Thema 01–14).
-- Same content as the bundled fallback in lib/theory-content.ts — keep both in sync.
-- Requires 20261005000001_redesign_v2.sql (adds the columns). Idempotent.

-- Thema 01: Persönliche Voraussetzungen
update public.theory_topics set
  description_de = 'Hier lernst du, wann du körperlich und geistig fit genug zum Fahren bist – und was dich fahruntüchtig macht: schlechte Sicht, Krankheit, Müdigkeit, Ablenkung, Alkohol, Drogen und Medikamente.',
  description_en = 'Learn when you are physically and mentally fit to drive – and what makes you unfit: poor eyesight, illness, fatigue, distraction, alcohol, drugs and medication.',
  learn_points_de = array[
    'Sehtest und Mindest-Sehschärfe',
    'Alarmsignale für Müdigkeit erkennen',
    'Handy-Regeln und Ablenkung vermeiden',
    'Promillegrenzen und Alkoholabbau',
    'Drogen und Medikamente am Steuer'
  ],
  learn_points_en = array[
    'Eye test and minimum visual acuity',
    'Recognise the warning signs of fatigue',
    'Phone rules and avoiding distraction',
    'Blood-alcohol limits and how alcohol breaks down',
    'Drugs and medication behind the wheel'
  ]
where number = 1;

-- Thema 02: Risikofaktor Mensch
update public.theory_topics set
  description_de = 'Die größte Gefahr beim Fahren ist der Mensch selbst. Du lernst, wo die Grenzen von Reaktion und Wahrnehmung liegen und wie du Emotionen am Steuer im Griff behältst.',
  description_en = 'The biggest risk when driving is the driver. Learn where the limits of reaction and perception lie and how to keep your emotions under control behind the wheel.',
  learn_points_de = array[
    'Reaktionszeit und Reaktionsweg',
    'Grenzen der Sinneswahrnehmung',
    'Emotionen erkennen und kontrollieren',
    'Selbstbild, Fremdbild und Fahrerrollen'
  ],
  learn_points_en = array[
    'Reaction time and reaction distance',
    'Limits of sensory perception',
    'Recognising and controlling emotions',
    'Self-image, external image and driver roles'
  ]
where number = 2;

-- Thema 03: Rechtliche Rahmenbedingungen
update public.theory_topics set
  description_de = 'Das rechtliche Fundament für alles auf der Straße: die Grundregel der StVO, Führerschein und Fahrerlaubnis, Probezeit, Punkte in Flensburg und die Hauptuntersuchung.',
  description_en = 'The legal foundation for everything on the road: the basic rule of the StVO, licence and driving permit, probation period, penalty points and the vehicle inspection.',
  learn_points_de = array[
    'Aufbau und Grundregel der StVO',
    'Führerscheinklasse B und ihre Varianten',
    'Probezeit mit A- und B-Verstößen',
    'Punkte im Fahreignungsregister',
    'Hauptuntersuchung und Betriebssicherheit'
  ],
  learn_points_en = array[
    'Structure and basic rule of the StVO',
    'Licence class B and its variants',
    'Probation period with A and B offences',
    'Points in the driving aptitude register',
    'Vehicle inspection and roadworthiness'
  ]
where number = 3;

-- Thema 04: Straßenverkehrssystem & Bahnübergänge
update public.theory_topics set
  description_de = 'Wie das Straßensystem aufgebaut ist und welche Regeln wo gelten – von Fahrbahnmarkierungen über die Autobahn bis zum sicheren Verhalten an Bahnübergängen.',
  description_en = 'How the road system is built and which rules apply where – from road markings and the motorway to behaving safely at level crossings.',
  learn_points_de = array[
    'Fahrbahnmarkierungen und Rechtsfahrgebot',
    'Auf die Autobahn einfahren und überholen',
    'Stau, Panne und Rettungsgasse',
    'Bahnübergänge und Andreaskreuz'
  ],
  learn_points_en = array[
    'Road markings and keeping right',
    'Joining the motorway and overtaking',
    'Traffic jams, breakdowns and emergency corridors',
    'Level crossings and the St Andrew’s cross'
  ]
where number = 4;

-- Thema 05: Vorfahrt & Verkehrsregelungen
update public.theory_topics set
  description_de = 'Vorfahrtfehler gehören zu den häufigsten Unfallursachen. Hier lernst du die Rangfolge von Polizei über Ampel und Schilder bis Rechts vor Links – inklusive Kreisverkehr.',
  description_en = 'Right-of-way errors are among the most common causes of accidents. Learn the order from police and traffic lights to signs and right before left – including roundabouts.',
  learn_points_de = array[
    'Rangfolge der Vorfahrtregelungen',
    'Rechts vor Links sicher anwenden',
    'Vorfahrtschilder und Stoppschild',
    'Kreisverkehr richtig ein- und ausfahren',
    'Ampelphasen und grüner Pfeil'
  ],
  learn_points_en = array[
    'Hierarchy of right-of-way rules',
    'Applying right before left',
    'Right-of-way signs and the stop sign',
    'Entering and leaving roundabouts',
    'Traffic light phases and the green arrow'
  ]
where number = 5;

-- Thema 06: Verkehrszeichen & Einrichtungen
update public.theory_topics set
  description_de = 'Über 400 Verkehrszeichen – aber wer das System aus Form und Farbe kennt, muss nicht alle auswendig lernen. Du lernst die Logik hinter Gefahr-, Vorschrift- und Richtzeichen.',
  description_en = 'Over 400 traffic signs – but once you know the system of shape and colour you don’t have to memorise them all. Learn the logic behind warning, regulatory and direction signs.',
  learn_points_de = array[
    'Form und Farbe der Zeichen verstehen',
    'Gefahrzeichen richtig deuten',
    'Verbote und Gebote erkennen',
    'Richtzeichen, Sinnbilder und Zusatzzeichen'
  ],
  learn_points_en = array[
    'Understanding sign shapes and colours',
    'Reading warning signs correctly',
    'Recognising prohibitions and mandatory signs',
    'Direction signs, symbols and supplementary signs'
  ]
where number = 6;

-- Thema 07: Verkehrsteilnehmer
update public.theory_topics set
  description_de = 'Im Straßenverkehr bist du nie allein. Du lernst, wie du dich gegenüber Fußgängern, Radfahrern, Bussen, Motorrädern und Lkw richtig verhältst.',
  description_en = 'You are never alone on the road. Learn how to behave correctly towards pedestrians, cyclists, buses, motorcycles and lorries.',
  learn_points_de = array[
    'Fußgänger und Zebrastreifen',
    'Busse, Straßenbahnen und Schulbusse',
    'Sicherheitsabstand zu Radfahrern',
    'Lkw und der tote Winkel',
    'Tempo-30-Zone und Spielstraße'
  ],
  learn_points_en = array[
    'Pedestrians and zebra crossings',
    'Buses, trams and school buses',
    'Safe passing distance to cyclists',
    'Lorries and the blind spot',
    '30 km/h zones and play streets'
  ]
where number = 7;

-- Thema 08: Geschwindigkeit
update public.theory_topics set
  description_de = 'Das Thema mit den meisten Rechenaufgaben in der Prüfung. Mit den Faustformeln für Reaktionsweg, Bremsweg und Anhalteweg löst du fast alle Fragen sicher.',
  description_en = 'The topic with the most calculation questions in the exam. With the rules of thumb for reaction, braking and stopping distance you can solve almost every question.',
  learn_points_de = array[
    'Reaktions-, Brems- und Anhalteweg berechnen',
    'Sicherheitsabstand richtig einschätzen',
    'Tempolimits innerorts und außerorts',
    'Umweltbewusst und spritsparend fahren'
  ],
  learn_points_en = array[
    'Calculating reaction, braking and stopping distance',
    'Judging a safe following distance',
    'Speed limits in and outside towns',
    'Eco-friendly, fuel-saving driving'
  ]
where number = 8;

-- Thema 09: Verkehrsbeobachtung & Fahrmanöver
update public.theory_topics set
  description_de = 'Fahrmanöver sind der häufigste Stolperstein – meist wegen eines vergessenen Schulterblicks. Du lernst jeden Schritt beim Einfahren, Überholen, Abbiegen und Wenden.',
  description_en = 'Manoeuvres are the most common stumbling block – usually because of a forgotten shoulder check. Learn every step of pulling out, overtaking, turning and reversing.',
  learn_points_de = array[
    'Spiegel, Schulterblick und toter Winkel',
    'Sicher anfahren und einfahren',
    'Überholen: Regeln und Verbote',
    'Abbiegen Schritt für Schritt',
    'Rückwärtsfahren und Wenden'
  ],
  learn_points_en = array[
    'Mirrors, shoulder checks and the blind spot',
    'Pulling away and merging safely',
    'Overtaking: rules and prohibitions',
    'Turning step by step',
    'Reversing and turning around'
  ]
where number = 9;

-- Thema 10: Ruhender Verkehr
update public.theory_topics set
  description_de = 'Hier lernst du alles rund ums Parken und Halten: wo du halten darfst, wo Parken verboten ist und welche Abstände gelten.',
  description_en = 'Learn everything about parking and stopping: where you may stop, where parking is forbidden and which distances apply.',
  learn_points_de = array[
    'Halten und Parken unterscheiden',
    'Halt- und Parkverbote erkennen',
    'Abstände zu Kreuzungen & Einfahrten',
    'Parken an Steigung und Gefälle'
  ],
  learn_points_en = array[
    'Tell stopping and parking apart',
    'Recognise no-stopping & no-parking zones',
    'Distances to junctions & driveways',
    'Parking on slopes and inclines'
  ]
where number = 10;

-- Thema 11: Verhalten in besonderen Situationen
update public.theory_topics set
  description_de = 'Von der Nebelschlussleuchte bis zur Ersten Hilfe: Du lernst, wie du in Situationen richtig handelst, in denen es um Sicherheit und manchmal um Leben geht.',
  description_en = 'From the rear fog light to first aid: learn how to act correctly in situations where safety – and sometimes lives – are at stake.',
  learn_points_de = array[
    'Richtige Beleuchtung je nach Situation',
    'Blaulicht und Einsatzfahrzeuge',
    'Verhalten nach einem Unfall',
    'Fahren im Tunnel',
    'Erste Hilfe – die Grundmaßnahmen'
  ],
  learn_points_en = array[
    'The right lights for every situation',
    'Blue lights and emergency vehicles',
    'What to do after an accident',
    'Driving through tunnels',
    'First aid – the basics'
  ]
where number = 11;

-- Thema 12: Sicherheit durch Lernen
update public.theory_topics set
  description_de = 'Sicherheit ist kein Zustand, sondern muss aktiv erhalten werden. Du lernst, wer im Verkehr besonders gefährdet ist, warum – und was Fahranfänger dagegen tun können.',
  description_en = 'Safety isn’t a state – it has to be maintained. Learn who is most at risk on the road, why – and what new drivers can do about it.',
  learn_points_de = array[
    'Unfallstatistik richtig lesen',
    'Risikogruppe Fahranfänger',
    'Probezeit und Regeln für junge Fahrer',
    'Lebenslanges Lernen und Fahrsicherheitstraining'
  ],
  learn_points_en = array[
    'Understanding accident statistics',
    'New drivers as a risk group',
    'Probation and rules for young drivers',
    'Lifelong learning and safety training'
  ]
where number = 12;

-- Thema 13: Technik, Beförderung & Umwelt
update public.theory_topics set
  description_de = 'Von ABS über ESP bis zur Knautschzone: Du lernst, wie dein Fahrzeug funktioniert, wie du es verkehrssicher hältst und was beim Umweltschutz gilt.',
  description_en = 'From ABS and ESP to the crumple zone: learn how your car works, how to keep it roadworthy and what the rules on environmental protection are.',
  learn_points_de = array[
    'Abfahrtkontrolle nach WOLKEN',
    'Bremsen und Reifen prüfen',
    'Fahrphysik, aktive und passive Sicherheit',
    'Fahrerassistenzsysteme wie ABS und ESP',
    'Umweltzonen und Verkehrsverbote'
  ],
  learn_points_en = array[
    'Pre-drive check (WOLKEN)',
    'Checking brakes and tyres',
    'Driving physics, active and passive safety',
    'Driver-assistance systems such as ABS and ESP',
    'Low-emission zones and traffic bans'
  ]
where number = 13;

-- Thema 14: Solofahrzeuge & Kombinationen
update public.theory_topics set
  description_de = 'Das letzte Theoriethema: Fahren mit und ohne Anhänger. Du lernst, was beim Anhängerbetrieb, in Kurven, im Gefälle und beim Transport von Personen und Ladung gilt.',
  description_en = 'The last theory topic: driving with and without a trailer. Learn what applies when towing, in bends, on downhill slopes and when carrying passengers and cargo.',
  learn_points_de = array[
    'Anhänger: Führerschein und Gewichte',
    'Schlingern erkennen und abfangen',
    'Kurven, Gefälle und Winterbedingungen',
    'Kindersitze und Airbag',
    'Ladung richtig sichern'
  ],
  learn_points_en = array[
    'Trailers: licence and weights',
    'Recognising and controlling trailer sway',
    'Bends, downhill slopes and winter conditions',
    'Child seats and airbags',
    'Securing your load properly'
  ]
where number = 14;

