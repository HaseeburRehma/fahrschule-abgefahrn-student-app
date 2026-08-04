-- ============================================================================
-- Seed data — service packages + the 14 theory topics.
-- Idempotent: re-running updates existing rows (keyed by key / number).
-- ============================================================================

-- ── packages (from the website's "Online Anmeldung" price list) ─────────────
insert into public.packages (key, name_de, name_en, price_eur, sort) values
  ('grundbetrag',     'Grundbetrag (Neuanmeldung)', 'Base fee (new registration)', 99.00,  1),
  ('intensivkurs',    'Intensivkurs',                'Intensive course',            359.00, 2),
  ('umschreibung',    'Umschreibung',                'License conversion',          219.00, 3),
  ('verlaengerung',   'Verlängerung',                'Extension',                   100.00, 4),
  ('fahrschulwechsel','Fahrschulwechsel',            'Driving-school transfer',     0.00,   5),
  ('be_anmeldung',    'BE Anmeldung',                'BE registration',             150.00, 6),
  ('auffrischung',    'Auffrischung',                'Refresher',                   50.00,  7),
  ('lernapp',         'LernApp',                     'Learning app',                50.00,  8)
on conflict (key) do update set
  name_de = excluded.name_de,
  name_en = excluded.name_en,
  price_eur = excluded.price_eur,
  sort = excluded.sort;

-- ── theory_topics (14 mandatory basic-training topics) ──────────────────────
insert into public.theory_topics (number, title_de, title_en) values
  (1,  'Persönliche Voraussetzungen',                                      'Personal requirements'),
  (2,  'Risikofaktor Mensch',                                              'Human risk factor'),
  (3,  'Rechtliche Rahmenbedingungen',                                     'Legal framework'),
  (4,  'Straßenverkehrssystem und Bahnübergänge',                          'Road traffic system & level crossings'),
  (5,  'Grundregeln, Vorfahrt und Verkehrsregelungen',                     'Basic rule, right-of-way & traffic regulations'),
  (6,  'Verkehrszeichen und Verkehrseinrichtungen',                        'Traffic signs and traffic control devices'),
  (7,  'Verkehrsteilnehmer im Straßenverkehr',                             'Participants in road traffic'),
  (8,  'Geschwindigkeit',                                                  'Speed'),
  (9,  'Verkehrsbeobachtung und Verhalten bei Fahrmanövern',               'Traffic observation & behavior during driving maneuvers'),
  (10, 'Ruhender Verkehr',                                                 'Stationary traffic'),
  (11, 'Verhalten in besonderen Situationen',                             'Behavior in special situations'),
  (12, 'Sicherheit durch stetiges Lernen',                                 'Safety through continuous learning'),
  (13, 'Technische Bedingungen, Personen-/Güterbeförderung, Umweltschutz', 'Technical conditions, passenger & freight transport and environmental protection'),
  (14, 'Fahren von Einzelfahrzeugen und Fahrzeugkombinationen',            'Driving solo vehicles and vehicle combinations')
on conflict (number) do update set
  title_de = excluded.title_de,
  title_en = excluded.title_en;
