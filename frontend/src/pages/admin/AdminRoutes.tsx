import { AgendaPage, AppointmentsPage, CustomersPage, DashboardPage, ProfessionalsPage, ServicesPage, SettingsPage } from './AdminPages'

type Page = 'dashboard' | 'agenda' | 'appointments' | 'services' | 'professionals' | 'customers' | 'settings'

export default function AdminRoutes({ page }: { page: Page }) {
  if (page === 'agenda') return <AgendaPage />
  if (page === 'appointments') return <AppointmentsPage />
  if (page === 'services') return <ServicesPage />
  if (page === 'professionals') return <ProfessionalsPage />
  if (page === 'customers') return <CustomersPage />
  if (page === 'settings') return <SettingsPage />
  return <DashboardPage />
}
