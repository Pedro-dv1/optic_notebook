import { useMutation, useQuery } from '@tanstack/react-query'
import { LuArrowLeft as ArrowLeft, LuArrowRight as ArrowRight, LuBuilding2 as Building2, LuCalendarDays as CalendarDays, LuCheck as Check, LuClock3 as Clock3, LuMapPin as MapPin, LuScissors as Scissors, LuTag as Tag, LuUserRound as UserRound } from 'react-icons/lu'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { api, ApiError, apiErrorMessage, apiFieldErrors } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { CompanyObservationPopover } from '../components/CompanyObservationPopover'
import { PublicFooter } from '../components/Footer'
import { PublicHeader } from '../components/PublicLayout'
import { StatusBadge } from '../components/StatusBadge'
import { Turnstile } from '../components/Turnstile'
import { Button, EmptyState, Field, LoadingState, Notice, TextAreaField, validateForm } from '../components/ui'
import { durationMinutes, formatDateTime, formatMoney, formatTime, localDateInput } from '../lib/format'
import { safeImageUrl } from '../lib/media'
import type { Appointment, AvailabilitySlot, Company, Professional, Service } from '../types/api'
import NotFoundPage from './NotFoundPage'

type Step = 'service' | 'professional' | 'time' | 'details' | 'review' | 'confirmed'
const stepKeys: Step[] = ['service', 'professional', 'time', 'details', 'review', 'confirmed']
const stepLabels = ['Serviço', 'Profissional', 'Data e horário', 'Seus dados', 'Revisão', 'Confirmação']
let inMemoryVisitorId: string | null = null

