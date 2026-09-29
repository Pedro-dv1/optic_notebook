import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router'
import App from '../app/App'
import { useAuth } from '../auth/AuthProvider'
import { safeImageUrl } from '../lib/media'
import PublicBookingPage from '../pages/PublicBookingPage'
import { company, companyAdmin, customer, json, renderApp } from './helpers'

const platformConfig = {
  name: 'NoteSync',
  support_email: 'suporte@example.com',
  company_options: {
    states: [{ value: 'SP', label: 'São Paulo' }],
    niches: [{ value: 'Health', label: 'Saúde' }],
    business_types: [{ value: 'Clinic', label: 'Clínica' }],
    business_types_by_niche: { Health: ['Clinic'] },
  },
}

afterEach(() => vi.useRealTimers())

function anonymousResponder(extra?: (url: string, init?: RequestInit) => Promise<Response> | undefined) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const custom = extra?.(url, init)
    if (custom) return custom
    if (url.includes('/availability/days/')) return json({ available_dates: [] })
    if (url.endsWith('/auth/csrf/')) return json(null, 204)
    if (url.endsWith('/auth/refresh/')) return json({ errors: { detail: 'Session unavailable' } }, 401)
    if (url.endsWith('/legal/current/')) return json({ terms: { version: '2026-09-16', accepted: false }, privacy: { version: '2026-09-16', accepted: false } })
    return json({ errors: { detail: 'Not found' } }, 404)
  })
}

