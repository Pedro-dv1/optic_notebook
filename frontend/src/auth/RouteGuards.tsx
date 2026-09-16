import { Navigate, Outlet, useLocation } from 'react-router'
import { LoadingState } from '../components/ui'
import { useAuth } from './AuthProvider'

type Role = 'customer' | 'company' | 'platform'

function userRole(user: ReturnType<typeof useAuth>['user']): Role | null {
  if (!user) return null
  if (user.is_superuser) return 'platform'
  if (user.company) return 'company'
  return 'customer'
}

function homeFor(user: NonNullable<ReturnType<typeof useAuth>['user']>) {
  return user.is_superuser ? '/platform' : user.company ? '/admin' : '/cliente/agendamentos'
}

export function ProtectedRoute({ role }: { role: Role }) {
  const { user, status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <LoadingState label="Restabelecendo sua sessão" />
  if (!user) {
    const login = role === 'platform' ? '/platform/login' : role === 'company' ? '/empreendedor/login' : '/cliente/login'
    return <Navigate to={login} replace state={{ from: location.pathname }} />
  }
  if (userRole(user) !== role) {
    const destination = user.is_superuser ? '/platform' : user.company ? '/admin' : '/cliente/agendamentos'
    return <Navigate to={destination} replace />
  }
  return <Outlet />
}

export function AnonymousRoute() {
  const { user, status } = useAuth()
  if (status === 'loading') return <LoadingState label="Verificando sua sessão" />
  return user ? <Navigate to={homeFor(user)} replace /> : <Outlet />
}
