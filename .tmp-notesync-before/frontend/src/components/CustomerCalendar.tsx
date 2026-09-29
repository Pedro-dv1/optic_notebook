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
  const first = new Date(`${month}-01T12:00:00`)
  const count = new Date(first.getFullYear(), first.getMonth()+1, 0).getDate()
  const params = new URLSearchParams({ start_date: `${month}-01`, end_date: `${month}-${count}` })
  const query = useQuery({ queryKey: ['customer-calendar', month], queryFn: ({ signal }) => api.get<{ days: Array<{ date: string; count: number }>; events: Appointment[] }>(`/customers/appointments/calendar/?${params}`, { signal }) })
  const dayQuery = useQuery({ queryKey: ['customer-calendar-day', selectedDay, page], queryFn: ({ signal }) => api.get<Paginated<Appointment>>(`/customers/appointments/?start_date=${selectedDay}&end_date=${selectedDay}&page=${page}`, { signal }), enabled: Boolean(selectedDay) })
  const navigate = (offset: number) => {
    const date = new Date(first.getFullYear(), first.getMonth()+offset, 1, 12)
    setMonth(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}`)
  }
  const byDay = new Map<string, Appointment[]>()
  for (const event of query.data?.events || []) {
    const day = localDateInput(new Date(event.starts_at))
    byDay.set(day, [...(byDay.get(day) || []), event])
  }
  const counts = new Map(query.data?.days.map((day) => [day.date, day.count]) || [])
  return <section aria-label="Calendário de agendamentos">
    <header className="mb-5 flex items-center justify-between gap-2"><Button variant="secondary" aria-label="Mês anterior" onClick={() => navigate(-1)}><LuChevronLeft aria-hidden="true" /></Button><h2 className="text-center text-xl font-bold capitalize" aria-live="polite">{first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2><Button variant="secondary" aria-label="Próximo mês" onClick={() => navigate(1)}><LuChevronRight aria-hidden="true" /></Button></header>
    {query.isPending && <LoadingState label="Carregando calendário" />}{query.isError && <Notice>{apiErrorMessage(query.error)}</Notice>}
    {query.data && <><p className="mb-3 text-sm text-[#43557e]">Horários de Brasília. Selecione um evento para ver os detalhes.</p><div className="calendar-grid grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-[#cbdcf0] bg-[#cbdcf0]">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => <div key={day} className="bg-[#edf5ff] py-2 text-center text-xs font-semibold">{day}</div>)}{Array.from({ length: (first.getDay()+6)%7 }, (_, index) => <div key={`blank-${index}`} className="bg-[#f7faff]" />)}{Array.from({ length: count }, (_, index) => {
      const day = `${month}-${String(index+1).padStart(2, '0')}`
      const events = byDay.get(day) || []
      const total = counts.get(day) || 0
      return <div key={day} className="min-w-0 bg-white p-1 sm:min-h-32 sm:p-2"><Button variant="ghost" className="w-full flex-col !min-h-11 !gap-0 !p-1 sm:w-auto sm:flex-row" aria-label={`${index+1} de ${first.toLocaleDateString('pt-BR', { month: 'long' })}, ${total} agendamentos`} onClick={() => { setSelectedDay(day); setPage(1) }}>{index+1}{total > 0 && <span className="rounded-full bg-[#e8f3ff] px-1 text-xs text-[#164a8a] sm:hidden">{total > 9 ? '9+' : total}</span>}</Button><div className="hidden space-y-1 sm:block">{events.map((event) => <button key={event.id} className="calendar-event block w-full rounded border border-[#b9d0eb] bg-[#f6faff] p-1 text-left text-xs leading-5 hover:border-[#164a8a]" onClick={() => onDetails(event)} aria-label={`${event.company_name}, ${event.service_name}, ${formatTime(event.starts_at)}`}><strong className="block truncate">{formatTime(event.starts_at)} · {event.company_name}</strong><span className="block truncate">{event.service_name}</span><StatusBadge status={event.status} outcome={event.outcome} /></button>)}{total > events.length && <Button variant="ghost" className="w-full !min-h-11 !px-1 !text-xs" onClick={() => { setSelectedDay(day); setPage(1) }}>Mais {total-events.length}</Button>}</div></div>
    })}</div>{!query.data.days.length && <p className="mt-4 text-sm text-[#43557e]">Você não tem agendamentos neste mês.</p>}</>}
    <Dialog open={Boolean(selectedDay)} title={`Agendamentos em ${selectedDay.split('-').reverse().join('/')}`} onClose={() => setSelectedDay('')}>
      {dayQuery.isPending && <LoadingState />}{dayQuery.isError && <Notice>{apiErrorMessage(dayQuery.error)}</Notice>}{dayQuery.data?.results.length === 0 && <EmptyState title="Dia livre" description="Nenhum agendamento nesta data." />}<ul className="grid gap-3">{dayQuery.data?.results.map((event) => <li key={event.id}><Button variant="secondary" className="w-full flex-col items-start text-left" onClick={() => { setSelectedDay(''); onDetails(event) }}>{formatTime(event.starts_at)} · {event.company_name}<span className="text-xs">{event.service_name} · {event.professional_name}{event.unit_name ? ` · ${event.unit_name}` : ''}</span><StatusBadge status={event.status} outcome={event.outcome} /></Button></li>)}</ul>{dayQuery.data && (dayQuery.data.previous || dayQuery.data.next) && <nav className="mt-4 flex justify-between" aria-label="Eventos do dia"><Button variant="secondary" disabled={!dayQuery.data.previous} onClick={() => setPage(page-1)}>Anterior</Button><Button variant="secondary" disabled={!dayQuery.data.next} onClick={() => setPage(page+1)}>Próxima</Button></nav>}
    </Dialog>
  </section>
}
