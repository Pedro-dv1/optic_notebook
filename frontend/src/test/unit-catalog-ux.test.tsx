import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../app/App'
import { AdminManualBooking } from '../pages/admin/AdminManualBooking'
import { CompanyObservationPopover } from '../components/CompanyObservationPopover'
import { CustomerCalendar } from '../components/CustomerCalendar'
import { PublicPage } from '../components/PublicLayout'
import { company, companyAdmin, customer, json, renderApp } from './helpers'
import type { User } from '../types/api'

const empty = { count: 0, next: null, previous: null, results: [] }
const units = [{ id: 'center', name: 'Centro', is_active: true, is_primary: true }, { id: 'shopping', name: 'Shopping', is_active: true, is_primary: false }]
afterEach(() => vi.useRealTimers())
function responder(extra?: (url: string, init?: RequestInit) => Promise<Response> | undefined, user: User = customer) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const custom = extra?.(url, init)
    if (custom) return custom
    if (url.endsWith('/auth/csrf/')) return json(null, 204)
    if (url.endsWith('/auth/refresh/')) return json({ access: 'restored' })
    if (url.endsWith('/auth/me/')) return json(user)
    if (url.endsWith('/customers/favorites/suggestions/')) return json([])
    if (url.includes('/customers/appointments/')) return json(empty)
    if (url.endsWith('/public/platform/')) return json({ name: 'NoteSync', support_email: '', company_options: { states: [], niches: [], business_types: [] } })
    return json({}, 404)
  })
}

