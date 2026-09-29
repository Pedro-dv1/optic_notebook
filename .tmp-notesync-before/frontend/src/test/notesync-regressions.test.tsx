import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, apiErrorMessage } from '../api/client'
import { StatusBadge } from '../components/StatusBadge'
import { Button, Notice } from '../components/ui'
import { enableBookingReminders } from '../lib/push'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('NoteSync status e mensagens', () => {
  it('mostra apenas o resultado final', () => {
    const { rerender } = render(<StatusBadge status="CONFIRMED" outcome="COMPLETED" />)
    expect(screen.getByText('Concluído')).toBeInTheDocument()
    expect(screen.queryByText('Confirmado')).not.toBeInTheDocument()
    rerender(<StatusBadge status="CONFIRMED" outcome="NO_SHOW" />)
    expect(screen.getByText('Não compareceu')).toBeInTheDocument()
    expect(screen.queryByText('Confirmado')).not.toBeInTheDocument()
  })

  it('usa o aviso acessível e o botão primário compartilhado', () => {
    render(<><Notice title="Não foi possível salvar">Revise os dados.</Notice><Button>Salvar</Button></>)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar')
    expect(screen.getByRole('button', { name: 'Fechar mensagem' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveClass('btn-primary')
  })
})

describe('Web Push', () => {
  it('distingue navegador incompatível', async () => {
    vi.stubGlobal('navigator', {})
    await expect(enableBookingReminders('booking')).rejects.toThrow('Navegador incompatível')
  })

  it('não registra subscription quando a permissão foi negada', async () => {
    const register = vi.fn()
    vi.stubGlobal('navigator', { serviceWorker: { register } })
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() })
    vi.stubGlobal('isSecureContext', true)
    await expect(enableBookingReminders('booking')).rejects.toThrow('Notificações bloqueadas')
    expect(register).not.toHaveBeenCalled()
  })

  it('reutiliza a subscription antes de confirmar o salvamento', async () => {
    const key = Uint8Array.from([4, ...Array(64).fill(1)])
    const subscription = { options: { applicationServerKey: key.buffer }, toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/one', keys: { p256dh: 'p'.repeat(80), auth: 'a'.repeat(24) } }) }
    const subscribe = vi.fn()
    const registration = { pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription), subscribe } }
    vi.stubGlobal('navigator', { serviceWorker: { register: vi.fn().mockResolvedValue(registration), ready: Promise.resolve(registration) } })
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() })
    vi.stubGlobal('isSecureContext', true)
    vi.spyOn(api, 'get').mockResolvedValue({ public_key: btoa(String.fromCharCode(...key)) })
    const post = vi.spyOn(api, 'post').mockResolvedValue({ active: true })
    await enableBookingReminders('booking')
    expect(subscribe).not.toHaveBeenCalled()
    expect(post).toHaveBeenCalledWith('/push/subscriptions/', expect.objectContaining({ appointment: 'booking', endpoint: 'https://fcm.googleapis.com/one' }))
    expect(apiErrorMessage(new Error('TypeError'))).toBe('Ocorreu um erro inesperado.')
  })

  it('troca uma subscription vinculada a uma chave VAPID antiga', async () => {
    const key = Uint8Array.from([4, ...Array(64).fill(1)])
    const subscription = { options: { applicationServerKey: Uint8Array.from([4, ...Array(64).fill(2)]).buffer }, unsubscribe: vi.fn().mockResolvedValue(true) }
    const replacement = { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/new', keys: { p256dh: 'p'.repeat(80), auth: 'a'.repeat(24) } }) }
    const subscribe = vi.fn().mockResolvedValue(replacement)
    const registration = { pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription), subscribe } }
    vi.stubGlobal('navigator', { serviceWorker: { register: vi.fn().mockResolvedValue(registration), ready: Promise.resolve(registration) } })
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() })
    vi.stubGlobal('isSecureContext', true)
    vi.spyOn(api, 'get').mockResolvedValue({ public_key: btoa(String.fromCharCode(...key)) })
    const post = vi.spyOn(api, 'post').mockResolvedValue({ active: true })
    await enableBookingReminders('booking')
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
    expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: key })
    expect(post).toHaveBeenCalledWith('/push/subscriptions/', expect.objectContaining({ endpoint: 'https://fcm.googleapis.com/new' }))
  })

  it('explica quando VAPID não está configurado', async () => {
    vi.stubGlobal('navigator', { serviceWorker: {} })
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { permission: 'granted' })
    vi.stubGlobal('isSecureContext', true)
    vi.spyOn(api, 'get').mockResolvedValue({ public_key: '' })
    const post = vi.spyOn(api, 'post')
    await expect(enableBookingReminders('booking')).rejects.toThrow('As notificações ainda não foram configuradas neste ambiente')
    expect(post).not.toHaveBeenCalled()
  })
})
