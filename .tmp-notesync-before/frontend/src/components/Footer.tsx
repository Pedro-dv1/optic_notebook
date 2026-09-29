import { Children, type ReactNode } from 'react'
import { Link } from 'react-router'
import logoWithText from '../assets/branding/notesync-wordmark.webp'

export function PublicFooter() {
  return (
    <footer className="relative z-10 border-t border-[#cbdcf0] bg-[#edf3fa] text-[#070d35]">
      <div className="mx-auto max-w-[105rem] px-5 py-11 sm:px-10 lg:py-14">
        <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-[1.8fr_repeat(3,minmax(10rem,1fr))] lg:gap-12 xl:gap-24">
          <div className="sm:col-span-2 lg:col-span-1">
            <img
              src={logoWithText}
              alt="NoteSync"
              className="h-20 max-w-full w-auto object-contain"
            />

            <p className="mt-4 max-w-[20rem] text-base leading-7 text-[#52658a]">
              Agendamentos simples para clientes e empresas.
            </p>
          </div>

          <FooterGroup title="Empresa">
            <Link to="/suporte">Suporte</Link>
          </FooterGroup>

          <FooterGroup title="Legal">
            <Link to="/politica-de-privacidade">Política de Privacidade</Link>
            <Link to="/termos-de-uso">Termos de Uso</Link>
          </FooterGroup>

          <FooterGroup title="Plataforma">
            <Link to="/como-funciona">Como funciona</Link>
            <Link to="/cliente/procurar">Buscar empresas</Link>
            <Link to="/empreendedor/login">Entrar como empreendedor</Link>
            <Link to="/cliente/login">Entrar como cliente</Link>
          </FooterGroup>
        </div>

        <div className="mt-12 border-t border-[#cbdcf0] pt-5 text-center text-sm text-[#52658a]">
          <p>
            © {new Date().getFullYear()} NoteSync. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterGroup({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section aria-label={title}>
      <h2 className="text-base font-bold">{title}</h2>

      <ul className="mt-3 space-y-2 text-base leading-6 text-[#52658a]">
        {Children.map(children, (item) => (
          <li>{item}</li>
        ))}
      </ul>
    </section>
  )
}
