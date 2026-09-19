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

export function homeFor(user: NonNullable<ReturnType<typeof useAuth>['user']>) {
  return user.is_superuser ? '/platform' : user.company ? '/admin' : '/cliente'
}

export function ProtectedRoute({ role }: { role: Role }) {
  const { user, status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <LoadingState label="Restabelecendo sua sessão" fullScreen />
  if (!user) {
    const login = role === 'platform' ? '/platform/login' : role === 'company' ? '/empreendedor/login' : '/cliente/login'
    return <Navigate to={login} replace state={{ from: location.pathname }} />
  }
  if (userRole(user) !== role) {
    return <Navigate to={homeFor(user)} replace />
  }
  return <Outlet />
}

export function AnonymousRoute() {
  const { user, status } = useAuth()
  if (status === 'loading') return <LoadingState label="Verificando sua sessão" fullScreen />
  return user ? <Navigate to={homeFor(user)} replace /> : <Outlet />
}
