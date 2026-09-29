export type CompanyStatus = 'ACTIVE' | 'SUSPENDED'
export interface Feedback {
  id: string
  public_id: string
  user_name: string
  user_email: string
  company: string | null
  company_name: string | null
  professional: string | null
  professional_name: string | null
  user_type: 'CLIENT' | 'ADMIN' | 'PROFESSIONAL'
  category: 'BUG' | 'SUGGESTION' | 'FEATURE_REQUEST' | 'UX' | 'OTHER'
  title: string
  description: string
  status: 'NEW' | 'REVIEWING' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  page_url: string
  browser: string
  browser_version: string
  operating_system: string
  device_type: string
  app_version: string
  created_at: string
  updated_at: string
  attachments: { id: number; original_filename: string; file_type: string; created_at: string }[]
  replies: { id: number; author_name: string; message: string; is_internal: boolean; created_at: string }[]
}
export type AppointmentStatus = 'WAITING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED'
export type AppointmentOutcome = 'COMPLETED' | 'NO_SHOW' | null

export interface CompanySummary {
  id: string
  name: string
  slug: string
  status: CompanyStatus
}

export interface User {
  id: string
  email: string
  full_name: string
  whatsapp: string
  avatar: string | null
  notification_preference?: boolean | null
  is_superuser: boolean
  company: CompanySummary | null
  professional?: { id: string; name: string; company: string; company_name?: string; company_slug?: string } | null
  role?: 'platform' | 'company' | 'professional' | 'customer'
}

export interface Company {
  id?: string
  units?: CompanyUnit[]
  owner?: string
  name: string
  slug: string
  tax_identifier?: string
  whatsapp: string
  address: string
  city: string
  state: string
  niche: string
  niche_custom?: string
  niche_label: string
  business_type: string
  business_type_custom?: string
  business_type_label: string
  public_notes: string
  status: CompanyStatus
  logo: string | null
  created_at?: string
  updated_at?: string
  appointments_this_month?: number
  appointments_previous_month?: number
  total_appointments?: number
  views_this_month?: number
  views_previous_month?: number
  total_views?: number
  unique_visitors_this_month?: number
  unique_visitors_previous_month?: number
}

export interface CompanySearchResult {
  id?: string
  units?: CompanyUnit[]
  average_rating: number | null
  review_count: number
  name: string
  slug: string
  city: string
  state: string
  niche: string
  niche_label: string
  business_type: string
  business_type_label: string
  address: string
  public_notes: string
  logo: string | null
}

export interface CompanyOption {
  value: string
  label: string
}

export interface PublicPlatformConfig {
  name: string
  support_email: string
  company_options: {
    states: CompanyOption[]
    niches: CompanyOption[]
    business_types: CompanyOption[]
    business_types_by_niche?: Record<string, string[]>
  }
}

export function isPublicPlatformConfig(value: unknown): value is PublicPlatformConfig {
  if (!value || typeof value !== 'object') return false
  const config = value as Partial<PublicPlatformConfig>
  const options = config.company_options
  return typeof config.name === 'string'
    && typeof config.support_email === 'string'
    && Boolean(options)
    && Array.isArray(options?.states)
    && Array.isArray(options?.niches)
    && Array.isArray(options?.business_types)
    && (options?.business_types_by_niche === undefined || typeof options.business_types_by_niche === 'object')
}

export interface PlatformMetrics {
  total_companies: number
  active_companies: number
  appointments_this_month: number
  total_appointments: number
  views_this_month: number
  unique_visitors_this_month: number
}

export interface Service {
  unit_ids?: string[]
  id: string
  name: string
  description: string
  price: string | null
  duration: string
  slot_interval: string
  is_active?: boolean
  professional_ids?: string[]
}

export interface Professional {
  unit_ids?: string[]
  id: string
  name: string
  is_active?: boolean
  service_ids: string[]
  access_active?: boolean
  access_email?: string | null
  invite_state?: 'ACTIVE' | 'USED' | 'REVOKED' | 'EXPIRED' | null
}

export interface WorkSchedule {
  unit?: string | null
  id: string
  professional: string
  weekday: number
  starts_at: string
  ends_at: string
}

export interface Appointment {
  unit?: string | null
  unit_name?: string
  unit_address?: string
  unit_city?: string
  unit_state?: string
  cancellation_reason?: string
  id: string
  company: string
  company_name: string
  company_slug: string
  company_logo: string | null
  company_address: string
  company_city: string
  company_state: string
  service: string
  service_name: string
  professional: string
  professional_name: string
  starts_at: string
  ends_at: string
  customer_name: string
  customer_email: string
  customer_whatsapp: string
  customer_notes: string
  customer_avatar: string | null
  status: AppointmentStatus
  outcome: AppointmentOutcome
  outcome_recorded_at: string | null
  origin: 'CUSTOMER' | 'ADMIN' | 'PROFESSIONAL'
  late_status: 'WITHIN_TOLERANCE' | 'EXCEEDED' | null
  can_record_outcome: boolean
  reviewed: boolean
  can_cancel: boolean
  can_reschedule: boolean
  whatsapp_message: string
  management_token?: string
}

export interface AvailabilitySlot {
  professional: string
  professional_name: string
  starts_at: string
  ends_at: string
}

export interface CompanyUnit {
  id: string
  name: string
  address: string
  city: string
  state: string
  is_active: boolean
  is_primary: boolean
}

export interface CompanyFavorite {
  id: string
  company: string
  company_details: CompanySearchResult
  created_at: string
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface CompanyCustomer {
  name: string
  email: string
  whatsapp: string
  avatar: string | null
  last_appointment_at: string
}

export interface BookingSettings {
  late_tolerance: string
  minimum_change_notice: string
  whatsapp_waiting_message: string
  whatsapp_confirmed_message: string
  whatsapp_cancelled_message: string
  updated_at: string
  late_tolerance_warning: string
}

export interface Unavailability {
  id: string
  professional: string
  starts_at: string
  ends_at: string
  kind: 'HOURS' | 'DAY_OFF' | 'VACATION' | 'APPOINTMENT' | 'OTHER'
  reason: string
}

export interface CompanyReport {
  total: number
  completed: number
  cancelled: number
  no_show: number
  attendance_rate: number
  no_show_rate: number
  services: Array<{ service__name: string; total: number }>
  professionals: Array<{ professional__name: string; total: number }>
  weekdays: Array<{ value: number; total: number }>
  hours: Array<{ value: number; total: number }>
  recurring_customers: Array<{ customer_email: string; customer_name: string; total: number }>
}

export interface Review {
  id: string
  appointment: string
  rating: number
  comment: string
  company_response: string
  customer_name: string
  verified: boolean
  created_at: string
}

export interface RegistrationKey {
  id: string
  state: 'ACTIVE' | 'INACTIVE' | 'CONSUMED'
  created_by: string
  consumed_by_company: string | null
  created_at: string
  consumed_at: string | null
}