describe('rotas e fluxos principais', () => {
  it('mostra a escolha inicial entre cliente e comércio', async () => {
    vi.stubGlobal('fetch', anonymousResponder())
    renderApp(<App />)
    expect(await screen.findByRole('heading', { name: /como você deseja acessar/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cliente' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Comércio' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /comércio — continuar/i }))
    expect(await screen.findByRole('heading', { name: /como você acessa o comércio/i }, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dono' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Profissional' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Entrar' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Criar conta' })).toHaveLength(2)
  }, 15_000)

  it('não mostra a seleção inicial para cliente autenticado', async () => {
    window.history.replaceState({}, '', '/')
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/csrf/')) return json(null, 204)
      if (url.endsWith('/auth/refresh/')) return json({ access: 'restored' })
      if (url.endsWith('/auth/me/')) return json(customer)
      if (url.endsWith('/customers/appointments/')) return json({ count: 0, next: null, previous: null, results: [] })
      return json({}, 404)
    }))
    renderApp(<App />)
    expect(await screen.findByRole('heading', { name: /Agende com facilidade/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/cliente/procurar')
    expect(screen.queryByRole('heading', { name: /como você deseja acessar/i })).not.toBeInTheDocument()
  })

  it('mostra os dados do card e pesquisa somente nos próximos agendamentos', async () => {
    window.history.replaceState({}, '', '/cliente')
    const appointment = {
      id: 'appointment-id', company: 'company-id', company_name: 'Empresa Real', company_slug: 'empresa-real',
      company_logo: 'http://localhost/media/company-logos/logo.png', company_address: 'Rua Um, 10', company_city: 'Jales', company_state: 'SP',
      service: 'service-id', service_name: 'Consulta', professional: 'professional-id', professional_name: 'Marina',
      starts_at: '2030-01-10T10:00:00-03:00', ends_at: '2030-01-10T10:30:00-03:00', customer_name: 'Ana Cliente',
      customer_email: customer.email, customer_whatsapp: customer.whatsapp, customer_notes: '', customer_avatar: null,
      status: 'WAITING_CONFIRMATION', can_cancel: true, can_reschedule: true, whatsapp_message: '',
    }
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/csrf/')) return json(null, 204)
      if (url.endsWith('/auth/refresh/')) return json({ access: 'restored' })
      if (url.endsWith('/auth/me/')) return json(customer)
      if (url.endsWith('/customers/appointments/')) return json({ count: 2, next: null, previous: null, results: [appointment, { ...appointment, id: 'past-appointment', company_name: 'Empresa do Histórico', company_logo: null, company_address: 'Rua Antiga, 20', starts_at: '2020-01-10T10:00:00-03:00', ends_at: '2020-01-10T10:30:00-03:00', status: 'CANCELLED' }] })
      return json({}, 404)
    }))
    renderApp(<App />)
    const image = await screen.findByRole('img', { name: 'Imagem de Empresa Real' })
    expect(image).toHaveClass('w-full', 'md:w-52')
    expect(screen.getByText('Rua Um, 10 · Jales - SP')).toBeInTheDocument()
    const status = screen.getByText('Aguardando confirmação').parentElement!
    expect(status.querySelector('svg')).not.toBeNull()
    expect(status.querySelector('span')).toHaveTextContent('Aguardando confirmação')
    const search = screen.getByRole('searchbox', { name: 'Pesquisar empresa nos próximos agendamentos' })
    expect(search.closest('label')).toHaveClass('w-full', 'mb-8')
    expect(search.closest('label')).not.toHaveClass('sm:max-w-md')
    fireEvent.change(search, { target: { value: 'outra empresa' } })
    expect(screen.getByText('Nenhuma empresa encontrada')).toBeInTheDocument()
    expect(screen.getByText('Empresa do Histórico')).toBeInTheDocument()
  })

  it('usa a identidade correta no header e exibe o footer sem links falsos', async () => {
    vi.stubGlobal('fetch', anonymousResponder())
    renderApp(<App />)
    await screen.findByRole('heading', { name: /como você deseja acessar/i })
    const logos = screen.getAllByRole('img', { name: 'NoteSync' })
    expect(logos.filter((image) => image.getAttribute('src')?.includes('notesync-wordmark')).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByRole('link', { name: 'Como funciona' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute('href', '/termos-de-uso')
    const privacyLinks = screen.getAllByRole('link', { name: 'Política de Privacidade' })
    expect(privacyLinks.length).toBeGreaterThanOrEqual(2)
    expect(privacyLinks.every((link) => link.getAttribute('href') === '/politica-de-privacidade')).toBe(true)
    expect(screen.getByText(/NoteSync\. Todos os direitos reservados/)).toBeInTheDocument()
  })

  it.each([
    ['/termos-de-uso', 'Termos de Uso', 'Termos de Uso | NoteSync'],
    ['/politica-de-privacidade', 'Política de Privacidade', 'Política de Privacidade | NoteSync'],
    ['/como-funciona', 'Agendar ficou mais simples.', 'Como funciona | NoteSync'],
  ])('renderiza a página pública %s com o title correto', async (route, heading, title) => {
    window.history.replaceState({}, '', route)
    vi.stubGlobal('fetch', anonymousResponder())
    renderApp(<App />)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe(title))
  })

  it('abre o cadastro de empreendedor depois de verificar a sessão', async () => {
    window.history.replaceState({}, '', '/empreendedor/cadastro')
    const responder = anonymousResponder((url) => url.endsWith('/public/platform/') ? json(platformConfig) : undefined)
    vi.stubGlobal('fetch', responder)
    renderApp(<App />)
    expect(await screen.findByRole('heading', { name: /cadastrar no notesync/i }, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar' }).closest('.public-form-card')).not.toBeNull()
    expect(screen.getByLabelText('Estado')).toHaveTextContent('São Paulo')
    expect(responder.mock.calls.some(([input]) => String(input).endsWith('/auth/refresh/'))).toBe(true)
  })

  it.each([
    ['/cliente/login', 'Entre na sua conta'],
    ['/cliente/cadastro', 'Criar conta'],
    ['/empreendedor/login', 'Acesse seu painel'],
    ['/platform/login', 'Acesse o painel central'],
    ['/profissional/login', 'Entre como profissional'],
    ['/profissional/cadastro', 'Cadastro de profissional'],
  ])('mantém a rota reservada %s fora do slug público', async (route, heading) => {
    window.history.replaceState({}, '', route)
    vi.stubGlobal('fetch', anonymousResponder((url) => url.endsWith('/public/platform/') ? json(platformConfig) : undefined))
    renderApp(<App />)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar' }).closest('.public-form-card')).not.toBeNull()
  })

  it('trata configuração vazia no cadastro sem derrubar a aplicação', async () => {
    window.history.replaceState({}, '', '/empreendedor/cadastro')
    vi.stubGlobal('fetch', anonymousResponder((url) => url.endsWith('/public/platform/') ? json(null) : undefined))
    renderApp(<App />)
    expect(await screen.findByRole('heading', { name: 'Opções de cadastro indisponíveis' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar' }).closest('.public-form-card')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('completa município e UF com a fonte oficial do IBGE', async () => {
    window.history.replaceState({}, '', '/empreendedor/cadastro')
    vi.stubGlobal('fetch', anonymousResponder((url) => {
      if (url.endsWith('/public/platform/')) return json(platformConfig)
      if (url.startsWith('https://servicodados.ibge.gov.br/')) return json([{ id: 3555208, nome: 'Urânia', 'regiao-imediata': { 'regiao-intermediaria': { UF: { sigla: 'SP' } } } }])
    }))
    renderApp(<App />)
    const city = await screen.findByLabelText(/Cidade/)
    fireEvent.change(city, { target: { value: 'Urânia' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Urânia - SP' }))
    expect(city).toHaveValue('Urânia')
    expect(screen.getByLabelText(/Estado/)).toHaveTextContent('São Paulo')
  })

  it('limpa o tipo de negócio incompatível ao trocar o nicho', async () => {
    window.history.replaceState({}, '', '/empreendedor/cadastro')
    const config = { ...platformConfig, company_options: { ...platformConfig.company_options, niches: [{ value: 'Beauty', label: 'Beleza' }, { value: 'Health', label: 'Saúde' }], business_types: [{ value: 'Barbershop', label: 'Barbearia' }, { value: 'Clinic', label: 'Clínica' }], business_types_by_niche: { Beauty: ['Barbershop'], Health: ['Clinic'] } } }
    vi.stubGlobal('fetch', anonymousResponder((url) => url.endsWith('/public/platform/') ? json(config) : undefined))
    renderApp(<App />)
    const niche = await screen.findByLabelText('Nicho-base')
    const businessType = screen.getByLabelText('Tipo de negócio')
    fireEvent.click(niche)
    fireEvent.click(screen.getByRole('option', { name: 'Beleza' }))
    fireEvent.click(businessType)
    fireEvent.click(screen.getByRole('option', { name: 'Barbearia' }))
    expect(businessType).toHaveTextContent('Barbearia')
    fireEvent.click(niche)
    fireEvent.click(screen.getByRole('option', { name: 'Saúde' }))
    expect(businessType).toHaveTextContent('Selecione')
    expect(businessType).not.toHaveTextContent('Barbearia')
  })

  it('solicita os textos personalizados ao selecionar Outro', async () => {
    window.history.replaceState({}, '', '/empreendedor/cadastro')
    const config = { ...platformConfig, company_options: { ...platformConfig.company_options, niches: [{ value: 'Other', label: 'Outro' }], business_types: [{ value: 'Other', label: 'Outro' }], business_types_by_niche: { Other: ['Other'] } } }
    vi.stubGlobal('fetch', anonymousResponder((url) => url.endsWith('/public/platform/') ? json(config) : undefined))
    renderApp(<App />)
    fireEvent.click(await screen.findByLabelText('Nicho-base'))
    fireEvent.click(screen.getByRole('option', { name: 'Outro' }))
    fireEvent.click(screen.getByLabelText('Tipo de negócio'))
    fireEvent.click(screen.getByRole('option', { name: 'Outro' }))
    expect(screen.getByLabelText('Qual nicho?')).toBeRequired()
    expect(screen.getByLabelText('Qual tipo de negócio?')).toBeRequired()
  })

  it('recupera o cadastro ao voltar pelo histórico do navegador', async () => {
    window.history.replaceState({}, '', '/empreendedor/cadastro')
    vi.stubGlobal('fetch', anonymousResponder((url) => url.endsWith('/public/platform/') ? json(platformConfig) : undefined))
    renderApp(<App />)
    await screen.findByRole('heading', { name: /cadastrar no notesync/i })
    fireEvent.click(screen.getByRole('link', { name: 'Voltar' }))
    await waitFor(() => expect(window.location.pathname).toBe('/empreendedor/login'))
    await screen.findByRole('heading', { name: 'Acesse seu painel' })
    act(() => window.history.back())
    await waitFor(() => expect(window.location.pathname).toBe('/empreendedor/cadastro'))
    expect(await screen.findByRole('heading', { name: /cadastrar no notesync/i }, { timeout: 5_000 })).toBeInTheDocument()
  })

  it('redireciona rota protegida sem sessão para o login correto', async () => {
    window.history.replaceState({}, '', '/admin')
    vi.stubGlobal('fetch', anonymousResponder())
    renderApp(<App />)
    expect(await screen.findByRole('heading', { name: 'Acesse seu painel' })).toBeInTheDocument()
  })

  it('aceita login válido e rejeita login inválido sem enumerar conta', async () => {
    window.history.replaceState({}, '', '/cliente/login')
    let valid = false
    vi.stubGlobal('fetch', anonymousResponder((url, init) => {
      if (url.endsWith('/auth/login/')) {
        expect(JSON.parse(String(init?.body))).not.toHaveProperty('website')
        return valid ? json({ access: 'access', user: customer }) : json({ errors: { detail: ['Credenciais inválidas.'] } }, 401)
      }
      if (url.endsWith('/customers/appointments/')) return json({ count: 0, next: null, previous: null, results: [] })
    }))
    renderApp(<App />)
    fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: customer.email } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'wrong-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeInTheDocument()
    valid = true
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'correct-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(window.location.pathname).toBe('/cliente/procurar'))
  })

  it('valida o login em português sem abrir o balão nativo', async () => {
    window.history.replaceState({}, '', '/empreendedor/login')
    const responder = anonymousResponder()
    vi.stubGlobal('fetch', responder)
    renderApp(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Preencha os campos obrigatórios.')).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toHaveFocus()
    expect(responder.mock.calls.some(([input]) => String(input).endsWith('/auth/login/'))).toBe(false)
  })

  it('restabelece sessão pelo refresh cookie no reload', async () => {
    window.history.replaceState({}, '', '/cliente/conta')
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/csrf/')) return json(null, 204)
      if (url.endsWith('/auth/refresh/')) return json({ access: 'restored' })
      if (url.endsWith('/auth/me/')) return json(customer)
      if (url.endsWith('/customers/appointments/')) return json({ count: 0, next: null, previous: null, results: [] })
      return json({}, 404)
    }))
    function SessionProbe() {
      const { status, user } = useAuth()
      return <p>{status === 'authenticated' ? user?.full_name : status}</p>
    }
    renderApp(<SessionProbe />)
    expect(await screen.findByText('Ana Cliente')).toBeInTheDocument()
  })

  it('exibe a foto do cliente no header e nos dados pessoais', async () => {
    window.history.replaceState({}, '', '/cliente/conta')
    const userWithAvatar = { ...customer, avatar: 'http://localhost/media/customer-avatars/avatar.png' }
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/csrf/')) return json(null, 204)
      if (url.endsWith('/auth/refresh/')) return json({ access: 'restored' })
      if (url.endsWith('/auth/me/')) return json(userWithAvatar)
      if (url.endsWith('/customers/appointments/')) return json({ count: 0, next: null, previous: null, results: [] })
      return json({}, 404)
    }))
    renderApp(<App />)
    expect(await screen.findAllByRole('img', { name: 'Foto de Ana Cliente' })).toHaveLength(3)
    expect(screen.getByLabelText('Nome')).toHaveValue('Ana Cliente')
  })

  it('cliente anônimo agenda sem aceite obrigatório e vê o aviso de privacidade', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2030-01-01T12:00:00-03:00'))
    window.history.replaceState({}, '', '/empresa-real')
    vi.stubGlobal('fetch', anonymousResponder((url) => {
      if (url.endsWith('/public/companies/empresa-real/')) return json(company)
      if (url.endsWith('/services/')) return json([{ id: 'service-1', name: 'Consulta', description: 'Avaliação', price: null, duration: '00:30:00' }])
      if (url.includes('/professionals/')) return json([{ id: 'pro-1', name: 'Marina', service_ids: ['service-1'] }])
      if (url.includes('/availability/days/')) return json({ available_dates: ['2030-01-10'] })
      if (url.includes('/availability/')) return json([{ professional: 'pro-1', professional_name: 'Marina', starts_at: '2030-01-10T10:00:00-03:00', ends_at: '2030-01-10T10:30:00-03:00' }])
    }))
    renderApp(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /Consulta/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Marina/ }))
    const current = new Date()
    const monthsAhead = (2030 - current.getFullYear()) * 12 - current.getMonth()
    for (let index = 0; index < monthsAhead; index++) fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))
    const day = await screen.findByRole('button', { name: /quinta-feira, 10 de janeiro de 2030/ })
    await waitFor(() => expect(day).toBeEnabled())
    fireEvent.click(day)
    fireEvent.click(await screen.findByRole('button', { name: '10:00' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Cliente sem conta' } })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'cliente@example.com' } })
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '+5511999999999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar agendamento' }))
    const notice = await screen.findByText(/Ao continuar, seus dados serão coletados/i)
    expect(notice.querySelector('a[href="/politica-de-privacidade"]')).not.toBeNull()
    expect(notice.querySelector('a[href="/termos-de-uso"]')).not.toBeNull()
    expect(screen.queryByText('Pendente')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar agendamento' })).toBeEnabled()
  })

  it('mostra 404 para slug inexistente sem capturar rotas reservadas', async () => {
    window.history.replaceState({}, '', '/rota-que-nao-existe')
    vi.stubGlobal('fetch', anonymousResponder())
    renderApp(<App />)
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /voltar para o início/i })).toBeInTheDocument()
  })

  it('pesquisa empresas sem exibir filtros', async () => {
    window.history.replaceState({}, '', '/cliente/procurar')
    const responder = anonymousResponder((url) => {
      if (url.endsWith('/public/platform/')) return json(platformConfig)
      if (url.includes('/public/companies/?')) return json({ count: 0, next: null, previous: null, results: [] })
    })
    vi.stubGlobal('fetch', responder)
    renderApp(<App />)
    await screen.findByText('Nenhuma empresa encontrada', {}, { timeout: 10_000 })
    const search = screen.getByRole('searchbox', { name: 'Pesquisar empresa, serviço ou área' })
    expect(search).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('button', { name: 'Filtros' })).not.toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'clínica' } })
    await waitFor(() => expect(responder.mock.calls.some(([input]) => String(input).includes('search=cl%C3%ADnica'))).toBe(true))
  })

  it('mostra a observação da empresa em tooltip e fecha ao tocar fora', async () => {
    window.history.replaceState({}, '', '/cliente/procurar')
    vi.stubGlobal('fetch', anonymousResponder((url) => {
      if (url.endsWith('/public/platform/')) return json(platformConfig)
      if (url.includes('/public/companies/?')) return json({ count: 1, next: null, previous: null, results: [{ ...company, public_notes: 'Atendimento com hora marcada.' }] })
    }))
    renderApp(<App />)
    const trigger = await screen.findByRole('button', { name: 'Observações de Empresa Real' })
    fireEvent.click(trigger)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Atendimento com hora marcada.')
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('cliente autenticado usa dados salvos ou altera apenas o snapshot do agendamento', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2030-01-01T12:00:00-03:00'))
    window.history.replaceState({}, '', '/empresa-real')
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/csrf/')) return json(null, 204)
      if (url.endsWith('/auth/refresh/')) return json({ access: 'restored' })
      if (url.endsWith('/auth/me/')) return json(customer)
      if (url.endsWith('/public/companies/empresa-real/')) return json(company)
      if (url.endsWith('/services/')) return json([{ id: 'service-1', name: 'Consulta', description: 'Avaliação', price: null, duration: '00:30:00' }])
      if (url.includes('/professionals/')) return json([{ id: 'pro-1', name: 'Marina', service_ids: ['service-1'] }])
      if (url.includes('/availability/days/')) return json({ available_dates: ['2030-01-10'] })
      if (url.includes('/availability/')) return json([{ professional: 'pro-1', professional_name: 'Marina', starts_at: '2030-01-10T10:00:00-03:00', ends_at: '2030-01-10T10:30:00-03:00' }])
      return json({}, 404)
    }))
    renderApp(<Routes><Route path="/:slug" element={<PublicBookingPage />} /></Routes>)
    await waitFor(() => expect(document.title).toBe('Agendar | Empresa Real'))
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Criar conta' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Abrir menu da conta' }).length).toBeGreaterThan(0)
    fireEvent.click(await screen.findByRole('button', { name: /Consulta/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Marina/ }))
    const current = new Date()
    const monthsAhead = (2030 - current.getFullYear()) * 12 - current.getMonth()
    for (let index = 0; index < monthsAhead; index++) fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))
    const day = await screen.findByRole('button', { name: /quinta-feira, 10 de janeiro de 2030/ })
    await waitFor(() => expect(day).toBeEnabled())
    fireEvent.click(day)
    fireEvent.click(await screen.findByRole('button', { name: '10:00' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText('Usar meus dados salvos')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Alterar apenas neste agendamento'))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Nome apenas deste agendamento' } })
    expect(screen.getByLabelText('Nome')).toHaveValue('Nome apenas deste agendamento')
    fireEvent.click(screen.getByLabelText('Usar estes dados'))
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Usar estes dados')).toBeChecked()
  })

  it('empresa suspensa não mostra o fluxo de agendamento', async () => {
    window.history.replaceState({}, '', '/empresa-real')
    vi.stubGlobal('fetch', anonymousResponder((url) => url.endsWith('/public/companies/empresa-real/') ? json({ ...company, status: 'SUSPENDED' }) : undefined))
    renderApp(<App />)
    expect(await screen.findByText('Página temporariamente indisponível')).toBeInTheDocument()
    expect(screen.queryByText('Escolha um serviço')).not.toBeInTheDocument()
  })

  it('define o mesmo horário para a semana toda do profissional', async () => {
    window.history.replaceState({}, '', '/admin/profissionais')
    const responder = vi.fn((...args: [RequestInfo | URL, RequestInit?]) => {
      const input = args[0]
      const url = String(input)
      if (url.endsWith('/auth/csrf/')) return json(null, 204)
      if (url.endsWith('/auth/refresh/')) return json({ access: 'restored' })
      if (url.endsWith('/auth/me/')) return json(companyAdmin)
      if (url.endsWith('/company/profile/')) return json({ ...company, id: 'company-id' })
      if (url.endsWith('/company/units/')) return json([{ id: 'unit-1', name: 'Principal', is_active: true, is_primary: true }])
      if (url.includes('/company/professionals/')) return json({ count: 1, next: null, previous: null, results: [{ id: 'pro-1', name: 'Marina', is_active: true, unit_ids: ['unit-1'], service_ids: [], access_email: null, invite_state: 'ACTIVE' }] })
      if (url.includes('/company/services/') || url.endsWith('/company/work-schedules/')) return json({ count: 0, next: null, previous: null, results: [] })
      if (url.endsWith('/company/work-schedules/week/')) return json([], 201)
      return json({}, 404)
    })
    vi.stubGlobal('fetch', responder)
    renderApp(<App />)
    expect(await screen.findByText(/acesso ACTIVE/i, {}, { timeout: 15_000 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gerar chave' })).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Horários' }, { timeout: 5_000 }))
    fireEvent.click(screen.getByLabelText('Unidade de atendimento'))
    fireEvent.click(screen.getByRole('option', { name: 'Principal' }))
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '17:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Definir horário para a semana toda' }))
    await waitFor(() => expect(responder.mock.calls.some(([input, init]) => String(input).endsWith('/company/work-schedules/week/') && init?.method === 'POST')).toBe(true))
  }, 20_000)

  it('company admin não recebe controles de Super Admin', async () => {
    window.history.replaceState({}, '', '/admin')
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/csrf/')) return json(null, 204)
      if (url.endsWith('/auth/refresh/')) return json({ access: 'restored' })
      if (url.endsWith('/auth/me/')) return json(companyAdmin)
      if (url.endsWith('/company/profile/')) return json({ ...company, id: 'company-id' })
      if (url.includes('/company/appointments/')) return json({ count: 0, next: null, previous: null, results: [] })
      if (url.endsWith('/company/services/') || url.endsWith('/company/professionals/')) return json({ count: 0, next: null, previous: null, results: [] })
      return json({}, 404)
    }))
    renderApp(<App />)
    expect(await screen.findByRole('heading', { name: 'Visão geral' }, { timeout: 15_000 })).toBeInTheDocument()
    expect(screen.queryByText('Chaves de cadastro')).not.toBeInTheDocument()
  }, 20_000)


  it.each([
    ['/platform', 'Visão geral'],
    ['/platform/empresas', 'Empresas'],
    ['/platform/chaves', 'Chaves de cadastro'],
  ])('renderiza a rota protegida da plataforma %s para superusuário', async (route, heading) => {
    window.history.replaceState({}, '', route)
    const platformAdmin = { ...customer, is_superuser: true }
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/csrf/')) return json(null, 204)
      if (url.endsWith('/auth/refresh/')) return json({ access: 'restored' })
      if (url.endsWith('/auth/me/')) return json(platformAdmin)
      if (url.endsWith('/public/platform/')) return json(platformConfig)
      if (url.endsWith('/platform/metrics/')) return json({ total_companies: 0, active_companies: 0, appointments_this_month: 0, total_appointments: 0, views_this_month: 0, unique_visitors_this_month: 0 })
      if (url.includes('/platform/companies/')) return json({ count: 0, next: null, previous: null, results: [] })
      if (url.endsWith('/platform/registration-keys/')) return json({ count: 0, next: null, previous: null, results: [] })
      return json({}, 404)
    }))
    renderApp(<App />)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
  })
})

