self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  event.waitUntil(self.registration.showNotification(data.title || 'NoteSync', {
    body: data.body || 'Você possui uma atualização de agendamento.',
    icon: '/notesync-icon.png',
    data: { url: typeof data.url === 'string' ? data.url : '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const candidate = event.notification.data?.url || '/'
  const url = new URL(candidate, self.location.origin)
  const allowed = url.origin === self.location.origin && (
    url.pathname === '/cliente' || url.pathname === '/avaliar' || url.pathname.startsWith('/cliente/agendar/')
  )
  event.waitUntil(clients.openWindow(allowed ? url.href : self.location.origin))
})
