import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router'
import { AuthProvider } from '../auth/AuthProvider'

export function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: status === 204 ? undefined : { 'Content-Type': 'application/json' },
  }))
}

export function renderApp(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<BrowserRouter><QueryClientProvider client={client}><AuthProvider>{children}</AuthProvider></QueryClientProvider></BrowserRouter>)
}

export const customer = {
  id: 'customer-id', email: 'ana@example.com', full_name: 'Ana Cliente', whatsapp: '+5511999999999', avatar: null, is_superuser: false, company: null,
}

export const companyAdmin = {
  id: 'owner-id', email: 'dono@example.com', full_name: 'Dono', whatsapp: '+5511988888888', avatar: null, is_superuser: false,
  company: { id: 'company-id', name: 'Empresa Real', slug: 'empresa-real', status: 'ACTIVE' as const },
}

export const company = {
  name: 'Empresa Real', slug: 'empresa-real', whatsapp: '+5511977777777', address: 'Rua Um, 10', city: 'Jales', state: 'SP', niche: 'Health', niche_label: 'Saúde', business_type: 'Clinic', business_type_label: 'Clínica', public_notes: '', status: 'ACTIVE' as const, logo: null,
}
