import { LuArrowLeft as ArrowLeft, LuSearchX as SearchX } from 'react-icons/lu'
import { Link } from 'react-router'
import { useEffect } from 'react'
import { PublicPage } from '../components/PublicLayout'

export default function NotFoundPage() {
  useEffect(() => { document.title = 'Página não encontrada | OpticNoteBook' }, [])
  return <PublicPage mode="home">
    <section className="mx-auto grid min-h-[32rem] max-w-3xl place-items-center px-5 py-16 text-center sm:py-24">
      <div>
        <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-[#cfe0f6] bg-[#f4f9ff] text-[#087cf0]" aria-hidden="true"><SearchX className="size-8 stroke-[1.7]" /></div>
        <p className="mt-7 text-7xl font-extrabold tracking-[-.08em] text-[#087cf0] sm:text-8xl">404</p>
        <h1 className="public-display mt-3 text-3xl sm:text-4xl">Página não encontrada</h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-[#7182b2] sm:text-lg">Parece que este endereço não existe ou foi movido.</p>
        <Link to="/" className="public-primary-link mt-8"><ArrowLeft className="size-4" aria-hidden="true" />Voltar para o início</Link>
      </div>
    </section>
  </PublicPage>
}
