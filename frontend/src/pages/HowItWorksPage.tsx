import { LuArrowRight as ArrowRight, LuCalendarCheck as CalendarCheck, LuClock3 as Clock3, LuListChecks as ListChecks } from 'react-icons/lu'
import { Link } from 'react-router'
import searchImage from '../assets/how-it-works/01-buscar-empresas.png'
import serviceImage from '../assets/how-it-works/02-escolher-servico.png'
import scheduleImage from '../assets/how-it-works/03-escolher-horario.png'
import reviewImage from '../assets/how-it-works/04-revisar-agendamento.png'
import customerImage from '../assets/how-it-works/05-area-cliente.png'
import adminImage from '../assets/how-it-works/06-painel-empreendedor.png'
import { PublicPage } from '../components/PublicLayout'

const customerSteps = [
  { title: 'Encontre uma empresa', text: 'Pesquise pelo nome ou encontre empresas disponíveis no OpticNoteBook.', image: searchImage, alt: 'Busca de empresas no OpticNoteBook' },
  { title: 'Escolha o que você precisa', text: 'Veja os serviços disponíveis e escolha o profissional, quando houver essa opção.', image: serviceImage, alt: 'Seleção de serviço no OpticNoteBook' },
  { title: 'Escolha o melhor horário', text: 'Selecione uma data e um dos horários disponíveis.', image: scheduleImage, alt: 'Escolha de data e horário' },
  { title: 'Revise e envie', text: 'Confira seus dados e envie sua solicitação de agendamento.', image: reviewImage, alt: 'Revisão do agendamento' },
  { title: 'Acompanhe seus horários', text: 'Se você tiver uma conta, poderá consultar próximos agendamentos e seu histórico.', image: customerImage, alt: 'Área do cliente' },
]

export default function HowItWorksPage() {
  return <PublicPage decorations={false}>
    <section className="border-b border-[#dfeaf7] bg-[#f8fbff]">
      <div className="mx-auto max-w-[78rem] px-5 py-14 sm:px-8 sm:py-18 lg:px-12">
        <p className="eyebrow">Como funciona</p>
        <h1 className="public-display mt-3 max-w-3xl text-4xl sm:text-5xl">Agendar ficou <span>mais simples.</span></h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[#6173a5]">Encontre uma empresa, escolha o serviço e marque seu horário em poucos passos.</p>
      </div>
    </section>
    <section className="mx-auto max-w-[78rem] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
      <div className="max-w-2xl"><p className="eyebrow">Para clientes</p><h2 className="public-display mt-3 text-3xl sm:text-4xl">Do início ao agendamento</h2></div>
      <div className="mt-12 grid gap-18 lg:mt-18 lg:gap-28">
        {customerSteps.map((step, index) => <article key={step.title} className="grid items-center gap-7 lg:grid-cols-2 lg:gap-16">
          <div className={`overflow-hidden rounded-2xl border border-[#d5e4f5] bg-[#f5f8fc] p-2 shadow-[0_18px_50px_rgb(7_16_68_/_8%)] ${index % 2 === 0 ? 'lg:order-2' : ''}`}>
            <img src={step.image} alt={step.alt} loading="lazy" className="h-auto w-full rounded-xl" />
          </div>
          <div className={index % 2 === 0 ? 'lg:order-1' : ''}><span className="text-sm font-bold text-[#087cf0]">Passo {index + 1}</span><h3 className="mt-2 text-2xl font-bold tracking-[-.035em] text-[#071044] sm:text-3xl">{step.title}</h3><p className="mt-3 max-w-xl text-base leading-7 text-[#6173a5] sm:text-lg">{step.text}</p></div>
        </article>)}
      </div>
    </section>
    <section className="border-t border-[#dfeaf7] bg-[#f4f8fc]">
      <div className="mx-auto grid max-w-[78rem] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] lg:items-center lg:px-12 lg:py-20">
        <div><p className="eyebrow">Para quem atende</p><h2 className="public-display mt-3 text-3xl sm:text-4xl">Sua operação em um só lugar</h2><p className="mt-4 text-base leading-7 text-[#6173a5]">O OpticNoteBook também ajuda empresas a organizar serviços, profissionais, horários e agendamentos em um só lugar.</p><ul className="mt-7 grid gap-4 text-[#172653]"><li className="flex items-center gap-3"><ListChecks className="size-5 text-[#087cf0]" />Cadastre seus serviços</li><li className="flex items-center gap-3"><Clock3 className="size-5 text-[#087cf0]" />Organize profissionais e horários</li><li className="flex items-center gap-3"><CalendarCheck className="size-5 text-[#087cf0]" />Gerencie seus agendamentos</li></ul><Link className="public-primary-link mt-8" to="/empreendedor/login">Entrar como empreendedor <ArrowRight className="size-4" /></Link></div>
        <div className="overflow-hidden rounded-2xl border border-[#d5e4f5] bg-white p-2 shadow-[0_18px_50px_rgb(7_16_68_/_8%)]"><img src={adminImage} alt="Painel administrativo do empreendedor" loading="lazy" className="h-auto w-full rounded-xl" /></div>
      </div>
    </section>
  </PublicPage>
}
