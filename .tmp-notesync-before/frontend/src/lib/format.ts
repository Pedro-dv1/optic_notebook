const timeZone = 'America/Sao_Paulo'

export function formatDateTime(value: string) {
  const date = new Intl.DateTimeFormat('pt-BR', { timeZone, day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value))
  return `${date}, ${formatTime(value)}`
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
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
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)!.value).join('-')
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
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`
  if (digits.length < 8 || digits.length > 15) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