describe('conteúdo não confiável', () => {
  it('rejeita URLs de imagem com protocolo inseguro', () => {
    expect(safeImageUrl('javascript:alert(1)')).toBeNull()
  })

  it('renderiza string maliciosa como texto, sem criar script', async () => {
    window.history.replaceState({}, '', '/empresa-real')
    const malicious = '<script>alert(1)</script>'
    vi.stubGlobal('fetch', anonymousResponder((url) => {
      if (url.endsWith('/public/companies/empresa-real/')) return json({ ...company, name: malicious })
      if (url.endsWith('/services/')) return json([])
    }))
    const { container } = renderApp(<App />)
    expect(await screen.findByText(malicious)).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
  })

  it('expõe estados de loading e vazio de forma acessível', async () => {
    window.history.replaceState({}, '', '/cliente/procurar')
    let resolveSearch!: (value: Response) => void
    vi.stubGlobal('fetch', anonymousResponder((url) => {
      if (url.includes('/public/companies/?')) return new Promise((resolve) => { resolveSearch = resolve })
    }))
    renderApp(<App />)
    expect(await screen.findByText(/Buscando empresas/i)).toBeInTheDocument()
    resolveSearch(await json({ count: 0, next: null, previous: null, results: [] }))
    expect(await screen.findByText('Nenhuma empresa encontrada')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nenhuma' } })
    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue('nenhuma'))
  })
})
