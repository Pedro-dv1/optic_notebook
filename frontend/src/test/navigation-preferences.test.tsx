import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import App from '../app/App'
import { BookingReminders } from '../components/BookingReminders'
import { CustomerCalendar } from '../components/CustomerCalendar'
import { SegmentedControl } from '../components/SegmentedControl'
import { enableBookingReminders } from '../lib/push'
import { customer, json, renderApp } from './helpers'

vi.mock('../lib/push', () => ({ enableBookingReminders: vi.fn().mockResolvedValue(undefined) }))

function responder({ authenticated = true, preference = null, extra }: {
  authenticated?: boolean
  preference?: boolean | null
  extra?: (url: string, init?: RequestInit) => Promise<Response> | undefined
} = {}) {
  let saved = preference
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const custom = extra?.(url, init)
    if (custom) return custom
    if (url.endsWith('/auth/csrf/')) return json(null, 204)
    if (url.endsWith('/auth/refresh/')) return authenticated ? json({ access: 'test' }) : json({}, 401)
    if (url.endsWith('/auth/me/')) return json({ ...customer, notification_preference: saved })
    if (url.endsWith('/customers/profile/me/')) {
      saved = JSON.parse(String(init?.body)).notification_preference
      return json({ ...customer, notification_preference: saved })
    }
    if (url.includes('/customers/appointments/') || url.includes('/customers/favorites/')) return json({ count: 0, next: null, previous: null, results: [] })
    return json({}, 404)
  })
}

