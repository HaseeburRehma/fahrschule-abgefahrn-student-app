/**
 * Domain types — mirror the Supabase schema in supabase/migrations/.
 * Column names use snake_case to match Postgres/PostgREST responses.
 */

export type UserRole = 'admin' | 'student'
export type Locale = 'de' | 'en'

export interface Profile {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  role: UserRole
  locale: Locale
  is_active: boolean
  push_token: string | null
  push_token_platform: string | null
  push_token_updated_at: string | null
  current_theory_topic_id: string | null
  driving_lessons_count: number
  drive_autobahn: boolean
  drive_night: boolean
  drive_overland: boolean
  theory_exam_date: string | null
  practical_exam_date: string | null
  theory_passed: boolean | null
  practical_passed: boolean | null
  created_at: string
  updated_at: string
}

export interface Package {
  id: string
  key: string
  name_de: string
  name_en: string
  price_eur: number
  sort: number
}

export interface StudentPackage {
  student_id: string
  package_id: string
  created_at: string
}

export interface TheoryTopic {
  id: string
  number: number
  title_de: string
  title_en: string
}

export interface TheoryClass {
  id: string
  topic_id: string | null
  title_de: string
  title_en: string
  starts_at: string
  ends_at: string | null
  location: string | null
  notes: string | null
  created_at: string
}

export interface ClassEnrollment {
  student_id: string
  class_id: string
  created_at: string
}

export type NotificationType =
  | 'general'
  | 'schedule'
  | 'reminder'
  | 'theory'
  | 'package'

export interface NotificationRow {
  id: string
  user_id: string
  title: string
  body: string | null
  type: NotificationType
  data: Record<string, any> | null
  is_read: boolean
  created_at: string
}

export type IntakeStatus = 'pending' | 'converted' | 'dismissed'

export interface SignupIntake {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  service_label: string | null
  payment: string | null
  raw: Record<string, any> | null
  status: IntakeStatus
  created_at: string
}
