import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatDateTime(value: string) {
  return format(parseISO(value), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })
}

export function formatTime(value: string) {
  return format(parseISO(value), 'HH:mm')
}

export function durationMinutes(value: string) {
  if (value.startsWith('P')) {
    const hours = Number(value.match(/(\d+)H/)?.[1] || 0)
    const minutes = Number(value.match(/(\d+)M/)?.[1] || 0)
    return hours * 60 + minutes
  }
  const match = value.match(/^(?:(\d+)\s+)?(\d+):(\d{2})(?::\d{2}(?:\.\d+)?)?$/)
  if (!match) return 0
  return Number(match[1] || 0) * 1440 + Number(match[2]) * 60 + Number(match[3])
}

export function localDateInput(date = new Date()) {
  return format(date, 'yyyy-MM-dd')
}

export function minutesToDuration(minutes: number) {
  const rounded = Math.round(minutes)
  const hours = Math.floor(rounded / 60).toString().padStart(2, '0')
  return `${hours}:${(rounded % 60).toString().padStart(2, '0')}:00`
}

export type FriendlyDurationUnit = 'hours' | 'days'

export function durationToFriendlyUnit(value: string): { value: number; unit: FriendlyDurationUnit } {
  const minutes = durationMinutes(value)
  return minutes >= 1440 && minutes % 1440 === 0
    ? { value: minutes / 1440, unit: 'days' }
    : { value: minutes / 60, unit: 'hours' }
}

export function friendlyUnitToDuration(value: number, unit: FriendlyDurationUnit) {
  return minutesToDuration(value * (unit === 'days' ? 1440 : 60))
}

export function formatMoney(value: string | null) {
  if (value === null) return null
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
}

export function whatsappUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
