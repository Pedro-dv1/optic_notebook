import { useState } from 'react'
import { formatTime } from '../lib/format'
import type { AvailabilitySlot } from '../types/api'
import { Button } from './ui'
import { SegmentedControl } from './SegmentedControl'

const periods = ['Manhã', 'Tarde', 'Noite']
export function slotPeriod(slot: AvailabilitySlot) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date(slot.starts_at)))
  return hour < 12 ? 0 : hour < 18 ? 1 : 2
}

export function TimeSlots({ slots, value, onChange }: { slots: AvailabilitySlot[]; value: string; onChange: (value: string) => void }) {
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null)
  const grouped = periods.map((_, index) => slots.filter((slot) => slotPeriod(slot) === index))
  const active = selectedPeriod !== null && grouped[selectedPeriod].length ? selectedPeriod : grouped.findIndex((group) => group.length > 0)
  return <section className="mt-5" aria-label="Horários disponíveis">
    <SegmentedControl label="Período do dia" options={periods.map((label, value) => ({ label, value, disabled: !grouped[value].length }))}
      value={active} onChange={(period) => { setSelectedPeriod(period); onChange('') }} />
    <div className="mt-4 flex gap-2 overflow-x-auto p-1 pb-3 sm:flex-wrap" aria-live="polite">{grouped[active]?.map((slot) => <Button key={`${slot.professional}-${slot.starts_at}`} type="button" variant="secondary" className="shrink-0" aria-pressed={value === slot.starts_at} onClick={() => onChange(slot.starts_at)}>{formatTime(slot.starts_at)}</Button>)}</div>
    {!slots.length && <p className="mt-4 text-sm text-[#52658f]">Sem horários disponíveis nesta data.</p>}
  </section>
}
