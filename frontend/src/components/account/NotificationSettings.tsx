import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { api, apiErrorMessage } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { Notice } from '../ui'

export function useNotificationPreference() {
  const { refreshUser } = useAuth()
  return useMutation({
    mutationFn: (preference: boolean) => api.patch('/customers/profile/me/', { notification_preference: preference }),
    onSuccess: () => refreshUser(),
  })
}

export function NotificationSettings() {
  const { user } = useAuth()
  const save = useNotificationPreference()
  const [permissionError, setPermissionError] = useState('')
  const change = async (enabled: boolean) => {
    setPermissionError('')
    if (enabled) {
      if (!('Notification' in window)) {
        setPermissionError('Este navegador não oferece notificações.')
        return
      }
      try {
        if (await Notification.requestPermission() !== 'granted') {
          setPermissionError('Autorize as notificações nas configurações do navegador para ativar as mensagens.')
          return
        }
      } catch {
        setPermissionError('Não foi possível solicitar a permissão do navegador.')
        return
      }
    }
    save.mutate(enabled)
  }
  return <section aria-label="Preferência de notificações">
    <p className="text-sm leading-6 text-[#52658f]">Receba mensagens e lembretes dos seus agendamentos. A preferência vale para sua conta; cada navegador precisa de permissão própria.</p>
    <label className="mt-6 flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-xl border border-[#d8e5f4] p-4">
      <span className="font-semibold text-[#172653]">Ativar mensagens do navegador</span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={user?.notification_preference === true} disabled={save.isPending} onChange={(event) => void change(event.target.checked)} />
      <span aria-hidden="true" className="relative h-7 w-12 shrink-0 rounded-full bg-[#aab8cf] transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[#087cf0] peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#087cf0]" />
    </label>
    {save.isSuccess && <div className="mt-3"><Notice kind="success">Preferência salva.</Notice></div>}
    {save.isError && <div className="mt-3"><Notice>{apiErrorMessage(save.error)}</Notice></div>}
    {permissionError && <div className="mt-3"><Notice>{permissionError}</Notice></div>}
  </section>
}
