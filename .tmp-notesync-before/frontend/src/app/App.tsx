import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { AnonymousRoute, ProtectedRoute } from '../auth/RouteGuards'
import { AppShell } from '../components/AppShell'
import { LoadingState } from '../components/ui'

const SupportPage = lazy(() => import('../pages/SupportPage'))
const HomePage = lazy(() => import('../pages/HomePage'))
const CommerceAccessPage = lazy(() => import('../pages/CommerceAccessPage'))
const CustomerHubPage = lazy(() => import('../pages/CustomerHubPage'))
const LoginPage = lazy(() => import('../pages/LoginPage'))
const CustomerRegisterPage = lazy(() => import('../pages/CustomerRegisterPage'))
const CompanyRegisterPage = lazy(() => import('../pages/CompanyRegisterPage'))
const CustomerAccountPage = lazy(() => import('../pages/CustomerAccountPage'))
const PublicBookingPage = lazy(() => import('../pages/PublicBookingPage'))
const TermsPage = lazy(() => import('../pages/TermsPage'))
const PrivacyPage = lazy(() => import('../pages/PrivacyPage'))
const HowItWorksPage = lazy(() => import('../pages/HowItWorksPage'))
const AdminPages = lazy(() => import('../pages/admin/AdminRoutes'))
const PlatformPages = lazy(() => import('../pages/platform/PlatformRoutes'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))
const ProfessionalRegisterPage = lazy(() => import('../pages/ProfessionalRegisterPage'))
const ProfessionalPage = lazy(() => import('../pages/ProfessionalPage'))
const ReviewPage = lazy(() => import('../pages/ReviewPage'))

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
    <Suspense fallback={<LoadingState label="Carregando" fullScreen />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/cliente/procurar" element={<CustomerHubPage />} />
        <Route path="/cliente/agendar/:slug" element={<PublicBookingPage />} />
        <Route path="/termos-de-uso" element={<TermsPage />} />
        <Route path="/politica-de-privacidade" element={<PrivacyPage />} />
        <Route path="/suporte" element={<SupportPage />} />
        <Route path="/como-funciona" element={<HowItWorksPage />} />
        <Route path="/avaliar" element={<ReviewPage />} />
        <Route path="/empreendedor" element={<Navigate to="/empreendedor/login" replace />} />
        <Route element={<AnonymousRoute />}>
          <Route path="/comercio" element={<CommerceAccessPage />} />
          <Route path="/cliente/login" element={<LoginPage />} />
          <Route path="/cliente/cadastro" element={<CustomerRegisterPage />} />
          <Route path="/empreendedor/login" element={<LoginPage />} />
          <Route path="/empreendedor/cadastro" element={<CompanyRegisterPage />} />
          <Route path="/platform/login" element={<LoginPage />} />
          <Route path="/profissional/login" element={<LoginPage />} />
          <Route path="/profissional/cadastro" element={<ProfessionalRegisterPage />} />
        </Route>
        <Route element={<ProtectedRoute role="customer" />}>
          <Route path="/cliente" element={<CustomerAccountPage />} />
          <Route path="/cliente/agendamentos" element={<Navigate to="/cliente" replace />} />
          <Route path="/cliente/conta" element={<Navigate to="/cliente" replace />} />
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
            <Route path="unidades" element={<AdminPages page="units" />} />
            <Route path="servicos" element={<AdminPages page="services" />} />
            <Route path="profissionais" element={<AdminPages page="professionals" />} />
            <Route path="clientes" element={<AdminPages page="customers" />} />
            <Route path="configuracoes" element={<AdminPages page="settings" />} />
            <Route path="relatorios" element={<AdminPages page="reports" />} />
            <Route path="indisponibilidades" element={<AdminPages page="unavailabilities" />} />
            <Route path="avaliacoes" element={<AdminPages page="reviews" />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute role="professional" />}>
          <Route path="/profissional" element={<ProfessionalPage />} />
        </Route>
        <Route path="/login" element={<Navigate to="/cliente/login" replace />} />
        <Route path="/cadastro" element={<Navigate to="/cliente/cadastro" replace />} />
        <Route path="/:slug" element={<LegacyBookingRedirect />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  </>
}

function RouteTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'NoteSync',
      '/comercio': 'Acesso do comércio | NoteSync',
      '/cliente': 'Meus agendamentos | NoteSync',
      '/cliente/procurar': 'Buscar empresas | NoteSync',
      '/termos-de-uso': 'Termos de Uso | NoteSync',
      '/politica-de-privacidade': 'Política de Privacidade | NoteSync',
      '/suporte': 'Suporte | NoteSync',
      '/admin/unidades': 'Unidades | NoteSync',
      '/como-funciona': 'Como funciona | NoteSync',
      '/cliente/login': 'Entrar | NoteSync',
      '/cliente/cadastro': 'Criar conta | NoteSync',
      '/cliente/agendamentos': 'Meus agendamentos | NoteSync',
      '/cliente/conta': 'Meus agendamentos | NoteSync',
      '/empreendedor/login': 'Entrar | NoteSync',
      '/empreendedor/cadastro': 'Criar conta empresarial | NoteSync',
      '/platform/login': 'Entrar | NoteSync',
      '/profissional/login': 'Entrar como profissional | NoteSync',
      '/profissional/cadastro': 'Cadastro profissional | NoteSync',
      '/profissional': 'Minha agenda | NoteSync',
      '/avaliar': 'Avaliar atendimento | NoteSync',
      '/platform': 'Painel | NoteSync',
      '/platform/empresas': 'Empresas | NoteSync',
      '/platform/chaves': 'Chaves de cadastro | NoteSync',
      '/admin': 'Painel | NoteSync',
      '/admin/agenda': 'Agenda | NoteSync',
      '/admin/agendamentos': 'Agendamentos | NoteSync',
      '/admin/servicos': 'Serviços | NoteSync',
      '/admin/profissionais': 'Profissionais | NoteSync',
      '/admin/clientes': 'Clientes | NoteSync',
      '/admin/configuracoes': 'Configurações | NoteSync',
    }
    document.title = titles[pathname] || (pathname.split('/').filter(Boolean).length === 1 ? 'Agendar | NoteSync' : 'Página não encontrada | NoteSync')
  }, [pathname])
  return null
}

function LegacyBookingRedirect() {
  const { slug } = useParams()
  return <Navigate to={`/cliente/agendar/${encodeURIComponent(slug || '')}`} replace />
}
