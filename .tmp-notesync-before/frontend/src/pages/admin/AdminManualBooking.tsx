import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useEffect, useState, type FormEvent } from 'react'
import { LuPlus as Plus } from 'react-icons/lu'
import { api, apiErrorMessage } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { Button, Dialog, Field, Notice, SelectField, TextAreaField } from '../../components/ui'
import { useCompanyUnits } from '../../components/UnitFields'
import { formatTime } from '../../lib/format'
import type { AvailabilitySlot, CompanyCustomer, Paginated, Professional, Service } from '../../types/api'

async function listAll<T>(path: string): Promise<T[]> {
  const results: T[] = []
  for (let page = 1; ; page += 1) {
    const response = await api.get<Paginated<T>>(`${path}?page_size=200&page=${page}`)
    results.push(...response.results)
    if (!response.next) return results
  }
}

export function AdminManualBooking() {
  const { user } = useAuth()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const units = useCompanyUnits(open)
  const [chosenUnit, setChosenUnit] = useState('')
  const activeUnits = units.data?.filter((unit) => unit.is_active) || []
  const unitId = activeUnits.length === 1 ? activeUnits[0].id : chosenUnit
  const [service, setService] = useState('')
  const [professional, setProfessional] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [slot, setSlot] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(customerSearch.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [customerSearch])
  const [customer, setCustomer] = useState<CompanyCustomer | null>(null)
  const services = useQuery({ queryKey: ['manual-services'], queryFn: () => listAll<Service>('/company/services/'), enabled: open })
  const professionals = useQuery({ queryKey: ['manual-professionals'], queryFn: () => listAll<Professional>('/company/professionals/'), enabled: open })
  const customers = useQuery({ queryKey: ['company-customers', debouncedSearch], queryFn: ({ signal }) => api.get<Paginated<CompanyCustomer>>(`/company/customers/?q=${encodeURIComponent(debouncedSearch)}`, { signal }), enabled: open && debouncedSearch.length >= 2 })
  const compatible = professionals.data?.filter((item) => item.is_active && item.service_ids.includes(service) && (!unitId || item.unit_ids?.includes(unitId))) || []
  const selectedProfessional = compatible.length === 1 ? compatible[0].id : compatible.some((item) => item.id === professional) ? professional : ''
  const availability = useQuery({
    queryKey: ['manual-availability', user?.company?.slug, service, selectedProfessional, date, unitId],
    queryFn: () => api.get<AvailabilitySlot[]>(`/public/companies/${user!.company!.slug}/availability/?service=${service}&professional=${selectedProfessional}&date=${date}${unitId ? `&unit=${unitId}` : ''}`),
    enabled: open && Boolean(user?.company?.slug && service && selectedProfessional && date),
  })
  const create = useMutation({
    mutationFn: (payload: object) => api.post('/company/appointments/manual/', payload),
    onSuccess: () => { setOpen(false); setSlot(''); client.invalidateQueries({ queryKey: ['appointments'] }) },
  })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!slot) return
    const data = new FormData(event.currentTarget)
    create.mutate({
      service, professional: selectedProfessional, starts_at: slot, ...(unitId ? { unit: unitId } : {}),
      customer_name: data.get('customer_name'), customer_email: data.get('customer_email'),
      customer_whatsapp: data.get('customer_whatsapp'), customer_notes: data.get('customer_notes'),
    })
  }
  return <>
    <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Novo agendamento</Button>
    <Dialog open={open} title="Novo agendamento" onClose={() => setOpen(false)}>
      <form className="grid gap-4" onSubmit={submit}>{units.isError && <Notice>{apiErrorMessage(units.error)}</Notice>}{activeUnits.length > 1 && <SelectField label="Unidade" required value={chosenUnit} onChange={(event) => { setChosenUnit(event.target.value); setService(''); setProfessional(''); setSlot('') }}><option value="">Selecione</option>{activeUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</SelectField>}
        <SelectField label="Serviço" required value={service} onChange={(event) => { setService(event.target.value); setProfessional(''); setSlot('') }}>
          <option value="">Selecione um serviço</option>{services.data?.filter((item) => item.is_active && (!item.unit_ids?.length || item.unit_ids.includes(unitId))).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </SelectField>
        {compatible.length > 1 && <SelectField label="Profissional" required value={professional} onChange={(event) => { setProfessional(event.target.value); setSlot('') }}><option value="">Selecione um profissional</option>{compatible.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>}
        {compatible.length === 1 && <p className="text-sm text-[#52658f]">Profissional: {compatible[0].name}</p>}
        {service && compatible.length === 0 && <Notice>Nenhum profissional ativo realiza este serviço.</Notice>}
        <Field label="Data" type="date" required min={format(new Date(), 'yyyy-MM-dd')} value={date} onChange={(event) => { setDate(event.target.value); setSlot('') }} />
        {selectedProfessional && <SelectField label="Horário disponível" required value={slot} onChange={(event) => setSlot(event.target.value)}><option value="">Selecione um horário</option>{availability.data?.map((item) => <option key={item.starts_at} value={item.starts_at}>{formatTime(item.starts_at)}</option>)}</SelectField>}
        {availability.data?.length === 0 && <Notice kind="info">Sem horários disponíveis nesta data.</Notice>}
        <Field label="Localizar cliente existente" type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Nome, e-mail ou WhatsApp" />
        {customers.data && customers.data.results.length > 0 && <SelectField label="Cliente encontrado" value={customer?.email || ''} onChange={(event) => setCustomer(customers.data!.results.find((item) => item.email === event.target.value) || null)}><option value="">Informar novo contato</option>{customers.data.results.map((item) => <option key={item.email} value={item.email}>{item.name} · {item.email}</option>)}</SelectField>}
        <Field key={`name-${customer?.email || 'new'}`} label="Cliente" name="customer_name" required maxLength={150} defaultValue={customer?.name || ''} />
        <Field key={`email-${customer?.email || 'new'}`} label="E-mail" name="customer_email" type="email" required defaultValue={customer?.email || ''} />
        <Field key={`phone-${customer?.email || 'new'}`} label="WhatsApp" name="customer_whatsapp" required maxLength={20} defaultValue={customer?.whatsapp || ''} />
        <TextAreaField label="Observação" name="customer_notes" maxLength={2000} />
        {services.isError && <Notice>{apiErrorMessage(services.error)}</Notice>}{professionals.isError && <Notice>{apiErrorMessage(professionals.error)}</Notice>}{availability.isError && <Notice>{apiErrorMessage(availability.error)}</Notice>}{customers.isError && <Notice>{apiErrorMessage(customers.error)}</Notice>}{create.isError && <Notice>{apiErrorMessage(create.error)}</Notice>}
        <Button loading={create.isPending} disabled={units.isPending || units.isError || !unitId || !service || !selectedProfessional || !slot}>Criar agendamento confirmado</Button>
      </form>
    </Dialog>
  </>
}
