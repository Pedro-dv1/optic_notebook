import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { AnonymousRoute, ProtectedRoute } from '../auth/RouteGuards'
import { AppShell } from '../components/AppShell'
import { LoadingState } from '../components/ui'

const HomePage = lazy(() => import('../pages/HomePage'))
const CustomerHubPage = lazy(() => import('../pages/CustomerHubPage'))
const LoginPage = lazy(() => import('../pages/LoginPage'))
const CustomerRegisterPage = lazy(() => import('../pages/CustomerRegisterPage'))
const CompanyRegisterPage = lazy(() => import('../pages/CompanyRegisterPage'))
const CustomerAccountPage = lazy(() => import('../pages/CustomerAccountPage'))
const PublicBookingPage = lazy(() => import('../pages/PublicBookingPage'))
const AdminPages = lazy(() => import('../pages/admin/AdminRoutes'))
const PlatformPages = lazy(() => import('../pages/platform/PlatformRoutes'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))

export default function App() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const connected = () => setOnline(true)
    const disconnected = () => setOnline(false)
    window.addEventListener('online', connected)
    window.addEventListener('offline', disconnected)
    return () => { window.removeEventListener('online', connected); window.removeEventListener('offline', disconnected) }
  }, [])

  return <>
    <RouteTitle />
    {!online && <div role="status" className="sticky top-0 z-[70] bg-[#8b5b18] px-4 py-2 text-center text-sm font-medium text-white">Você está offline. Algumas ações ficarão indisponíveis até a conexão voltar.</div>}
    <Suspense fallback={<LoadingState label="Carregando" />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/cliente" element={<CustomerHubPage />} />
        <Route path="/empreendedor" element={<Navigate to="/empreendedor/login" replace />} />
        <Route element={<AnonymousRoute />}>
          <Route path="/cliente/login" element={<LoginPage />} />
          <Route path="/cliente/cadastro" element={<CustomerRegisterPage />} />
          <Route path="/empreendedor/login" element={<LoginPage />} />
          <Route path="/empreendedor/cadastro" element={<CompanyRegisterPage />} />
          <Route path="/platform/login" element={<LoginPage />} />
        </Route>
        <Route element={<ProtectedRoute role="customer" />}>
          <Route path="/cliente/agendamentos" element={<CustomerAccountPage />} />
          <Route path="/cliente/conta" element={<Navigate to="/cliente/agendamentos" replace />} />
        </Route>
        <Route element={<ProtectedRoute role="platform" />}>
          <Route path="/platform" element={<AppShell context="platform" />}>
            <Route index element={<PlatformPages page="dashboard" />} />
            <Route path="empresas" element={<PlatformPages page="companies" />} />
            <Route path="chaves" element={<PlatformPages page="keys" />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute role="company" />}>
          <Route path="/admin" element={<AppShell context="company" />}>
            <Route index element={<AdminPages page="dashboard" />} />
            <Route path="agenda" element={<AdminPages page="agenda" />} />
            <Route path="agendamentos" element={<AdminPages page="appointments" />} />
            <Route path="servicos" element={<AdminPages page="services" />} />
            <Route path="profissionais" element={<AdminPages page="professionals" />} />
            <Route path="clientes" element={<AdminPages page="customers" />} />
            <Route path="configuracoes" element={<AdminPages page="settings" />} />
          </Route>
        </Route>
        <Route path="/login" element={<Navigate to="/cliente/login" replace />} />
        <Route path="/cadastro" element={<Navigate to="/cliente/cadastro" replace />} />
        <Route path="/:slug" element={<PublicBookingPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  </>
}

function RouteTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'OpticNoteBook',
      '/cliente': 'Buscar empresas | OpticNoteBook',
      '/cliente/login': 'Entrar | OpticNoteBook',
      '/cliente/cadastro': 'Criar conta | OpticNoteBook',
      '/cliente/agendamentos': 'Meus agendamentos | OpticNoteBook',
      '/cliente/conta': 'Meus agendamentos | OpticNoteBook',
      '/empreendedor/login': 'Entrar | OpticNoteBook',
      '/empreendedor/cadastro': 'Criar conta empresarial | OpticNoteBook',
      '/platform/login': 'Entrar | OpticNoteBook',
      '/platform': 'Painel | OpticNoteBook',
      '/platform/empresas': 'Empresas | OpticNoteBook',
      '/platform/chaves': 'Chaves de cadastro | OpticNoteBook',
      '/admin': 'Painel | OpticNoteBook',
      '/admin/agenda': 'Agenda | OpticNoteBook',
      '/admin/agendamentos': 'Agendamentos | OpticNoteBook',
      '/admin/servicos': 'Serviços | OpticNoteBook',
      '/admin/profissionais': 'Profissionais | OpticNoteBook',
      '/admin/clientes': 'Clientes | OpticNoteBook',
      '/admin/configuracoes': 'Configurações | OpticNoteBook',
    }
    document.title = titles[pathname] || (pathname.split('/').filter(Boolean).length === 1 ? 'Agendar | OpticNoteBook' : 'Página não encontrada | OpticNoteBook')
  }, [pathname])
  return null
}
