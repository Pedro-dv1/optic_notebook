import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LuBuilding2 as Building2, LuCalendarDays as CalendarDays, LuCirclePlus as PlusCircle, LuMapPin as MapPin, LuSearch as Search, LuUserRound as UserRound } from 'react-icons/lu'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { PublicPage } from '../components/PublicLayout'
import { StatusBadge } from '../components/StatusBadge'
import { Button, Dialog, EmptyState, LoadingState, Notice, SelectField, TextAreaField } from '../components/ui'
import { formatDateTime } from '../lib/format'
import { safeImageUrl } from '../lib/media'
import { CustomerCalendar } from '../components/CustomerCalendar'
import { FavoriteSuggestions } from '../components/CustomerFavorites'
import { BookingDatePicker } from '../components/BookingDatePicker'
import { TimeSlots } from '../components/TimeSlots'
import type { Appointment, AvailabilitySlot, Paginated } from '../types/api'

export default function CustomerAccountPage() {
  const [now] = useState(() => Date.now())
  const [view, setView] = useState<'appointments' | 'calendar'>('appointments')
  const [page, setPage] = useState(1)
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null)
  const [detailsTarget, setDetailsTarget] = useState<Appointment | null>(null)
  const [reviewTargetId, setReviewTargetId] = useState<string | null>(() => new URLSearchParams(window.location.hash.slice(1)).get('avaliar'))
  const [reviewSent, setReviewSent] = useState(false)
  const [companySearch, setCompanySearch] = useState('')
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const bookings = useQuery({ queryKey: ['customer-appointments', page], queryFn: ({ signal }) => api.get<Paginated<Appointment>>(`/customers/appointments/${page === 1 ? '' : `?page=${page}`}`, { signal }), enabled: view === 'appointments' })
  const availability = useQuery({ queryKey: ['customer-reschedule', rescheduleTarget?.id, date], queryFn: () => api.get<AvailabilitySlot[]>(`/public/companies/${rescheduleTarget?.company_slug}/availability/?service=${rescheduleTarget?.service}&professional=${rescheduleTarget?.professional}&date=${date}${rescheduleTarget?.unit ? `&unit=${rescheduleTarget.unit}` : ''}`), enabled: Boolean(rescheduleTarget && date) })
  const refreshBookings = () => { queryClient.invalidateQueries({ queryKey: ['customer-appointments'] }); queryClient.invalidateQueries({ queryKey: ['customer-calendar'] }); queryClient.invalidateQueries({ queryKey: ['customer-calendar-day'] }); queryClient.invalidateQueries({ queryKey: ['favorite-suggestions'] }) }
  const cancel = useMutation({ mutationFn: (appointment: Appointment) => api.post(`/customers/appointments/${appointment.id}/cancel/`), onSuccess: () => { refreshBookings(); setCancelTarget(null) } })
  const reschedule = useMutation({ mutationFn: () => api.post(`/customers/appointments/${rescheduleTarget?.id}/reschedule/`, { starts_at: slot }), onSuccess: () => { refreshBookings(); setRescheduleTarget(null); setSlot(''); setDate('') } })
  const review = useMutation({ mutationFn: (payload: { rating: number; comment: string }) => api.post(`/customers/appointments/${reviewTargetId}/review/`, payload), onSuccess: () => { refreshBookings(); setReviewTargetId(null); setReviewSent(true) } })
  const all = bookings.data?.results || []
  const reviewTarget = all.find((item) => item.id === reviewTargetId && item.outcome === 'COMPLETED' && !item.reviewed) || null
  const upcoming = all.filter((item) => new Date(item.starts_at).getTime() >= now && item.status !== 'CANCELLED').sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const history = all.filter((item) => !upcoming.includes(item)).sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  const normalizedSearch = companySearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
  const filteredUpcoming = upcoming.filter((item) => item.company_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').includes(normalizedSearch))
  const firstName = user?.full_name.trim().split(/\s+/)[0] || 'cliente'

  useEffect(() => {
    if (reviewTargetId && window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [reviewTargetId])

  const submitReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    review.mutate({ rating: Number(data.get('rating')), comment: String(data.get('comment') || '') })
  }

  return <PublicPage mode="customer" decorations={false}>
    <div className="mx-auto w-full max-w-[72rem] px-4 py-7 sm:px-7 lg:px-10 lg:py-9">
      <header className="flex flex-col gap-5 border-b border-[#dfe8f3] pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#087cf0]">Área do cliente</p><h1 className="public-display mt-2 text-3xl sm:text-4xl">Olá, <span>{firstName}!</span></h1><p className="mt-2 text-sm text-[#52658a]">Acompanhe seus próximos horários e consulte seu histórico.</p></div><div className="flex flex-wrap items-center gap-3 sm:justify-end"><Link className="public-primary-link customer-action" to="/cliente/procurar"><PlusCircle className="size-4" aria-hidden="true" /> Agendar horário</Link><div className="view-switch" data-view={view} role="group" aria-label="Visualização da agenda">{(['appointments', 'calendar'] as const).map((mode) => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)}>{mode === 'appointments' ? 'Agenda' : 'Calendário'}</button>)}</div></div></header>
      <section className="mt-7">
        {view === 'calendar' && <CustomerCalendar onDetails={setDetailsTarget} />}
        {view === 'appointments' && <><FavoriteSuggestions />
        {reviewSent && <div className="mb-4"><Notice kind="success">Avaliação enviada. Obrigado!</Notice></div>}
        {bookings.isPending && <LoadingState label="Carregando seus agendamentos" />}{bookings.isError && <Notice>{apiErrorMessage(bookings.error)}</Notice>}{bookings.data && <div><SectionHeading title="Próximos agendamentos" description="Aqui estão os seus próximos horários agendados." />{upcoming.length === 0 ? <EmptyState title="Você ainda não possui agendamentos." description="Escolha uma empresa e encontre o melhor horário para você." action={<Link to="/cliente/procurar" className="public-primary-link customer-action">Agendar horário</Link>} /> : <><label className="relative mb-4 block w-full sm:max-w-md"><span className="sr-only">Pesquisar empresa nos próximos agendamentos</span><Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#52658f]" aria-hidden="true" /><input className="field !min-h-12 !rounded-xl !pl-11" type="search" value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder="Pesquisar empresa" /></label>{filteredUpcoming.length === 0 ? <EmptyState title="Nenhuma empresa encontrada" description="Tente pesquisar por outro nome." /> : <div className="grid gap-4">{filteredUpcoming.map((item) => <AppointmentCard key={item.id} item={item} onDetails={setDetailsTarget} />)}</div>}</>}<div className="mt-8"><SectionHeading title="Histórico" description="Seus agendamentos anteriores aparecem aqui." />{history.length === 0 ? <EmptyState title="Seu histórico aparecerá aqui" description="Após seus primeiros agendamentos, você poderá consultá-los nesta seção." /> : <div className="grid gap-4">{history.map((item) => <AppointmentCard key={item.id} item={item} onDetails={setDetailsTarget} />)}</div>}</div></div>}
        {bookings.data && (bookings.data.previous || bookings.data.next) && <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Paginação dos agendamentos"><Button variant="secondary" disabled={!bookings.data.previous} onClick={() => setPage(page - 1)}>Anterior</Button><span className="text-sm">Página {page}</span><Button variant="secondary" disabled={!bookings.data.next} onClick={() => setPage(page + 1)}>Próxima</Button></nav>}
        </>}
      </section>
    </div>
    <AppointmentDetails item={detailsTarget} onClose={() => setDetailsTarget(null)} onCancel={setCancelTarget} onReschedule={(item) => { setRescheduleTarget(item); setDate(''); setSlot(''); setDetailsTarget(null) }} onReview={(item) => { setReviewTargetId(item.id); setDetailsTarget(null) }} />
    <Dialog open={Boolean(cancelTarget)} title="Cancelar agendamento" onClose={() => setCancelTarget(null)}><p className="text-sm text-[#52658f]">Confirma o cancelamento de <strong className="text-[#071044]">{cancelTarget?.service_name}</strong> em {cancelTarget && formatDateTime(cancelTarget.starts_at)}?</p>{cancel.isError && <div className="mt-4"><Notice>{apiErrorMessage(cancel.error)}</Notice></div>}<div className="mt-6 flex flex-wrap justify-end gap-3"><Button variant="secondary" onClick={() => setCancelTarget(null)}>Voltar</Button><Button variant="danger" disabled={cancel.isPending} onClick={() => cancelTarget && cancel.mutate(cancelTarget)}>Cancelar agendamento</Button></div></Dialog>
    <Dialog open={Boolean(rescheduleTarget)} title="Reagendar" onClose={() => setRescheduleTarget(null)}>{rescheduleTarget && <BookingDatePicker slug={rescheduleTarget.company_slug} service={rescheduleTarget.service} professional={rescheduleTarget.professional} unit={rescheduleTarget.unit} value={date} onChange={(value) => { setDate(value); setSlot('') }} />}{availability.isFetching && <LoadingState />}{availability.isError && <div className="mt-4"><Notice>{apiErrorMessage(availability.error)}</Notice></div>}{availability.data && <TimeSlots key={date} slots={availability.data} value={slot} onChange={setSlot} />}{availability.data?.length === 0 && <p className="mt-4 text-sm text-[#52658a]">Sem horários disponíveis nesta data.</p>}{reschedule.isError && <div className="mt-4"><Notice>{apiErrorMessage(reschedule.error)}</Notice></div>}<Button className="mt-5 w-full" disabled={!slot || reschedule.isPending} onClick={() => reschedule.mutate()}>Confirmar novo horário</Button></Dialog>
    <Dialog open={Boolean(reviewTarget)} title="Avaliar atendimento" onClose={() => setReviewTargetId(null)}><form className="grid gap-4" onSubmit={submitReview}><SelectField label="Nota" name="rating" required><option value="">Selecione</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} estrela{value > 1 ? 's' : ''}</option>)}</SelectField><TextAreaField label="Comentário opcional" name="comment" maxLength={2000} />{review.isError && <Notice>{apiErrorMessage(review.error)}</Notice>}<Button loading={review.isPending}>Enviar avaliação</Button></form></Dialog>
  </PublicPage>
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <header className="mb-4"><h2 className="text-xl font-bold tracking-[-.03em] text-[#071044] sm:text-2xl">{title}</h2><p className="mt-1 text-sm text-[#52658a]">{description}</p></header>
}

