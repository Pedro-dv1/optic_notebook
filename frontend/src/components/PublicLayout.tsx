import { LuArrowLeft as ArrowLeft, LuCalendarDays as CalendarDays, LuClipboardCheck as ClipboardCheck, LuClock3 as Clock3, LuMenu as Menu, LuX as X } from 'react-icons/lu'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import logoWithText from '../assets/branding/OpticNoteBook-logo-text.svg'
import { PublicFooter } from './Footer'
import { ProfileAvatar } from './ProfileAvatar'
import { AccountMenu } from './account/AccountMenu'

export function PublicLogo({ className = '' }: { className?: string }) {
  return <Link to="/" className={`inline-flex shrink-0 items-center ${className}`} aria-label="OpticNoteBook — início">
    <img src={logoWithText} alt="OpticNoteBook" className="h-14 w-auto max-w-[15rem] object-contain sm:h-16 sm:max-w-[18rem]" />
  </Link>
}

export function PublicBackLink({ to }: { to: string }) {
  return <Link to={to} className="btn btn-ghost mb-3 !size-11 !min-h-0 !rounded-full !p-0" aria-label="Voltar" title="Voltar">
    <ArrowLeft className="size-6" aria-hidden="true" />
  </Link>
}

type HeaderMode = 'home' | 'customer' | 'entrepreneur'

export function PublicHeader({ mode = 'customer' }: { mode?: HeaderMode }) {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const loginTo = mode === 'entrepreneur' ? '/empreendedor/login' : '/cliente/login'
  const registerTo = mode === 'entrepreneur' ? '/empreendedor/cadastro' : '/cliente/cadastro'
  const accountTo = user?.is_superuser ? '/platform' : user?.company ? '/admin' : '/cliente'
  const isCustomer = Boolean(user && !user.is_superuser && !user.company)
  return <header className="public-header sticky top-0 z-40 backdrop-blur-md">
    <div className="mx-auto flex h-20 max-w-[90rem] items-center justify-between gap-3 px-5 sm:h-[5.5rem] sm:gap-6 sm:px-8 lg:px-12">
      <PublicLogo />
      <nav className="hidden items-center gap-9 text-[1.02rem] font-medium text-[#6173a5] md:flex" aria-label="Navegação pública">
        <Link to="/como-funciona" className="public-nav-link">Como funciona</Link>
        {user ? <><Link to={isCustomer ? '/cliente' : accountTo}>{isCustomer ? 'Meus agendamentos' : 'Painel'}</Link>{isCustomer ? <AccountMenu /> : <Link to={accountTo} className="header-account-link" aria-label="Abrir minha conta"><ProfileAvatar src={user.avatar} name={user.full_name} className="size-full" /></Link>}</> : mode === 'home' ? <>
          <span className="text-[#9aabd0]" aria-hidden="true">|</span>
          <Link to="/politica-de-privacidade" className="public-nav-link">Política de Privacidade</Link>
        </> : <>
          <span className="h-7 w-px bg-[#b9c8e5]" aria-hidden="true" />
          <Link to={loginTo} className="font-semibold text-[#070d35] hover:text-[#087cf0]">Entrar</Link>
          <Link to={registerTo} className="public-primary-link">Criar conta</Link>
        </>}
      </nav>
      <div className="flex items-center gap-2 md:hidden">
        {isCustomer && <AccountMenu />}
        <button type="button" className="btn btn-ghost !size-12 !min-h-0 !p-0" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open}>
          {open ? <X className="size-8" /> : <Menu className="size-9" />}
        </button>
      </div>
    </div>
    {open && <nav className="absolute inset-x-0 top-full border-y border-[#d9e6f8] bg-white px-6 py-5 text-[#071044] shadow-sm md:hidden" aria-label="Navegação móvel">
      <div className="mx-auto grid max-w-lg gap-2"><Link to="/como-funciona" className="py-2" onClick={() => setOpen(false)}>Como funciona</Link>
        {user ? isCustomer ? <><Link to="/cliente" className="py-2" onClick={() => setOpen(false)}>Meus agendamentos</Link><Link to="/cliente/procurar" className="py-2" onClick={() => setOpen(false)}>Buscar empresas</Link></> : <Link to={accountTo} className="py-2" onClick={() => setOpen(false)}>Painel</Link> : mode === 'home' ? <Link to="/politica-de-privacidade" className="py-2" onClick={() => setOpen(false)}>Política de Privacidade</Link> : <><Link to={loginTo} className="py-2" onClick={() => setOpen(false)}>Entrar</Link><Link to={registerTo} className="public-primary-link mt-1 text-center" onClick={() => setOpen(false)}>Criar conta</Link></>}
      </div>
    </nav>}
  </header>
}

export function PublicDecorations() {
  return <div className="pointer-events-none absolute inset-0 hidden overflow-hidden text-[#b9d6ff] sm:block" aria-hidden="true">
    <CalendarDays className="absolute -left-10 top-[12rem] size-56 rotate-[-10deg] stroke-[1.15] opacity-70 sm:left-5" />
    <Clock3 className="absolute -right-5 top-[11rem] size-52 rotate-[4deg] stroke-[1.15] opacity-70 sm:right-8" />
    <ClipboardCheck className="absolute -bottom-10 -right-14 size-56 rotate-[14deg] stroke-[1.15] opacity-60 sm:right-1" />
    <span className="absolute -bottom-12 -left-8 h-56 w-44 rotate-[-14deg] rounded-[1.8rem] border-[3px] border-current opacity-55" />
  </div>
}

export function PublicPage({ children, mode = 'customer', className = '', decorations = true }: { children: ReactNode; mode?: HeaderMode; className?: string; decorations?: boolean }) {
  return <div className={`public-page relative flex min-h-screen flex-col overflow-x-clip ${className}`}>
    {decorations && <PublicDecorations />}
    <PublicHeader mode={mode} />
    <main className="relative z-10 flex-1">{children}</main>
    <PublicFooter />
  </div>
}
