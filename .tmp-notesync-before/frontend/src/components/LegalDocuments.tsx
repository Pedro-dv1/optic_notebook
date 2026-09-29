import { useQuery } from '@tanstack/react-query'
import { LuCheck as Check, LuChevronDown as ChevronDown, LuCircle as Circle } from 'react-icons/lu'
import { useEffect, useId, useState, type UIEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { privacyDocument } from '../content/legal/privacy'
import { termsDocument } from '../content/legal/terms'
import { hasLegalContent, type LegalDocument, type LegalDocumentKind } from '../content/legal/types'
import { Button, Dialog, Notice } from './ui'

export interface LegalAcceptanceValue {
  terms: boolean
  privacy: boolean
}

export interface CurrentLegalDocuments {
  terms: { version: string; accepted: boolean }
  privacy: { version: string; accepted: boolean }
}

const documents: Record<LegalDocumentKind, LegalDocument> = {
  terms: termsDocument,
  privacy: privacyDocument,
}

export function useCurrentLegalDocuments() {
  const { status, user } = useAuth()
  return useQuery({
    queryKey: ['legal-current', user?.id || 'anonymous'],
    queryFn: () => api.get<CurrentLegalDocuments>('/legal/current/'),
    enabled: status !== 'loading',
    staleTime: 60_000,
  })
}

export function LegalDocumentContent({ document, idPrefix = document.kind }: { document: LegalDocument; idPrefix?: string }) {
  if (!hasLegalContent(document)) {
    return <Notice kind="warning">O texto integral deste documento ainda não foi adicionado ao projeto.</Notice>
  }
  return <div className="legal-copy">
    {document.introduction.map((paragraph, index) => <p key={`${document.kind}-intro-${index}`}>{paragraph}</p>)}
    {document.sections.map((section) => <section key={section.id} id={`${idPrefix}-${section.id}`} className="scroll-mt-28">
      <h2>{section.title}</h2>
      {section.paragraphs.map((paragraph, index) => <p key={`${section.id}-paragraph-${index}`}>{paragraph}</p>)}
      {section.items && <ul>{section.items.map((item, index) => <li key={`${section.id}-item-${index}`}>{item}</li>)}</ul>}
    </section>)}
  </div>
}

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  const current = useCurrentLegalDocuments()
  const [activeSection, setActiveSection] = useState(document.sections[0]?.id || '')
  const version = current.data?.[document.kind].version

  useEffect(() => {
    if (!document.sections.length || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.find((entry) => entry.isIntersecting)
      if (visible) setActiveSection(visible.target.id.replace(`${document.kind}-`, ''))
    }, { rootMargin: '-20% 0px -65% 0px' })
    document.sections.forEach((section) => {
      const element = window.document.getElementById(`${document.kind}-${section.id}`)
      if (element) observer.observe(element)
    })
    return () => observer.disconnect()
  }, [document])

  return <div id="top" className="mx-auto max-w-[78rem] px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
    <header className="max-w-3xl border-b border-[#d8e5f4] pb-8">
      <p className="eyebrow">Informações legais</p>
      <h1 className="public-display mt-3 text-4xl sm:text-5xl">{document.title}</h1>
      <p className="mt-4 text-sm text-[#6173a5]">Última atualização: {version ? formatLegalDate(version) : 'indisponível'}</p>
    </header>
    {document.sections.length > 0 && <details className="mt-7 rounded-xl border border-[#d8e5f4] bg-white p-4 lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">Neste documento <ChevronDown className="size-5" /></summary>
      <LegalIndex document={document} activeSection={activeSection} className="mt-4" />
    </details>}
    <div className={`mt-9 ${document.sections.length ? 'grid gap-12 lg:grid-cols-[15rem_minmax(0,45rem)] lg:items-start lg:justify-between' : 'max-w-[45rem]'}`}>
      {document.sections.length > 0 && <aside className="hidden lg:sticky lg:top-28 lg:block">
        <p className="text-sm font-bold text-[#071044]">Neste documento</p>
        <LegalIndex document={document} activeSection={activeSection} className="mt-3" />
      </aside>}
      <article>
        <LegalDocumentContent document={document} />
        <a href="#top" className="btn btn-secondary mt-10">Voltar ao topo</a>
      </article>
    </div>
  </div>
}

function LegalIndex({ document, activeSection, className = '' }: { document: LegalDocument; activeSection: string; className?: string }) {
  return <nav aria-label={`Índice de ${document.title}`} className={className}>
    <ol className="grid gap-1 text-sm text-[#6173a5]">
      {document.sections.map((section) => <li key={section.id}>
        <a className={`block rounded-md px-3 py-2 hover:bg-[#edf5ff] hover:text-[#087cf0] ${activeSection === section.id ? 'bg-[#edf5ff] font-semibold text-[#087cf0]' : ''}`} href={`#${document.kind}-${section.id}`}>{section.title}</a>
      </li>)}
    </ol>
  </nav>
}

