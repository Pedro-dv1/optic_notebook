import { useQuery } from '@tanstack/react-query'
import { LuArrowLeft as ArrowLeft, LuArrowRight as ArrowRight, LuBuilding2 as Building2, LuListFilter as ListFilter, LuSearch as Search, LuSlidersHorizontal as SlidersHorizontal, LuX as X } from 'react-icons/lu'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { PublicBackLink, PublicPage } from '../components/PublicLayout'
import { CompanyObservationPopover } from '../components/CompanyObservationPopover'
import { EmptyState, LoadingState, Notice, SelectField } from '../components/ui'
import { safeImageUrl } from '../lib/media'
import { isPublicPlatformConfig, type CompanySearchResult, type Paginated, type PublicPlatformConfig } from '../types/api'

const emptyFilters = { state: '', city: '', niche: '', businessType: '', service: '' }

export default function CustomerHubPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filters, setFilters] = useState(emptyFilters)
  const [draftFilters, setDraftFilters] = useState(emptyFilters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [ordering, setOrdering] = useState<'name' | '-name'>('name')
  const [page, setPage] = useState(1)
  const filterButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1) }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const updateFilters = useCallback((next: typeof emptyFilters) => { setFilters(next); setPage(1) }, [])
  const openFilters = useCallback(() => { setDraftFilters(filters); setFiltersOpen(true) }, [filters])
  const closeFilters = useCallback(() => { setFiltersOpen(false); filterButtonRef.current?.focus() }, [])
  const applyFilters = useCallback(() => { updateFilters(draftFilters); closeFilters() }, [closeFilters, draftFilters, updateFilters])
  const clearFilters = useCallback(() => { setDraftFilters(emptyFilters); updateFilters(emptyFilters) }, [updateFilters])

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ ordering, page: String(page) })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (filters.state) params.set('state', filters.state)
    if (filters.city.trim()) params.set('city', filters.city.trim())
    if (filters.niche) params.set('niche', filters.niche)
    if (filters.businessType) params.set('business_type', filters.businessType)
    if (filters.service.trim()) params.set('service', filters.service.trim())
    return params.toString()
  }, [debouncedSearch, filters, ordering, page])

  const companies = useQuery({
    queryKey: ['public-companies', queryString],
    queryFn: () => api.get<Paginated<CompanySearchResult>>(`/public/companies/?${queryString}`),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  })
  const options = useQuery({ queryKey: ['platform-config'], queryFn: () => api.get<unknown>('/public/platform/'), staleTime: 3_600_000 })
  const companyOptions = isPublicPlatformConfig(options.data) ? options.data.company_options : null
  const hasFilters = Object.values(filters).some(Boolean)

  return <PublicPage mode="customer" className="pb-24 md:pb-0">
    <div className="relative z-10 mx-auto max-w-[76rem] px-5 pb-12 pt-5 sm:px-8 sm:pt-7 lg:px-10">
      <PublicBackLink to="/" />
      <header className="text-center">
        <h1 className="public-display text-[2.5rem] leading-[1.04] sm:text-5xl lg:text-[3.4rem]">Agende com <span>facilidade.</span></h1>
        <p className="mx-auto mt-3 max-w-3xl text-lg leading-7 text-[#7182b2]">Pesquise uma empresa para encontrar horários e agendar.</p>
      </header>
      <section className="mx-auto mt-7 max-w-[62rem]" aria-labelledby="companies-title">
        <h2 id="companies-title" className="sr-only">Empresas disponíveis</h2>
        <label className="relative block"><span className="sr-only">Pesquisar empresa, serviço ou área</span><Search className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-[#164c9c]" aria-hidden="true" /><input className="field !min-h-14 !rounded-xl !pl-12 !text-base" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Empresa, serviço ou área" /></label>
        <div className="mt-5 flex flex-wrap gap-3">
          <button ref={filterButtonRef} type="button" className="btn btn-secondary !min-h-12 !px-5 !text-[#071044]" onClick={openFilters} aria-expanded={filtersOpen} aria-controls="company-filters"><ListFilter className="size-5" /> Filtrar{hasFilters ? ' · ativo' : ''}</button>
          <button type="button" className="btn btn-secondary !min-h-12 !px-5 !text-[#071044]" onClick={() => { setOrdering((value) => value === 'name' ? '-name' : 'name'); setPage(1) }} aria-label={`Alterar ordenação para ${ordering === 'name' ? 'Z a A' : 'A a Z'}`}><SlidersHorizontal className="size-5" /> {ordering === 'name' ? 'A - Z' : 'Z - A'}</button>
        </div>
        {options.isError && <div className="mt-4"><Notice>{apiErrorMessage(options.error)}</Notice></div>}
        {options.isSuccess && !companyOptions && <div className="mt-4"><Notice>As opções de filtros estão temporariamente indisponíveis.</Notice></div>}
      </section>
      <section className="mt-9" aria-live="polite">
        {companies.isPending && <LoadingState label="Buscando empresas" />}
        {companies.isFetching && !companies.isPending && <p className="mb-3 text-center text-sm text-[#7182b2]">Atualizando resultados…</p>}
        {companies.isError && <Notice>{apiErrorMessage(companies.error)}</Notice>}
        {companies.data?.results.length === 0 && <EmptyState title="Nenhuma empresa encontrada" description="Revise a busca ou remova algum filtro para tentar novamente." />}
        {companies.data && companies.data.results.length > 0 && <><p className="mb-3 text-sm text-[#7182b2]">{companies.data.count} {companies.data.count === 1 ? 'empresa encontrada' : 'empresas encontradas'}</p><ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{companies.data.results.map((company) => <CompanyCard key={company.slug} company={company} />)}</ul></>}
        {companies.data && (companies.data.previous || companies.data.next) && <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Paginação"><button type="button" className="btn btn-secondary" disabled={!companies.data.previous} onClick={() => setPage((value) => Math.max(1, value - 1))}><ArrowLeft className="size-4" /> Anterior</button><span className="text-sm text-[#7182b2]">Página {page}</span><button type="button" className="btn btn-secondary" disabled={!companies.data.next} onClick={() => setPage((value) => value + 1)}>Próxima <ArrowRight className="size-4" /></button></nav>}
      </section>
    </div>
    <FilterPanel open={filtersOpen} filters={draftFilters} options={companyOptions} onChange={setDraftFilters} onApply={applyFilters} onClear={clearFilters} onClose={closeFilters} />
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d3e2f4] bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden"><Link to={user ? '/cliente/conta' : '/cliente/login'} className="public-primary-link w-full">{user ? 'Minha conta' : 'Entrar'}</Link></div>
  </PublicPage>
}

interface FilterPanelProps {
  open: boolean
  filters: typeof emptyFilters
  options: PublicPlatformConfig['company_options'] | null
  onChange: (filters: typeof emptyFilters) => void
  onApply: () => void
  onClear: () => void
  onClose: () => void
}

function FilterPanel({ open, filters, options, onChange, onApply, onClear, onClose }: FilterPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const allowedTypes = options?.business_types_by_niche?.[filters.niche]
  const businessTypes = allowedTypes ? options?.business_types.filter((option) => allowedTypes.includes(option.value)) : options?.business_types

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const panel = panelRef.current
    panel?.querySelector<HTMLElement>('select, input, button')?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'))
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  if (!open) return null
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onApply() }

  return createPortal(<div className="public-page fixed inset-0 z-50" role="presentation" style={{ background: 'transparent' }}>
    <button type="button" className="absolute inset-0 hidden bg-[#071044]/20 md:block" aria-hidden="true" tabIndex={-1} onClick={onClose} />
    <aside ref={panelRef} id="company-filters" role="dialog" aria-modal="true" aria-labelledby="company-filters-title" className="absolute inset-y-0 left-0 flex w-full flex-col bg-white shadow-2xl md:w-[320px] md:border-r md:border-[#d4e4f7]">
      <header className="flex min-h-20 items-center justify-between border-b border-[#d9e6f6] px-5">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#087cf0]">Pesquisa</p><h2 id="company-filters-title" className="mt-1 text-xl font-bold text-[#070d35]">Filtros</h2></div>
        <button type="button" className="btn btn-ghost !size-11 !min-h-0 !p-0" onClick={onClose} aria-label="Fechar filtros"><X className="size-6" /></button>
      </header>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
        <div className="grid flex-1 content-start gap-5 overflow-y-auto px-5 py-6">
          <SelectField label="Estado" value={filters.state} disabled={!options} onChange={(event) => onChange({ ...filters, state: event.target.value })}><option value="">Todos</option>{options?.states.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField>
          <label><span className="label">Cidade</span><input className="field" value={filters.city} maxLength={100} onChange={(event) => onChange({ ...filters, city: event.target.value })} /></label>
          <SelectField label="Nicho" value={filters.niche} disabled={!options} onChange={(event) => { const niche = event.target.value; onChange({ ...filters, niche, businessType: options?.business_types_by_niche?.[niche]?.includes(filters.businessType) ? filters.businessType : '' }) }}><option value="">Todos</option>{options?.niches.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField>
          <SelectField label="Tipo de negócio" value={filters.businessType} disabled={!options || !filters.niche} onChange={(event) => onChange({ ...filters, businessType: event.target.value })}><option value="">Todos</option>{businessTypes?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField>
          <label><span className="label">Serviço</span><input className="field" value={filters.service} maxLength={120} onChange={(event) => onChange({ ...filters, service: event.target.value })} /></label>
        </div>
        <div className="grid gap-3 border-t border-[#d9e6f6] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
          <button type="submit" className="public-primary-link w-full">Aplicar filtros</button>
          <button type="button" className="btn btn-secondary w-full" onClick={onClear}>Limpar filtros</button>
        </div>
      </form>
    </aside>
  </div>, document.body)
}

function CompanyCard({ company }: { company: CompanySearchResult }) {
  const logo = safeImageUrl(company.logo)
  const category = [company.business_type_label, company.niche_label].filter(Boolean).join(' · ')
  return <li><article className="relative overflow-hidden rounded-2xl border border-[#d4e4f7] bg-white text-[#070d35] transition-colors hover:border-[#78b8f5]">
    <div className="absolute right-3 top-3 z-10"><CompanyObservationPopover companyName={company.name} notes={company.public_notes} /></div>
    <Link to={`/${company.slug}`} aria-label={`Abrir ${company.name} e agendar`} className="group block">
      {logo ? <img src={logo} alt={`Imagem de ${company.name}`} loading="lazy" className="h-40 w-full object-cover sm:h-44" /> : <span className="grid h-40 w-full place-items-center bg-[#eef5ff] text-[#7aaee8] sm:h-44"><Building2 className="size-12" aria-hidden="true" /></span>}
      <span className="flex items-end gap-4 p-5"><span className="min-w-0 flex-1"><strong className="block truncate text-lg tracking-[-.03em]">{company.name}</strong>{category && <span className="mt-1 block truncate text-sm font-medium text-[#087cf0]">{category}</span>}{company.city && <span className="mt-2 block truncate text-sm text-[#7182b2]">{company.city}{company.state ? ` - ${company.state}` : ''}</span>}{company.address && <span className="mt-2 line-clamp-2 block text-xs leading-5 text-[#7182b2]">{company.address}</span>}</span><ArrowRight className="mb-1 size-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
    </Link>
  </article></li>
}
