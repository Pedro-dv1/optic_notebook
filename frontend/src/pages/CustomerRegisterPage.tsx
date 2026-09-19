import { LuLockKeyhole as LockKeyhole, LuMail as Mail, LuMessageCircle as MessageCircle, LuUserRound as UserRound } from 'react-icons/lu'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api, apiErrorMessage, apiFieldErrors } from '../api/client'
import logoIcon from '../assets/branding/OpticNoteBook-logo-icon.png'
import { PublicBackLink, PublicPage } from '../components/PublicLayout'
import { Honeypot, Turnstile } from '../components/Turnstile'
import { Button, Field, Notice, PasswordInput, validateForm } from '../components/ui'
import { formatPhone } from '../lib/inputMasks'
import { LegalAcceptanceSection, type LegalAcceptanceValue } from '../components/LegalDocuments'

export default function CustomerRegisterPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [legalAcceptance, setLegalAcceptance] = useState<LegalAcceptanceValue>({ terms: false, privacy: false })

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validateForm(event.currentTarget)
    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors)
      setError('Preencha os campos obrigatórios.')
      return
    }
    setBusy(true)
    setError('')
    setFieldErrors({})
    const data = new FormData(event.currentTarget)
    try {
      await api.post('/customers/register/', {
        full_name: data.get('full_name'),
        email: data.get('email'),
        whatsapp,
        password: data.get('password'),
        website: data.get('website'),
        turnstile_token: token,
        terms_accepted: legalAcceptance.terms,
        privacy_accepted: legalAcceptance.privacy,
      })
      navigate('/cliente/login', { replace: true, state: { registered: true } })
    } catch (caught) {
      setError(apiErrorMessage(caught))
      setFieldErrors(apiFieldErrors(caught))
      setToken('')
    } finally {
      setBusy(false)
    }
  }

  return <PublicPage mode="customer">
    <section className="mx-auto max-w-[50rem] px-5 pb-16 pt-8 sm:pt-12">
      <PublicBackLink to="/cliente/login" />
      <div className="public-form-card px-6 py-9 sm:px-12 sm:py-11">
        <img src={logoIcon} className="mx-auto size-14 object-contain" alt="" aria-hidden="true" />
        <p className="mt-4 text-center text-xs font-bold uppercase tracking-[.24em] text-[#087cf0]">Conta global do cliente</p>
        <h1 className="public-display mt-2 text-center text-3xl sm:text-4xl">Criar conta</h1>
        <p className="mt-2 text-center text-base text-[#7182b2]">Use esta conta para acompanhar agendamentos em diferentes empresas.</p>
        <form className="relative mt-6 grid gap-4 sm:grid-cols-2" onSubmit={submit} noValidate>
          <Honeypot />
          <div className="sm:col-span-2"><Field label="Nome completo" name="full_name" autoComplete="name" placeholder="Seu nome completo" icon={UserRound} required maxLength={150} error={fieldErrors.full_name} /></div>
          <Field label="E-mail" name="email" type="email" autoComplete="email" placeholder="seu@email.com" icon={Mail} required maxLength={254} error={fieldErrors.email} />
          <Field label="WhatsApp" name="whatsapp" type="tel" autoComplete="tel" inputMode="numeric" placeholder="(00) 90000-0000" icon={MessageCircle} value={whatsapp} onChange={(event) => setWhatsapp(formatPhone(event.target.value))} required maxLength={15} error={fieldErrors.whatsapp} />
          <div className="sm:col-span-2"><PasswordInput label="Senha" name="password" autoComplete="new-password" placeholder="Crie uma senha" icon={LockKeyhole} required minLength={12} maxLength={128} error={fieldErrors.password} /></div>
          <div className="sm:col-span-2"><LegalAcceptanceSection value={legalAcceptance} onChange={setLegalAcceptance} error={fieldErrors.legal_acceptance} /></div>
          <div className="sm:col-span-2"><Turnstile action="customer_registration" onToken={setToken} />{error && <div className="mt-4"><Notice kind={Object.keys(fieldErrors).length ? 'validation' : 'error'}>{error}</Notice></div>}
            <div className="mt-6 border-t border-[#dbe6f4] pt-6"><Button className="w-full" disabled={busy || !legalAcceptance.terms || !legalAcceptance.privacy}>{busy ? 'Criando…' : 'Criar conta'}</Button></div>
          </div>
        </form>
      </div>
    </section>
  </PublicPage>
}
