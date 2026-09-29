import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import App from '../app/App'
import { TimeSlots } from '../components/TimeSlots'
import { BookingDatePicker } from '../components/BookingDatePicker'
import { FavoriteButton } from '../components/FavoriteButton'
import { FavoriteSuggestions } from '../components/CustomerFavorites'
import { AccountDeletionPanel } from '../components/account/AccountDeletion'
import { ProfilePanel } from '../components/account/ProfileDialog'
import AdminUnitsPage from '../pages/admin/AdminUnitsPage'
import { AdminManualBooking } from '../pages/admin/AdminManualBooking'
import SupportPage from '../pages/SupportPage'
import { company, companyAdmin, customer, json, renderApp } from './helpers'
import type { Appointment } from '../types/api'

function responder(extra?: (url: string, init?: RequestInit) => Promise<Response> | undefined, authenticated = true) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const custom = extra?.(url, init)
    if (custom) return custom
    if (url.endsWith('/auth/csrf/')) return json(null, 204)
    if (url.endsWith('/auth/refresh/')) return authenticated ? json({ access: 'test-access' }) : json({}, 401)
    if (url.endsWith('/auth/me/')) return json(customer)
    if (url.endsWith('/customers/favorites/suggestions/')) return json([])
    if (url.includes('/customers/appointments/')) return json({ count: 0, next: null, previous: null, results: [] })
    return json({ errors: { detail: 'Not found' } }, 404)
  })
}

