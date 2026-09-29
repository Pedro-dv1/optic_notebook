import { useEffect, useState, type InputHTMLAttributes } from 'react'

const examples = ['Salão de beleza', 'Barbearia', 'Clínica odontológica', 'Pet shop', 'Academia']

export function CompanySearchInput({ value, placeholder = 'Pesquisar empresa', onFocus, onBlur, ...props }: InputHTMLAttributes<HTMLInputElement> & { value: string }) {
  const [focused, setFocused] = useState(false)
  const [example, setExample] = useState(0)
  const [length, setLength] = useState(1)
  const [deleting, setDeleting] = useState(false)
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const animate = !focused && !value && !reducedMotion

  useEffect(() => {
    if (!animate) return
    const timer = window.setTimeout(() => {
      if (deleting && length === 0) { setDeleting(false); setExample((current) => (current + 1) % examples.length) }
      else if (deleting) setLength(length - 1)
      else if (length === examples[example].length) setDeleting(true)
      else setLength(length + 1)
    }, deleting ? 55 : length === examples[example].length ? 1100 : 100)
    return () => window.clearTimeout(timer)
  }, [animate, deleting, example, length])

  return <input {...props} value={value} placeholder={animate ? `${examples[example].slice(0, length)}|` : placeholder} onFocus={(event) => { setFocused(true); onFocus?.(event) }} onBlur={(event) => { setFocused(false); onBlur?.(event) }} />
}
