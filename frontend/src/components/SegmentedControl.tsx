import type { CSSProperties } from 'react'

export function SegmentedControl<T extends string | number>({ options, value, onChange, label, className = '' }: {
  options: ReadonlyArray<{ value: T; label: string; disabled?: boolean }>
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  const selected = options.findIndex((option) => option.value === value)
  return <div className={`segmented-control ${className}`} role="group" aria-label={label}
    data-view={value}
    style={{ '--segment-count': options.length, '--segment-index': Math.max(0, selected) } as CSSProperties}>
    <span className="segmented-indicator" hidden={selected < 0} aria-hidden="true" />
    {options.map((option) => <button key={option.value} type="button" disabled={option.disabled}
      aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>
}
