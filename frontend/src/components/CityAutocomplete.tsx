import { LuCircleAlert as AlertCircle, LuLoaderCircle as LoaderCircle, LuMapPin as MapPin } from 'react-icons/lu'
import { useEffect, useId, useMemo, useState } from 'react'

interface Municipality {
  id: number
  name: string
  state: string
}

interface IbgeMunicipality {
  id?: unknown
  nome?: unknown
  microrregiao?: { mesorregiao?: { UF?: { sigla?: unknown } } }
  'regiao-imediata'?: { 'regiao-intermediaria'?: { UF?: { sigla?: unknown } } }
}

let municipalitiesRequest: Promise<Municipality[]> | null = null

function loadMunicipalities() {
  municipalitiesRequest ||= (async () => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12_000)
    try {
      const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome', { signal: controller.signal })
      if (!response.ok) throw new Error('IBGE unavailable')
      const payload: unknown = await response.json()
      if (!Array.isArray(payload)) throw new Error('Invalid IBGE response')
      // ASVS V2.2: dados externos só entram no formulário após validação de tipo e UF.
      return payload.flatMap((item: IbgeMunicipality) => {
        const state = item['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla ?? item.microrregiao?.mesorregiao?.UF?.sigla
        return Number.isInteger(item.id) && typeof item.nome === 'string' && typeof state === 'string' && /^[A-Z]{2}$/.test(state)
          ? [{ id: item.id as number, name: item.nome, state }]
          : []
      })
    } finally {
      window.clearTimeout(timeout)
    }
  })().catch((error) => {
    municipalitiesRequest = null
    throw error
  })
  return municipalitiesRequest
}

function comparable(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

export function CityAutocomplete({ city, state, states, onCityChange, onStateChange, cityError, stateError }: {
  city: string
  state: string
  states: { value: string; label: string }[]
  onCityChange: (value: string) => void
  onStateChange: (value: string) => void
  cityError?: string
  stateError?: string
}) {
  const listId = useId()
  const [debouncedCity, setDebouncedCity] = useState(city)
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const value = city.trim()
      setDebouncedCity(value)
      setStatus(value.length >= 2 ? 'loading' : 'idle')
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [city])

  useEffect(() => {
    if (debouncedCity.length < 2) return
    let active = true
    loadMunicipalities().then((items) => {
      if (!active) return
      setMunicipalities(items)
      setStatus('ready')
      setOpen(true)
    }).catch(() => active && setStatus('error'))
    return () => { active = false }
  }, [debouncedCity])

  const suggestions = useMemo(() => {
    const query = comparable(debouncedCity)
    if (query.length < 2) return []
    return municipalities.filter((item) => comparable(item.name).includes(query)).slice(0, 8)
  }, [debouncedCity, municipalities])

  const select = (item: Municipality) => {
    onCityChange(item.name)
    onStateChange(item.state)
    setOpen(false)
    setActiveIndex(-1)
  }

  return <>
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="block"><span className="label required-label">Cidade</span><span className="relative block">
        <MapPin className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 opacity-55" aria-hidden="true" />
        <input id={`${listId}-input`} name="city" className="field pl-12" value={city} maxLength={100} required autoComplete="off" placeholder="Digite sua cidade" role="combobox" aria-autocomplete="list" aria-expanded={open && status === 'ready'} aria-controls={listId} aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} aria-invalid={Boolean(cityError)} aria-describedby={cityError ? `${listId}-city-error` : `${listId}-status`} onFocus={() => debouncedCity.length >= 2 && setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 100)} onChange={(event) => { onCityChange(event.target.value); onStateChange(''); setActiveIndex(-1) }} onKeyDown={(event) => {
          if (!open || !suggestions.length) return
          if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => (index + 1) % suggestions.length) }
          if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => index <= 0 ? suggestions.length - 1 : index - 1) }
          if (event.key === 'Enter' && activeIndex >= 0) { event.preventDefault(); select(suggestions[activeIndex]) }
          if (event.key === 'Escape') setOpen(false)
        }} />
        {status === 'loading' && <LoaderCircle className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-[#087cf0]" aria-hidden="true" />}
      </span></label>
      <span id={`${listId}-status`} className="mt-1 block min-h-5 text-xs text-[#7182b2]" aria-live="polite">
        {status === 'loading' && 'Buscando municípios…'}
        {status === 'error' && 'Não foi possível consultar o IBGE. Digite a cidade e selecione a UF.'}
        {status === 'ready' && open && suggestions.length === 0 && 'Nenhum município encontrado.'}
      </span>
      {cityError && <span id={`${listId}-city-error`} className="field-error" role="alert"><AlertCircle className="size-3.5" aria-hidden="true" />{cityError}</span>}
      {open && status === 'ready' && suggestions.length > 0 && <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[#bdd5f4] bg-white p-1 text-[#070d35] shadow-xl">
        {suggestions.map((item, index) => <li key={item.id} id={`${listId}-${index}`} role="option" aria-selected={index === activeIndex} className={`cursor-pointer rounded-md px-3 py-2.5 text-sm ${index === activeIndex ? 'bg-[#eaf4ff] text-[#065fad]' : 'hover:bg-[#f3f8ff]'}`} onMouseDown={(event) => event.preventDefault()} onClick={() => select(item)}>{item.name} - {item.state}</li>)}
      </ul>}
    </div>
    <div><label className="block"><span className="label required-label">Estado</span><select name="state" className="field" value={state} required aria-invalid={Boolean(stateError)} aria-describedby={stateError ? `${listId}-state-error` : undefined} onChange={(event) => onStateChange(event.target.value)}><option value="" disabled>Selecione</option>{states.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{stateError && <span id={`${listId}-state-error`} className="field-error" role="alert"><AlertCircle className="size-3.5" aria-hidden="true" />{stateError}</span>}</div>
  </>
}
