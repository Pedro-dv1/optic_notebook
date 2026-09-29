import { LuCircleCheck as CircleCheck, LuCircleX as CircleX, LuClock3 as Clock } from 'react-icons/lu'
import type { AppointmentOutcome, AppointmentStatus, CompanyStatus } from '../types/api'

const labels: Record<CompanyStatus, string> = {
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
}

export function getAppointmentStatusMeta(status: AppointmentStatus, outcome?: AppointmentOutcome) {
  if (status === 'CANCELLED') return { label: 'Cancelado', tone: 'status-negative', Icon: CircleX }
  if (outcome === 'COMPLETED') return { label: 'Concluído', tone: 'status-positive', Icon: CircleCheck }
  if (outcome === 'NO_SHOW') return { label: 'Não compareceu', tone: 'status-negative', Icon: CircleX }
  if (status === 'CONFIRMED') return { label: 'Confirmado', tone: 'status-positive', Icon: CircleCheck }
  return { label: 'Aguardando confirmação', tone: 'status-warning', Icon: Clock }
}

export function StatusBadge({ status, outcome }: { status: AppointmentStatus | CompanyStatus; outcome?: AppointmentOutcome }) {
  const meta = status === 'ACTIVE' || status === 'SUSPENDED'
    ? { label: labels[status], tone: status === 'ACTIVE' ? 'status-positive' : 'status-negative', Icon: null }
    : getAppointmentStatusMeta(status, outcome)
  const { label, tone, Icon } = meta
  return <span className={`inline-flex max-w-full items-center gap-1.5 text-xs font-medium ${tone}`}>
    {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />}<span className="min-w-0">{label}</span>
  </span>
}