function AppointmentCard({ item, onDetails }: { item: Appointment; onDetails: (item: Appointment) => void }) {
  const logo = safeImageUrl(item.company_logo)
  const location = companyLocation(item)
  return <article className="flex flex-col overflow-hidden rounded-xl border border-[#d8e5f4] bg-white md:min-h-52 md:flex-row">
    {logo ? <img src={logo} alt={`Imagem de ${item.company_name}`} loading="lazy" className="h-44 w-full object-cover md:h-auto md:w-52" /> : <span className="grid h-44 w-full shrink-0 place-items-center bg-[#eef5ff] text-[#7aaee8] md:h-auto md:w-52"><Building2 className="size-12" aria-hidden="true" /></span>}
    <div className="flex min-w-0 flex-1 flex-col p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-bold text-[#071044]">{item.company_name}</h3><p className="mt-1 truncate text-sm text-[#52658f]">{item.service_name}</p></div><StatusBadge status={item.status} outcome={item.outcome} /></div><div className="mt-4 grid gap-2 border-t border-[#e4edf7] pt-4 text-sm text-[#43557e]"><p className="flex items-center gap-2"><CalendarDays className="size-4 shrink-0 text-[#087cf0]" aria-hidden="true" />{formatDateTime(item.starts_at)}</p><p className="flex items-center gap-2"><UserRound className="size-4 shrink-0 text-[#087cf0]" aria-hidden="true" />{item.professional_name}</p>{location && <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-[#087cf0]" aria-hidden="true" />{location}</p>}</div><Button className="customer-action mt-5 w-full md:ml-auto md:w-fit" variant="secondary" onClick={() => onDetails(item)}>Ver detalhes</Button></div>
  </article>
}

function AppointmentDetails({ item, onClose, onCancel, onReschedule, onReview }: { item: Appointment | null; onClose: () => void; onCancel: (item: Appointment) => void; onReschedule: (item: Appointment) => void; onReview: (item: Appointment) => void }) {
  return <Dialog open={Boolean(item)} title="Detalhes do agendamento" onClose={onClose}>{item && <><dl className="grid gap-3 text-sm"><Detail label="Empresa" value={item.company_name} />{item.unit_name && <Detail label="Unidade" value={item.unit_name} />}<Detail label="Serviço" value={item.service_name} /><Detail label="Profissional" value={item.professional_name} /><Detail label="Data e horário" value={formatDateTime(item.starts_at)} />{companyLocation(item) && <Detail label="Localização" value={companyLocation(item)} />}{item.cancellation_reason === 'EXPIRED_UNCONFIRMED' && <Detail label="Motivo" value="Cancelado automaticamente por falta de confirmação no prazo." />}<div className="flex justify-between gap-3"><dt className="text-[#52658a]">Status</dt><dd><StatusBadge status={item.status} outcome={item.outcome} /></dd></div></dl>{(item.can_cancel || item.can_reschedule || (item.outcome === 'COMPLETED' && !item.reviewed)) && <div className="mt-6 flex flex-wrap justify-end gap-2">{item.outcome === 'COMPLETED' && !item.reviewed && <Button variant="secondary" onClick={() => onReview(item)}>Avaliar atendimento</Button>}{item.can_reschedule && <Button variant="secondary" onClick={() => onReschedule(item)}>Reagendar</Button>}{item.can_cancel && <Button variant="danger" onClick={() => { onClose(); onCancel(item) }}>Cancelar</Button>}</div>}</>}</Dialog>
}

function companyLocation(item: Appointment) {
  return [item.unit_address ?? item.company_address, [item.unit_city ?? item.company_city, item.unit_state ?? item.company_state].filter(Boolean).join(' - ')].filter(Boolean).join(' · ')
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-[#52658a]">{label}</dt><dd className="text-right font-medium text-[#172653]">{value}</dd></div>
}