export default function PublicBookingPage() {
  const [minimumDate] = useState(() => localDateInput())
  const { slug = '' } = useParams()
  const { user, status } = useAuth()
  const [step, setStep] = useState<Step>('service')
  const [service, setService] = useState<Service | null>(null)
  const [professional, setProfessional] = useState<Professional | null>(null)
  const [date, setDate] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [snapshot, setSnapshot] = useState({ name: '', email: '', whatsapp: '', notes: '' })
  const [useSaved, setUseSaved] = useState(true)
  const [turnstile, setTurnstile] = useState('')
  const [confirmation, setConfirmation] = useState<Appointment | null>(null)
  const [managementToken, setManagementToken] = useState('')
  const [rescheduling, setRescheduling] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const company = useQuery({ queryKey: ['public-company', slug], queryFn: () => api.get<Company>(`/public/companies/${encodeURIComponent(slug)}/`), retry: false })
  const services = useQuery({ queryKey: ['public-services', slug], queryFn: () => api.get<Service[]>(`/public/companies/${encodeURIComponent(slug)}/services/`), enabled: company.data?.status === 'ACTIVE' })
  const professionals = useQuery({ queryKey: ['public-professionals', slug, service?.id], queryFn: () => api.get<Professional[]>(`/public/companies/${encodeURIComponent(slug)}/professionals/?service=${service?.id}`), enabled: Boolean(service) })
  const availability = useQuery({ queryKey: ['availability', slug, service?.id, professional?.id, date], queryFn: () => api.get<AvailabilitySlot[]>(`/public/companies/${encodeURIComponent(slug)}/availability/?service=${service?.id}&professional=${professional?.id}&date=${date}`), enabled: Boolean(service && professional && date), staleTime: 15_000 })
  const { mutate: recordView } = useMutation({ mutationFn: (visitorId: string) => api.post(`/public/companies/${encodeURIComponent(slug)}/view/`, { visitor_id: visitorId }), retry: false })

  useEffect(() => {
    if (company.data?.status === 'ACTIVE') recordView(visitorIdentifier())
  }, [company.data?.status, recordView])
  useEffect(() => {
    if (company.data?.name) document.title = `Agendar | ${company.data.name}`
  }, [company.data?.name])

  const create = useMutation({
    mutationFn: () => rescheduling
      ? api.post<Appointment>(`/public/companies/${encodeURIComponent(slug)}/appointments/reschedule/`, { management_token: managementToken, starts_at: startsAt })
      : api.post<Appointment & { management_token?: string }>(`/public/companies/${encodeURIComponent(slug)}/appointments/`, {
        service: service?.id,
        professional: professional?.id,
        starts_at: startsAt,
        customer_notes: snapshot.notes,
        ...(user && useSaved ? {} : { customer_name: snapshot.name, customer_email: snapshot.email, customer_whatsapp: snapshot.whatsapp }),
        turnstile_token: user ? undefined : turnstile,
        website: '',
      }),
    onSuccess: (appointment) => {
      setConfirmation(appointment)
      setFieldErrors({})
      if ('management_token' in appointment && appointment.management_token) setManagementToken(appointment.management_token)
      setStep('confirmed')
      setRescheduling(false)
    },
    onError: (error) => {
      const errors = apiFieldErrors(error)
      setFieldErrors(errors)
      const details = { name: errors.customer_name, email: errors.customer_email, whatsapp: errors.customer_whatsapp }
      if (Object.values(details).some(Boolean)) {
        setStep('details')
      }
    },
  })
  const cancel = useMutation({ mutationFn: () => user ? api.post<Appointment>(`/customers/appointments/${confirmation?.id}/cancel/`) : api.post<Appointment>(`/public/companies/${encodeURIComponent(slug)}/appointments/cancel/`, { management_token: managementToken }), onSuccess: setConfirmation })

  if (company.isPending) return <BookingFrame><LoadingState label="Carregando página da empresa" /></BookingFrame>
  if (company.isError && company.error instanceof ApiError && company.error.status === 404) return <NotFoundPage />
  if (company.isError) return <BookingFrame><CenteredNotice error={company.error} /></BookingFrame>
  const brand = company.data
  if (brand.status === 'SUSPENDED') return <BookingFrame><div className="mx-auto max-w-xl px-5 py-20 text-center"><h1 className="text-2xl font-bold">Página temporariamente indisponível</h1><p className="mt-3 text-[#7182b2]">No momento, esta empresa não está recebendo novos agendamentos.</p><Link to="/cliente/procurar" className="btn btn-secondary mt-7">Encontrar outra empresa</Link></div></BookingFrame>

  const logo = safeImageUrl(brand.logo)
  const category = [brand.business_type_label, brand.niche_label].filter(Boolean).join(' · ')
  const location = [brand.address, [brand.city, brand.state].filter(Boolean).join(' - ')].filter(Boolean).join(' · ')
  const currentStep = stepKeys.indexOf(step)
  const backMap: Partial<Record<Step, Step>> = { professional: 'service', time: 'professional', details: 'time', review: 'details' }
  const nextFromDetails = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors = validateForm(event.currentTarget)
    if (Object.keys(errors).length) { setFieldErrors(errors); return }
    setFieldErrors({})
    const data = new FormData(event.currentTarget)
    setSnapshot({ name: String(data.get('name') || ''), email: String(data.get('email') || ''), whatsapp: String(data.get('whatsapp') || ''), notes: String(data.get('notes') || '') })
    setStep('review')
  }
  const beginReschedule = () => { setDate(''); setStartsAt(''); setRescheduling(true); setStep('time') }

  return <BookingFrame>
    <div className="mx-auto max-w-[78rem] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <div className="mb-6 text-center sm:mb-8"><h1 className="public-display text-3xl sm:text-4xl">Agende seu <span>horário</span></h1><p className="mt-2 text-sm text-[#7182b2] sm:text-base">Escolha o serviço, selecione um horário e confirme seus dados.</p></div>
      <div className="grid gap-5 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-2xl border border-[#d5e4f5] bg-white p-4 lg:sticky lg:top-28 lg:p-5">
          <div className="relative flex items-center gap-3 lg:block">
            <div className="absolute right-0 top-0"><CompanyObservationPopover companyName={brand.name} notes={brand.public_notes} /></div>
            {logo ? <img src={logo} alt={`Imagem de ${brand.name}`} className="size-16 shrink-0 rounded-xl object-cover lg:h-32 lg:w-full" /> : <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-[#eef5ff] text-[#087cf0] lg:h-28 lg:w-full"><Building2 className="size-8" aria-hidden="true" /></div>}
            <div className="min-w-0 pr-10 lg:mt-4 lg:pr-0"><h2 className="truncate text-lg font-bold">{brand.name}</h2>{category && <p className="mt-1 truncate text-sm font-medium text-[#087cf0]">{category}</p>}{location && <p className="mt-2 hidden gap-2 text-sm leading-5 text-[#7182b2] lg:flex"><MapPin className="mt-0.5 size-4 shrink-0" />{location}</p>}</div>
          </div>
          <BookingStepper current={currentStep} />
        </aside>
        <section className="min-w-0 rounded-2xl border border-[#d5e4f5] bg-white p-4 sm:p-6 lg:p-7">
          {step !== 'service' && step !== 'confirmed' && <button className="btn btn-ghost mb-5 !px-2" onClick={() => setStep(backMap[step] || 'service')}><ArrowLeft className="size-4" /> Voltar</button>}
          {step === 'service' && <StepSection title="Qual serviço você deseja?" description="Selecione o serviço que melhor atende às suas necessidades.">
            {services.isPending && <LoadingState />}{services.isError && <Notice>{apiErrorMessage(services.error)}</Notice>}{services.data?.length === 0 && <EmptyState title="Nenhum serviço disponível" description="Esta empresa ainda não publicou serviços para agendamento." />}
            {services.data && <div className="grid gap-3 sm:grid-cols-2">{services.data.map((item) => <article key={item.id} className="flex min-h-48 flex-col rounded-xl border border-[#d8e5f4] p-4"><div className="flex items-start gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#edf5ff] text-[#087cf0]"><Scissors className="size-5" aria-hidden="true" /></span><div className="min-w-0"><h3 className="font-bold">{item.name}</h3>{item.description && <p className="mt-1 line-clamp-3 text-sm leading-5 text-[#7182b2]">{item.description}</p>}</div></div><div className="mt-auto flex flex-wrap gap-x-5 gap-y-2 pt-4 text-sm text-[#52658f]"><span className="inline-flex items-center gap-1.5"><Clock3 className="size-4" />{durationMinutes(item.duration)} min</span>{item.price !== null && <span className="inline-flex items-center gap-1.5"><Tag className="size-4" />{formatMoney(item.price)}</span>}</div><Button className="mt-4 w-full" aria-label={`Selecionar ${item.name}`} onClick={() => { setService(item); setProfessional(null); setStep('professional') }}>Selecionar</Button></article>)}</div>}
          </StepSection>}
          {step === 'professional' && <StepSection title="Escolha o profissional" description="Mostramos somente profissionais disponíveis para o serviço selecionado.">{professionals.isPending && <LoadingState />}{professionals.isError && <Notice>{apiErrorMessage(professionals.error)}</Notice>}{professionals.data?.length === 0 && <EmptyState title="Nenhum profissional disponível" description="Não há profissionais ativos para este serviço." />}{professionals.data && <div className="grid gap-3 sm:grid-cols-2">{professionals.data.map((item) => <button key={item.id} className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-[#d8e5f4] p-4 text-left hover:border-[#7bb7ef]" onClick={() => { setProfessional(item); setStep('time') }}><span className="inline-flex min-w-0 items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#edf5ff] text-[#087cf0]"><UserRound className="size-5" /></span><span className="truncate font-semibold">{item.name}</span></span><ArrowRight className="size-4 shrink-0 text-[#7182b2]" /></button>)}</div>}</StepSection>}
          {step === 'time' && <StepSection title="Escolha a data e o horário" description="Os horários abaixo refletem a disponibilidade real da empresa."><div className="max-w-sm"><Field label="Data" type="date" min={minimumDate} value={date} onChange={(event) => { setDate(event.target.value); setStartsAt('') }} /></div>{availability.isFetching && <LoadingState label="Consultando disponibilidade" />}{availability.isError && <div className="mt-4"><Notice>{apiErrorMessage(availability.error)}</Notice></div>}{availability.data?.length === 0 && <div className="mt-5"><EmptyState title="Sem horários nesta data" description="Escolha outro dia para continuar." /></div>}{availability.data && availability.data.length > 0 && <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">{availability.data.map((item) => <button key={item.starts_at} className={`btn !px-2 ${startsAt === item.starts_at ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStartsAt(item.starts_at)}>{formatTime(item.starts_at)}</button>)}</div>}<div className="mt-6 flex justify-end"><Button disabled={!startsAt || create.isPending} onClick={() => rescheduling ? create.mutate() : setStep('details')}>{rescheduling ? 'Confirmar novo horário' : 'Continuar'}</Button></div>{create.isError && <div className="mt-4"><Notice>{apiErrorMessage(create.error)}</Notice></div>}</StepSection>}
          {step === 'details' && <StepSection title="Seus dados" description="Confira como a empresa poderá identificar e contatar você.">{status === 'authenticated' && user && <div className="rounded-xl border border-[#d8e5f4] p-4"><p className="font-semibold">Usar meus dados salvos</p><div className="mt-2 text-sm leading-6 text-[#52658f]">{user.full_name}<br />{user.email}<br />{user.whatsapp}</div><div className="mt-3 grid gap-1"><label className="flex min-h-11 cursor-pointer items-center gap-2"><input type="radio" name="saved-data" checked={useSaved} onChange={() => setUseSaved(true)} /> Usar estes dados</label><label className="flex min-h-11 cursor-pointer items-center gap-2"><input type="radio" name="saved-data" checked={!useSaved} onChange={() => setUseSaved(false)} /> Alterar apenas neste agendamento</label></div></div>}<form className="mt-5 grid gap-4" onSubmit={nextFromDetails} noValidate>{(!user || !useSaved) && <><Field label="Nome" name="name" defaultValue={user?.full_name || snapshot.name} required error={fieldErrors.name} /><Field label="E-mail" name="email" type="email" defaultValue={user?.email || snapshot.email} required error={fieldErrors.email} /><Field label="WhatsApp" name="whatsapp" type="tel" defaultValue={user?.whatsapp || snapshot.whatsapp} required error={fieldErrors.whatsapp} /></>}<TextAreaField label="Observação (opcional)" name="notes" defaultValue={snapshot.notes} maxLength={2000} />{!user && <Turnstile action="anonymous_booking" onToken={setTurnstile} />}{Object.keys(fieldErrors).length > 0 && <Notice kind="validation">Preencha os campos obrigatórios.</Notice>}<Button className="w-full sm:ml-auto sm:w-auto" type="submit">Revisar agendamento</Button></form></StepSection>}
          {step === 'review' && <StepSection title="Revise antes de confirmar" description="Verifique os dados antes de enviar o agendamento."><dl className="divide-y divide-[#e1eaf5] rounded-xl border border-[#d8e5f4] px-4">{[['Empresa', brand.name], ['Serviço', service?.name], ['Profissional', professional?.name], ['Data e horário', startsAt ? formatDateTime(startsAt) : ''], ['Cliente', user && useSaved ? user.full_name : snapshot.name]].map(([label, value]) => <div key={label} className="grid gap-1 py-3 text-sm sm:grid-cols-[8rem_1fr]"><dt className="text-[#7182b2]">{label}</dt><dd className="font-medium text-[#172653]">{value}</dd></div>)}</dl>{!user && <p className="mt-5 text-sm leading-6 text-[#52658f]">Ao continuar, seus dados serão coletados para realizar e administrar este agendamento. Saiba mais na <Link className="font-semibold text-[#087cf0] underline-offset-2 hover:underline" to="/politica-de-privacidade">Política de Privacidade</Link> e nos <Link className="font-semibold text-[#087cf0] underline-offset-2 hover:underline" to="/termos-de-uso">Termos de Uso</Link>.</p>}{create.isError && <div className="mt-4"><Notice>{apiErrorMessage(create.error)}</Notice></div>}<Button className="mt-6 w-full sm:ml-auto sm:w-auto" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? 'Confirmando…' : 'Confirmar agendamento'}</Button></StepSection>}
          {step === 'confirmed' && confirmation && <div className="py-2"><div className="grid size-12 place-items-center rounded-full bg-[#e7f7ee] text-[#16804b]"><Check className="size-6" /></div><h2 className="mt-5 text-2xl font-bold">Agendamento recebido</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#7182b2]">A empresa recebeu sua solicitação. Você pode acompanhar o status e gerenciar este horário enquanto o prazo permitir.</p><dl className="mt-6 grid gap-3 rounded-xl border border-[#d8e5f4] p-4 text-sm"><SummaryRow label="Status"><StatusBadge status={confirmation.status} /></SummaryRow><SummaryRow label="Empresa">{confirmation.company_name}</SummaryRow><SummaryRow label="Serviço">{confirmation.service_name}</SummaryRow><SummaryRow label="Profissional">{confirmation.professional_name}</SummaryRow><SummaryRow label="Quando">{formatDateTime(confirmation.starts_at)}</SummaryRow></dl>{cancel.isError && <div className="mt-4"><Notice>{apiErrorMessage(cancel.error)}</Notice></div>}{(confirmation.can_cancel || confirmation.can_reschedule) && <div className="mt-6 flex flex-wrap gap-3">{confirmation.can_reschedule && <Button variant="secondary" onClick={beginReschedule}>Reagendar</Button>}{confirmation.can_cancel && <Button variant="danger" disabled={cancel.isPending} onClick={() => cancel.mutate()}>{cancel.isPending ? 'Cancelando…' : 'Cancelar agendamento'}</Button>}</div>}{user && <Link className="btn btn-secondary mt-3" to="/cliente"><CalendarDays className="size-4" /> Meus agendamentos</Link>}</div>}
        </section>
      </div>
    </div>
  </BookingFrame>
}

function BookingFrame({ children }: { children: ReactNode }) {
  return <div className="booking-theme flex min-h-screen flex-col overflow-x-hidden"><PublicHeader mode="customer" /><main className="flex-1">{children}</main><PublicFooter /></div>
}

function BookingStepper({ current }: { current: number }) {
  return <nav className="mt-4 border-t border-[#e1eaf5] pt-4 lg:mt-5" aria-label="Etapas do agendamento"><ol className="grid grid-cols-6 gap-1 lg:grid-cols-1 lg:gap-1">{stepLabels.map((label, index) => { const completed = index < current; const active = index === current; return <li key={label} aria-current={active ? 'step' : undefined} className={`flex min-w-0 flex-col items-center gap-1 rounded-lg py-1 text-center lg:flex-row lg:gap-3 lg:px-2 lg:py-2 lg:text-left ${active ? 'bg-[#edf5ff] font-semibold text-[#087cf0]' : completed ? 'text-[#355b88]' : 'text-[#94a1bd]'}`}><span className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs ${active ? 'border-[#087cf0] bg-[#087cf0] text-white' : completed ? 'border-[#87b5e5] bg-[#eef6ff]' : 'border-[#cbd9e9]'}`}>{completed ? <Check className="size-3.5" /> : index + 1}</span><span className={`${active ? 'block' : 'sr-only'} max-w-full truncate text-[.65rem] leading-3 lg:not-sr-only lg:text-sm`}>{label}</span></li>})}</ol></nav>
}

function StepSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <><header className="mb-5"><h2 className="text-xl font-bold tracking-[-.025em] sm:text-2xl">{title}</h2><p className="mt-1 text-sm leading-6 text-[#7182b2]">{description}</p></header>{children}</>
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-start justify-between gap-4"><dt className="text-[#7182b2]">{label}</dt><dd className="text-right font-medium text-[#172653]">{children}</dd></div>
}

function CenteredNotice({ error }: { error: unknown }) {
  return <div className="mx-auto max-w-xl px-5 py-20"><Notice>{apiErrorMessage(error)}</Notice><Link to="/cliente/procurar" className="btn btn-secondary mt-5">Voltar à busca</Link></div>
}

function visitorIdentifier() {
  const storageKey = 'obn_anonymous_visitor'
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored && /^[A-Za-z0-9_-]{20,64}$/.test(stored)) return stored
    const created = window.crypto.randomUUID()
    window.localStorage.setItem(storageKey, created)
    return created
  } catch {
    inMemoryVisitorId ||= window.crypto.randomUUID()
    return inMemoryVisitorId
  }
}
