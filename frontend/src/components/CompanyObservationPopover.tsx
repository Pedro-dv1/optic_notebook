import { LuCircleHelp as CircleHelp } from 'react-icons/lu'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function CompanyObservationPopover({ companyName, notes }: { companyName: string; notes?: string }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 16, top: 16, arrow: 16, above: false })
  const [pinned, setPinned] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)
  const pointerWasOpen = useRef(false)
  const tooltipId = useId()
  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !tooltipRef.current) return
    const place = () => {
      if (!buttonRef.current || !tooltipRef.current) return
      const button = buttonRef.current.getBoundingClientRect()
      const tooltip = tooltipRef.current.getBoundingClientRect()
      const left = Math.max(16, Math.min(window.innerWidth - tooltip.width - 16, button.left + button.width / 2 - tooltip.width / 2))
      const below = button.bottom + 10
      const above = below + tooltip.height > window.innerHeight - 16
      const top = Math.max(16, Math.min(window.innerHeight - tooltip.height - 16, above ? button.top - tooltip.height - 10 : below))
      setPosition({ left, top, above, arrow: Math.min(tooltip.width - 16, Math.max(16, button.left + button.width / 2 - left)) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!buttonRef.current?.contains(target) && !tooltipRef.current?.contains(target)) { setOpen(false); setPinned(false) }
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); setPinned(false) } }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape); window.clearTimeout(closeTimer.current) }
  }, [open])
  const keepOpen = () => { window.clearTimeout(closeTimer.current); setOpen(true) }
  const closeAfterHover = () => { if (!pinned && document.activeElement !== buttonRef.current) closeTimer.current = window.setTimeout(() => setOpen(false), 150) }
  if (!notes?.trim()) return null
  return <>
    <button ref={buttonRef} type="button" className="catalog-icon-button" aria-label={`Observações de ${companyName}`} aria-describedby={open ? tooltipId : undefined} aria-expanded={open} onPointerDown={() => { pointerWasOpen.current = pinned }} onClick={(event) => { const next = event.detail === 0 ? !pinned : !pointerWasOpen.current; window.clearTimeout(closeTimer.current); setOpen(next); setPinned(next) }} onMouseEnter={keepOpen} onMouseLeave={closeAfterHover} onFocus={keepOpen} onBlur={(event) => { if (!tooltipRef.current?.contains(event.relatedTarget as Node)) { setOpen(false); setPinned(false) } }}>
      <CircleHelp className="size-4" aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={tooltipRef} id={tooltipId} role="tooltip" className={`company-tooltip ${position.above ? 'company-tooltip-above' : ''}`} style={{ left: position.left, top: position.top, '--tooltip-arrow': `${position.arrow}px` } as React.CSSProperties} onMouseEnter={keepOpen} onMouseLeave={closeAfterHover}><div className="company-tooltip-content" tabIndex={0} onBlur={(event) => { if (!tooltipRef.current?.contains(event.relatedTarget as Node) && event.relatedTarget !== buttonRef.current) { setOpen(false); setPinned(false) } }}><span className="sr-only">Observações: </span>{notes}</div></div>, document.body)}
  </>
}
