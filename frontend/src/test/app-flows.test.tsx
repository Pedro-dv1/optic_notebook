import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router'
import App from '../app/App'
import { useAuth } from '../auth/AuthProvider'
import { safeImageUrl } from '../lib/media'
import PublicBookingPage from '../pages/PublicBookingPage'
import { company, companyAdmin, customer, json, renderApp } from './helpers'

const platformConfig = {
  name: 'OpticNoteBook',
  support_email: 'suporte@example.com',
  company_options: {
    states: [{ value: 'SP', label: 'São Paulo' }],
    niches: [{ value: 'Health', label: 'Saúde' }],
    business_types: [{ value: 'Clinic', label: 'Clínica' }],
    business_types_by_niche: { Health: ['Clinic'] },
  },
}

function anonymousResponder(extra?: (url: string, init?: RequestInit) => Promise<Response> | undefined) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const custom = extra?.(url, init)
    if (custom) return custom
    if (url.endsWith('/auth/csrf/')) return json(null, 204)
    if (url.endsWith('/auth/refresh/')) return json({ errors: { detail: 'Session unavailable' } }, 401)
    if (url.endsWith('/legal/current/')) return json({ terms: { version: '2026-09-16', accepted: false }, privacy: { version: '2026-09-16', accepted: false } })
    return json({ errors: { detail: 'Not found' } }, 404)
  })
}