describe('catálogos por unidade e controles do cliente', () => {
  it('mostra Agenda/Calendário na mesma área de ações e favoritos somente nas configurações', async () => {
    window.history.replaceState({}, '', '/cliente')
    let saved = true
    const fetcher = responder((url, init) => {
      if (url.includes('/appointments/calendar/')) return json({ days: [], events: [] })
      if (url.includes('/customers/favorites/?')) return json(saved ? { ...empty, count: 1, results: [{ id: 'favorite', company: 'business', company_details: { ...company, id: 'business' } }] } : empty)
      if (url.endsWith('/customers/favorites/favorite/') && init?.method === 'DELETE') { saved = false; return json(null, 204) }
    })
    vi.stubGlobal('fetch', fetcher)
    renderApp(<App />)
    await screen.findByRole('heading', { name: /Olá, Ana/ }, { timeout: 10_000 })
    expect(within(screen.getAllByRole('banner')[0]).queryByRole('link', { name: 'Como funciona' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Favoritos' })).not.toBeInTheDocument()
    const mobileMenu = screen.getByRole('button', { name: 'Abrir menu' })
    const mobileAccount = within(mobileMenu.parentElement!).getByRole('button', { name: 'Abrir menu da conta' })
    expect(mobileMenu.compareDocumentPosition(mobileAccount) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const switcher = screen.getByRole('group', { name: 'Visualização da agenda' })
    const agenda = within(switcher).getByRole('button', { name: 'Agenda' })
    expect(agenda).toHaveAttribute('aria-pressed', 'true')
    expect(switcher).toHaveAttribute('data-view', 'appointments')
    fireEvent.click(within(switcher).getByRole('button', { name: 'Calendário' }))
    await screen.findByText('Você não tem agendamentos neste mês.')
    expect(within(switcher).getByRole('button', { name: 'Calendário' })).toHaveAttribute('aria-pressed', 'true')
    expect(switcher).toHaveAttribute('data-view', 'calendar')
    fireEvent.click(agenda)
    expect(agenda).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getAllByRole('button', { name: 'Abrir menu da conta' })[0])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Configurações' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Favoritos' }))
    const dialog = screen.getByRole('dialog', { name: 'Favoritos' })
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Remover Empresa Real dos favoritos' }))
    await within(dialog).findByText('Suas empresas favoritas aparecerão aqui')
    expect(saved).toBe(false)
  }, 20_000)

  it('busca empresas sem painel de filtros e mantém recomendações', async () => {
    window.history.replaceState({}, '', '/cliente/procurar')
    const fetcher = responder((url) => {
      if (url.includes('/public/companies/?')) return json({ ...empty, count: 1, results: [{ ...company, id: 'business', average_rating: null, review_count: 0 }] })
      if (url.includes('/favorites/status/')) return json({})
    })
    vi.stubGlobal('fetch', fetcher)
    renderApp(<App />)
    await screen.findByRole('heading', { name: 'Recomendados para você' }, { timeout: 10_000 })
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('ordering=recommended'))).toBe(true)
    expect(screen.getByText('0.0')).toHaveAttribute('aria-label', 'Sem avaliações')
    expect(screen.queryByRole('button', { name: /Filtros|A - Z|Z - A/ })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Pesquisar empresa, serviço ou área' }), { target: { value: 'barbearia' } })
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => String(url).includes('search=barbearia'))).toBe(true))
  })

  it('trocar unidade limpa o serviço anterior e consulta somente o catálogo selecionado no cadastro manual', async () => {
    const fetcher = responder((url) => {
      if (url.endsWith('/company/units/')) return json(units)
      if (url.includes('/company/services/')) {
        const center = url.includes('unit=center')
        return json({ ...empty, count: 1, results: [{ id: center ? 'cut' : 'premium', name: center ? 'Corte' : 'Premium', is_active: true, unit_ids: [center ? 'center' : 'shopping'] }] })
      }
      if (url.includes('/company/professionals/')) return json(empty)
    }, companyAdmin)
    vi.stubGlobal('fetch', fetcher)
    renderApp(<AdminManualBooking />)
    fireEvent.click(screen.getByRole('button', { name: 'Novo agendamento' }))
    const unit = await screen.findByLabelText('Unidade')
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/company/services/'))).toBe(false)
    fireEvent.click(unit)
    fireEvent.click(screen.getByRole('option', { name: 'Centro' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Serviço' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Corte' }))
    fireEvent.click(unit)
    fireEvent.click(screen.getByRole('option', { name: 'Shopping' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Serviço' }))
    await screen.findByRole('option', { name: 'Premium' })
    expect(screen.queryByRole('option', { name: 'Corte' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Serviço' })).toHaveTextContent('Selecione')
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('unit=shopping'))).toBe(true)
  })

  it('mantém favorito e observações independentes do link que cobre o card', async () => {
    window.history.replaceState({}, '', '/cliente/procurar')
    let saved = false
    vi.stubGlobal('fetch', responder((url, init) => {
      if (url.includes('/public/companies/?')) return json({ ...empty, count: 1, results: [{ ...company, id: 'business', public_notes: 'Atendimento com hora marcada', average_rating: 4.5, review_count: 2 }] })
      if (url.includes('/favorites/status/')) return json({ business: saved ? 'favorite' : null })
      if (url.endsWith('/customers/favorites/') && init?.method === 'POST') { saved = true; return json({ id: 'favorite', company: 'business' }) }
    }))
    renderApp(<App />)
    const link = await screen.findByRole('link', { name: 'Abrir Empresa Real e agendar' }, { timeout: 10_000 })
    const card = link.closest('article')!
    expect(within(card).getByText('4.5')).toHaveAttribute('aria-label', 'Avaliação 4.5 de 5')
    expect(within(card).getByText('4.5')).toHaveClass('absolute', 'right-3', 'top-3')
    expect(within(card).getAllByRole('link')).toHaveLength(1)
    expect(link).toHaveAttribute('href', `/cliente/agendar/${company.slug}`)
    const info = within(card).getByRole('button', { name: 'Observações de Empresa Real' })
    expect(info.closest('a')).toBeNull()
    fireEvent.click(info)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Atendimento com hora marcada')
    expect(window.location.pathname).toBe('/cliente/procurar')
    const favorite = await within(card).findByRole('button', { name: 'Adicionar Empresa Real aos favoritos' })
    expect(favorite.closest('a')).toBeNull()
    fireEvent.click(favorite)
    await waitFor(() => expect(favorite).toHaveAttribute('aria-pressed', 'true'))
    expect(window.location.pathname).toBe('/cliente/procurar')
    fireEvent.click(link)
    await waitFor(() => expect(window.location.pathname).toBe(`/cliente/agendar/${company.slug}`))
  })

  it('tooltip abre por teclado e o primeiro toque não fecha após o foco', () => {
    vi.stubGlobal('fetch', responder())
    renderApp(<CompanyObservationPopover companyName="Empresa" notes="Observação acessível" />)
    const trigger = screen.getByRole('button', { name: 'Observações de Empresa' })
    fireEvent.pointerDown(trigger)
    fireEvent.focus(trigger)
    fireEvent.click(trigger, { detail: 1 })
    expect(screen.getByRole('tooltip')).toHaveTextContent('Observação acessível')
    expect(trigger).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    fireEvent.focus(trigger)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it.each([
    ['2026-09-26T01:30:00Z', '25 de setembro de 2026', '2026-09-25', '31 de agosto de 2026', '4 de outubro de 2026', 'outubro de 2026'],
    ['2028-02-29T12:00:00Z', '29 de fevereiro de 2028', '2028-02-29', '31 de janeiro de 2028', '5 de março de 2028', 'março de 2028'],
    ['2026-12-31T12:00:00Z', '31 de dezembro de 2026', '2026-12-31', '30 de novembro de 2026', '3 de janeiro de 2027', 'janeiro de 2027'],
  ])('completa as semanas e marca hoje em Brasília (%s)', async (now, todayLabel, today, previousLabel, nextLabel, nextMonth) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(now))
    const fetcher = responder((url) => url.includes('/appointments/calendar/') ? json({ days: [], events: [] }) : undefined)
    vi.stubGlobal('fetch', fetcher)
    renderApp(<PublicPage decorations={false}><CustomerCalendar onDetails={vi.fn()} /></PublicPage>)
    const current = await screen.findByRole('button', { name: `${todayLabel}, 0 agendamentos, hoje` }, { timeout: 10_000 })
    expect(current).toHaveAttribute('aria-current', 'date')
    expect(screen.getAllByRole('button', { name: /^\d+ de / })).toHaveLength(35)
    expect(screen.getByRole('button', { name: `${previousLabel}, fora do mês exibido` })).toBeInTheDocument()
    const next = screen.getByRole('button', { name: `${nextLabel}, fora do mês exibido` })
    fireEvent.click(current)
    const dialog = screen.getByRole('dialog', { name: `Agendamentos em ${today.split('-').reverse().join('/')}` })
    await within(dialog).findByText('Dia livre')
    expect(document.body.style.overflow).toBe('hidden')
    expect(within(dialog).getByRole('button', { name: 'Fechar' })).toHaveFocus()
    expect(fetcher.mock.calls.some(([url]) => String(url).includes(`start_date=${today}&end_date=${today}`))).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).not.toBe('hidden')
    fireEvent.click(next)
    expect(screen.getByRole('heading', { name: nextMonth })).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
