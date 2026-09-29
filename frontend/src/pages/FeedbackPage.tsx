import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { PublicPage } from '../components/PublicLayout'
import { Button, EmptyState, Field, LoadingState, Notice, SelectField, TextAreaField } from '../components/ui'
import { formatDateTime } from '../lib/format'
import type { Feedback, Paginated } from '../types/api'

export const categories = { SUGGESTION: 'Sugestão / ideia', BUG: 'Reportar um problema', FEATURE_REQUEST: 'Pedir funcionalidade', UX: 'Algo difícil de usar', OTHER: 'Outro feedback' } as const
export const statuses = { NEW: 'Novo', REVIEWING: 'Em análise', PLANNED: 'Planejado', IN_PROGRESS: 'Em desenvolvimento', COMPLETED: 'Concluído', REJECTED: 'Não planejado' } as const
export const priorities = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', CRITICAL: 'Crítica' } as const
export const origins = { CLIENT: 'Cliente', ADMIN: 'Comerciante/Admin', PROFESSIONAL: 'Profissional' } as const

export async function downloadAttachment(path: string, filename: string) {
  const blob = await api.download(path)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function technicalContext() {
  const agent = navigator.userAgent
  const browser = agent.match(/(?:Edg|Chrome|Firefox|Version)\/([\d.]+)/)
  const name = agent.includes('Edg/') ? 'Edge' : agent.includes('Chrome/') ? 'Chrome' : agent.includes('Firefox/') ? 'Firefox' : agent.includes('Safari/') ? 'Safari' : 'Outro'
  const operating_system = agent.includes('Windows') ? 'Windows' : agent.includes('Android') ? 'Android' : agent.includes('iPhone') || agent.includes('iPad') ? 'iOS' : agent.includes('Mac OS') ? 'macOS' : agent.includes('Linux') ? 'Linux' : 'Outro'
  return { page_url: location.pathname, browser: name, browser_version: browser?.[1] || '', operating_system, device_type: /Mobi|Android|iPhone/.test(agent) ? 'Celular' : /iPad|Tablet/.test(agent) ? 'Tablet' : 'Desktop', app_version: import.meta.env.VITE_APP_VERSION || '' }
}

function FeedbackCenter() {
  const client = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)
  const [category, setCategory] = useState<keyof typeof categories>('SUGGESTION')
  const [selected, setSelected] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [success, setSuccess] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const query = useQuery({ queryKey: ['feedback-mine', page], queryFn: () => api.get<Paginated<Feedback>>(`/feedback/mine/?page=${page}`) })
  const detail = useQuery({ queryKey: ['feedback-detail', selected], queryFn: () => api.get<Feedback>(`/feedback/${selected}/`), enabled: Boolean(selected) })
  const create = useMutation({ mutationFn: async ({ payload, file }: { payload: object; file: File | null }) => {
    const feedback = await api.post<Feedback>('/feedback/', payload)
    if (file) {
      const data = new FormData(); data.append('file', file)
      try { await api.post(`/feedback/${feedback.id}/attachments/`, data) }
      catch (error) { setUploadError(`Feedback enviado, mas a imagem não foi anexada: ${apiErrorMessage(error)}`) }
    }
    return feedback
  }, onSuccess: () => { setSuccess(true); setSelected(null); formRef.current?.reset(); client.invalidateQueries({ queryKey: ['feedback-mine'] }) } })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSuccess(false); setUploadError('')
    const data = new FormData(event.currentTarget)
    const file = data.get('file') instanceof File && (data.get('file') as File).size ? data.get('file') as File : null
    if (file && (file.size > 2 * 1024 * 1024 || !/\.(png|jpe?g|webp)$/i.test(file.name))) { setUploadError('Envie uma imagem PNG, JPEG ou WebP de até 2 MB.'); return }
    const payload = { category, title: data.get('title'), description: data.get('description'), ...(category === 'BUG' ? technicalContext() : {}) }
    create.mutate({ payload, file })
  }
  return <div className="mx-auto max-w-5xl min-w-0"><header className="mb-7"><h1 className="page-title">Ajuda e feedback</h1><p className="muted mt-2 text-sm">Conte como podemos melhorar o NoteSync e acompanhe suas mensagens.</p></header>
    {success && <div className="mb-5"><Notice kind="success" title="Obrigado pelo feedback">Recebemos sua mensagem e ela já está disponível em Meus feedbacks.</Notice></div>}
    {uploadError && <div className="mb-5"><Notice kind="warning">{uploadError}</Notice></div>}
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><section className="panel min-w-0"><h2 className="mb-5 text-lg font-semibold">Enviar feedback</h2><form ref={formRef} className="grid gap-4" onSubmit={submit}><SelectField label="Tipo" value={category} onChange={(event) => setCategory(event.target.value as keyof typeof categories)}>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField><Field label="Título" name="title" required maxLength={160} /><TextAreaField label="Descrição" name="description" required maxLength={5000} />{category === 'BUG' && <p className="text-sm text-[#52658a]">Algumas informações técnicas básicas desta página serão enviadas para nos ajudar a identificar o problema.</p>}<Field label="Anexar imagem/print (opcional)" name="file" type="file" accept="image/png,image/jpeg,image/webp" />{create.isError && <Notice>{apiErrorMessage(create.error)}</Notice>}<Button loading={create.isPending}>Enviar feedback</Button></form></section>
    <section className="min-w-0"><h2 className="mb-5 text-lg font-semibold">Meus feedbacks</h2>{query.isPending && <LoadingState />}{query.isError && <Notice>{apiErrorMessage(query.error)}</Notice>}{query.data?.results.length === 0 && <EmptyState title="Nenhum feedback enviado" description="Sua primeira mensagem aparecerá aqui." />}{query.data?.results.map((item) => <button key={item.id} type="button" onClick={() => setSelected(item.id)} className="surface mb-3 block w-full min-w-0 rounded-xl p-4 text-left hover:border-[#8fc0f1]"><span className="text-xs font-semibold text-[#52658a]">{item.public_id} · {formatDateTime(item.created_at)}</span><strong className="mt-1 block break-words">{item.title}</strong><span className="mt-2 block text-sm text-[#52658a]">{categories[item.category]} · {statuses[item.status]}</span></button>)}{query.data && query.data.count > 50 && <div className="mt-4 flex items-center gap-3"><Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button><span>Página {page}</span><Button variant="secondary" disabled={!query.data.next} onClick={() => setPage(page + 1)}>Próxima</Button></div>}</section></div>
    {selected && <section className="panel mt-6 min-w-0" aria-live="polite"><Button variant="ghost" onClick={() => setSelected(null)}>Voltar à lista</Button>{detail.isPending && <LoadingState />}{detail.isError && <Notice>{apiErrorMessage(detail.error)}</Notice>}{detail.data && <><p className="mt-4 text-sm text-[#52658a]">{detail.data.public_id} · {categories[detail.data.category]} · {formatDateTime(detail.data.created_at)}</p><h2 className="mt-2 break-words text-xl font-semibold">{detail.data.title}</h2><p className="mt-2">{statuses[detail.data.status]}</p><p className="mt-5 whitespace-pre-wrap break-words">{detail.data.description}</p><h3 className="mt-6 font-semibold">Anexos</h3>{detail.data.attachments.length ? detail.data.attachments.map((file) => <Button key={file.id} variant="ghost" onClick={() => void downloadAttachment(`/feedback/${detail.data!.id}/attachments/${file.id}/download/`, file.original_filename).catch((error) => setDownloadError(apiErrorMessage(error)))}>{file.original_filename}</Button>) : <p className="text-sm text-[#52658a]">Nenhum anexo.</p>}{downloadError && <Notice>{downloadError}</Notice>}<h3 className="mt-6 font-semibold">Respostas da equipe</h3>{detail.data.replies.length ? detail.data.replies.map((reply) => <article key={reply.id} className="mt-3 rounded-xl border border-[#d8e5f4] p-4"><p className="text-xs text-[#52658a]">{reply.author_name} · {formatDateTime(reply.created_at)}</p><p className="mt-2 whitespace-pre-wrap break-words">{reply.message}</p></article>) : <p className="mt-2 text-sm text-[#52658a]">Ainda não há respostas.</p>}</>}</section>}
  </div>
}

export default function FeedbackPage() {
  const { user } = useAuth()
  if (user?.company) return <FeedbackCenter />
  if (user?.professional) return <main className="min-h-screen bg-[#f7faff] p-4 text-[#071044] sm:p-8"><div className="mx-auto max-w-5xl"><Link to="/profissional" className="btn btn-ghost mb-5">Voltar à agenda</Link><FeedbackCenter /></div></main>
  return <PublicPage mode="customer" decorations={false}><div className="mx-auto max-w-5xl px-4 py-8"><Link to="/cliente/conta" className="btn btn-ghost mb-5">Voltar ao perfil</Link><FeedbackCenter /></div></PublicPage>
}
