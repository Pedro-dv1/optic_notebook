import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LuArrowLeft as ArrowLeft, LuBuilding2 as Building2, LuCalendarDays as CalendarDays, LuCheck as Check, LuCopy as Copy, LuEye as Eye, LuPlus as Plus, LuSearch as Search, LuUsers as Users } from 'react-icons/lu'
import { useState } from 'react'
import { Link } from 'react-router'
import { api, apiErrorMessage } from '../../api/client'
import { StatusBadge } from '../../components/StatusBadge'
import { Button, Dialog, EmptyState, LoadingState, Notice } from '../../components/ui'
import { formatDateTime } from '../../lib/format'
import type { Company, Paginated, PlatformMetrics, RegistrationKey } from '../../types/api'

export function PlatformDashboardPage() {
  const metrics = useQuery({ queryKey: ['platform-metrics'], queryFn: () => api.get<PlatformMetrics>('/platform/metrics/') })
  if (metrics.isPending) return <LoadingState label="Carregando a plataforma" />
  if (metrics.isError) return <Notice>{apiErrorMessage(metrics.error)}</Notice>
  return <Page title="Visão geral" description="Indicadores essenciais da operação do OpticNoteBook."><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Metric label="Total de empresas" value={metrics.data.total_companies} icon={Building2} /><Metric label="Empresas ativas" value={metrics.data.active_companies} icon={Building2} /><Metric label="Agendamentos no mês" value={metrics.data.appointments_this_month} icon={CalendarDays} /><Metric label="Agendamentos totais" value={metrics.data.total_appointments} icon={CalendarDays} /><Metric label="Visualizações no mês" value={metrics.data.views_this_month} icon={Eye} /><Metric label="Visitantes únicos no mês" value={metrics.data.unique_visitors_this_month} icon={Users} /></div></Page>
}

export function PlatformCompaniesPage() {
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [target, setTarget] = useState<Company | null>(null)
  const query = useQuery({ queryKey: ['platform-companies', search, page], queryFn: () => api.get<Paginated<Company>>(`/platform/companies/?q=${encodeURIComponent(search)}&page=${page}`) })
  const changeStatus = useMutation({
    mutationFn: (company: Company) => api.post(`/platform/companies/${company.id}/${company.status === 'ACTIVE' ? 'suspend' : 'reactivate'}/`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['platform-companies'] })
      setTarget(null)
    },
  })
  return <Page title="Empresas" description="Pesquise, suspenda e reative sem remover os dados da empresa.">
    <label className="relative mb-5 block max-w-md"><span className="sr-only">Pesquisar empresas</span><Search className="absolute left-3 top-3.5 size-4 text-[#667084]" /><input className="field pl-10" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Nome ou endereço público" /></label>
    {query.isPending && <LoadingState />}{query.isError && <Notice>{apiErrorMessage(query.error)}</Notice>}
    {query.data?.results.length === 0 && <EmptyState title="Nenhuma empresa encontrada" description="Tente outro termo de busca." />}
    {query.data && query.data.results.length > 0 && <div className="table-wrap"><table className="data-table responsive-table"><thead><tr><th>Empresa</th><th>Local e segmento</th><th>Status</th><th>Agendamentos</th><th>Analytics</th><th>Criada em</th><th>Ação</th></tr></thead><tbody>{query.data.results.map((company) => <tr key={company.id}><td data-label="Empresa"><strong className="text-[#071044]">{company.name}</strong><span className="block text-xs text-[#7182a8]">/{company.slug}</span></td><td data-label="Local e segmento"><span>{company.city || 'Cidade não informada'}{company.state ? ` · ${company.state}` : ''}</span><span className="block text-xs text-[#7182a8]">{company.business_type_label} · {company.niche_label}</span></td><td data-label="Status"><StatusBadge status={company.status} /></td><td data-label="Agendamentos"><strong className="text-[#071044]">{company.appointments_this_month || 0}</strong> neste mês<span className="block text-xs text-[#7182a8]">{company.appointments_previous_month || 0} no mês anterior · {company.total_appointments || 0} total</span></td><td data-label="Analytics"><strong className="text-[#071044]">{company.views_this_month || 0}</strong> visualizações<span className="block text-xs text-[#7182a8]">{company.unique_visitors_this_month || 0} visitantes únicos · {company.total_views || 0} total</span></td><td data-label="Criada em">{company.created_at ? formatDateTime(company.created_at) : '—'}</td><td data-label="Ação"><Button variant={company.status === 'ACTIVE' ? 'danger' : 'secondary'} onClick={() => setTarget(company)}>{company.status === 'ACTIVE' ? 'Suspender' : 'Reativar'}</Button></td></tr>)}</tbody></table></div>}
    {query.data && (query.data.previous || query.data.next) && <nav className="mt-5 flex items-center justify-end gap-3" aria-label="Paginação de empresas"><Button variant="secondary" disabled={!query.data.previous} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</Button><span className="text-sm text-[#8d98aa]">Página {page}</span><Button variant="secondary" disabled={!query.data.next} onClick={() => setPage((value) => value + 1)}>Próxima</Button></nav>}
    <Dialog open={Boolean(target)} onClose={() => setTarget(null)} title={target?.status === 'ACTIVE' ? 'Suspender empresa' : 'Reativar empresa'}><p className="muted text-sm leading-6">Você está prestes a {target?.status === 'ACTIVE' ? 'suspender' : 'reativar'} <strong className="text-[#071044]">{target?.name}</strong>. {target?.status === 'ACTIVE' ? 'A página pública e as operações administrativas ficarão bloqueadas; os dados serão preservados.' : 'A página pública e as operações voltarão a funcionar.'}</p>{changeStatus.isError && <div className="mt-4"><Notice>{apiErrorMessage(changeStatus.error)}</Notice></div>}<div className="mt-6 flex justify-end gap-3"><Button variant="ghost" onClick={() => setTarget(null)}>Voltar</Button><Button variant={target?.status === 'ACTIVE' ? 'danger' : 'primary'} disabled={changeStatus.isPending} onClick={() => target && changeStatus.mutate(target)}>Confirmar</Button></div></Dialog>
  </Page>
}

