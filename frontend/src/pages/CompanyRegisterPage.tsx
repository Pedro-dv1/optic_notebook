import { LuBriefcaseBusiness as BriefcaseBusiness, LuKeyRound as KeyRound, LuLink2 as Link2, LuLockKeyhole as LockKeyhole, LuMail as Mail, LuMapPin as MapPin, LuMessageCircle as MessageCircle, LuPhone as Phone, LuUserRound as UserRound } from 'react-icons/lu'
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api, apiErrorMessage, apiFieldErrors } from '../api/client'
import logoIcon from '../assets/branding/OpticNoteBook-logo-icon.png'
import { CityAutocomplete } from '../components/CityAutocomplete'
import { PublicBackLink, PublicPage } from '../components/PublicLayout'
import { Honeypot, Turnstile } from '../components/Turnstile'
import { Button, EmptyState, Field, LoadingState, Notice, PasswordInput, SelectField, validateForm } from '../components/ui'
import { formatCnpj, formatPhone, formatSlug } from '../lib/inputMasks'
import { isPublicPlatformConfig } from '../types/api'
import { LegalAcceptanceSection, type LegalAcceptanceValue } from '../components/LegalDocuments'

export default function CompanyRegisterPage() {
  const navigate = useNavigate()
  const options = useQuery({ queryKey: ['platform-config'], queryFn: () => api.get<unknown>('/public/platform/'), staleTime: 3_600_000 })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState('')
  const [authorizationKey, setAuthorizationKey] = useState('')
  const [ownerWhatsapp, setOwnerWhatsapp] = useState('')
  const [companyWhatsapp, setCompanyWhatsapp] = useState('')
  const [taxIdentifier, setTaxIdentifier] = useState('')
  const [slug, setSlug] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [niche, setNiche] = useState('')
  const [nicheCustom, setNicheCustom] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [businessTypeCustom, setBusinessTypeCustom] = useState('')
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
      await api.post('/companies/register/', {
        authorization_key: authorizationKey,
        owner_name: data.get('owner_name'),
        owner_email: data.get('owner_email'),
        owner_whatsapp: ownerWhatsapp,
        owner_password: data.get('owner_password'),
        name: data.get('name'),
        slug,
        tax_identifier: taxIdentifier,
        whatsapp: companyWhatsapp,
        address: data.get('address'),
        city,
        state,
        niche,
        niche_custom: niche === 'Other' ? nicheCustom : '',
        business_type: businessType,
        business_type_custom: businessType === 'Other' ? businessTypeCustom : '',
        website: data.get('website'),
        turnstile_token: token,
        terms_accepted: legalAcceptance.terms,
        privacy_accepted: legalAcceptance.privacy,
      })
      navigate('/empreendedor/login', { replace: true, state: { registered: true } })
    } catch (caught) {
      setError(apiErrorMessage(caught))
      setFieldErrors(apiFieldErrors(caught))
      setToken('')
    } finally {
      setAuthorizationKey('')
      setBusy(false)
    }
  }

  if (options.isPending) return <PublicPage mode="entrepreneur"><div className="mx-auto max-w-[58rem] px-5 pt-4"><PublicBackLink to="/empreendedor/login" /><LoadingState label="Carregando opções de cadastro" /></div></PublicPage>
  if (options.isError) return <PublicPage mode="entrepreneur"><div className="mx-auto max-w-[58rem] px-5 pt-4"><PublicBackLink to="/empreendedor/login" /><div className="mx-auto max-w-xl pt-16"><Notice>{apiErrorMessage(options.error)}</Notice></div></div></PublicPage>
  if (!isPublicPlatformConfig(options.data)) return <PublicPage mode="entrepreneur"><div className="mx-auto max-w-[58rem] px-5 pt-4"><PublicBackLink to="/empreendedor/login" /><div className="mx-auto max-w-xl py-16"><EmptyState title="Opções de cadastro indisponíveis" description="A configuração de cadastro veio vazia. Tente carregar novamente." /><div className="mt-5 flex justify-center"><Button variant="secondary" disabled={options.isFetching} onClick={() => void options.refetch()}>{options.isFetching ? 'Carregando…' : 'Tentar novamente'}</Button></div></div></div></PublicPage>
  const companyOptions = options.data.company_options
  const allowedTypes = companyOptions.business_types_by_niche?.[niche]
  const businessTypes = allowedTypes ? companyOptions.business_types.filter((option) => allowedTypes.includes(option.value)) : companyOptions.business_types

  return <PublicPage mode="entrepreneur">
    <section className="mx-auto max-w-[56rem] px-5 pb-10 pt-5 sm:pt-7">
      <PublicBackLink to="/empreendedor/login" />
      <div className="public-form-card px-5 py-6 sm:px-8 sm:py-7">
        <img src={logoIcon} className="mx-auto size-12 object-contain" alt="" aria-hidden="true" />
        <p className="mt-3 text-center text-xs font-bold uppercase tracking-[.22em] text-[#087cf0]">Nova empresa</p>
        <h1 className="public-display mt-2 text-center text-3xl sm:text-4xl">Cadastrar no <span>OpticNoteBook</span></h1>
        <p className="mt-2 text-center text-sm text-[#7182b2] sm:text-base">A chave será enviada somente nesta solicitação e removida do formulário logo depois.</p>
        <form className="relative mt-6 grid gap-x-5 gap-y-3.5 sm:grid-cols-2" onSubmit={submit} noValidate>
          <Honeypot />
          <div className="sm:col-span-2"><PasswordInput label="Chave de autorização" name="authorization_key" autoComplete="off" placeholder="Digite a chave de autorização" icon={KeyRound} value={authorizationKey} onChange={(event) => setAuthorizationKey(event.target.value)} required minLength={40} maxLength={100} error={fieldErrors.authorization_key} /></div>
          <h2 className="mt-2 border-t border-[#dbe6f4] pt-4 text-sm font-bold text-[#070d35] sm:col-span-2">Responsável pela conta</h2>
          <Field label="Nome" name="owner_name" autoComplete="name" placeholder="Seu nome completo" icon={UserRound} required maxLength={150} error={fieldErrors.owner_name} />
          <Field label="E-mail" name="owner_email" type="email" autoComplete="email" placeholder="seu@email.com" icon={Mail} required maxLength={254} error={fieldErrors.owner_email} />
          <Field label="WhatsApp pessoal" name="owner_whatsapp" type="tel" autoComplete="tel" inputMode="numeric" placeholder="(11) 91234-5678" icon={MessageCircle} value={ownerWhatsapp} onChange={(event) => setOwnerWhatsapp(formatPhone(event.target.value))} required maxLength={15} error={fieldErrors.owner_whatsapp} />
          <PasswordInput label="Senha" name="owner_password" autoComplete="new-password" placeholder="Crie uma senha" icon={LockKeyhole} required minLength={12} maxLength={128} error={fieldErrors.owner_password} />
          <h2 className="mt-2 border-t border-[#dbe6f4] pt-4 text-sm font-bold text-[#070d35] sm:col-span-2">Empresa</h2>
          <Field label="Nome da empresa" name="name" placeholder="Nome da sua empresa" icon={BriefcaseBusiness} required maxLength={150} error={fieldErrors.name} />
          <Field label="Endereço público (slug)" name="slug" placeholder="minha-empresa" icon={Link2} value={slug} onChange={(event) => setSlug(formatSlug(event.target.value))} required pattern="[a-z0-9-]+" maxLength={80} error={fieldErrors.slug} />
          <Field label="CNPJ (opcional)" name="tax_identifier" inputMode="numeric" placeholder="00.000.000/0000-00" value={taxIdentifier} onChange={(event) => setTaxIdentifier(formatCnpj(event.target.value))} maxLength={18} error={fieldErrors.tax_identifier} />
          <Field label="Telefone / WhatsApp" name="whatsapp" type="tel" inputMode="numeric" placeholder="(11) 91234-5678" icon={Phone} value={companyWhatsapp} onChange={(event) => setCompanyWhatsapp(formatPhone(event.target.value))} required maxLength={15} error={fieldErrors.whatsapp} />
          <div className="sm:col-span-2"><Field label="Endereço" name="address" autoComplete="street-address" placeholder="Rua, número e bairro" icon={MapPin} maxLength={300} error={fieldErrors.address} /></div>
          <CityAutocomplete city={city} state={state} states={companyOptions.states} onCityChange={setCity} onStateChange={setState} cityError={fieldErrors.city} stateError={fieldErrors.state} />
          <SelectField label="Nicho-base" name="niche" required value={niche} error={fieldErrors.niche} onChange={(event) => { const next = event.target.value; setNiche(next); if (next !== 'Other') setNicheCustom(''); if (!companyOptions.business_types_by_niche?.[next]?.includes(businessType)) { setBusinessType(''); setBusinessTypeCustom('') } }}><option value="" disabled>Selecione</option>{companyOptions.niches.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField>
          <SelectField label="Tipo de negócio" name="business_type" required value={businessType} disabled={!niche} error={fieldErrors.business_type} onChange={(event) => { setBusinessType(event.target.value); if (event.target.value !== 'Other') setBusinessTypeCustom('') }}><option value="" disabled>{niche ? 'Selecione' : 'Escolha o nicho primeiro'}</option>{businessTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField>
          {niche === 'Other' && <Field label="Qual nicho?" name="niche_custom" value={nicheCustom} onChange={(event) => setNicheCustom(event.target.value)} required maxLength={100} error={fieldErrors.niche_custom} />}
          {businessType === 'Other' && <Field label="Qual tipo de negócio?" name="business_type_custom" value={businessTypeCustom} onChange={(event) => setBusinessTypeCustom(event.target.value)} required maxLength={100} error={fieldErrors.business_type_custom} />}
          <div className="sm:col-span-2"><LegalAcceptanceSection value={legalAcceptance} onChange={setLegalAcceptance} error={fieldErrors.legal_acceptance} /></div>
          <div className="sm:col-span-2"><Turnstile action="company_registration" onToken={setToken} />{error && <div className="mt-4"><Notice kind={Object.keys(fieldErrors).length ? 'validation' : 'error'}>{error}</Notice></div>}<div className="mt-5"><Button className="w-full" disabled={busy || !legalAcceptance.terms || !legalAcceptance.privacy}>{busy ? 'Cadastrando…' : 'Cadastrar empresa'}</Button></div></div>
        </form>
      </div>
    </section>
  </PublicPage>
}
