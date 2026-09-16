import { LuBuilding2 as Building2, LuCalendarDays as CalendarDays, LuClock3 as Clock3, LuKeyRound as KeyRound, LuLayoutDashboard as LayoutDashboard, LuLogOut as LogOut, LuMenu as Menu, LuScissors as Scissors, LuSettings2 as Settings2, LuUserRound as UserRound, LuUsers as Users, LuX as X } from 'react-icons/lu'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import type { Company } from '../types/api'
import { Button, LoadingState, Notice } from './ui'
import logo from '../assets/branding/OpticNoteBook-logo.svg'

const companyItems = [
  { to: '/admin', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/admin/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/admin/agendamentos', label: 'Agendamentos', icon: Clock3 },
  { to: '/admin/servicos', label: 'Serviços', icon: Scissors },
  { to: '/admin/profissionais', label: 'Profissionais', icon: UserRound },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings2 },
]

const platformItems = [
  { to: '/platform', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/platform/empresas', label: 'Empresas', icon: Building2 },
  { to: '/platform/chaves', label: 'Chaves de cadastro', icon: KeyRound },
]

export function AppShell({ context }: { context: 'company' | 'platform' }) {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const items = context === 'company' ? companyItems : platformItems
  const company = useQuery({
    queryKey: ['company-shell'],
    queryFn: () => api.get<Company>('/company/profile/'),
    enabled: context === 'company',
  })
  const platformConfig = useQuery({
    queryKey: ['platform-config'],
    queryFn: () => api.get<{ name: string; support_email: string }>('/public/platform/'),
    enabled: context === 'company' && company.data?.status === 'SUSPENDED',
  })
  if (context === 'company' && company.isPending) return <LoadingState label="Verificando a empresa" />
  if (context === 'company' && company.isError) return <div className="mx-auto max-w-lg p-6"><Notice>{apiErrorMessage(company.error)}</Notice></div>
  if (context === 'company' && company.data?.status === 'SUSPENDED') {
    return <main className="grid min-h-screen place-items-center bg-[#f7faff] p-5 text-[#071044]"><section className="panel max-w-lg text-left"><Brand /><h1 className="mt-8 text-2xl font-semibold">Empresa temporariamente suspensa</h1><p className="muted mt-3 text-sm leading-6">Os dados permanecem preservados, mas as funções operacionais estão indisponíveis até a reativação pela plataforma.</p>{platformConfig.data?.support_email && <p className="mt-4 text-sm">Suporte: <a className="text-[#087cf0] underline" href={`mailto:${platformConfig.data.support_email}`}>{platformConfig.data.support_email}</a></p>}<Button className="mt-7" variant="secondary" onClick={() => void logout()}><LogOut className="size-4" /> Sair</Button></section></main>
  }
  return <div className="internal-shell min-h-screen bg-[#f7faff] text-[#071044]">
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-[#d8e5f4] bg-white/95 px-4 backdrop-blur md:hidden">
      <Brand />
      <button className="btn btn-ghost !size-11 !min-h-0 !p-0" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open}>
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
    </header>
    {open && <button className="fixed inset-0 z-30 bg-black/55 md:hidden" aria-label="Fechar menu" onClick={() => setOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[#d8e5f4] bg-white transition-transform md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-20 items-center border-b border-[#d8e5f4] px-5"><Brand /></div>
      <div className="border-b border-[#e4edf7] px-5 py-4">
        <p className="truncate text-sm font-semibold text-[#071044]">{context === 'company' ? user?.company?.name : 'Administração da plataforma'}</p>
        <p className="mt-1 truncate text-xs text-[#7182a8]">{user?.email}</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navegação principal">
        {items.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `flex min-h-11 items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-[#eaf3fd] text-[#087cf0]' : 'text-[#52658f] hover:bg-[#f1f6fc] hover:text-[#071044]'}`} style={{ borderRadius: 'var(--radius-sm)' }}>
          <Icon className="size-4" aria-hidden="true" />{label}
        </NavLink>)}
      </nav>
      <div className="border-t border-[#d8e5f4] p-3">
        <Button variant="ghost" className="w-full justify-start" onClick={() => void logout()}><LogOut className="size-4" /> Sair</Button>
      </div>
    </aside>
    <main className="min-h-screen md:ml-64"><div className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8"><Outlet /></div></main>
  </div>
}

export function Brand() {
  return <span className="inline-flex"><img src={logo} alt="OpticNoteBook" className="h-10 w-auto object-contain" /></span>
}
