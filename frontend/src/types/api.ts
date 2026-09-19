export type CompanyStatus = 'ACTIVE' | 'SUSPENDED'
export type AppointmentStatus = 'WAITING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED'

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
  is_superuser: boolean
  company: CompanySummary | null
}

export interface Company {
  id?: string
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
  id: string
  name: string
  is_active?: boolean
  service_ids: string[]
}

export interface WorkSchedule {
  id: string
  professional: string
  weekday: number
  starts_at: string
  ends_at: string
}

export interface Appointment {
  id: string
  company: string
  company_name: string
  company_slug: string
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
}

export interface RegistrationKey {
  id: string
  state: 'ACTIVE' | 'INACTIVE' | 'CONSUMED'
  created_by: string
  consumed_by_company: string | null
  created_at: string
  consumed_at: string | null
}
