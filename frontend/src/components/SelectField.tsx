import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode, type SelectHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { LuCheck as Check, LuChevronDown as ChevronDown, LuCircleAlert as AlertCircle } from 'react-icons/lu'

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  children: ReactNode
  error?: string
  hideLabel?: boolean
  placeholder?: string
  onValueChange?: (value: string) => void
}

export function SelectField({ label, children, error, id, name, value, defaultValue, onChange, onValueChange, disabled, required, hideLabel = false, placeholder, className = '', 'aria-label': ariaLabel, 'aria-describedby': describedBy }: Props) {
  const generatedId = useId()
  const fieldId = id || name || generatedId
  const listId = `${fieldId}-listbox`
  const labelId = `${fieldId}-label`
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selectRef = useRef<HTMLSelectElement>(null)
  const [open, setOpen] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [internalValue, setInternalValue] = useState<string | undefined>(undefined)
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 })
  // ASVS V1.2: keep option labels as React children so text is escaped.
  const childOptions = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; label?: string; disabled?: boolean; children?: ReactNode }>(child) || child.type !== 'option') return []
    return [{ value: String(child.props.value ?? child.props.children ?? ''), label: child.props.label ?? child.props.children, disabled: Boolean(child.props.disabled) }]
  })
  const addPlaceholder = Boolean(placeholder) && !childOptions.some((option) => option.value === '')
  const options = addPlaceholder ? [{ value: '', label: placeholder, disabled: true }, ...childOptions] : childOptions
  const selectedValue = value !== undefined ? String(value ?? '') : internalValue ?? String(defaultValue ?? (placeholder ? '' : options[0]?.value ?? ''))
  const selectedOption = options.find((option) => option.value === selectedValue)
  const displayOption = selectedOption ?? options[0]
  const isPlaceholder = !selectedValue && Boolean(placeholder || displayOption?.disabled)
  const message = error || (invalid ? 'Este campo é obrigatório.' : '')

  const choose = (next: string) => {
    if (value === undefined) setInternalValue(next)
    setInvalid(false)
    setOpen(false)
    // Existing forms read event.target.value; the target remains the real form control.
    if (selectRef.current) {
      selectRef.current.value = next
      onChange?.({ target: selectRef.current, currentTarget: selectRef.current } as ChangeEvent<HTMLSelectElement>)
    }
    onValueChange?.(next)
    buttonRef.current?.focus()
  }

  const show = () => {
    if (disabled) return
    const selected = options.findIndex((option) => option.value === selectedValue && !option.disabled)
    setActiveIndex(selected >= 0 ? selected : options.findIndex((option) => !option.disabled))
    setOpen(true)
  }

  const move = (direction: number) => {
    if (!open) { show(); return }
    if (!options.some((option) => !option.disabled)) return
    let next = activeIndex
    do { next = (next + direction + options.length) % options.length } while (options[next].disabled)
    setActiveIndex(next)
  }

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const button = buttonRef.current?.getBoundingClientRect()
      const menu = menuRef.current
      if (!button || !menu) return
      const below = window.innerHeight - button.bottom - 8
      const above = button.top - 8
      const height = Math.min(280, menu.scrollHeight)
      const openAbove = below < height && above > below
      const space = openAbove ? above : below
      setPosition({
        top: openAbove ? button.top - Math.min(height, space) - 6 : button.bottom + 6,
        left: Math.max(8, Math.min(button.left, window.innerWidth - button.width - 8)),
        width: Math.min(button.width, window.innerWidth - 16),
        maxHeight: Math.max(40, Math.min(280, space - 6)),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!buttonRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  useEffect(() => {
    const form = selectRef.current?.form
    if (!form) return
    const reset = () => { setInternalValue(undefined); setInvalid(false); setOpen(false) }
    form.addEventListener('reset', reset)
    return () => form.removeEventListener('reset', reset)
  }, [])

  useEffect(() => {
    if (open && activeIndex >= 0) menuRef.current?.querySelectorAll('[role="option"]')[activeIndex]?.scrollIntoView?.({ block: 'nearest' })
  }, [open, activeIndex])

  return <div className="min-w-0">
    <label id={labelId} htmlFor={fieldId} className={`${hideLabel ? 'sr-only' : 'label'} ${required ? 'required-label' : ''}`}>{label}</label>
    <div className="relative" data-custom-select>
      <button ref={buttonRef} id={fieldId} type="button" role="combobox" className={`field custom-select-trigger ${className}`} disabled={disabled} aria-label={ariaLabel} aria-labelledby={ariaLabel ? undefined : labelId} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} aria-required={required || undefined} aria-invalid={Boolean(message)} aria-describedby={[describedBy, message ? `${fieldId}-error` : ''].filter(Boolean).join(' ') || undefined} onClick={() => open ? setOpen(false) : show()} onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); move(event.key === 'ArrowDown' ? 1 : -1) }
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (open && activeIndex >= 0 && !options[activeIndex].disabled) choose(options[activeIndex].value); else if (!open) show() }
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false) }
        if (event.key === 'Tab') setOpen(false)
      }}>
        <span className={`min-w-0 flex-1 truncate ${isPlaceholder ? 'text-[#7f8dae]' : ''}`}>{isPlaceholder && placeholder ? placeholder : displayOption?.label ?? placeholder ?? ''}</span>
        <ChevronDown className={`size-4 shrink-0 text-[#52658a] transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <select ref={selectRef} name={name} value={selectedValue} required={required} disabled={disabled} tabIndex={-1} aria-hidden="true" data-custom-select="true" className="pointer-events-none absolute left-0 top-0 size-px opacity-0" onChange={(event) => choose(event.target.value)} onInvalid={(event) => { event.preventDefault(); setInvalid(true); buttonRef.current?.focus() }} onFocus={() => buttonRef.current?.focus()}>{addPlaceholder && <option value="" disabled>{placeholder}</option>}{children}</select>
    </div>
    {message && <span id={`${fieldId}-error`} className="field-error" role="alert"><AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />{message}</span>}
    {open && createPortal(<div ref={menuRef} id={listId} role="listbox" aria-labelledby={labelId} className="custom-select-list" style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }} onPointerDown={(event) => event.preventDefault()}>
      {options.map((option, index) => <div key={`${option.value}-${index}`} id={`${listId}-${index}`} role="option" aria-selected={option.value === selectedValue} aria-disabled={option.disabled || undefined} className={`custom-select-option ${index === activeIndex ? 'custom-select-option-active' : ''}`} onMouseEnter={() => !option.disabled && setActiveIndex(index)} onClick={() => !option.disabled && choose(option.value)}><span className="min-w-0 flex-1">{option.label}</span>{option.value === selectedValue && <Check className="size-4 shrink-0" aria-hidden="true" />}</div>)}
    </div>, document.body)}
  </div>
}