export function RegistrationKeysPage() {
  const client = useQueryClient()
  const [revealed, setRevealed] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const query = useQuery({ queryKey: ['registration-keys'], queryFn: () => api.get<Paginated<RegistrationKey>>('/platform/registration-keys/') })
  const create = useMutation({ mutationFn: () => api.post<{ id: string; authorization_key: string }>('/platform/registration-keys/'), onSuccess: (data) => { setRevealed(data.authorization_key); setCopied(false); client.invalidateQueries({ queryKey: ['registration-keys'] }) } })
  const copy = async () => { if (!revealed) return; await navigator.clipboard.writeText(revealed); setCopied(true) }
  return <Page title="Chaves de cadastro" description="Uma chave autoriza exatamente um novo cadastro empresarial." action={<Button onClick={() => create.mutate()} disabled={create.isPending}><Plus className="size-4" /> Gerar chave</Button>}>
    {create.isError && <div className="mb-4"><Notice>{apiErrorMessage(create.error)}</Notice></div>}
    {revealed && <section className="mb-6 border border-[#365d8d] bg-[#101d2d] p-5" style={{ borderRadius: 'var(--radius-md)' }}><h2 className="font-semibold text-white">Copie a chave agora</h2><p className="muted mt-2 text-sm">Ela aparece uma única vez e não poderá ser consultada novamente.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><code className="min-w-0 flex-1 overflow-auto rounded border border-[#343c4d] bg-[#090b10] px-3 py-3 text-sm text-[#d8e8fb]">{revealed}</code><Button variant="secondary" onClick={() => void copy()}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? 'Copiada' : 'Copiar'}</Button></div><button type="button" className="mt-3 text-sm text-[#9cbce4] underline" onClick={() => { setRevealed(null); setCopied(false) }}>Já salvei em local seguro</button></section>}
    {query.isPending && <LoadingState />}{query.isError && <Notice>{apiErrorMessage(query.error)}</Notice>}
    {query.data?.results.length === 0 && <EmptyState title="Nenhuma chave gerada" description="Gere a primeira chave quando uma empresa for se cadastrar." />}
    {query.data && query.data.results.length > 0 && <div className="table-wrap"><table className="data-table responsive-table"><thead><tr><th>Estado</th><th>Criada em</th><th>Usada em</th><th>Empresa</th></tr></thead><tbody>{query.data.results.map((key) => <tr key={key.id}><td data-label="Estado">{key.state === 'ACTIVE' ? 'Disponível' : key.state === 'CONSUMED' ? 'Utilizada' : 'Inativa'}</td><td data-label="Criada em">{formatDateTime(key.created_at)}</td><td data-label="Usada em">{key.consumed_at ? formatDateTime(key.consumed_at) : '—'}</td><td data-label="Empresa">{key.consumed_by_company || '—'}</td></tr>)}</tbody></table></div>}
  </Page>
}

function Page({ title, description, action, children }: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) { return <div>{title !== 'Visão geral' && <Link to="/platform" className="btn btn-ghost mb-3 !size-11 !p-0" aria-label="Voltar ao painel" title="Voltar"><ArrowLeft className="size-5" /></Link>}<header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="page-title">{title}</h1><p className="muted mt-2 text-sm">{description}</p></div>{action}</header>{children}</div> }
function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Building2 }) { return <div className="panel"><div className="flex items-center justify-between"><p className="text-sm text-[#7182a8]">{label}</p><Icon className="size-4 text-[#1f64b6]" aria-hidden="true" /></div><p className="mt-3 text-3xl font-semibold tracking-tight text-[#071044]">{value}</p></div> }
