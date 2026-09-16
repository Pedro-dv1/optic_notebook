import { describe, expect, it, vi } from 'vitest'
import { ApiError, api, apiErrorMessage, refreshAccess } from '../api/client'
import { customer, json } from './helpers'

describe('cliente HTTP e sessão', () => {
  it('compartilha uma única renovação entre chamadas simultâneas', async () => {
    let refreshes = 0
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/csrf/')) return json(null, 204)
      if (url.endsWith('/auth/refresh/')) { refreshes += 1; return json({ access: 'new-access' }) }
      return json({})
    }))
    await Promise.all([refreshAccess(), refreshAccess(), refreshAccess()])
    expect(refreshes).toBe(1)
  })

  it('faz login e logout sem persistir tokens no storage', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input); calls.push(url)
      if (url.endsWith('/auth/csrf/')) return json(null, 204)
      if (url.endsWith('/auth/login/')) return json({ access: 'memory-only', user: customer })
      if (url.endsWith('/auth/logout/')) return json(null, 204)
      return json({})
    }))
    await api.login({ email: customer.email, password: 'long-password' })
    await api.logout()
    expect(storage).not.toHaveBeenCalled()
    expect(calls.some((url) => url.endsWith('/auth/logout/'))).toBe(true)
  })

  it.each([
    [401, 'sessão expirou'], [403, 'permissão'], [404, 'encontramos'], [409, 'horário'], [429, 'Muitas tentativas'],
  ])('traduz o erro HTTP %i', (status, fragment) => {
    expect(apiErrorMessage(new ApiError(status, null))).toContain(fragment)
  })

  it('diferencia falha de rede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')))
    await expect(api.get('/public/companies/')).rejects.toThrow('Não foi possível conectar ao servidor')
  })

  it('rejeita HTML de fallback recebido no lugar de JSON da API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!doctype html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })))
    await expect(api.get('/public/platform/')).rejects.toThrow('resposta inválida')
  })
})
