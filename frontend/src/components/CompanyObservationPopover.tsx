import { LuCircleHelp as CircleHelp } from 'react-icons/lu'
import { useState } from 'react'
import { Dialog } from './ui'

export function CompanyObservationPopover({ companyName, notes }: { companyName: string; notes?: string }) {
  const [open, setOpen] = useState(false)
  if (!notes?.trim()) return null
  return <>
    <button type="button" className="observation-button" aria-label={`Ver observações de ${companyName}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <CircleHelp className="size-5" aria-hidden="true" />
    </button>
    <Dialog open={open} title={`Observações de ${companyName}`} onClose={() => setOpen(false)}>
      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#43557e]">{notes}</p>
    </Dialog>
  </>
}
