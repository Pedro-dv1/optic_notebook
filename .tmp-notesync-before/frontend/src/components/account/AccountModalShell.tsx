import { createPortal } from 'react-dom'
import { LuArrowLeft as ArrowLeft, LuX as X } from 'react-icons/lu'
import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

export function AccountModalShell({ title, sidebar, backLabel, onBack, onClose, returnFocusRef, children }: {
  title: string
  sidebar: ReactNode
  backLabel?: string
  onBack?: () => void
  onClose: () => void
  returnFocusRef: RefObject<HTMLElement | null>
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    const body = document.body
    const previousOverflow = body.style.overflow
    const previousPaddingRight = body.style.paddingRight
    const returnFocus = returnFocusRef.current
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    if (scrollbarWidth > 0) body.style.paddingRight = `calc(${getComputedStyle(body).paddingRight} + ${scrollbarWidth}px)`
    body.style.overflow = 'hidden'
    titleRef.current?.focus()

    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const allFocusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) || [])]
      const visibleFocusable = allFocusable.filter((element) => element.getClientRects().length > 0)
      const focusable = visibleFocusable.length ? visibleFocusable : allFocusable
      if (!focusable.length) {
        event.preventDefault()
        titleRef.current?.focus()
        return
      }
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && (document.activeElement === first || document.activeElement === titleRef.current)) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', keyDown)
    return () => {
      document.removeEventListener('keydown', keyDown)
      body.style.overflow = previousOverflow
      body.style.paddingRight = previousPaddingRight
      returnFocus?.focus()
    }
  }, [returnFocusRef])

  useEffect(() => { titleRef.current?.focus() }, [title])

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#071044]/45 p-2 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="account-modal-title" className="relative flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-[#cbdcf0] bg-white shadow-[0_24px_80px_rgb(7_16_68_/_24%)] sm:grid sm:h-[min(42rem,calc(100vh-3rem))] sm:w-[min(56rem,calc(100vw-3rem))] sm:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="hidden min-h-0 flex-col border-r border-[#dce7f4] bg-[#f7faff] p-4 pt-20 sm:flex">
          <nav aria-label="Navegação da conta" className="grid gap-1">{sidebar}</nav>
        </aside>
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex min-h-16 items-center gap-2 border-b border-[#dce7f4] px-3 sm:min-h-20 sm:px-8">
            {onBack && <button type="button" className="btn btn-ghost !size-11 !min-h-0 !p-0" onClick={onBack} aria-label={`Voltar para ${backLabel}`}><ArrowLeft className="size-5" aria-hidden="true" /></button>}
            <h2 ref={titleRef} id="account-modal-title" tabIndex={-1} className="min-w-0 flex-1 truncate text-lg font-bold text-[#071044] sm:text-2xl sm:tracking-[-.025em]">{title}</h2>
            <button type="button" className="btn btn-ghost !size-11 !min-h-0 !p-0" onClick={onClose} aria-label="Fechar"><X className="size-5" aria-hidden="true" /></button>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-9 sm:py-8">{children}</main>
        </div>
      </div>
    </div>,
    document.body,
  )
}