export function LegalAcceptanceSection({ value, onChange, error, hideWhenComplete = false }: { value: LegalAcceptanceValue; onChange: (value: LegalAcceptanceValue) => void; error?: string; hideWhenComplete?: boolean }) {
  const current = useCurrentLegalDocuments()
  const [openDocument, setOpenDocument] = useState<LegalDocumentKind | null>(null)
  const descriptionId = useId()

  useEffect(() => {
    if (!current.data) return
    const next = {
      terms: value.terms || current.data.terms.accepted,
      privacy: value.privacy || current.data.privacy.accepted,
    }
    if (next.terms !== value.terms || next.privacy !== value.privacy) onChange(next)
  }, [current.data, onChange, value.privacy, value.terms])

  if (hideWhenComplete && value.terms && value.privacy) return null

  return <fieldset aria-describedby={error ? descriptionId : undefined} className="rounded-xl border border-[#d8e5f4] bg-[#f8fbff] p-4 sm:p-5">
    <legend className="px-1 text-sm font-bold text-[#071044]">Antes de continuar</legend>
    <p className="mb-3 text-sm leading-6 text-[#6173a5]">Abra e percorra cada documento até o final para confirmar separadamente.</p>
    {current.isPending && <p role="status" className="text-sm text-[#6173a5]">Carregando documentos…</p>}
    {current.isError && <Notice>Não foi possível consultar as versões vigentes. Tente novamente.</Notice>}
    {current.data && <div className="grid gap-2">
      {(['terms', 'privacy'] as const).map((kind) => {
        const accepted = value[kind]
        const document = documents[kind]
        return <div key={kind} className="flex flex-col gap-3 rounded-lg border border-[#d8e5f4] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-8 shrink-0 place-items-center rounded-full ${accepted ? 'bg-[#e7f7ee] text-[#16804b]' : 'bg-[#eef3f8] text-[#70809e]'}`} aria-hidden="true">{accepted ? <Check className="size-4" /> : <Circle className="size-3" />}</span>
            <span><strong className="block text-sm text-[#071044]">{document.title}</strong><span className="text-xs text-[#6173a5]">{accepted ? 'Aceito' : 'Pendente'} · versão {current.data[kind].version}</span></span>
          </div>
          <Button type="button" className="w-full shrink-0 sm:w-auto" onClick={() => setOpenDocument(kind)}>{accepted ? 'Ver novamente' : 'Abrir documento'}</Button>
        </div>
      })}
    </div>}
    {error && <p id={descriptionId} className="field-error" role="alert">{error}</p>}
    {openDocument && current.data && <LegalDocumentModal
      document={documents[openDocument]}
      version={current.data[openDocument].version}
      onClose={() => setOpenDocument(null)}
      onAccept={() => {
        onChange({ ...value, [openDocument]: true })
        setOpenDocument(null)
      }}
    />}
  </fieldset>
}

export function reachedLegalDocumentEnd(element: Pick<HTMLElement, 'scrollTop' | 'clientHeight' | 'scrollHeight'>, tolerance = 8) {
  return element.scrollTop + element.clientHeight >= element.scrollHeight - tolerance
}

export function LegalDocumentModal({ document, version, onClose, onAccept }: { document: LegalDocument; version: string; onClose: () => void; onAccept: () => void }) {
  const [reachedEnd, setReachedEnd] = useState(false)
  const [progress, setProgress] = useState(0)
  const descriptionId = useId()
  const available = hasLegalContent(document)

  const updateProgress = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget
    setProgress(Math.min(100, Math.round(((element.scrollTop + element.clientHeight) / element.scrollHeight) * 100)))
    if (reachedLegalDocumentEnd(element)) setReachedEnd(true)
  }

  return <Dialog open title={document.title} onClose={onClose} describedBy={descriptionId} className="!flex !h-[100dvh] !max-h-[100dvh] !max-w-4xl !flex-col !overflow-hidden !rounded-none sm:!h-[88vh] sm:!rounded-[var(--radius-lg)]">
    <div className="flex min-h-0 flex-1 flex-col">
      <p id={descriptionId} className="mb-3 text-sm text-[#6173a5]">Última atualização: {formatLegalDate(version)}. A confirmação registra que o documento foi apresentado e percorrido.</p>
      <div className="mb-2 flex items-center gap-3 text-xs text-[#6173a5]" aria-live="polite"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#dce8f5]"><span className="block h-full bg-[#087cf0]" style={{ width: `${progress}%` }} /></span><span>{progress}%</span></div>
      <div onScroll={updateProgress} tabIndex={0} className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-[#d8e5f4] p-4 focus-visible:ring-2 focus-visible:ring-[#2f80ed] sm:p-6">
        <LegalDocumentContent document={document} idPrefix={`modal-${document.kind}`} />
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 border-t border-[#d8e5f4] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" onClick={onClose}>Fechar</Button>
        <Button type="button" disabled={!available || !reachedEnd} onClick={onAccept}>{!available ? 'Documento ainda não publicado' : reachedEnd ? 'Li e concordo' : 'Continue até o final'}</Button>
      </div>
    </div>
  </Dialog>
}

function formatLegalDate(version: string) {
  const date = new Date(`${version}T00:00:00Z`)
  return Number.isNaN(date.valueOf()) ? version : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(date)
}
