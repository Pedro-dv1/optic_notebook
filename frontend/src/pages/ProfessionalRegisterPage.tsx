import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api, apiErrorMessage, apiFieldErrors } from '../api/client'
import { LegalAcceptanceSection, type LegalAcceptanceValue } from '../components/LegalDocuments'
import { PublicBackLink, PublicPage } from '../components/PublicLayout'
import { Honeypot, Turnstile } from '../components/Turnstile'
import { Button, Field, Notice, PasswordInput, validateForm } from '../components/ui'

export default function ProfessionalRegisterPage() {
  const navigate = useNavigate()
  const [legal, setLegal] = useState<LegalAcceptanceValue>({ terms: false, privacy: false })
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const invalid = validateForm(event.currentTarget)
    if (Object.keys(invalid).length) { setErrors(invalid); return }
    const data = new FormData(event.currentTarget)
    setBusy(true); setError(''); setErrors({})
    try {
      await api.post('/professionals/register/', {
        full_name: data.get('full_name'), email: data.get('email'), password: data.get('password'),
        access_key: String(data.get('access_key') || '').trim().toUpperCase(), turnstile_token: token, website: '',
        terms_accepted: legal.terms, privacy_accepted: legal.privacy,
      })
      navigate('/profissional/login', { replace: true, state: { registered: true } })
    } catch (caught) { setError(apiErrorMessage(caught)); setErrors(apiFieldErrors(caught)); setToken('') } finally { setBusy(false) }
  }
  return <PublicPage mode="entrepreneur"><section className="mx-auto max-w-xl px-5 py-8"><div className="public-form-card p-6 sm:p-9"><PublicBackLink to="/profissional/login" /><h1 className="public-display text-3xl">Cadastro de <span>profissional</span></h1><p className="mt-2 text-sm text-[#7182b2]">Use a chave de 12 caracteres entregue pela empresa.</p><form className="mt-6 grid gap-4" onSubmit={submit} noValidate><Honeypot /><Field label="Nome completo" name="full_name" required minLength={2} maxLength={150} error={errors.full_name} /><Field label="E-mail" name="email" type="email" required maxLength={254} error={errors.email} /><PasswordInput label="Senha" name="password" autoComplete="new-password" required minLength={12} maxLength={128} error={errors.password} /><Field label="Chave de acesso" name="access_key" autoComplete="off" required minLength={12} maxLength={12} pattern="[A-Za-z2-9]{12}" error={errors.access_key} /><LegalAcceptanceSection value={legal} onChange={setLegal} error={errors.legal_acceptance} /><Turnstile action="professional_registration" onToken={setToken} />{error && <Notice>{error}</Notice>}<Button loading={busy} disabled={!legal.terms || !legal.privacy}>Criar conta profissional</Button></form></div></section></PublicPage>
}
