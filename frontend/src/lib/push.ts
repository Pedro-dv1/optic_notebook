import { api, ApiError, UserFacingError } from '../api/client'

function applicationServerKey(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

function reportWebPushError(stage: string, error: unknown) {
  if (!import.meta.env.DEV) return
  const detail = error instanceof Error ? { name: error.name, message: error.message } : { name: typeof error, message: String(error) }
  const response = error instanceof ApiError ? {
    status: error.status,
    body: JSON.stringify(error.details, (field, value) => /token|key|secret|endpoint|auth/i.test(field) ? '[redacted]' : value),
  } : undefined
  console.error(`[webpush] ${stage}`, detail, response)
}

export async function enableBookingReminders(appointment: string, managementToken?: string, askPermission = true) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new UserFacingError('Navegador incompatível com notificações.')
  }
  if (!window.isSecureContext) throw new UserFacingError('Conexão não segura. Abra o NoteSync por HTTPS ou localhost.')
  if (Notification.permission === 'denied') throw new UserFacingError('Notificações bloqueadas. Ative a permissão nas configurações do navegador.')
  if (!askPermission && Notification.permission !== 'granted') return
  let permission: NotificationPermission
  try {
    permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  } catch (error) {
    reportWebPushError('permission', error)
    throw new UserFacingError('Não foi possível solicitar permissão para notificações.')
  }
  if (permission === 'denied') throw new UserFacingError('Notificações bloqueadas. Ative a permissão nas configurações do navegador.')
  if (permission !== 'granted') throw new UserFacingError('Permissão para notificações não concedida.')
  let config: { public_key: string }
  try {
    config = await api.get<{ public_key: string }>('/push/config/')
  } catch (error) {
    reportWebPushError('vapid-key', error)
    throw error
  }
  if (!config.public_key) {
    const error = new UserFacingError('As notificações ainda não foram configuradas neste ambiente')
    reportWebPushError('vapid-key', error)
    throw error
  }
  let key: Uint8Array<ArrayBuffer>
  try {
    key = applicationServerKey(config.public_key)
    if (key.length !== 65 || key[0] !== 4) throw new Error('Invalid VAPID key')
  } catch (error) {
    reportWebPushError('vapid-key', error)
    throw new UserFacingError('Configuração de notificações indisponível.')
  }
  let registration: ServiceWorkerRegistration
  try {
    await navigator.serviceWorker.register('/sw.js')
    registration = await navigator.serviceWorker.ready
  } catch (error) {
    reportWebPushError('service-worker', error)
    throw new UserFacingError('Falha ao carregar serviço de notificações.')
  }
  let existing: PushSubscription | null
  try {
    existing = await registration.pushManager.getSubscription()
  } catch (error) {
    reportWebPushError('existing-subscription', error)
    throw new UserFacingError('Falha ao consultar as notificações deste dispositivo.')
  }
  let subscription: PushSubscription
  try {
    const existingKey = existing?.options.applicationServerKey
    const matches = existingKey && new Uint8Array(existingKey).every((byte, index) => byte === key[index]) && existingKey.byteLength === key.length
    if (existing && !matches && !await existing.unsubscribe()) throw new Error('Could not remove stale PushSubscription')
    subscription = existing && matches ? existing : await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    })
  } catch (error) {
    reportWebPushError('subscribe', error)
    throw new UserFacingError('Falha ao registrar dispositivo para notificações.')
  }
  let json: PushSubscriptionJSON
  try {
    json = subscription.toJSON()
  } catch (error) {
    reportWebPushError('subscribe', error)
    throw new UserFacingError('Falha ao registrar dispositivo para notificações.')
  }
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new UserFacingError('Falha ao registrar dispositivo para notificações.')
  try {
    await api.post('/push/subscriptions/', {
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      appointment,
      management_token: managementToken,
    })
  } catch (error) {
    reportWebPushError('backend-registration', error)
    if (error instanceof ApiError && error.status === 0) throw new UserFacingError('Falha de rede ao registrar notificações.')
    throw error
  }
}
