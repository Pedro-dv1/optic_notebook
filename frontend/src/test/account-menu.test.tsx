import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '../app/App'
import { customer, json, renderApp } from './helpers'

function authenticatedResponder(extra?: (url: string, init?: RequestInit) => Promise<Response> | undefined) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const custom = extra?.(url, init)
    if (custom) return custom
    if (url.endsWith('/auth/csrf/')) return json(null, 204)
    if (url.endsWith('/auth/refresh/')) return json({ access: 'restored' })
    if (url.endsWith('/auth/me/')) return json(customer)
    if (url.endsWith('/customers/appointments/')) return json({ count: 0, next: null, previous: null, results: [] })
    if (url.endsWith('/auth/logout/')) return json(null, 204)
    return json({ errors: { detail: 'Not found' } }, 404)
  })
}

async function openAccountMenu() {
  const buttons = await screen.findAllByRole('button', { name: 'Abrir menu da conta' }, { timeout: 30_000 })
  fireEvent.click(buttons[0])
  return screen.getByRole('menu', { name: 'Conta' })
}

describe('menu e segurança da conta', () => {
  it('abre, fecha por ESC e clique externo, navega por teclado e abre os dialogs', async () => {
    window.history.replaceState({}, '', '/cliente')
    vi.stubGlobal('fetch', authenticatedResponder())
    renderApp(<App />)

    let menu = await openAccountMenu()
    expect(within(menu).getByText('Ana Cliente')).toBeInTheDocument()
    expect(within(menu).getByText('an***@example.com')).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Perfil' })).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(within(menu).getByRole('menuitem', { name: 'Configurações' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu', { name: 'Conta' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Abrir menu da conta' })[0]).toHaveFocus()

    menu = await openAccountMenu()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu', { name: 'Conta' })).not.toBeInTheDocument()

    menu = await openAccountMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Perfil' }))
    const profile = screen.getByRole('dialog', { name: 'Perfil' })
    expect(profile.closest('header')).toBeNull()
    expect(document.body.style.overflow).toBe('hidden')
    expect(within(profile).getByLabelText('Nome')).toHaveValue('Ana Cliente')
    expect(within(profile).getByLabelText('WhatsApp')).toHaveValue('(11) 99999-9999')
    expect(within(profile).getByText('an***@example.com')).toBeInTheDocument()
    expect(within(profile).getByRole('button', { name: 'Alterar foto' })).toBeInTheDocument()
    expect(within(profile).queryByLabelText('Senha atual')).not.toBeInTheDocument()
    within(profile).getByRole('button', { name: 'Salvar alterações' }).focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(within(profile).getByRole('button', { name: 'Perfil' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.body.style.overflow).toBe('')
    expect(screen.getAllByRole('button', { name: 'Abrir menu da conta' })[0]).toHaveFocus()

    menu = await openAccountMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Configurações' }))
    const settings = screen.getByRole('dialog', { name: 'Configurações' })
    expect(within(settings).getByText('Gerencie as configurações da sua conta.')).toBeInTheDocument()
    expect(within(settings).queryByRole('button', { name: 'Alterar senha' })).not.toBeInTheDocument()
    fireEvent.click(within(settings).getByRole('button', { name: 'Abrir Segurança' }))
    expect(screen.getByRole('dialog', { name: 'Segurança' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Senha' }))
    expect(screen.getByRole('dialog', { name: 'Senha' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alterar senha' })).toBeInTheDocument()
  }, 45_000)

  it('executa o fluxo de senha em etapas, trata erro/cooldown e evita envio duplo', async () => {
    window.history.replaceState({}, '', '/cliente')
    let requests = 0
    let verifies = 0
    vi.stubGlobal('fetch', authenticatedResponder((url) => {
      if (url.endsWith('/customers/security/password/request/')) {
        requests += 1
        return json({ challenge_id: 'challenge-1', masked_email: 'an***@example.com', expires_in: 600, resend_after: 60 }, 201)
      }
      if (url.endsWith('/customers/security/password/verify/')) {
        verifies += 1
        return verifies === 1
          ? json({ errors: { code: 'otp_invalid', message: 'invalid' } }, 400)
          : json({ authorization_token: 'authorization-token', expires_in: 600 })
      }
      if (url.endsWith('/customers/password/change/')) return json(null, 204)
    }))
    renderApp(<App />)
    const menu = await openAccountMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Configurações' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Segurança' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Senha' }))
    fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))
    const send = screen.getByRole('button', { name: 'Enviar código de verificação' })
    fireEvent.click(send)
    fireEvent.click(send)
    expect(await screen.findByText('Verifique seu e-mail')).toBeInTheDocument()
    expect(requests).toBe(1)
    expect(screen.getByRole('button', { name: 'Reenviar código em 01:00' })).toBeDisabled()

    fireEvent.paste(screen.getByLabelText('Dígito 1 do código'), { clipboardData: { getData: () => '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText('Esse código não é válido.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('heading', { name: 'Criar nova senha' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'Another-Correct-Horse-2026!' } })
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'Another-Correct-Horse-2026!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))
    expect(await screen.findByText(/Senha alterada com sucesso/)).toBeInTheDocument()
  }, 20_000)

  it('mostra erro estável de entrega e não inicia cooldown quando o envio falha', async () => {
    window.history.replaceState({}, '', '/cliente')
    vi.stubGlobal('fetch', authenticatedResponder((url) => {
      if (url.endsWith('/customers/security/password/request/')) {
        return json({ errors: { code: 'email_delivery_unavailable', message: 'provider hidden' } }, 503)
      }
    }))
    renderApp(<App />)
    const menu = await openAccountMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Configurações' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Segurança' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Senha' }))
    fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código de verificação' }))
    expect(await screen.findByText('Não foi possível enviar o código agora. Tente novamente em alguns instantes.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar código de verificação' })).toBeEnabled()
    expect(screen.queryByText(/Reenviar código em/)).not.toBeInTheDocument()
  }, 20_000)

  it('só altera o e-mail depois de confirmar o endereço atual e o novo', async () => {
    window.history.replaceState({}, '', '/cliente')
    let changed = false
    vi.stubGlobal('fetch', authenticatedResponder((url) => {
      if (url.endsWith('/auth/me/')) return json(changed ? { ...customer, email: 'novo@example.com' } : customer)
      if (url.endsWith('/customers/security/email-change/current/request/')) return json({ challenge_id: 'current', masked_email: 'an***@example.com', expires_in: 600, resend_after: 60 }, 201)
      if (url.endsWith('/customers/security/email-change/current/verify/')) return json({ authorization_token: 'email-authorization', expires_in: 600 })
      if (url.endsWith('/customers/security/email-change/new/request/')) return json({ challenge_id: 'new', masked_email: 'no***@example.com', expires_in: 600, resend_after: 60 }, 201)
      if (url.endsWith('/customers/security/email-change/new/verify/')) { changed = true; return json(null, 204) }
    }))
    renderApp(<App />)
    const menu = await openAccountMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Perfil' }))
    fireEvent.click(screen.getByRole('button', { name: 'Alterar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
    expect(await screen.findByRole('heading', { name: 'Verifique seu e-mail atual' })).toBeInTheDocument()
    fireEvent.paste(screen.getByLabelText('Dígito 1 do código'), { clipboardData: { getData: () => '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('heading', { name: 'Informe o novo e-mail' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Novo e-mail'), { target: { value: 'novo@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código ao novo e-mail' }))
    expect(await screen.findByRole('heading', { name: 'Confirme o novo e-mail' })).toBeInTheDocument()
    fireEvent.paste(screen.getByLabelText('Dígito 1 do código'), { clipboardData: { getData: () => '654321' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText('E-mail alterado com sucesso.')).toBeInTheDocument()
    await waitFor(() => expect(changed).toBe(true))
  }, 20_000)
})
