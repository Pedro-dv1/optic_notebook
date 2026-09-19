import { LuArrowRight as ArrowRight, LuBriefcaseBusiness as BriefcaseBusiness, LuCalendarDays as CalendarDays, LuCircleUserRound as CircleUserRound } from 'react-icons/lu'
import { Link, Navigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { homeFor } from '../auth/RouteGuards'
import { PublicPage } from '../components/PublicLayout'
import { LoadingState } from '../components/ui'

export default function HomePage() {
  const { user, status } = useAuth()
  if (status === 'loading') return <LoadingState fullScreen label="Verificando sua sessão" />
  if (user) return <Navigate to={homeFor(user)} replace />
  return <PublicPage mode="home">
    <section id="como-funciona" className="mx-auto max-w-[80rem] px-5 pb-12 pt-9 sm:px-8 sm:pt-12 lg:px-12">
      <div className="text-center">
        <h1 className="public-display text-[2.25rem] leading-[1.08] sm:text-5xl lg:text-[3.4rem]">Como você deseja <span>acessar</span>?</h1>
        <p className="mt-3 text-lg text-[#7182b2] sm:text-xl">Escolha a opção que melhor descreve você.</p>
      </div>
      <div className="mt-9 grid gap-5 lg:grid-cols-2">
        <AccessCard to="/empreendedor/login" icon={BriefcaseBusiness} title="Sou empreendedor" description="Gerencie sua agenda e organize seu negócio com facilidade." decoration="calendar" />
        <AccessCard to="/cliente/login" icon={CircleUserRound} title="Sou cliente" description="Agende horários de forma simples, rápida e prática." decoration="appointments" />
      </div>
    </section>
  </PublicPage>
}

function AccessCard({ to, icon: Icon, title, description, decoration }: { to: string; icon: typeof BriefcaseBusiness; title: string; description: string; decoration: 'calendar' | 'appointments' }) {
  return <article className="public-access-card relative min-h-[19rem] overflow-hidden p-7 sm:p-9">
    <div className="relative z-10 max-w-[24rem]">
      <span className="grid size-16 place-items-center rounded-full bg-[#eef5ff] text-[#071044]"><Icon className="size-8 stroke-[1.8]" aria-hidden="true" /></span>
      <h2 className="mt-5 text-2xl font-bold tracking-[-0.04em] text-[#070d35] sm:text-3xl">{title}</h2>
      <p className="mt-2 text-base leading-7 text-[#7182b2] sm:text-lg">{description}</p>
      <Link to={to} aria-label={`${title} — continuar`} className="public-primary-link mt-6 w-fit min-w-40 justify-center">Continuar <ArrowRight className="size-4 lg:hidden" aria-hidden="true" /></Link>
    </div>
    {decoration === 'calendar' ? <CalendarDays className="absolute -bottom-14 right-[-2.5rem] size-72 rotate-[12deg] stroke-[0.9] text-[#dceafa]" aria-hidden="true" /> : <div className="absolute -bottom-20 right-[-1rem] h-80 w-64 rotate-[11deg] rounded-[2rem] border border-[#e1ebf8] bg-white/80 p-8 text-[#dce7f5]" aria-hidden="true"><div className="grid size-14 place-items-center rounded-full bg-[#f2f6fb]"><CalendarDays className="size-7" /></div><div className="mt-8 space-y-6"><span className="block h-4 w-28 rounded-full bg-current opacity-70" /><span className="block h-4 w-36 rounded-full bg-current opacity-60" /><span className="block h-4 w-24 rounded-full bg-current opacity-55" /></div></div>}
  </article>
}
