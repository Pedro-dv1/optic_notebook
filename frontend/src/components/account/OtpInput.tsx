import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'

export function OtpInput({ value, onChange, disabled, error }: { value: string; onChange: (value: string) => void; disabled?: boolean; error?: string }) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const slots = Array.from({ length: 6 }, (_, index) => value[index] || '')
  const update = (index: number, input: string) => {
    const digits = input.replace(/\D/g, '')
    const next = [...slots]
    if (digits.length > 1) {
      digits.slice(0, 6 - index).split('').forEach((digit, offset) => { next[index + offset] = digit })
      onChange(next.join(''))
      refs.current[Math.min(index + digits.length, 5)]?.focus()
      return
    }
    next[index] = digits
    onChange(next.join(''))
    if (digits && index < 5) refs.current[index + 1]?.focus()
  }
  const paste = (event: ClipboardEvent<HTMLInputElement>, index: number) => {
    event.preventDefault()
    update(index, event.clipboardData.getData('text'))
  }
  const keyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Backspace' && !slots[index] && index > 0) {
      event.preventDefault()
      const next = [...slots]
      next[index - 1] = ''
      onChange(next.join(''))
      refs.current[index - 1]?.focus()
    }
    if (event.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus()
    if (event.key === 'ArrowRight' && index < 5) refs.current[index + 1]?.focus()
  }
  return <div>
    <div role="group" aria-label="Código de verificação" className="grid grid-cols-6 gap-2">
      {slots.map((digit, index) => <input
        key={index}
        ref={(element) => { refs.current[index] = element }}
        type="text"
        inputMode="numeric"
        autoComplete={index === 0 ? 'one-time-code' : 'off'}
        pattern="[0-9]*"
        maxLength={1}
        value={digit}
        disabled={disabled}
        aria-label={`Dígito ${index + 1} do código`}
        aria-invalid={Boolean(error)}
        className="field !px-0 text-center !text-xl font-bold tabular-nums"
        onChange={(event) => update(index, event.target.value)}
        onPaste={(event) => paste(event, index)}
        onKeyDown={(event) => keyDown(event, index)}
      />)}
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>
}
