import { LuLockKeyhole as LockKeyhole, LuLogOut as LogOut, LuSettings2 as Settings2, LuUserRound as UserRound } from 'react-icons/lu'
import type { IconType } from 'react-icons'
import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthProvider'
import { ProfileAvatar } from '../ProfileAvatar'
import { AccountModalShell } from './AccountModalShell'
import { EmailChangeFlow } from './EmailChangeFlow'
import { PasswordChangeFlow } from './PasswordChangeFlow'
import { ProfilePanel } from './ProfileDialog'
import { PasswordSettings, SecuritySettings, SettingsHome } from './SettingsDialog'

type AccountView = 'profile' | 'email' | 'settings' | 'security' | 'password' | 'password-change' | null

export function AccountMenu() {
  const navigate = useNavigate()
  const { user, logout, clearSession } = useAuth()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<AccountView>(null)
  const [passwordChanged, setPasswordChanged] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (!open) return
    itemRefs.current[0]?.focus()
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const choose = (next: AccountView) => {
    setOpen(false)
    setPasswordChanged(false)
    setView(next)
  }
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[]
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      items[(current + 1) % items.length]?.focus()
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      items[(current - 1 + items.length) % items.length]?.focus()
    }
    if (event.key === 'Home') { event.preventDefault(); items[0]?.focus() }
    if (event.key === 'End') { event.preventDefault(); items.at(-1)?.focus() }
    if (event.key === 'Tab') setOpen(false)
  }
  const leave = async () => {
    if (leaving) return
    setLeaving(true)
    try {
      await logout()
      navigate('/', { replace: true })
    } finally {
      setLeaving(false)
    }
  }
  const finishPasswordChange = useCallback(() => {
    clearSession()
    setView(null)
    navigate('/cliente/login', { replace: true, state: { passwordChanged: true } })
  }, [clearSession, navigate])
  const closeAccount = useCallback(() => {
    if (passwordChanged) finishPasswordChange()
    else setView(null)
  }, [finishPasswordChange, passwordChanged])

  const settingsView = view === 'settings' || view === 'security' || view === 'password' || view === 'password-change'
  const title = view === 'profile' ? 'Perfil'
    : view === 'email' ? 'Alterar e-mail'
      : view === 'security' ? 'Segurança'
        : view === 'password' ? 'Senha'
          : view === 'password-change' ? 'Alterar senha'
            : 'Configurações'
  const onBack = view === 'email' ? () => setView('profile')
    : view === 'security' ? () => setView('settings')
      : view === 'password' ? () => setView('security')
        : view === 'password-change' && !passwordChanged ? () => setView('password')
          : undefined
  const backLabel = view === 'email' ? 'Perfil'
    : view === 'security' ? 'Configurações'
      : view === 'password' ? 'Segurança'
        : view === 'password-change' ? 'Senha'
          : undefined

  if (!user) return null

  return <>
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        className="header-account-link"
        aria-label="Abrir menu da conta"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="customer-account-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <ProfileAvatar src={user.avatar} name={user.full_name} className="size-full" />
      </button>
      {open && <div
        id="customer-account-menu"
        role="menu"
        aria-label="Conta"
        className="absolute right-0 top-[calc(100%+.65rem)] z-[60] w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#d4e4f7] bg-white p-2 text-left shadow-[0_18px_60px_rgb(7_16_68_/_18%)]"
        onKeyDown={keyDown}
      >
        <div className="flex items-center gap-3 px-3 py-3" role="none">
          <ProfileAvatar src={user.avatar} name={user.full_name} className="size-11" />
          <div className="min-w-0"><p className="truncate text-sm font-bold text-[#071044]">{user.full_name}</p><p className="mt-0.5 truncate text-xs text-[#7182a8]">{maskEmail(user.email)}</p></div>
        </div>
        <div className="my-1 border-t border-[#e1eaf5]" role="separator" />
        <MenuButton refItem={(element) => { itemRefs.current[0] = element }} icon={UserRound} onClick={() => choose('profile')}>Perfil</MenuButton>
        <MenuButton refItem={(element) => { itemRefs.current[1] = element }} icon={Settings2} onClick={() => choose('settings')}>Configurações</MenuButton>
        <div className="my-1 border-t border-[#e1eaf5]" role="separator" />
        <MenuButton refItem={(element) => { itemRefs.current[2] = element }} icon={LogOut} disabled={leaving} onClick={() => void leave()}>{leaving ? 'Saindo…' : 'Sair'}</MenuButton>
      </div>}
    </div>
    {view && <AccountModalShell
      title={title}
      onClose={closeAccount}
      onBack={onBack}
      backLabel={backLabel}
      returnFocusRef={buttonRef}
      sidebar={settingsView
        ? <AccountNavButton active={view !== 'settings'} icon={LockKeyhole} onClick={() => setView('security')}>Segurança</AccountNavButton>
        : <AccountNavButton active icon={UserRound} onClick={() => setView('profile')}>Perfil</AccountNavButton>}
    >
      {view === 'profile' && <ProfilePanel onEmailChange={() => setView('email')} />}
      {view === 'email' && <EmailChangeFlow onDone={() => setView('profile')} />}
      {view === 'settings' && <SettingsHome onSecurity={() => setView('security')} />}
      {view === 'security' && <SecuritySettings onPassword={() => setView('password')} />}
      {view === 'password' && <PasswordSettings onPasswordChange={() => setView('password-change')} />}
      {view === 'password-change' && <PasswordChangeFlow onSuccess={() => setPasswordChanged(true)} onDone={finishPasswordChange} />}
    </AccountModalShell>}
  </>
}

function MenuButton({ refItem, icon: Icon, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { refItem: (element: HTMLButtonElement | null) => void; icon: IconType }) {
  return <button ref={refItem} type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-[#30436e] hover:bg-[#edf5fd] hover:text-[#087cf0]" {...props}>
    <Icon className="size-4" aria-hidden="true" />{children}
  </button>
}

function AccountNavButton({ active, icon: Icon, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; icon: IconType }) {
  return <button type="button" aria-current={active ? 'page' : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold ${active ? 'bg-[#e8f3ff] text-[#087cf0]' : 'text-[#52658f] hover:bg-[#edf5fd] hover:text-[#087cf0]'}`} {...props}>
    <Icon className="size-4" aria-hidden="true" />{children}
  </button>
}

function maskEmail(email: string) {
  const [local = '', domain = ''] = email.split('@')
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`
}
