import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu'
import { api, apiErrorMessage } from '../api/client'
import { formatTime, localDateInput } from '../lib/format'
import type { Appointment, Paginated } from '../types/api'
import { StatusBadge } from './StatusBadge'
import { Button, Dialog, EmptyState, LoadingState, Notice } from './ui'

export function CustomerCalendar({ onDetails }: { onDetails: (item: Appointment) => void }) {
  const [month, setMonth] = useState(() => localDateInput().slice(0, 7))
  const [selectedDay, setSelectedDay] = useState('')
  const [page, setPage] = useState(1)
  const first = new Date(`${month}-01T12:00:00Z`)
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth()+1, 0)).getUTCDate()
  const leadingDays = (first.getUTCDay()+6)%7
  const cells = Math.ceil((leadingDays+count)/7)*7
  const today = localDateInput()
  const params = new URLSearchParams({ start_date: `${month}-01`, end_date: `${month}-${count}` })
  const query = useQuery({ queryKey: ['customer-calendar', month], queryFn: ({ signal }) => api.get<{ days: Array<{ date: string; count: number }>; events: Appointment[] }>(`/customers/appointments/calendar/?${params}`, { signal }) })
  const dayQuery = useQuery({ queryKey: ['customer-calendar-day', selectedDay, page], queryFn: ({ signal }) => api.get<Paginated<Appointment>>(`/customers/appointments/?start_date=${selectedDay}&end_date=${selectedDay}&page=${page}`, { signal }), enabled: Boolean(selectedDay) })
  const navigate = (offset: number) => {
    const date = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth()+offset, 1, 12))
    setMonth(date.toISOString().slice(0, 7))
  }
  const counts = new Map(query.data?.days.map((day) => [day.date, day.count]) || [])
  return <section aria-label="Calendário de agendamentos">
    <header className="mb-5 flex items-center justify-between gap-2"><button type="button" className="calendar-month-nav" aria-label="Mês anterior" onClick={() => navigate(-1)}><LuChevronLeft className="size-5" aria-hidden="true" /></button><h2 className="text-center text-xl font-bold capitalize" aria-live="polite">{first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2><button type="button" className="calendar-month-nav" aria-label="Próximo mês" onClick={() => navigate(1)}><LuChevronRight className="size-5" aria-hidden="true" /></button></header>
    {query.isPending && <LoadingState label="Carregando calendário" />}{query.isError && <Notice>{apiErrorMessage(query.error)}</Notice>}
    {query.data && <><p className="mb-3 text-sm text-[#43557e]">Horários de Brasília. Selecione um dia para ver seus agendamentos.</p><div className="calendar-grid grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-[#cbdcf0] bg-[#cbdcf0]">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => <div key={day} className="bg-[#edf5ff] py-2 text-center text-xs font-semibold">{day}</div>)}{Array.from({ length: cells }, (_, index) => {
      const date = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), index-leadingDays+1, 12))
      const day = date.toISOString().slice(0, 10)
      const outside = !day.startsWith(month)
      const total = counts.get(day) || 0
      return <div key={day} className={`calendar-cell min-w-0 p-1 sm:p-2 ${outside ? 'bg-[#f7faff]' : 'bg-white'}`}>
        <button type="button" className={`calendar-day ${outside ? 'text-[#617085]' : ''}`} aria-current={day === today ? 'date' : undefined}
          aria-label={`${date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}${outside ? ', fora do mês exibido' : `, ${total} agendamentos`}${day === today ? ', hoje' : ''}`}
          onClick={() => { if (outside) setMonth(day.slice(0, 7)); setSelectedDay(day); setPage(1) }}>
          <span className="calendar-day-number">{date.getUTCDate()}{total > 0 && <span className="calendar-event-mark" aria-hidden="true">!</span>}</span>
        </button>
      </div>
    })}</div>{!query.data.days.length && <p className="mt-4 text-sm text-[#43557e]">Você não tem agendamentos neste mês.</p>}</>}
    <Dialog open={Boolean(selectedDay)} title={`Agendamentos em ${selectedDay.split('-').reverse().join('/')}`} onClose={() => setSelectedDay('')}>
      {dayQuery.isPending && <LoadingState />}{dayQuery.isError && <Notice>{apiErrorMessage(dayQuery.error)}</Notice>}{dayQuery.data?.results.length === 0 && <EmptyState title="Dia livre" description="Nenhum agendamento nesta data." />}<ul className="grid gap-3">{dayQuery.data?.results.map((event) => <li key={event.id}><Button variant="secondary" className="w-full flex-col items-start text-left" onClick={() => { setSelectedDay(''); onDetails(event) }}>{formatTime(event.starts_at)} · {event.company_name}<span className="text-xs">{event.service_name} · {event.professional_name}{event.unit_name ? ` · ${event.unit_name}` : ''}</span><StatusBadge status={event.status} outcome={event.outcome} /></Button></li>)}</ul>{dayQuery.data && (dayQuery.data.previous || dayQuery.data.next) && <nav className="mt-4 flex justify-between" aria-label="Eventos do dia"><Button variant="secondary" disabled={!dayQuery.data.previous} onClick={() => setPage(page-1)}>Anterior</Button><Button variant="secondary" disabled={!dayQuery.data.next} onClick={() => setPage(page+1)}>Próxima</Button></nav>}
    </Dialog>
  </section>
}
