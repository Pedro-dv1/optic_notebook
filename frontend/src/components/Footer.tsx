import { FaInstagram as Instagram } from 'react-icons/fa6'
import { LuPhone as Phone } from 'react-icons/lu'
import { Children, type ReactNode } from 'react'
import { Link } from 'react-router'
import logoWithText from '../assets/branding/OpticNoteBook-logo-text.svg'
import opticacsLogo from '../assets/branding/opticacs-logo.png'

export function PublicFooter() {
  return (
    <footer className="relative z-10 border-t border-[#cbdcf0] bg-[#edf3fa] text-[#070d35]">
      <div className="mx-auto max-w-[105rem] px-5 py-11 sm:px-10 lg:py-14">
        <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-[1.8fr_repeat(3,minmax(10rem,1fr))] lg:gap-12 xl:gap-24">
          <div className="sm:col-span-2 lg:col-span-1">
            <img
              src={logoWithText}
              alt="OpticNoteBook"
              className="h-26 w-auto object-contain"
            />

            <p className="mt-4 max-w-[20rem] text-base leading-7 text-[#6173a5]">
              Agendamentos simples para clientes e empresas.
            </p>
          </div>

          <FooterGroup title="Empresa">
            <a
              href="tel:+5517997585762"
              className="inline-flex items-center gap-2"
            >
              <Phone className="size-4" aria-hidden="true" />
              (17) 99758-5762
            </a>

            <a
              href="https://www.instagram.com/opticacs/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              <Instagram className="size-4" aria-hidden="true" />
              Instagram
            </a>
          </FooterGroup>

          <FooterGroup title="Legal">
            <Link to="/politica-de-privacidade">Política de Privacidade</Link>
            <Link to="/termos-de-uso">Termos de Uso</Link>
          </FooterGroup>

          <FooterGroup title="Produto">
            <Link to="/como-funciona">Como funciona</Link>
            <Link to="/cliente/procurar">Buscar empresas</Link>
            <Link to="/empreendedor/login">Entrar como empreendedor</Link>
            <Link to="/cliente/login">Entrar como cliente</Link>
          </FooterGroup>
        </div>

        <div className="mt-12 grid gap-6 border-t border-[#cbdcf0] pt-5 text-center text-base text-[#6173a5] lg:grid-cols-[1fr_auto_1fr] lg:text-left">
          <p className="lg:self-start">
            © {new Date().getFullYear()} OpticNoteBook. Todos os direitos reservados.
          </p>

          <section className="flex flex-col items-center" aria-label="Autoria">
            <h2>Produzido por</h2>

            <a
              href="https://optic-acs.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex"
              aria-label="Visitar o site da OpticACS"
            >
              <img
                src={opticacsLogo}
                alt="OpticACS"
                className="h-12 w-auto object-contain"
              />
            </a>
          </section>
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

      <ul className="mt-3 space-y-2 text-base leading-6 text-[#6173a5]">
        {Children.map(children, (item) => (
          <li>{item}</li>
        ))}
      </ul>
    </section>
  )
}
