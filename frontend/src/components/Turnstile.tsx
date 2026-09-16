import { useEffect, useId, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string
      remove: (widgetId: string) => void
    }
  }
}

let scriptPromise: Promise<void> | null = null
function loadScript() {
  if (window.turnstile) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Turnstile unavailable'))
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

export function Turnstile({ action, onToken }: { action: string; onToken: (token: string) => void }) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  useEffect(() => {
    if (!siteKey || !ref.current) return
    let widgetId: string | null = null
    let active = true
    loadScript().then(() => {
      if (active && ref.current && window.turnstile) {
        widgetId = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          action,
          callback: onToken,
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
          theme: 'dark',
        })
      }
    }).catch(() => onToken(''))
    return () => {
      active = false
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [action, onToken, siteKey])
  if (!siteKey) return null
  return <div><span id={`${id}-label`} className="sr-only">Verificação anti-robô</span><div ref={ref} aria-labelledby={`${id}-label`} /></div>
}

export function Honeypot() {
  return <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
    <label>Não preencha este campo<input name="website" tabIndex={-1} autoComplete="off" /></label>
  </div>
}
