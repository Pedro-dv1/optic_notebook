import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LegalDocumentModal, reachedLegalDocumentEnd } from '../components/LegalDocuments'
import type { LegalDocument } from '../content/legal/types'

const document: LegalDocument = {
  kind: 'terms',
  title: 'Documento de teste',
  introduction: ['Introdução completa para o teste.'],
  sections: [{ id: 'primeira', title: 'Primeira seção', paragraphs: ['Conteúdo da seção.'] }],
}

describe('aceite de documentos jurídicos', () => {
  it('considera a tolerância somente quando o scroll chega ao final', () => {
    expect(reachedLegalDocumentEnd({ scrollTop: 580, clientHeight: 400, scrollHeight: 1000 })).toBe(false)
    expect(reachedLegalDocumentEnd({ scrollTop: 592, clientHeight: 400, scrollHeight: 1000 })).toBe(true)
  })

  it('mantém a confirmação desabilitada antes do final e habilita depois do scroll real', () => {
    const accept = vi.fn()
    render(<LegalDocumentModal document={document} version="2026-09-16" onClose={vi.fn()} onAccept={accept} />)
    const confirm = screen.getByRole('button', { name: 'Continue até o final' })
    expect(confirm).toBeDisabled()

    const scrollContainer = screen.getByRole('dialog').querySelector<HTMLElement>('[tabindex="0"]')
    expect(scrollContainer).not.toBeNull()
    Object.defineProperties(scrollContainer!, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 600, writable: true },
    })
    fireEvent.scroll(scrollContainer!)

    const enabled = screen.getByRole('button', { name: 'Li e concordo' })
    expect(enabled).toBeEnabled()
    fireEvent.click(enabled)
    expect(accept).toHaveBeenCalledOnce()
  })
})
