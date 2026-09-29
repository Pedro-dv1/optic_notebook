import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { LuHeart } from 'react-icons/lu'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import type { CompanyFavorite } from '../types/api'
import { Button } from './ui'

export function FavoriteButton({ companyId, companyName, initialFavoriteId, showLabel = false }: { companyId: string; companyName: string; initialFavoriteId?: string | null; showLabel?: boolean }) {
  const { user } = useAuth()
  const client = useQueryClient()
  const enabled = Boolean(user && !user.company && !user.professional && !user.is_superuser)
  const favorite = useQuery({ queryKey: ['favorite-status', companyId], queryFn: ({ signal }) => api.get<{ id: string | null }>(`/customers/favorites/status/?company=${encodeURIComponent(companyId)}`, { signal }), enabled: enabled && initialFavoriteId === undefined, initialData: initialFavoriteId !== undefined ? { id: initialFavoriteId } : undefined, staleTime: 60_000 })
  useEffect(() => {
    if (initialFavoriteId !== undefined) client.setQueryData(['favorite-status', companyId], { id: initialFavoriteId })
  }, [client, companyId, initialFavoriteId])
  const toggle = useMutation({
    mutationFn: () => favorite.data?.id ? api.delete(`/customers/favorites/${favorite.data.id}/`) : api.post<CompanyFavorite>('/customers/favorites/', { company: companyId }),
    onSuccess: (result) => {
      client.setQueryData(['favorite-status', companyId], { id: result && typeof result === 'object' && 'id' in result ? result.id : null })
      client.invalidateQueries({ queryKey: ['customer-favorites'] }); client.invalidateQueries({ queryKey: ['favorite-states'] })
      client.invalidateQueries({ queryKey: ['favorite-suggestions'] })
      client.invalidateQueries({ queryKey: ['public-companies'] })
    },
  })
  if (!enabled) return null
  const error = toggle.error || favorite.error
  return <div className="relative shrink-0">
    <Button type="button" variant={showLabel ? 'secondary' : 'icon'} className={showLabel ? '' : 'catalog-icon-button'} aria-label={`${favorite.data?.id ? 'Remover' : 'Adicionar'} ${companyName} ${favorite.data?.id ? 'dos' : 'aos'} favoritos`} aria-pressed={Boolean(favorite.data?.id)} aria-busy={toggle.isPending || undefined} disabled={toggle.isPending || favorite.isPending || favorite.isError} onClick={() => toggle.mutate()}><LuHeart className={`size-4 ${favorite.data?.id ? 'fill-current' : ''}`} aria-hidden="true" />{showLabel && (favorite.data?.id ? 'Favoritado' : 'Favoritar')}</Button>
    {error && <p role="alert" className="absolute right-0 top-full z-20 mt-2 w-52 max-w-[calc(100vw-2rem)] rounded-lg border border-[#e3a1a8] bg-white p-2 text-xs text-[#a52d39]">{apiErrorMessage(error)}</p>}
  </div>
}
