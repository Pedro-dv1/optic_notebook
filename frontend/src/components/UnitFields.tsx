import { useQuery } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../api/client'
import type { CompanyUnit } from '../types/api'
import { LoadingState, Notice } from './ui'

export function useCompanyUnits(enabled = true) {
  return useQuery({ queryKey: ['company-units'], queryFn: () => api.get<CompanyUnit[]>('/company/units/'), enabled, staleTime: 30_000 })
}

export function UnitCheckboxes({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const units = useCompanyUnits()
  if (units.isPending) return <LoadingState label="Carregando unidades" />
  if (units.isError) return <Notice>{apiErrorMessage(units.error)}</Notice>
  return <fieldset><legend className="label">Unidades de atendimento</legend><div className="max-h-40 overflow-auto rounded-md border border-[#d8e5f4] p-2">{units.data.filter((unit) => unit.is_active || ids.includes(unit.id)).map((unit) => <label key={unit.id} className="flex min-h-11 items-center gap-2"><input type="checkbox" name="units" value={unit.id} checked={ids.includes(unit.id)} required={ids.length === 0} onChange={(event) => onChange(event.target.checked ? [...ids, unit.id] : ids.filter((id) => id !== unit.id))} />{unit.name}{!unit.is_active && ' (inativa)'}</label>)}</div><p className="mt-1 text-xs text-[#52658a]">Disponível somente nas unidades selecionadas. Novas unidades têm catálogo próprio.</p></fieldset>
}
