import { LuLockKeyhole as LockKeyhole, LuMail as Mail } from 'react-icons/lu'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { apiErrorMessage, apiFieldErrors } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { PublicBackLink, PublicPage } from '../components/PublicLayout'
import { Turnstile } from '../components/Turnstile'
import { Button, Field, Notice, PasswordInput, validateForm } from '../components/ui'
import logoIcon from '../assets/branding/OpticNoteBook-logo-icon.png'

export default function LoginPage() {
  const { user, status, login, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const platform = location.pathname.startsWith('/platform')
  const customer = location.pathname.startsWith('/cliente')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState('')
  const [forgotHelp, setForgotHelp] = useState(false)

  if (status === 'authenticated' && user) {
    const destination = user.is_superuser ? '/platform' : user.company ? '/admin' : '/cliente'
    return <Navigate to={destination} replace />
  }

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
    const form = new FormData(event.currentTarget)
    try {
      const authenticated = await login({
        email: String(form.get('email') || ''),
        password: String(form.get('password') || ''),
        turnstile_token: token,
      })
      const target = authenticated.is_superuser ? '/platform' : authenticated.company ? '/admin' : '/cliente'
      const correctContext = platform ? authenticated.is_superuser : customer ? !authenticated.is_superuser && !authenticated.company : !authenticated.is_superuser && Boolean(authenticated.company)
      if (!correctContext) {
        await logout()
        setError(`Esta entrada é exclusiva ${platform ? 'da administração da plataforma' : customer ? 'de clientes' : 'da gestão de empresas'}.`)
      } else {
        navigate(target, { replace: true })
      }
    } catch (caught) {
      setError(apiErrorMessage(caught))
      setFieldErrors(apiFieldErrors(caught))
      setToken('')
    } finally {
      setBusy(false)
    }
  }

  const mode = customer ? 'customer' : 'entrepreneur'
  const title = platform ? 'Acesse o painel central' : customer ? 'Entre na sua conta' : 'Acesse seu painel'
  const emphasis = platform ? 'painel central' : customer ? 'conta' : 'painel'
  const description = platform ? 'Acesso exclusivo do administrador do OpticNoteBook.' : customer ? 'Acesse seus agendamentos de forma rápida e simples.' : 'Entre com seu e-mail e senha para gerenciar sua empresa.'
  const titlePrefix = title.slice(0, title.lastIndexOf(emphasis))

  return <PublicPage mode={platform ? 'home' : mode}>
    <section className="mx-auto max-w-[42rem] px-5 pb-12 pt-5 sm:pt-8">
      <PublicBackLink to="/" />
      <div className="public-form-card w-full px-6 py-7 sm:px-12 sm:py-9">
        <img src={logoIcon} className="mx-auto size-14 object-contain" alt="" aria-hidden="true" />
        <h1 className="public-display mt-3 text-center text-3xl sm:text-4xl">{titlePrefix}<span>{emphasis}</span></h1>
        <p className="mt-2 text-center text-base text-[#7182b2]">{description}</p>
        {Boolean((location.state as { registered?: boolean } | null)?.registered) && <div className="mt-5"><Notice kind="success">Cadastro concluído. Entre com sua nova conta.</Notice></div>}
        {Boolean((location.state as { passwordChanged?: boolean } | null)?.passwordChanged) && <div className="mt-5"><Notice kind="success">Senha alterada. Entre novamente com a nova senha.</Notice></div>}
        <form className="relative mt-6 space-y-4" onSubmit={submit} noValidate>
          <Field label="E-mail" hideLabel name="email" type="email" autoComplete="email" placeholder="E-mail" icon={Mail} required maxLength={254} error={fieldErrors.email} />
          <PasswordInput label="Senha" hideLabel name="password" autoComplete="current-password" placeholder="Senha" icon={LockKeyhole} required minLength={12} maxLength={128} error={fieldErrors.password} />
          <div className="flex justify-end"><button type="button" className="text-sm font-medium text-[#087cf0] hover:underline" onClick={() => setForgotHelp(true)}>Esqueci minha senha</button></div>
          {forgotHelp && <Notice kind="info">Solicite a redefinição de senha ao suporte do OpticNoteBook.</Notice>}
          <Turnstile action="login" onToken={setToken} />
          {error && <Notice kind={Object.keys(fieldErrors).length ? 'validation' : 'error'}>{error}</Notice>}
          <Button className="w-full" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</Button>
          {customer && <Link to="/cliente/procurar" className="btn btn-secondary w-full">Continuar sem conta</Link>}
        </form>
        {!platform && <p className="mt-7 border-t border-[#dbe6f4] pt-7 text-center text-sm text-[#7182b2]">Ainda não tem conta? <Link className="font-semibold text-[#087cf0] hover:underline" to={customer ? '/cliente/cadastro' : '/empreendedor/cadastro'}>Criar conta</Link></p>}
      </div>
    </section>
  </PublicPage>
}
