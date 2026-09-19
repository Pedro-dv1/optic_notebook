import type { IconType } from 'react-icons'
import { LuCircleAlert as AlertCircle, LuCircleCheck as CheckCircle2, LuEye as Eye, LuEyeOff as EyeOff, LuInfo as Info, LuTriangleAlert as TriangleAlert, LuX as X } from 'react-icons/lu'
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import logo from '../assets/branding/OpticNoteBook-logo.svg'

export function Button({ variant = 'primary', className = '', loading = false, children, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'icon'; loading?: boolean }) {
  return <button className={`btn btn-${variant} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading && <span className="button-spinner" aria-hidden="true" />}{children}
  </button>
}

export function Field({ label, error, id, icon: Icon, hideLabel = false, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; icon?: IconType; hideLabel?: boolean }) {
  const fieldId = id || props.name
  return <div>
    <label htmlFor={fieldId} className="block"><span className={`${hideLabel ? 'sr-only' : 'label'} ${props.required ? 'required-label' : ''}`}>{label}</span><span className="relative block">
        {Icon && <Icon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-current opacity-55" aria-hidden="true" />}
        <input id={fieldId} className={`field ${Icon ? 'pl-12' : ''} ${className}`} aria-invalid={Boolean(error)} aria-required={props.required || undefined} aria-describedby={error ? `${fieldId}-error` : undefined} {...props} />
      </span></label>
    {error && <span id={`${fieldId}-error`} className="field-error" role="alert"><AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />{error}</span>}
  </div>
}

export function PasswordInput({ label, error, id, icon: Icon, hideLabel = false, className = '', ...props }: Omit<Parameters<typeof Field>[0], 'type'>) {
  const [visible, setVisible] = useState(false)
  const fieldId = id || props.name
  return <div>
    <label htmlFor={fieldId} className="block"><span className={`${hideLabel ? 'sr-only' : 'label'} ${props.required ? 'required-label' : ''}`}>{label}</span><span className="relative block">
        {Icon && <Icon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-current opacity-55" aria-hidden="true" />}
        <input {...props} id={fieldId} type={visible ? 'text' : 'password'} className={`field ${Icon ? 'pl-12' : ''} pr-12 ${className}`} aria-invalid={Boolean(error)} aria-required={props.required || undefined} aria-describedby={error ? `${fieldId}-error` : undefined} />
        <button type="button" className="absolute inset-y-0 right-2 my-auto grid size-9 place-items-center rounded text-current opacity-60 hover:opacity-100 focus-visible:opacity-100" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} aria-controls={fieldId}>
          {visible ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
        </button>
      </span></label>
    {error && <span id={`${fieldId}-error`} className="field-error" role="alert"><AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />{error}</span>}
  </div>
}

export const PasswordField = PasswordInput

export function SelectField({ label, children, error, id, hideLabel = false, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode; error?: string; hideLabel?: boolean }) {
  const fieldId = id || props.name
  return <div>
    <label htmlFor={fieldId} className="block"><span className={hideLabel ? 'sr-only' : 'label'}>{label}</span><select id={fieldId} className="field" aria-invalid={Boolean(error)} aria-required={props.required || undefined} aria-describedby={error ? `${fieldId}-error` : undefined} {...props}>{children}</select></label>
    {error && <span id={`${fieldId}-error`} className="field-error" role="alert"><AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />{error}</span>}
  </div>
}

export function TextAreaField({ label, id, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const fieldId = id || props.name
  return <label htmlFor={fieldId} className="block">
    <span className="label">{label}</span>
    <textarea id={fieldId} className="field min-h-24 resize-y" {...props} />
  </label>
}

export function LoadingState({ label = 'Carregando', fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  return <div className={`global-loading ${fullScreen ? 'global-loading-screen' : ''}`} role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">{label}</span>
    <div className="global-loading-content" aria-hidden="true">
      <img src={logo} alt="" className="global-loading-logo" />
      <span className="global-loading-track"><span className="global-loading-bar" /></span>
    </div>
  </div>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="panel py-10 text-center">
    <h3 className="font-semibold text-[#071044]">{title}</h3>
    <p className="mx-auto mt-2 max-w-lg text-sm text-[#7182a8]">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
}

export function Notice({ kind = 'error', children }: { kind?: 'error' | 'success' | 'warning' | 'validation' | 'info'; children: ReactNode }) {
  const Icon = kind === 'success' ? CheckCircle2 : kind === 'warning' ? TriangleAlert : kind === 'info' ? Info : AlertCircle
  return <div className={`notice notice-${kind}`} role={kind === 'error' || kind === 'validation' ? 'alert' : 'status'}>
    <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><div>{children}</div>
  </div>
}

export function validateForm(form: HTMLFormElement) {
  const errors: Record<string, string> = {}
  let firstInvalid: HTMLElement | null = null
  for (const control of Array.from(form.elements)) {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) || control.disabled || control.type === 'hidden' || control.validity.valid) continue
    const name = control.name || control.id
    if (!name) continue
    const message = control.validity.valueMissing
      ? 'Este campo é obrigatório.'
      : control.validity.typeMismatch
        ? control.type === 'email' ? 'Informe um e-mail válido.' : 'Informe um valor válido.'
        : control.validity.tooShort
          ? `Use pelo menos ${control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement ? control.minLength : 1} caracteres.`
          : control.validity.patternMismatch
            ? 'Use o formato solicitado.'
            : control.validity.rangeUnderflow || control.validity.rangeOverflow
              ? 'Informe um valor dentro do intervalo permitido.'
              : 'Revise este campo.'
    errors[name] = message
    firstInvalid ||= control
  }
  firstInvalid?.focus()
  return errors
}

export function Dialog({ open, title, children, onClose, describedBy, className = '' }: { open: boolean; title: string; children: ReactNode; onClose: () => void; describedBy?: string; className?: string }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.querySelector<HTMLElement>('button, input, select, textarea, [href]')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])')]
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow; previous?.focus() }
  }, [open, onClose])
  if (!open) return null
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#071044]/35 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby={describedBy} className={`panel max-h-[88vh] w-full max-w-md overflow-y-auto rounded-b-none shadow-xl sm:rounded-[var(--radius-lg)] ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 id="dialog-title" className="text-lg font-semibold text-[#071044]">{title}</h2>
        <button onClick={onClose} className="btn btn-ghost -m-2 !size-11 !min-h-0 !p-0" aria-label="Fechar"><X className="size-5" /></button>
      </div>
      {children}
    </div>
  </div>
}
