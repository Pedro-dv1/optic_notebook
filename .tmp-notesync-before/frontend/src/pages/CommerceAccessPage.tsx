import { LuBadgeCheck as BadgeCheck, LuBriefcaseBusiness as BriefcaseBusiness, LuCalendarDays as CalendarDays } from 'react-icons/lu'
import { Link } from 'react-router'
import { PublicBackLink, PublicPage } from '../components/PublicLayout'

export default function CommerceAccessPage() {
  return <PublicPage mode="home">
    <section className="mx-auto max-w-[80rem] px-5 pb-12 pt-5 sm:px-8 sm:pt-8 lg:px-12">
      <PublicBackLink to="/" />
      <div className="text-center">
        <h1 className="public-display text-[2.25rem] leading-[1.08] sm:text-5xl lg:text-[3.4rem]">Como você acessa o <span>comércio</span>?</h1>
        <p className="mt-3 text-lg text-[#7182b2] sm:text-xl">Escolha entre dono e profissional.</p>
      </div>
      <div className="mt-9 grid gap-5 lg:grid-cols-2">
        <CommerceCard icon={BriefcaseBusiness} title="Dono" description="Gerencie o comércio, a equipe e os agendamentos." loginTo="/empreendedor/login" registerTo="/empreendedor/cadastro" />
        <CommerceCard icon={BadgeCheck} title="Profissional" description="Acesse sua agenda vinculada ao comércio." loginTo="/profissional/login" registerTo="/profissional/cadastro" />
      </div>
    </section>
  </PublicPage>
}

function CommerceCard({ icon: Icon, title, description, loginTo, registerTo }: { icon: typeof BriefcaseBusiness; title: string; description: string; loginTo: string; registerTo: string }) {
  return <article className="public-access-card relative min-h-[19rem] overflow-hidden p-7 sm:p-9">
    <div className="relative z-10 flex min-h-[15rem] max-w-[24rem] flex-col">
      <span className="grid size-16 place-items-center rounded-full bg-[#eef5ff] text-[#071044]"><Icon className="size-8 stroke-[1.8]" aria-hidden="true" /></span>
      <h2 className="mt-5 text-2xl font-bold tracking-[-0.04em] text-[#070d35] sm:text-3xl">{title}</h2>
      <p className="mt-2 text-base leading-7 text-[#7182b2] sm:text-lg">{description}</p>
      <div className="mt-auto flex flex-wrap gap-3">
        <Link to={loginTo} className="public-primary-link min-w-32">Entrar</Link>
        <Link to={registerTo} className="btn btn-outline min-h-12 min-w-32 !rounded-[.65rem]">Criar conta</Link>
      </div>
    </div>
    <CalendarDays className="absolute -bottom-14 right-[-2.5rem] size-72 rotate-[12deg] stroke-[0.9] text-[#dceafa]" aria-hidden="true" />
  </article>
}