describe('rotas e fluxos principais', () => {
  it('mostra a escolha inicial entre cliente e empreendedor', async () => {
    vi.stubGlobal('fetch', anonymousResponder())
    renderApp(<App />)
    expect(await screen.findByRole('heading', { name: /como você deseja acessar/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sou cliente/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sou empreendedor/i })).toBeInTheDocument()
  })

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
    expect(await screen.findByRole('heading', { name: /Olá, Ana/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/cliente')
    expect(screen.queryByRole('heading', { name: /como você deseja acessar/i })).not.toBeInTheDocument()
  })

  it('usa a identidade correta no header e exibe o footer sem links falsos', async () => {
    vi.stubGlobal('fetch', anonymousResponder())
    renderApp(<App />)
    await screen.findByRole('heading', { name: /como você deseja acessar/i })
    const logos = screen.getAllByRole('img', { name: 'OpticNoteBook' })
    expect(logos.filter((image) => image.getAttribute('src')?.includes('logo-text')).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByRole('link', { name: 'Como funciona' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute('href', '/termos-de-uso')
    const privacyLinks = screen.getAllByRole('link', { name: 'Política de Privacidade' })
    expect(privacyLinks.length).toBeGreaterThanOrEqual(2)
    expect(privacyLinks.every((link) => link.getAttribute('href') === '/politica-de-privacidade')).toBe(true)
    expect(screen.getByText(/OpticNoteBook\. Todos os direitos reservados/)).toBeInTheDocument()
  })

  it.each([
    ['/termos-de-uso', 'Termos de Uso', 'Termos de Uso | OpticNoteBook'],
    ['/politica-de-privacidade', 'Política de Privacidade', 'Política de Privacidade | OpticNoteBook'],
    ['/como-funciona', 'Agendar ficou mais simples.', 'Como funciona | OpticNoteBook'],
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
    expect(await screen.findByRole('heading', { name: /cadastrar no opticnotebook/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Estado')).toHaveTextContent('São Paulo')
    expect(responder.mock.calls.some(([input]) => String(input).endsWith('/auth/refresh/'))).toBe(true)
  })

  it.each([
    ['/cliente/login', 'Entre na sua conta'],
    ['/cliente/cadastro', 'Criar conta'],
    ['/empreendedor/login', 'Acesse seu painel'],
    ['/platform/login', 'Acesse o painel central'],
  ])('mantém a rota reservada %s fora do slug público', async (route, heading) => {
    window.history.replaceState({}, '', route)
    vi.stubGlobal('fetch', anonymousResponder((url) => url.endsWith('/public/platform/') ? json(platformConfig) : undefined))
    renderApp(<App />)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('trata configuração vazia no cadastro sem derrubar a aplicação', async () => {
    window.history.replaceState({}, '', '/empreendedor/cadastro')
    vi.stubGlobal('fetch', anonymousResponder((url) => url.endsWith('/public/platform/') ? json(null) : undefined))
    renderApp(<App />)
    expect(await screen.findByRole('heading', { name: 'Opções de cadastro indisponíveis' })).toBeInTheDocument()
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
    expect(screen.getByLabelText(/Estado/)).toHaveValue('SP')
  })

  it('limpa o tipo de negócio incompatível ao trocar o nicho', async () => {
    window.history.replaceState({}, '', '/empreendedor/cadastro')
    const config = { ...platformConfig, company_options: { ...platformConfig.company_options, niches: [{ value: 'Beauty', label: 'Beleza' }, { value: 'Health', label: 'Saúde' }], business_types: [{ value: 'Barbershop', label: 'Barbearia' }, { value: 'Clinic', label: 'Clínica' }], business_types_by_niche: { Beauty: ['Barbershop'], Health: ['Clinic'] } } }
    vi.stubGlobal('fetch', anonymousResponder((url) => url.endsWith('/public/platform/') ? json(config) : undefined))
    renderApp(<App />)
    const niche = await screen.findByLabelText('Nicho-base')
    const businessType = screen.getByLabelText('Tipo de negócio')
    fireEvent.change(niche, { target: { value: 'Beauty' } })
    fireEvent.change(businessType, { target: { value: 'Barbershop' } })
    expect(businessType).toHaveValue('Barbershop')
    fireEvent.change(niche, { target: { value: 'Health' } })
    expect(businessType).toHaveValue('')
    expect(businessType).not.toHaveTextContent('Barbearia')
  })

  it('solicita os textos personalizados ao selecionar Outro', async () => {
    window.history.replaceState({}, '', '/empreendedor/cadastro')
    const config = { ...platformConfig, company_options: { ...platformConfig.company_options, niches: [{ value: 'Other', label: 'Outro' }], business_types: [{ value: 'Other', label: 'Outro' }], business_types_by_niche: { Other: ['Other'] } } }
    vi.stubGlobal('fetch', anonymousResponder((url) => url.endsWith('/public/platform/') ? json(config) : undefined))
    renderApp(<App />)
    fireEvent.change(await screen.findByLabelText('Nicho-base'), { target: { value: 'Other' } })
    fireEvent.change(screen.getByLabelText('Tipo de negócio'), { target: { value: 'Other' } })
    expect(screen.getByLabelText('Qual nicho?')).toBeRequired()
    expect(screen.getByLabelText('Qual tipo de negócio?')).toBeRequired()
  })

  it('recupera o cadastro ao voltar pelo histórico do navegador', async () => {
    window.history.replaceState({}, '', '/empreendedor/cadastro')
    vi.stubGlobal('fetch', anonymousResponder((url) => url.endsWith('/public/platform/') ? json(platformConfig) : undefined))
    renderApp(<App />)
    await screen.findByRole('heading', { name: /cadastrar no opticnotebook/i })
    fireEvent.click(screen.getByRole('link', { name: 'Voltar' }))
    await waitFor(() => expect(window.location.pathname).toBe('/empreendedor/login'))
    await screen.findByRole('heading', { name: 'Acesse seu painel' })
    act(() => window.history.back())
    await waitFor(() => expect(window.location.pathname).toBe('/empreendedor/cadastro'))
    expect(await screen.findByRole('heading', { name: /cadastrar no opticnotebook/i }, { timeout: 5_000 })).toBeInTheDocument()
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
    await waitFor(() => expect(window.location.pathname).toBe('/cliente'))
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
    expect(await screen.findAllByRole('img', { name: 'Foto de Ana Cliente' })).toHaveLength(2)
  })

  it('cliente anônimo agenda sem aceite obrigatório e vê o aviso de privacidade', async () => {
    window.history.replaceState({}, '', '/empresa-real')
    vi.stubGlobal('fetch', anonymousResponder((url) => {
      if (url.endsWith('/public/companies/empresa-real/')) return json(company)
      if (url.endsWith('/services/')) return json([{ id: 'service-1', name: 'Consulta', description: 'Avaliação', price: null, duration: '00:30:00' }])
      if (url.includes('/professionals/')) return json([{ id: 'pro-1', name: 'Marina', service_ids: ['service-1'] }])
      if (url.includes('/availability/')) return json([{ professional: 'pro-1', professional_name: 'Marina', starts_at: '2030-01-10T10:00:00-03:00', ends_at: '2030-01-10T10:30:00-03:00' }])
    }))
    renderApp(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /Consulta/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Marina/ }))
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2030-01-10' } })
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

  it('aplica e limpa filtros somente pelas ações do painel', async () => {
    window.history.replaceState({}, '', '/cliente/procurar')
    const responder = anonymousResponder((url) => {
      if (url.endsWith('/public/platform/')) return json(platformConfig)
      if (url.includes('/public/companies/?')) return json({ count: 0, next: null, previous: null, results: [] })
    })
    vi.stubGlobal('fetch', responder)
    renderApp(<App />)
    await screen.findByText('Nenhuma empresa encontrada')
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/cliente')
    fireEvent.click(screen.getByRole('button', { name: /^Filtrar/ }))
    const dialog = screen.getByRole('dialog', { name: 'Filtros' })
    expect(dialog).toHaveClass('w-full', 'md:w-[320px]')
    expect(screen.getByRole('button', { name: 'Fechar filtros' })).toHaveFocus()
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Jales' } })
    expect(responder.mock.calls.some(([input]) => String(input).includes('city=Jales'))).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await waitFor(() => expect(responder.mock.calls.some(([input]) => String(input).includes('city=Jales'))).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: /^Filtrar/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByLabelText('Cidade')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Filtrar' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Filtros' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filtrar' })).toHaveFocus()
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
    window.history.replaceState({}, '', '/empresa-real')
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/csrf/')) return json(null, 204)
      if (url.endsWith('/auth/refresh/')) return json({ access: 'restored' })
      if (url.endsWith('/auth/me/')) return json(customer)
      if (url.endsWith('/public/companies/empresa-real/')) return json(company)
      if (url.endsWith('/services/')) return json([{ id: 'service-1', name: 'Consulta', description: 'Avaliação', price: null, duration: '00:30:00' }])
      if (url.includes('/professionals/')) return json([{ id: 'pro-1', name: 'Marina', service_ids: ['service-1'] }])
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
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2030-01-10' } })
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
      if (url.endsWith('/company/professionals/')) return json({ count: 1, next: null, previous: null, results: [{ id: 'pro-1', name: 'Marina', is_active: true, service_ids: [] }] })
      if (url.endsWith('/company/services/') || url.endsWith('/company/work-schedules/')) return json({ count: 0, next: null, previous: null, results: [] })
      if (url.endsWith('/company/work-schedules/week/')) return json([], 201)
      return json({}, 404)
    })
    vi.stubGlobal('fetch', responder)
    renderApp(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Horários' }, { timeout: 5_000 }))
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '17:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Definir horário para a semana toda' }))
    await waitFor(() => expect(responder.mock.calls.some(([input, init]) => String(input).endsWith('/company/work-schedules/week/') && init?.method === 'POST')).toBe(true))
  })

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
    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument()
    expect(screen.queryByText('Chaves de cadastro')).not.toBeInTheDocument()
  })


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
