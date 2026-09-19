import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LuCalendarDays as CalendarDays, LuCirclePlus as PlusCircle, LuUserRound as UserRound } from 'react-icons/lu'
import { useState } from 'react'
import { Link } from 'react-router'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { PublicPage } from '../components/PublicLayout'
import { StatusBadge } from '../components/StatusBadge'
import { Button, Dialog, EmptyState, Field, LoadingState, Notice } from '../components/ui'
import { formatDateTime, formatTime, localDateInput } from '../lib/format'
import type { Appointment, AvailabilitySlot, Paginated } from '../types/api'

export default function CustomerAccountPage() {
  const [now] = useState(() => Date.now())
  const [minimumDate] = useState(() => localDateInput())
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null)
  const [detailsTarget, setDetailsTarget] = useState<Appointment | null>(null)
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const bookings = useQuery({ queryKey: ['customer-appointments'], queryFn: () => api.get<Paginated<Appointment>>('/customers/appointments/') })
  const availability = useQuery({ queryKey: ['customer-reschedule', rescheduleTarget?.id, date], queryFn: () => api.get<AvailabilitySlot[]>(`/public/companies/${rescheduleTarget?.company_slug}/availability/?service=${rescheduleTarget?.service}&professional=${rescheduleTarget?.professional}&date=${date}`), enabled: Boolean(rescheduleTarget && date) })
  const refreshBookings = () => queryClient.invalidateQueries({ queryKey: ['customer-appointments'] })
  const cancel = useMutation({ mutationFn: (appointment: Appointment) => api.post(`/customers/appointments/${appointment.id}/cancel/`), onSuccess: () => { refreshBookings(); setCancelTarget(null) } })
  const reschedule = useMutation({ mutationFn: () => api.post(`/customers/appointments/${rescheduleTarget?.id}/reschedule/`, { starts_at: slot }), onSuccess: () => { refreshBookings(); setRescheduleTarget(null); setSlot(''); setDate('') } })
  const all = bookings.data?.results || []
  const upcoming = all.filter((item) => new Date(item.starts_at).getTime() >= now && item.status !== 'CANCELLED').sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const history = all.filter((item) => !upcoming.includes(item)).sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  const firstName = user?.full_name.trim().split(/\s+/)[0] || 'cliente'

  return <PublicPage mode="customer" decorations={false}>
    <div className="mx-auto w-full max-w-[72rem] px-4 py-7 sm:px-7 lg:px-10 lg:py-9">
      <header className="flex flex-col gap-5 border-b border-[#dfe8f3] pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#087cf0]">Área do cliente</p><h1 className="public-display mt-2 text-3xl sm:text-4xl">Olá, <span>{firstName}!</span></h1><p className="mt-2 text-sm text-[#7182b2]">Acompanhe seus próximos horários e consulte seu histórico.</p></div><Link className="public-primary-link" to="/cliente/procurar"><PlusCircle className="size-4" /> Agendar horário</Link></header>
      <section className="mt-7">
        {bookings.isPending && <LoadingState label="Carregando seus agendamentos" />}{bookings.isError && <Notice>{apiErrorMessage(bookings.error)}</Notice>}{bookings.data && <div><SectionHeading title="Próximos agendamentos" description="Aqui estão os seus próximos horários agendados." />{upcoming.length === 0 ? <EmptyState title="Você ainda não possui agendamentos." description="Escolha uma empresa e encontre o melhor horário para você." action={<Link to="/cliente/procurar" className="public-primary-link">Agendar horário</Link>} /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{upcoming.slice(0, 6).map((item) => <AppointmentCard key={item.id} item={item} onDetails={setDetailsTarget} />)}</div>}<div className="mt-8"><SectionHeading title="Histórico" description="Seus agendamentos anteriores aparecem aqui." />{history.length === 0 ? <EmptyState title="Seu histórico aparecerá aqui" description="Após seus primeiros agendamentos, você poderá consultá-los nesta seção." /> : <History items={history} onDetails={setDetailsTarget} />}</div></div>}
      </section>
    </div>
    <AppointmentDetails item={detailsTarget} onClose={() => setDetailsTarget(null)} onCancel={setCancelTarget} onReschedule={(item) => { setRescheduleTarget(item); setDate(''); setSlot(''); setDetailsTarget(null) }} />
    <Dialog open={Boolean(cancelTarget)} title="Cancelar agendamento" onClose={() => setCancelTarget(null)}><p className="text-sm text-[#52658f]">Confirma o cancelamento de <strong className="text-[#071044]">{cancelTarget?.service_name}</strong> em {cancelTarget && formatDateTime(cancelTarget.starts_at)}?</p>{cancel.isError && <div className="mt-4"><Notice>{apiErrorMessage(cancel.error)}</Notice></div>}<div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={() => setCancelTarget(null)}>Voltar</Button><Button variant="danger" disabled={cancel.isPending} onClick={() => cancelTarget && cancel.mutate(cancelTarget)}>Cancelar agendamento</Button></div></Dialog>
    <Dialog open={Boolean(rescheduleTarget)} title="Reagendar" onClose={() => setRescheduleTarget(null)}><Field label="Nova data" type="date" min={minimumDate} value={date} onChange={(event) => { setDate(event.target.value); setSlot('') }} />{availability.isFetching && <LoadingState />}{availability.isError && <div className="mt-4"><Notice>{apiErrorMessage(availability.error)}</Notice></div>}{availability.data && <div className="mt-4 grid grid-cols-3 gap-2">{availability.data.map((item) => <button key={item.starts_at} className={`btn ${slot === item.starts_at ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSlot(item.starts_at)}>{formatTime(item.starts_at)}</button>)}</div>}{availability.data?.length === 0 && <p className="mt-4 text-sm text-[#7182b2]">Sem horários disponíveis nesta data.</p>}{reschedule.isError && <div className="mt-4"><Notice>{apiErrorMessage(reschedule.error)}</Notice></div>}<Button className="mt-5 w-full" disabled={!slot || reschedule.isPending} onClick={() => reschedule.mutate()}>Confirmar novo horário</Button></Dialog>
  </PublicPage>
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <header className="mb-4"><h2 className="text-xl font-bold tracking-[-.03em] text-[#071044] sm:text-2xl">{title}</h2><p className="mt-1 text-sm text-[#7182b2]">{description}</p></header>
}

function AppointmentCard({ item, onDetails }: { item: Appointment; onDetails: (item: Appointment) => void }) {
  return <article className="flex min-h-56 flex-col rounded-xl border border-[#d8e5f4] bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-bold text-[#071044]">{item.company_name}</h3><p className="mt-1 truncate text-sm text-[#52658f]">{item.service_name}</p></div><StatusBadge status={item.status} /></div><div className="mt-4 grid gap-2 border-t border-[#e4edf7] pt-4 text-sm text-[#43557e]"><p className="flex items-center gap-2"><CalendarDays className="size-4 text-[#087cf0]" />{formatDateTime(item.starts_at)}</p><p className="flex items-center gap-2"><UserRound className="size-4 text-[#087cf0]" />{item.professional_name}</p></div><Button className="mt-auto w-full" variant="secondary" onClick={() => onDetails(item)}>Ver detalhes</Button></article>
}

function History({ items, onDetails }: { items: Appointment[]; onDetails: (item: Appointment) => void }) {
  return <><div className="hidden overflow-hidden rounded-xl border border-[#d8e5f4] md:block"><table className="data-table"><thead><tr><th>Data</th><th>Serviço</th><th>Empresa</th><th>Profissional</th><th>Status</th><th></th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{formatDateTime(item.starts_at)}</td><td>{item.service_name}</td><td>{item.company_name}</td><td>{item.professional_name}</td><td><StatusBadge status={item.status} /></td><td><Button variant="ghost" onClick={() => onDetails(item)}>Detalhes</Button></td></tr>)}</tbody></table></div><div className="grid gap-3 md:hidden">{items.map((item) => <article key={item.id} className="rounded-xl border border-[#d8e5f4] p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{item.service_name}</h3><p className="mt-1 text-sm text-[#52658f]">{item.company_name}</p></div><StatusBadge status={item.status} /></div><p className="mt-3 text-sm text-[#43557e]">{formatDateTime(item.starts_at)} · {item.professional_name}</p><Button className="mt-3 w-full" variant="secondary" onClick={() => onDetails(item)}>Ver detalhes</Button></article>)}</div></>
}

function AppointmentDetails({ item, onClose, onCancel, onReschedule }: { item: Appointment | null; onClose: () => void; onCancel: (item: Appointment) => void; onReschedule: (item: Appointment) => void }) {
  return <Dialog open={Boolean(item)} title="Detalhes do agendamento" onClose={onClose}>{item && <><dl className="grid gap-3 text-sm"><Detail label="Empresa" value={item.company_name} /><Detail label="Serviço" value={item.service_name} /><Detail label="Profissional" value={item.professional_name} /><Detail label="Data e horário" value={formatDateTime(item.starts_at)} /><div className="flex justify-between gap-3"><dt className="text-[#7182b2]">Status</dt><dd><StatusBadge status={item.status} /></dd></div></dl>{(item.can_cancel || item.can_reschedule) && <div className="mt-6 flex flex-wrap justify-end gap-2">{item.can_reschedule && <Button variant="secondary" onClick={() => onReschedule(item)}>Reagendar</Button>}{item.can_cancel && <Button variant="danger" onClick={() => { onClose(); onCancel(item) }}>Cancelar</Button>}</div>}</>}</Dialog>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-[#7182b2]">{label}</dt><dd className="text-right font-medium text-[#172653]">{value}</dd></div>
}
