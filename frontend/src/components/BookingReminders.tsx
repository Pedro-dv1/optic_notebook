import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { enableBookingReminders } from '../lib/push'
import { useNotificationPreference } from './account/NotificationSettings'
import { Button, Notice } from './ui'

export function BookingReminders({ appointment, managementToken }: { appointment: string; managementToken?: string }) {
  const { user } = useAuth()
  const save = useNotificationPreference()
  const reminders = useMutation({ mutationFn: (askPermission: boolean) => enableBookingReminders(appointment, user ? undefined : managementToken, askPermission) })
  const attempted = useRef('')
  const preference = user?.notification_preference
  const { mutate } = reminders
  useEffect(() => {
    if (preference !== true || attempted.current === appointment) return
    attempted.current = appointment
    if ('Notification' in window && Notification.permission === 'granted') mutate(false)
  }, [appointment, preference, mutate])

  const accept = async () => {
    // Keep the account choice even when this device cannot enable Web Push.
    if (user) {
      attempted.current = appointment
      try { await save.mutateAsync(true) } catch { return }
    }
    reminders.mutate(true)
  }
  if (user && preference != null) return reminders.isError
    ? <div className="mt-5"><Notice>{apiErrorMessage(reminders.error)}</Notice></div>
    : null
  return <section className="mt-5 rounded-xl border border-[#d8e5f4] p-4" aria-label="Lembretes do agendamento">
    <p className="font-semibold">Receba lembretes deste agendamento</p>
    <p className="mt-1 text-sm text-[#52658a]">Ative somente se quiser. O agendamento funciona normalmente sem notificações.{user && ' Sua escolha ficará salva na conta.'}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <Button variant="secondary" loading={save.isPending || reminders.isPending} onClick={() => void accept()}>Ativar lembretes</Button>
      {user && <Button variant="ghost" disabled={save.isPending} onClick={() => save.mutate(false)}>Não receber</Button>}
    </div>
    {reminders.isSuccess && <div className="mt-3"><Notice kind="success">Lembretes ativados neste navegador.</Notice></div>}
    {(save.isError || reminders.isError) && <div className="mt-3"><Notice>{apiErrorMessage(save.error || reminders.error)}</Notice></div>}
  </section>
}
