import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, refreshAccess, setSessionLostHandler } from '../api/client'
import type { User } from '../types/api'

type AuthStatus = 'loading' | 'anonymous' | 'authenticated'

interface AuthContextValue {
  user: User | null
  status: AuthStatus
  login: (payload: { email: string; password: string; turnstile_token?: string }) => Promise<User>
  logout: () => Promise<void>
  clearSession: () => void
  refreshUser: () => Promise<User>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  const clearSession = useCallback(() => {
    api.clearAccess()
    queryClient.clear()
    setUser(null)
    setStatus('anonymous')
  }, [queryClient])

  useEffect(() => {
    setSessionLostHandler(() => {
      clearSession()
    })
    refreshAccess()
      .then(() => api.get<User>('/auth/me/'))
      .then((restoredUser) => {
        setUser(restoredUser)
        setStatus('authenticated')
      })
      .catch(() => {
        api.clearAccess()
        setStatus('anonymous')
      })
    return () => setSessionLostHandler(null)
  }, [clearSession])

  const login = async (payload: Parameters<typeof api.login>[0]) => {
    const authenticatedUser = await api.login(payload)
    queryClient.clear()
    setUser(authenticatedUser)
    setStatus('authenticated')
    return authenticatedUser
  }

  const logout = async () => {
    try {
      await api.logout()
    } finally {
      queryClient.clear()
      setUser(null)
      setStatus('anonymous')
    }
  }

  const refreshUser = async () => {
    const current = await api.get<User>('/auth/me/')
    setUser(current)
    return current
  }

  return <AuthContext value={{ user, status, login, logout, clearSession, refreshUser }}>{children}</AuthContext>
}

export function useAuth() {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
