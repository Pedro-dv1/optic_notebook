import { LuArrowRight as ArrowRight, LuBriefcaseBusiness as BriefcaseBusiness, LuCalendarDays as CalendarDays, LuCircleUserRound as CircleUserRound } from 'react-icons/lu'
import { Link, Navigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { homeFor } from '../auth/RouteGuards'
import { PublicPage } from '../components/PublicLayout'
import adminImage from '../assets/how-it-works/06-painel-empreendedor.png'
import { LoadingState } from '../components/ui'

export default function HomePage() {
  const { user, status } = useAuth()
  if (status === 'loading') return <LoadingState fullScreen label="Verificando sua sessão" />
  if (user) return <Navigate to={homeFor(user)} replace />
  return <PublicPage mode="home" decorations={false}>
    <section className="mx-auto grid max-w-[80rem] items-center gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-2 lg:gap-14 lg:px-12">
      <div><p className="eyebrow">Sua agenda, conectada</p><h1 className="public-display mt-5 text-[2.7rem] leading-[1.1] sm:text-6xl">Menos trabalho para marcar.<br /><span>Mais tempo para atender.</span></h1><p className="muted mt-6 max-w-xl text-lg leading-8">O NoteSync conecta empresas e clientes em uma agenda online. Organize seus serviços, equipe e horários. Seus clientes encontram você e solicitam um atendimento em poucos passos.</p><div className="mt-8 flex flex-wrap gap-3"><Link className="public-primary-link" to="/comercio">Organizar minha agenda <ArrowRight className="size-4" aria-hidden="true" /></Link><Link className="btn btn-secondary" to="/cliente/procurar">Encontrar uma empresa</Link></div><p className="mt-5 text-sm text-[#52658a]">Para quem atende. Para quem precisa agendar.</p></div>
      <figure className="min-w-0 overflow-hidden rounded-2xl border border-[#cbdcf0] bg-[#edf4fc] p-3 shadow-[0_20px_60px_rgb(7_16_68_/_8%)]"><img src={adminImage} width="1915" height="958" alt="Painel do NoteSync com a visão geral dos agendamentos" className="h-auto w-full rounded-xl" fetchPriority="high" /><figcaption className="px-2 pb-1 pt-4 text-sm text-[#52658a]">Sua operação reunida em uma visão geral.</figcaption></figure>
    </section>
    <section className="border-y border-[#d8e5f4] bg-[#f4f8fd]" aria-labelledby="benefits-title"><div className="mx-auto max-w-[80rem] px-5 py-16 sm:px-8 lg:px-12"><p className="eyebrow">Uma rotina mais organizada</p><h2 id="benefits-title" className="public-display mt-3 max-w-3xl text-3xl sm:text-4xl">Do primeiro horário ao próximo atendimento.</h2><div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{[
      ['Serviços e equipe', 'Defina duração, intervalos e profissionais para cada serviço. A disponibilidade segue os horários cadastrados.'],
      ['Cada unidade, seu endereço', 'Organize os locais de atendimento da empresa e os horários dos profissionais em cada unidade.'],
      ['Controle dos agendamentos', 'Confirme solicitações, acompanhe sua agenda e registre atendimentos concluídos ou não comparecimentos.'],
      ['Disponibilidade real', 'Clientes escolhem entre horários disponíveis, respeitando duração, pausas e conflitos da agenda.'],
      ['Uma conta para acompanhar', 'Consulte seus agendamentos no calendário, veja detalhes e cancele ou reagende dentro do prazo permitido.'],
      ['Empresas sempre por perto', 'Encontre empresas por localização e guarde seus favoritos para voltar a agendar com facilidade.'],
    ].map(([title, text], index) => <article key={title}><span className="text-sm font-bold text-[#0759ad]">0{index + 1}</span><h3 className="mt-3 text-xl font-bold">{title}</h3><p className="muted mt-3 leading-7">{text}</p></article>)}</div></div></section>
    <section id="como-funciona" className="mx-auto max-w-[80rem] px-5 py-16 sm:px-8 lg:px-12 lg:py-24"><p className="eyebrow">Como funciona</p><h2 className="public-display mt-3 text-3xl sm:text-4xl">Configure. Compartilhe. Atenda.</h2><ol className="mt-10 grid gap-8 md:grid-cols-3">{[
      ['Prepare sua empresa', 'Cadastre os dados e unidades da empresa, os serviços, os profissionais e seus horários de atendimento.'],
      ['Seu cliente escolhe', 'Compartilhe sua página. O cliente encontra a empresa, escolhe o local, o serviço, o profissional e um horário disponível.'],
      ['Acompanhe a agenda', 'Receba as solicitações no painel, confirme o atendimento e mantenha o status atualizado. O cliente acompanha pela própria conta.'],
    ].map(([title, text], index) => <li key={title} className="border-t-2 border-[#087cf0] pt-5"><span className="text-sm text-[#52658a]">Passo {index + 1}</span><h3 className="mt-2 text-xl font-bold">{title}</h3><p className="muted mt-3 leading-7">{text}</p></li>)}</ol><Link className="btn btn-secondary mt-8" to="/como-funciona">Conheça o fluxo completo</Link></section>
    <section id="acesso" className="mx-auto max-w-[80rem] px-5 pb-12 pt-9 sm:px-8 sm:pt-12 lg:px-12">
      <div className="text-center">
        <h2 className="public-display text-[2.25rem] leading-[1.08] sm:text-5xl lg:text-[3.4rem]">Como você deseja <span>acessar</span>?</h2>
        <p className="mt-3 text-lg text-[#52658a] sm:text-xl">Escolha a opção que melhor descreve você.</p>
      </div>
      <div className="mt-9 grid gap-5 lg:grid-cols-2">
        <AccessCard to="/comercio" icon={BriefcaseBusiness} title="Comércio" description="Acesse como dono ou profissional do comércio." decoration="calendar" />
        <AccessCard to="/cliente/login" icon={CircleUserRound} title="Cliente" description="Agende horários de forma simples, rápida e prática." decoration="appointments" />
      </div>
    </section>
  </PublicPage>
}

function AccessCard({ to, icon: Icon, title, description, decoration }: { to: string; icon: typeof BriefcaseBusiness; title: string; description: string; decoration: 'calendar' | 'appointments' }) {
  return <article className="public-access-card relative min-h-[19rem] overflow-hidden p-7 sm:p-9">
    <div className="relative z-10 flex min-h-[15rem] max-w-[24rem] flex-col">
      <span className="grid size-16 place-items-center rounded-full bg-[#eef5ff] text-[#071044]"><Icon className="size-8 stroke-[1.8]" aria-hidden="true" /></span>
      <h2 className="mt-5 text-2xl font-bold tracking-[-0.04em] text-[#070d35] sm:text-3xl">{title}</h2>
      <p className="mt-2 text-base leading-7 text-[#52658a] sm:text-lg">{description}</p>
      <Link to={to} aria-label={`${title} — continuar`} className="public-primary-link mt-auto w-fit min-w-40 justify-center">Continuar <ArrowRight className="size-4 lg:hidden" aria-hidden="true" /></Link>
    </div>
    {decoration === 'calendar' ? <CalendarDays className="absolute -bottom-14 right-[-2.5rem] size-72 rotate-[12deg] stroke-[0.9] text-[#dceafa]" aria-hidden="true" /> : <div className="absolute -bottom-20 right-[-1rem] h-80 w-64 rotate-[11deg] rounded-[2rem] border border-[#e1ebf8] bg-white/80 p-8 text-[#dce7f5]" aria-hidden="true"><div className="grid size-14 place-items-center rounded-full bg-[#f2f6fb]"><CalendarDays className="size-7" /></div><div className="mt-8 space-y-6"><span className="block h-4 w-28 rounded-full bg-current opacity-70" /><span className="block h-4 w-36 rounded-full bg-current opacity-60" /><span className="block h-4 w-24 rounded-full bg-current opacity-55" /></div></div>}
  </article>
}