describe('navegação, calendário e preferências', () => {
  it('recupera a senha no login com os mesmos três endpoints da conta', async () => {
    window.history.replaceState({}, '', '/cliente/login')
    const payloads: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', responder({ authenticated: false, extra: (url, init) => {
      if (url.endsWith('/security/password/request/')) { payloads.push(JSON.parse(String(init?.body))); return json({ challenge_id: 'challenge', masked_email: 'an***@example.com', resend_after: 60, expires_in: 600 }, 201) }
      if (url.endsWith('/security/password/verify/')) { payloads.push(JSON.parse(String(init?.body))); return json({ authorization_token: 'verified-token', expires_in: 600 }) }
      if (url.endsWith('/customers/password/change/')) { payloads.push(JSON.parse(String(init?.body))); return json(null, 204) }
    } }))
    renderApp(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Esqueci minha senha' }, { timeout: 10_000 }))
    const dialog = screen.getByRole('dialog', { name: 'Redefinir senha' })
    fireEvent.change(within(dialog).getByLabelText('E-mail'), { target: { value: customer.email } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enviar código de verificação' }))
    const firstDigit = await within(dialog).findByLabelText('Dígito 1 do código')
    fireEvent.paste(firstDigit, { clipboardData: { getData: () => '123456' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    fireEvent.change(await within(dialog).findByLabelText('Nova senha'), { target: { value: 'Another-Correct-Horse-2026!' } })
    fireEvent.change(within(dialog).getByLabelText('Confirmar nova senha'), { target: { value: 'Another-Correct-Horse-2026!' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alterar senha' }))
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Entrar novamente' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(payloads[0]).toEqual({ email: customer.email })
    expect(payloads[1]).toEqual({ challenge_id: 'challenge', code: '123456' })
    expect(payloads[2]).toMatchObject({ authorization_token: 'verified-token', new_password: 'Another-Correct-Horse-2026!' })
  }, 20_000)

  it('usa as três rotas existentes e abre perfil sem exibir os agendamentos', async () => {
    window.history.replaceState({}, '', '/cliente/conta')
    const fetcher = responder()
    vi.stubGlobal('fetch', fetcher)
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') })
    renderApp(<App />)
    const nav = await screen.findByRole('navigation', { name: 'Navegação do cliente' })
    expect(within(nav).getAllByRole('link')).toHaveLength(3)
    expect(within(nav).getByRole('link', { name: 'Explorar' })).toHaveAttribute('href', '/cliente/procurar')
    expect(within(nav).getByRole('link', { name: 'Agendamentos' })).toHaveAttribute('href', '/cliente')
    expect(within(nav).getByRole('link', { name: 'Perfil' })).toHaveAttribute('aria-current', 'page')
    const account = await screen.findByRole('navigation', { name: 'Configurações da conta' })
    expect(within(account).getByRole('button', { name: 'Perfil' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
    fireEvent.click(within(account).getByRole('button', { name: 'Perfil' }))
    await screen.findByLabelText('Nome')
    expect(account).toHaveClass('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(account).not.toHaveClass('hidden')
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/customers/appointments/'))).toBe(false)
    fireEvent.click(within(account).getByRole('button', { name: 'Configurações' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Mensagens e lembretes' }))
    const notifications = screen.getByRole('switch', { name: 'Ativar mensagens do navegador' })
    expect(notifications).not.toBeChecked()
    fireEvent.click(notifications)
    await screen.findByText('Preferência salva.')
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH' && JSON.parse(String(init.body)).notification_preference === true)).toBe(true)
    await waitFor(() => expect(notifications).toBeChecked())
    fireEvent.click(notifications)
    await waitFor(() => expect(notifications).not.toBeChecked())
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH' && JSON.parse(String(init.body)).notification_preference === false)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByRole('button', { name: 'Abrir Mensagens e lembretes' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(account).not.toHaveClass('hidden')
  })

  it('mantém o switch desligado quando o navegador recusa a permissão', async () => {
    window.history.replaceState({}, '', '/cliente/conta')
    const fetcher = responder()
    vi.stubGlobal('fetch', fetcher)
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn().mockResolvedValue('denied') })
    renderApp(<App />)
    const account = await screen.findByRole('navigation', { name: 'Configurações da conta' })
    fireEvent.click(within(account).getByRole('button', { name: 'Configurações' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Mensagens e lembretes' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Ativar mensagens do navegador' }))
    expect(await screen.findByText(/Autorize as notificações nas configurações do navegador/)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Ativar mensagens do navegador' })).not.toBeChecked()
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
  })

  it('sinaliza dias com agendamentos e abre a lista paginada do dia em todas as telas', async () => {
    const month = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)
    const day = `${month}-10`
    const fetcher = responder({ extra: (url) => {
      if (url.includes('/appointments/calendar/')) return json({ days: [{ date: day, count: 12 }], events: [] })
      if (url.includes(`start_date=${day}&end_date=${day}`)) return json({ count: 12, next: 'next', previous: null, results: [] })
    } })
    vi.stubGlobal('fetch', fetcher)
    renderApp(<CustomerCalendar onDetails={vi.fn()} />)
    const button = await screen.findByRole('button', { name: /12 agendamentos/ })
    expect(within(button).getByText('!')).toHaveClass('calendar-event-mark')
    expect(within(button).queryByText('12')).not.toBeInTheDocument()
    expect(document.querySelector('.calendar-event')).toBeNull()
    fireEvent.click(button)
    await screen.findByRole('dialog', { name: /Agendamentos em/ })
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => String(url).includes(`start_date=${day}&end_date=${day}`))).toBe(true))
    fireEvent.click(await screen.findByRole('button', { name: 'Próxima' }))
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => String(url).includes('page=2'))).toBe(true))
  })

  it.each([2, 3, 4])('segmenta %i opções com um único indicador móvel e botões acessíveis', (count) => {
    const options = Array.from({ length: count }, (_, value) => ({ value, label: `Opção ${value}` }))
    function Example() { const [value, onChange] = useState(0); return <SegmentedControl options={options} value={value} onChange={onChange} label="Visualização" /> }
    vi.stubGlobal('fetch', responder({ authenticated: false }))
    renderApp(<Example />)
    const group = screen.getByRole('group', { name: 'Visualização' })
    fireEvent.click(within(group).getByRole('button', { name: `Opção ${count - 1}` }))
    expect(group.style.getPropertyValue('--segment-index')).toBe(String(count - 1))
    expect(group.querySelectorAll('.segmented-indicator')).toHaveLength(1)
    expect(within(group).getByRole('button', { name: `Opção ${count - 1}` })).toHaveAttribute('aria-pressed', 'true')
  })

  it.each([true, false])('não repete a pergunta quando a preferência é %s', async (preference) => {
    vi.stubGlobal('Notification', { permission: 'granted' })
    vi.mocked(enableBookingReminders).mockClear()
    vi.stubGlobal('fetch', responder({ preference }))
    renderApp(<BookingReminders appointment="booking" />)
    await waitFor(() => expect(screen.queryByText('Receba lembretes deste agendamento')).not.toBeInTheDocument())
    if (preference) await waitFor(() => expect(enableBookingReminders).toHaveBeenCalledWith('booking', undefined, false))
    else expect(enableBookingReminders).not.toHaveBeenCalled()
  })

  it('salva a recusa inicial no backend', async () => {
    const fetcher = responder()
    vi.stubGlobal('fetch', fetcher)
    renderApp(<BookingReminders appointment="booking" />)
    const decline = await screen.findByRole('button', { name: 'Não receber' })
    fireEvent.click(decline)
    await waitFor(() => expect(screen.queryByText('Receba lembretes deste agendamento')).not.toBeInTheDocument())
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH' && JSON.parse(String(init.body)).notification_preference === false)).toBe(true)
  })

  it('mantém o fluxo guest sem tentar salvar uma preferência de conta', async () => {
    const fetcher = responder({ authenticated: false })
    vi.stubGlobal('fetch', fetcher)
    renderApp(<BookingReminders appointment="guest-booking" managementToken="guest-token" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ativar lembretes' }))
    await waitFor(() => expect(enableBookingReminders).toHaveBeenCalledWith('guest-booking', 'guest-token', true))
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/customers/profile/me/'))).toBe(false)
  })
})
