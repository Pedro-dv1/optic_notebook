import { AgendaPage, AppointmentsPage, CustomersPage, DashboardPage, ProfessionalsPage, ServicesPage, SettingsPage } from './AdminPages'
import { ReportsPage, ReviewsPage, UnavailabilitiesPage } from './AdminExtraPages'
import { lazy } from 'react'
const AdminUnitsPage = lazy(() => import('./AdminUnitsPage'))

type Page = 'dashboard' | 'agenda' | 'appointments' | 'services' | 'professionals' | 'customers' | 'settings' | 'reports' | 'unavailabilities' | 'reviews' | 'units'

export default function AdminRoutes({ page }: { page: Page }) {
  if (page === 'units') return <AdminUnitsPage />
  if (page === 'agenda') return <AgendaPage />
  if (page === 'appointments') return <AppointmentsPage />
  if (page === 'services') return <ServicesPage />
  if (page === 'professionals') return <ProfessionalsPage />
  if (page === 'customers') return <CustomersPage />
  if (page === 'settings') return <SettingsPage />
  if (page === 'reports') return <ReportsPage />
  if (page === 'unavailabilities') return <UnavailabilitiesPage />
  if (page === 'reviews') return <ReviewsPage />
  return <DashboardPage />
}
