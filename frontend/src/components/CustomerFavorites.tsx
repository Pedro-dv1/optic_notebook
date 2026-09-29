import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { api, apiErrorMessage } from '../api/client'
import type { CompanyFavorite, CompanySearchResult, Paginated } from '../types/api'
import { Button, EmptyState, LoadingState, Notice } from './ui'
import { FavoriteButton } from './FavoriteButton'

export function FavoriteSuggestions() {
  const client = useQueryClient()
  const suggestions = useQuery({ queryKey: ['favorite-suggestions'], queryFn: () => api.get<CompanySearchResult[]>('/customers/favorites/suggestions/'), staleTime: 60_000 })
  const dismiss = useMutation({ mutationFn: (company: string) => api.post('/customers/favorites/dismiss-suggestion/', { company }), onSuccess: () => client.invalidateQueries({ queryKey: ['favorite-suggestions'] }) })
  const company = suggestions.data?.[0]
  if (suggestions.isError) return <Notice>{apiErrorMessage(suggestions.error)}</Notice>
  if (!company?.id) return null
  return <aside className="panel mb-5 flex flex-col gap-4 sm:flex-row sm:items-center" aria-label="Sugestão de favorito"><p className="flex-1 text-sm leading-6 text-[#43557e]">Você já agendou algumas vezes com <strong>{company.name}</strong>. Adicione aos favoritos para acessar mais rápido.</p><div className="flex items-center gap-3"><FavoriteButton companyId={company.id} companyName={company.name} initialFavoriteId={null} showLabel /><Button variant="secondary" loading={dismiss.isPending} onClick={() => dismiss.mutate(company.id!)}>Agora não</Button></div>{dismiss.isError && <Notice>{apiErrorMessage(dismiss.error)}</Notice>}</aside>
}

export function CustomerFavorites() {
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['customer-favorites', page], queryFn: ({ signal }) => api.get<Paginated<CompanyFavorite>>(`/customers/favorites/?page=${page}`, { signal }) })
  return <section aria-labelledby="favorites-title"><h2 id="favorites-title" className="mb-5 text-2xl font-bold">Favoritos</h2>{query.isPending && <LoadingState label="Carregando favoritos" />}{query.isError && <Notice>{apiErrorMessage(query.error)}</Notice>}{query.data?.results.length === 0 && <EmptyState title="Suas empresas favoritas aparecerão aqui" description="Use o coração na busca ou na página da empresa para salvar um acesso rápido." action={<Link to="/cliente/procurar" className="btn btn-secondary">Procurar empresas</Link>} />}<ul className="grid gap-4 lg:grid-cols-2">{query.data?.results.map((favorite) => <li key={favorite.id} className="panel flex items-start gap-4"><div className="min-w-0 flex-1"><h3 className="font-semibold">{favorite.company_details.name}</h3><p className="mt-2 text-sm text-[#43557e]">{[favorite.company_details.city, favorite.company_details.state].filter(Boolean).join(' - ')}</p><Link to={`/cliente/agendar/${favorite.company_details.slug}`} className="btn btn-secondary mt-4">Agendar nesta empresa</Link></div><FavoriteButton companyId={favorite.company} companyName={favorite.company_details.name} initialFavoriteId={favorite.id} /></li>)}</ul>{query.data && (query.data.previous || query.data.next) && <nav className="mt-5 flex items-center justify-center gap-3" aria-label="Paginação de favoritos"><Button variant="secondary" disabled={!query.data.previous} onClick={() => setPage(page - 1)}>Anterior</Button><span>Página {page}</span><Button variant="secondary" disabled={!query.data.next} onClick={() => setPage(page + 1)}>Próxima</Button></nav>}</section>
}
