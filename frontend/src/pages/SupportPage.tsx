import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, apiErrorMessage } from '../api/client'
import { PublicPage } from '../components/PublicLayout'
import { LoadingState, Notice } from '../components/ui'
import type { PublicPlatformConfig } from '../types/api'

const questions = [
  ['Como encontro uma empresa?', 'Abra Buscar empresas e digite o nome. Você também pode filtrar por cidade, estado e tipo de negócio.'],
  ['Meu horário já está confirmado?', 'Consulte o status em Meus agendamentos. Aguardando confirmação significa que a empresa ainda precisa confirmar o atendimento.'],
  ['Posso cancelar ou reagendar?', 'Abra os detalhes do agendamento na sua conta ou o link de gerenciamento recebido. As opções respeitam o prazo definido pela empresa.'],
  ['Como organizo as unidades da minha empresa?', 'No painel administrativo, abra Unidades. Associe os profissionais aos locais de atendimento e cadastre os horários de cada unidade.'],
  ['Esqueci minha senha. O que faço?', 'Na tela de login, selecione “Esqueci minha senha”. Informe seu e-mail, confirme o código recebido e crie uma nova senha.'],
]

export default function SupportPage() {
  const config = useQuery({ queryKey: ['platform-config'], queryFn: () => api.get<PublicPlatformConfig>('/public/platform/'), staleTime: 3_600_000 })
  return <PublicPage decorations={false}><section className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20"><p className="eyebrow">Central de ajuda</p><h1 className="public-display mt-3 text-4xl sm:text-5xl">Suporte <span>NoteSync</span></h1><p className="muted mt-5 max-w-2xl text-lg leading-8">Encontre orientações para agendar, acompanhar seus horários e administrar sua empresa.</p><section className="mt-12" aria-labelledby="support-questions"><h2 id="support-questions" className="text-2xl font-bold">Como podemos ajudar?</h2><div className="mt-5 divide-y divide-[#d8e5f4] border-y border-[#d8e5f4]">{questions.map(([title, answer]) => <details key={title} className="py-5"><summary className="cursor-pointer py-1 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">{title}</summary><p className="muted mt-3 max-w-3xl leading-7">{answer}</p></details>)}</div></section><section className="panel mt-12"><h2 className="text-2xl font-bold">Precisa de mais ajuda?</h2><p className="muted mt-3 leading-7">Para dúvidas sobre um atendimento específico, consulte os dados da empresa na página do agendamento. Para ajuda com a plataforma, use o contato de suporte abaixo.</p>{config.isPending && <LoadingState label="Carregando contato de suporte" />}{config.isError && <Notice>{apiErrorMessage(config.error)}</Notice>}{config.data && (config.data.support_email ? <a className="public-primary-link mt-6 break-all" href={`mailto:${config.data.support_email}`}>Entrar em contato: {config.data.support_email}</a> : <p className="mt-4 text-sm text-[#52658a]">O contato de suporte ainda não foi configurado pela plataforma.</p>)}</section><nav className="mt-8 flex flex-wrap gap-3" aria-label="Links úteis"><Link className="btn btn-secondary" to="/como-funciona">Como funciona</Link><Link className="btn btn-secondary" to="/cliente/procurar">Buscar empresas</Link><Link className="btn btn-secondary" to="/cliente/login">Acessar minha conta</Link></nav></section></PublicPage>
}
