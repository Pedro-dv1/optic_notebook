import { useQuery } from '@tanstack/react-query'
import { LuArrowLeft as ArrowLeft, LuArrowRight as ArrowRight, LuBuilding2 as Building2, LuSearch as Search, LuStar as Star } from 'react-icons/lu'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { PublicBackLink, PublicPage } from '../components/PublicLayout'
import { FavoriteButton } from '../components/FavoriteButton'
import { CompanySearchInput } from '../components/CompanySearchInput'
import { CompanyObservationPopover } from '../components/CompanyObservationPopover'
import { EmptyState, LoadingState, Notice } from '../components/ui'
import { safeImageUrl } from '../lib/media'
import type { CompanySearchResult, Paginated } from '../types/api'

export default function CustomerHubPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timeout = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1) }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const params = new URLSearchParams({ ordering: 'recommended', page: String(page) })
  if (debouncedSearch) params.set('search', debouncedSearch)
  const queryString = params.toString()

  const companies = useQuery({
    queryKey: ['public-companies', user?.id ?? 'public', queryString],
    queryFn: ({ signal }) => api.get<Paginated<CompanySearchResult>>(`/public/companies/?${queryString}`, { signal }),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  })
  const companyIds = companies.data?.results.map((company) => company.id).filter(Boolean).join(',') || ''
  const favoriteStates = useQuery({ queryKey: ['favorite-states', user?.id, companyIds], queryFn: ({ signal }) => api.get<Record<string, string>>(`/customers/favorites/status/?companies=${companyIds}`, { signal }), enabled: Boolean(companyIds && user && !user.company && !user.professional && !user.is_superuser), staleTime: 60_000 })
  return <PublicPage mode="customer" className={user ? '' : 'pb-24 md:pb-0'}>
    <div className="relative z-10 mx-auto max-w-[76rem] px-5 pb-12 pt-5 sm:px-8 sm:pt-7 lg:px-10">
      {!user && <PublicBackLink to="/" />}
      <header className="text-center">
        <h1 className="public-display text-[2.5rem] leading-[1.04] sm:text-5xl lg:text-[3.4rem]">Agende com <span>facilidade.</span></h1>
        <p className="mx-auto mt-3 max-w-3xl text-lg leading-7 text-[#7182b2]">Pesquise uma empresa para encontrar horários e agendar.</p>
      </header>
      <section className="mx-auto mt-7 max-w-[62rem]" aria-labelledby="companies-title">
        <h2 id="companies-title" className="sr-only">Empresas disponíveis</h2>
        <form role="search" onSubmit={(event) => { event.preventDefault(); setDebouncedSearch(search.trim()); setPage(1) }}><label className="relative block"><span className="sr-only">Pesquisar empresa, serviço ou área</span><Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#164c9c]" aria-hidden="true" /><CompanySearchInput className="field !min-h-12 !pl-12 !text-base" type="search" maxLength={150} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar estabelecimento..." /></label></form>
      </section>
      <section className="mt-9" aria-live="polite">
        {companies.isPending && <LoadingState label="Buscando empresas" />}
        {companies.isFetching && !companies.isPending && <p className="mb-3 text-center text-sm text-[#7182b2]">Atualizando resultados…</p>}
        {favoriteStates.isError && <Notice>{apiErrorMessage(favoriteStates.error)}</Notice>}{companies.isError && <Notice>{apiErrorMessage(companies.error)}</Notice>}
        {companies.data?.results.length === 0 && <EmptyState title="Nenhuma empresa encontrada" description="Tente pesquisar por outro nome ou serviço." />}
        {companies.data && companies.data.results.length > 0 && <>{user && !user.company && !user.professional && !user.is_superuser && <h2 className="mb-2 text-xl font-semibold">Recomendados para você</h2>}<p className="mb-3 text-sm text-[#7182b2]">{companies.data.count} {companies.data.count === 1 ? 'empresa encontrada' : 'empresas encontradas'}</p><ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{companies.data.results.map((company) => <CompanyCard key={company.slug} company={company} favoriteId={company.id && favoriteStates.data ? favoriteStates.data[company.id] || null : undefined} />)}</ul></>}
        {companies.data && (companies.data.previous || companies.data.next) && <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Paginação"><button type="button" className="btn btn-secondary" disabled={!companies.data.previous} onClick={() => setPage((value) => Math.max(1, value - 1))}><ArrowLeft className="size-4" /> Anterior</button><span className="text-sm text-[#7182b2]">Página {page}</span><button type="button" className="btn btn-secondary" disabled={!companies.data.next} onClick={() => setPage((value) => value + 1)}>Próxima <ArrowRight className="size-4" /></button></nav>}
      </section>
    </div>
    {!user && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d3e2f4] bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden"><Link to="/cliente/login" className="public-primary-link w-full">Entrar</Link></div>}
  </PublicPage>
}

function CompanyCard({ company, favoriteId }: { company: CompanySearchResult; favoriteId?: string | null }) {
  const logo = safeImageUrl(company.logo)
  const category = [company.business_type_label, company.niche_label].filter(Boolean).join(' · ')
  const path = `/cliente/agendar/${company.slug}`
  const rating = (company.average_rating ?? 0).toFixed(1)
  return <li className="min-w-0"><article className="relative isolate h-full rounded-xl border border-[#d4e4f7] bg-white text-[#070d35] transition-colors hover:border-[#78b8f5]">
    <span className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-sm font-semibold text-[#172653] shadow-sm" aria-label={company.review_count > 0 ? `Avaliação ${rating} de 5` : 'Sem avaliações'}><Star className="size-4 fill-[#d69b35] text-[#d69b35]" aria-hidden="true" />{rating}</span>
    <div className="overflow-hidden rounded-t-xl">
      {logo ? <img src={logo} alt={`Imagem de ${company.name}`} loading="lazy" className="h-40 w-full object-cover sm:h-44" /> : <span className="grid h-40 w-full place-items-center bg-[#f5f7fa] text-[#8d98aa] sm:h-44"><Building2 className="size-12" aria-hidden="true" /></span>}
    </div>
    <div className="p-4"><div className="flex items-center gap-1"><h3 className="min-w-0 flex-1 text-lg font-semibold tracking-[-.03em]"><Link className="company-card-link" to={path} aria-label={`Abrir ${company.name} e agendar`}>{company.name}</Link></h3><div className="relative z-10 flex shrink-0">{company.id && favoriteId !== undefined && <FavoriteButton companyId={company.id} companyName={company.name} initialFavoriteId={favoriteId} />}<CompanyObservationPopover companyName={company.name} notes={company.public_notes} /></div></div>
      {company.units && company.units.length > 1 && <p className="mt-1 text-xs text-[#43557e]">{company.units.length} unidades: {[...new Set(company.units.map((unit) => unit.city))].filter(Boolean).join(', ')}</p>}
      {category && <p className="mt-1 text-sm font-medium text-[#0759ad]">{category}</p>}
      {company.city && <p className="mt-2 text-sm text-[#52658a]">{company.city}{company.state ? ` - ${company.state}` : ''}</p>}
      {company.address && <p className="mt-2 text-xs leading-5 text-[#52658a]">{company.address}</p>}
    </div>
  </article></li>
}
