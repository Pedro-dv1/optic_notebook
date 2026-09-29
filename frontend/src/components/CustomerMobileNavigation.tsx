import { LuCalendarDays, LuLogIn, LuSearch, LuUserRound } from 'react-icons/lu'
import { Link, NavLink, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider'

export function CustomerMobileNavigation() {
  const { user, status } = useAuth()
  const { pathname } = useLocation()
  if (status === 'loading') return null
  if (user && (user.is_superuser || user.company || user.professional)) return null
  if (!user) return <nav className="customer-bottom-nav guest-bottom-nav" aria-label="Acesso à conta">
    <NavLink to="/cliente/cadastro"><LuUserRound aria-hidden="true" /><span>Criar conta</span></NavLink>
    <NavLink to="/cliente/login"><LuLogIn aria-hidden="true" /><span>Entrar</span></NavLink>
  </nav>
  const exploring = pathname === '/cliente/procurar' || pathname.startsWith('/cliente/agendar/')
  return <nav className="customer-bottom-nav" aria-label="Navegação do cliente">
    <Link to="/cliente/procurar" className={exploring ? 'active' : undefined} aria-current={exploring ? 'page' : undefined}>
      <LuSearch aria-hidden="true" /><span>Explorar</span>
    </Link>
    <NavLink to="/cliente" end><LuCalendarDays aria-hidden="true" /><span>Agendamentos</span></NavLink>
    <NavLink to="/cliente/conta"><LuUserRound aria-hidden="true" /><span>Perfil</span></NavLink>
  </nav>
}