describe('pacote NoteSync', () => {
  it('carrega o cadastro manual sob demanda e agrupa a pesquisa do cliente por debounce', async () => {
    const fetcher = responder((url) => {
      if (url.endsWith('/auth/me/')) return json(companyAdmin)
      if (url.endsWith('/company/units/')) return json([{ id: 'unit-1', name: 'Principal', is_active: true, is_primary: true }])
      if (url.includes('/company/services/') || url.includes('/company/professionals/') || url.includes('/company/customers/')) return json({ count: 0, next: null, previous: null, results: [] })
    })
    vi.stubGlobal('fetch', fetcher)
    renderApp(<AdminManualBooking />)
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/company/units/'))).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Novo agendamento' }))
    const input = screen.getByLabelText('Localizar cliente existente')
    fireEvent.change(input, { target: { value: 'An' } })
    fireEvent.change(input, { target: { value: 'Ana' } })
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/company/customers/'))).toBe(false)
    await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => String(url).includes('/company/customers/')).length).toBe(1))
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('q=Ana'))).toBe(true)
  })

  it('publica somente o contato de suporte configurado', async () => {
    vi.stubGlobal('fetch', responder((url) => url.endsWith('/public/platform/') ? json({ support_email: 'configured@example.com' }) : undefined, false))
    renderApp(<SupportPage />)
    expect(await screen.findByRole('link', { name: 'Entrar em contato: configured@example.com' }, { timeout: 5000 })).toHaveAttribute('href', 'mailto:configured@example.com')
    expect(screen.queryByRole('link', { name: 'Instagram' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Suporte' })).toHaveAttribute('href', '/suporte')
    expect(document.querySelector('a[href^="tel:"]')).toBeNull()
    expect(screen.getByRole('region', { name: 'Plataforma' })).toBeInTheDocument()
  })

  it('explica a ausência de contato sem inventar endereço de suporte', async () => {
    vi.stubGlobal('fetch', responder((url) => url.endsWith('/public/platform/') ? json({ support_email: '' }) : undefined, false))
    renderApp(<SupportPage />)
    expect(await screen.findByText('O contato de suporte ainda não foi configurado pela plataforma.')).toBeInTheDocument()
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
  })

  it('filtra somente slots reais por período e distingue seleção', () => {
    const slots = [9, 14].map((hour) => ({ professional: 'pro', professional_name: 'Marina', starts_at: `2030-01-10T${hour.toString().padStart(2, '0')}:00:00-03:00`, ends_at: `2030-01-10T${hour.toString().padStart(2, '0')}:30:00-03:00` }))
    function Example() { const [value, setValue] = useState(''); return <TimeSlots slots={slots} value={value} onChange={setValue} /> }
    vi.stubGlobal('fetch', responder(undefined, false))
    renderApp(<Example />)
    expect(screen.getByRole('button', { name: 'Noite' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '09:00' }))
    expect(screen.getByRole('button', { name: '09:00' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Tarde' }))
    expect(screen.queryByRole('button', { name: '09:00' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '14:00' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '15:00' })).not.toBeInTheDocument()
  })

  it('consulta dias por mês/unidade e desabilita datas indisponíveis', async () => {
    const fetcher = responder((url) => url.includes('/availability/days/') ? json({ available_dates: ['2030-01-10'] }) : undefined, false)
    vi.stubGlobal('fetch', fetcher)
    renderApp(<BookingDatePicker slug="empresa-real" service="service" professional="pro" unit="unit" value="2030-01-10" onChange={vi.fn()} />)
    const available = await screen.findByRole('button', { name: /quinta-feira, 10 de janeiro de 2030/ })
    await waitFor(() => expect(available).toBeEnabled())
    expect(screen.getByRole('button', { name: /sexta-feira, 11 de janeiro de 2030/ })).toBeDisabled()
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('unit=unit') && String(url).includes('end_date=2030-01-31'))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => String(url).includes('start_date=2030-02-01'))).toBe(true))
  })

  it('favorita e remove com persistência pela API e feedback de estado', async () => {
    let saved = false
    const fetcher = responder((url, init) => {
      if (url.includes('/favorites/status/')) return json({ id: null })
      if (url.endsWith('/customers/favorites/') && init?.method === 'POST') { saved = true; return json({ id: 'favorite-1', company: 'company-1' }, 201) }
      if (url.endsWith('/customers/favorites/favorite-1/') && init?.method === 'DELETE') { saved = false; return json(null, 204) }
    })
    vi.stubGlobal('fetch', fetcher)
    renderApp(<FavoriteButton companyId="company-1" companyName="Empresa Real" />)
    const add = await screen.findByRole('button', { name: 'Adicionar Empresa Real aos favoritos' })
    await waitFor(() => expect(add).toBeEnabled())
    fireEvent.click(add)
    const remove = await screen.findByRole('button', { name: 'Remover Empresa Real dos favoritos' })
    expect(saved).toBe(true)
    expect(remove).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(remove)
    await screen.findByRole('button', { name: 'Adicionar Empresa Real aos favoritos' })
    expect(saved).toBe(false)
  })

  it('persiste a recusa da sugestão e deixa de mostrá-la', async () => {
    let dismissed = false
    vi.stubGlobal('fetch', responder((url, init) => {
      if (url.endsWith('/favorites/suggestions/')) return json(dismissed ? [] : [{ ...company, id: 'company-1' }])
      if (url.endsWith('/favorites/dismiss-suggestion/') && init?.method === 'POST') { expect(JSON.parse(String(init.body))).toEqual({ company: 'company-1' }); dismissed = true; return json(null, 204) }
    }))
    renderApp(<FavoriteSuggestions />)
    fireEvent.click(await screen.findByRole('button', { name: 'Agora não' }))
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Sugestão de favorito' })).not.toBeInTheDocument())
    expect(dismissed).toBe(true)
  })

  it('sincroniza o coração quando a consulta em lote muda um favorito já em cache', async () => {
    const fetcher = responder((url, init) => url.endsWith('/customers/favorites/external-favorite/') && init?.method === 'DELETE' ? json(null, 204) : undefined)
    vi.stubGlobal('fetch', fetcher)
    function Example() {
      const [id, setId] = useState<string | null>(null)
      return <><FavoriteButton companyId="company-1" companyName="Empresa Real" initialFavoriteId={id} /><button onClick={() => setId('external-favorite')}>Atualizar favorito externo</button></>
    }
    renderApp(<Example />)
    await screen.findByRole('button', { name: 'Adicionar Empresa Real aos favoritos' })
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar favorito externo' }))
    const remove = await screen.findByRole('button', { name: 'Remover Empresa Real dos favoritos' })
    fireEvent.click(remove)
    await waitFor(() => expect(fetcher.mock.calls.some(([url, init]) => String(url).endsWith('/external-favorite/') && init?.method === 'DELETE')).toBe(true))
  })

  it('carrega o calendário sob demanda, navega mês e abre os detalhes existentes', async () => {
    window.history.replaceState({}, '', '/cliente')
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}`
    const event = { id: 'appt-1', company_name: 'Empresa Real', company_slug: 'empresa-real', company_address: '', company_city: '', company_state: '', service_name: 'Consulta', professional_name: 'Marina', starts_at: `${month}-10T10:00:00-03:00`, status: 'CONFIRMED', outcome: null, can_cancel: false, can_reschedule: false } as Appointment
    const fetcher = responder((url) => url.includes('/appointments/calendar/') ? json({ days: [{ date: `${month}-10`, count: 1 }], events: [event] }) : url.includes(`start_date=${month}-10&end_date=${month}-10`) ? json({ count: 1, next: null, previous: null, results: [event] }) : undefined)
    vi.stubGlobal('fetch', fetcher)
    renderApp(<App />)
    await screen.findByRole('heading', { name: /Olá, Ana/ })
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/calendar/'))).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Calendário' }))
    fireEvent.click(await screen.findByRole('button', { name: /, 1 agendamentos/ }))
    const dayDialog = screen.getByRole('dialog', { name: /Agendamentos em/ })
    fireEvent.click(await within(dayDialog).findByRole('button', { name: /10:00 · Empresa Real/ }))
    const details = screen.getByRole('dialog', { name: 'Detalhes do agendamento' })
    expect(within(details).getByText('Marina')).toBeInTheDocument()
    fireEvent.click(within(details).getByRole('button', { name: 'Fechar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))
    await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => String(url).includes('/calendar/')).length).toBe(2))
  })

  it('exige texto e senha antes de excluir e limpa a sessão', async () => {
    let deleted = false
    vi.stubGlobal('fetch', responder((url, init) => {
      if (url.endsWith('/auth/account/delete/')) { expect(JSON.parse(String(init?.body))).toEqual({ confirmation: 'EXCLUIR', password: 'current-password' }); deleted = true; return json(null, 204) }
    }))
    window.history.replaceState({}, '', '/cliente')
    renderApp(<AccountDeletionPanel />)
    const button = screen.getByRole('button', { name: 'Excluir minha conta permanentemente' })
    expect(button).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Digite EXCLUIR para confirmar'), { target: { value: 'EXCLUIR' } })
    expect(button).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: 'current-password' } })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)
    await waitFor(() => expect(window.location.pathname).toBe('/'))
    expect(deleted).toBe(true)
  })

  it('abre câmera, captura arquivo e encerra os tracks', async () => {
    const stop = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, value: 640 })
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, value: 640 })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['image'], { type: 'image/jpeg' })))
    URL.createObjectURL = vi.fn().mockReturnValue('blob:preview')
    URL.revokeObjectURL = vi.fn()
    let uploaded = false
    vi.stubGlobal('fetch', responder((url, init) => {
      if (url.endsWith('/customers/profile/me/')) { const file = (init?.body as FormData).get('avatar') as File; expect(file.type).toBe('image/jpeg'); expect(file.name).toBe('camera.jpg'); uploaded = true; return json(customer) }
    }))
    renderApp(<ProfilePanel onEmailChange={vi.fn()} />)
    await waitFor(() => expect(screen.getByLabelText('Nome')).toHaveValue('Ana Cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Opções da foto de perfil' }))
    expect(screen.getByRole('button', { name: 'Escolher da galeria/arquivos' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tirar foto' }))
    const capture = await screen.findByRole('button', { name: 'Capturar foto' })
    await waitFor(() => expect(capture).toBeEnabled())
    fireEvent.click(capture)
    expect(stop).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(uploaded).toBe(true))
  })

  it('cancela a câmera e valida arquivo da galeria antes de enviar', async () => {
    const stop = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    URL.createObjectURL = vi.fn().mockReturnValue('blob:gallery')
    URL.revokeObjectURL = vi.fn()
    vi.stubGlobal('fetch', responder())
    renderApp(<ProfilePanel onEmailChange={vi.fn()} />)
    await waitFor(() => expect(screen.getByLabelText('Nome')).toHaveValue('Ana Cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Opções da foto de perfil' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tirar foto' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Capturar foto' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar câmera' }))
    expect(stop).toHaveBeenCalledOnce()
    expect(screen.queryByLabelText('Prévia da câmera')).not.toBeInTheDocument()
    const gallery = screen.getByLabelText('Selecionar foto')
    fireEvent.change(gallery, { target: { files: [new File(['unsafe'], 'image.svg', { type: 'image/svg+xml' })] } })
    expect(screen.getByText('Use uma imagem PNG, JPEG ou WebP.')).toBeInTheDocument()
    fireEvent.change(gallery, { target: { files: [new File(['picture'], 'image.png', { type: 'image/png' })] } })
    expect(screen.getByRole('img', { name: 'Foto de Ana Cliente' })).toHaveAttribute('src', 'blob:gallery')
  })

  it('admin cadastra uma unidade e atualiza a listagem pela API', async () => {
    const principal = { id: 'unit-1', name: 'Principal', address: 'Rua Um', city: 'Jales', state: 'SP', is_active: true, is_primary: true }
    let created = false
    vi.stubGlobal('fetch', responder((url, init) => {
      if (url.endsWith('/company/units/') && init?.method === 'POST') { expect(JSON.parse(String(init.body)).name).toBe('Centro'); created = true; return json({ ...principal, id: 'unit-2', name: 'Centro', is_primary: false }, 201) }
      if (url.endsWith('/company/units/')) return json(created ? [principal, { ...principal, id: 'unit-2', name: 'Centro', is_primary: false }] : [principal])
    }))
    renderApp(<AdminUnitsPage />)
    await screen.findByRole('heading', { name: 'Principal' })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar unidade' }))
    fireEvent.change(screen.getByLabelText('Nome da unidade'), { target: { value: 'Centro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar unidade' }))
    expect(await screen.findByRole('heading', { name: 'Centro' })).toBeInTheDocument()
    expect(created).toBe(true)
  })
})
