import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu'
import { api, apiErrorMessage } from '../api/client'
import { localDateInput } from '../lib/format'
import { Button, Notice } from './ui'

export function BookingDatePicker({ slug, service, professional, unit, value, onChange }: {
  slug: string; service: string; professional: string; unit?: string | null; value: string; onChange: (date: string) => void
}) {
  const [today] = useState(() => localDateInput())
  const [month, setMonth] = useState(() => (value || today).slice(0, 7))
  const scrollRef = useRef<HTMLDivElement>(null)
  const first = new Date(`${month}-01T12:00:00`)
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const days = Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)
  const params = new URLSearchParams({ service, professional, start_date: days[0], end_date: days[count - 1] })
  if (unit) params.set('unit', unit)
  const available = useQuery({
    queryKey: ['available-days', slug, params.toString()],
    queryFn: ({ signal }) => api.get<{ available_dates: string[] }>(`/public/companies/${encodeURIComponent(slug)}/availability/days/?${params}`, { signal }),
    enabled: Boolean(service && professional), staleTime: 15_000,
  })
  const navigate = (offset: number) => {
    const date = new Date(first.getFullYear(), first.getMonth() + offset, 1, 12)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
    onChange('')
    if (scrollRef.current) scrollRef.current.scrollLeft = 0
  }
  return <section aria-label="Escolha da data">
    <div className="mb-3 flex items-center justify-between gap-2">
      <button className="calendar-month-nav" type="button" aria-label="Mês anterior" disabled={month <= today.slice(0, 7)} onClick={() => navigate(-1)}><LuChevronLeft aria-hidden="true" /></button>
      <h3 className="text-center font-semibold capitalize" aria-live="polite">{first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
      <button className="calendar-month-nav" type="button" aria-label="Próximo mês" onClick={() => navigate(1)}><LuChevronRight aria-hidden="true" /></button>
    </div>
    <div className="flex min-w-0 items-center gap-2">
      <Button className="hidden !px-2 sm:inline-flex" type="button" variant="ghost" aria-label="Rolar dias para a esquerda" onClick={() => scrollRef.current?.scrollBy({ left: -280, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}><LuChevronLeft aria-hidden="true" /></Button>
      <div ref={scrollRef} className="day-carousel flex min-w-0 flex-1 gap-2 overflow-x-auto p-1 pb-3" aria-label="Dias do mês" tabIndex={0}>
        {days.map((date) => {
          const selected = date === value
          const disabled = date < today || Boolean(available.data && !available.data.available_dates.includes(date))
          const parsed = new Date(`${date}T12:00:00`)
          return <Button type="button" variant="secondary" key={date} aria-label={parsed.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} aria-pressed={selected} disabled={disabled || available.isPending || available.isError} className="day-choice shrink-0 flex-col !gap-1 !px-4 !py-3" onClick={() => onChange(date)}><span className="text-xs uppercase">{parsed.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span><strong className="text-xl">{parsed.getDate()}</strong>{selected && <span className="sr-only">Selecionado</span>}</Button>
        })}
      </div>
      <Button className="hidden !px-2 sm:inline-flex" type="button" variant="ghost" aria-label="Rolar dias para a direita" onClick={() => scrollRef.current?.scrollBy({ left: 280, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}><LuChevronRight aria-hidden="true" /></Button>
    </div>
    {available.isFetching && <p className="text-sm text-[#52658f]" role="status">Consultando dias disponíveis…</p>}
    {available.isError && <Notice>{apiErrorMessage(available.error)}</Notice>}
    {available.data?.available_dates.length === 0 && <p className="mt-2 text-sm text-[#52658f]">Nenhum dia disponível neste mês. Tente o próximo.</p>}
    <p className="mt-3 text-xs text-[#52658f]">Horários no fuso de Brasília.</p>
  </section>
}
