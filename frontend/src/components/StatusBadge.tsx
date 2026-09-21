import { LuCircleCheck as CircleCheck, LuCircleX as CircleX, LuClock3 as Clock } from 'react-icons/lu'
import type { AppointmentStatus, CompanyStatus } from '../types/api'

const labels: Record<AppointmentStatus | CompanyStatus, string> = {
  WAITING_CONFIRMATION: 'Aguardando confirmação',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
}

export function StatusBadge({ status }: { status: AppointmentStatus | CompanyStatus }) {
  const tone = status === 'CONFIRMED' || status === 'ACTIVE' ? 'status-positive' : status === 'WAITING_CONFIRMATION' ? 'status-warning' : 'status-negative'
  const Icon = status === 'CONFIRMED' ? CircleCheck : status === 'CANCELLED' ? CircleX : status === 'WAITING_CONFIRMATION' ? Clock : null
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${tone}`}>
    {Icon ? <Icon className="size-4" aria-hidden="true" /> : <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}{labels[status]}
  </span>
}
