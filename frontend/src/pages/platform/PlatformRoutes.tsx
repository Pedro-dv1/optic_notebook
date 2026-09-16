import { PlatformCompaniesPage, PlatformDashboardPage, RegistrationKeysPage } from './PlatformPages'

export default function PlatformRoutes({ page }: { page: 'dashboard' | 'companies' | 'keys' }) {
  if (page === 'companies') return <PlatformCompaniesPage />
  if (page === 'keys') return <RegistrationKeysPage />
  return <PlatformDashboardPage />
}
