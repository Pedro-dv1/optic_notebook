import { LuCircleHelp as CircleHelp } from 'react-icons/lu'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function CompanyObservationPopover({ companyName, notes }: { companyName: string; notes?: string }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 16, top: 16 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)
  const tooltipId = useId()
  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !tooltipRef.current) return
    const button = buttonRef.current.getBoundingClientRect()
    const tooltip = tooltipRef.current.getBoundingClientRect()
    const left = Math.min(window.innerWidth - tooltip.width - 16, Math.max(16, button.left + button.width / 2 - tooltip.width / 2))
    const below = button.bottom + 8
    setPosition({ left, top: below + tooltip.height <= window.innerHeight - 16 ? below : button.top - tooltip.height - 8 })
  }, [open])
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!buttonRef.current?.contains(target) && !tooltipRef.current?.contains(target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape); window.clearTimeout(closeTimer.current) }
  }, [open])
  const keepOpen = () => { window.clearTimeout(closeTimer.current); setOpen(true) }
  const closeAfterHover = () => { closeTimer.current = window.setTimeout(() => setOpen(false), 80) }
  if (!notes?.trim()) return null
  return <>
    <button ref={buttonRef} type="button" className="observation-button" aria-label={`Observações de ${companyName}`} aria-describedby={open ? tooltipId : undefined} aria-expanded={open} onClick={() => setOpen((value) => !value)} onMouseEnter={keepOpen} onMouseLeave={closeAfterHover} onFocus={keepOpen} onBlur={(event) => { if (!tooltipRef.current?.contains(event.relatedTarget as Node)) setOpen(false) }}>
      <CircleHelp className="size-5" aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={tooltipRef} id={tooltipId} role="tooltip" className="company-tooltip" style={position} onMouseEnter={keepOpen} onMouseLeave={closeAfterHover}><span className="sr-only">Observações: </span>{notes}</div>, document.body)}
  </>
}
