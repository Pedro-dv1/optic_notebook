import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, apiErrorMessage, apiFieldErrors } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { Button, Field, Notice, validateForm } from '../ui'
import { OtpInput } from './OtpInput'

interface OtpResponse {
  challenge_id: string
  masked_email: string
  expires_in: number
  resend_after: number
}

interface AuthorizationResponse {
  authorization_token: string
  expires_in: number
}

type Step = 'identity' | 'current-otp' | 'new-email' | 'new-otp' | 'success'

export function EmailChangeFlow({ onDone }: { onDone: () => void }) {
  const { user, refreshUser } = useAuth()
  const [step, setStep] = useState<Step>('identity')
  const [challenge, setChallenge] = useState<OtpResponse | null>(null)
  const [authorization, setAuthorization] = useState('')
  const [code, setCode] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const currentRequestLock = useRef(false)
  const currentVerifyLock = useRef(false)
  const newRequestLock = useRef(false)
  const newVerifyLock = useRef(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1_000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const requestCurrent = useMutation({
    mutationFn: () => api.post<OtpResponse>('/customers/security/email-change/current/request/'),
    onSuccess: (data) => {
      setChallenge(data)
      setCode('')
      setCooldown(data.resend_after)
      setStep('current-otp')
    },
  })
  const verifyCurrent = useMutation({
    mutationFn: () => api.post<AuthorizationResponse>('/customers/security/email-change/current/verify/', {
      challenge_id: challenge?.challenge_id,
      code,
    }),
    onSuccess: (data) => {
      setAuthorization(data.authorization_token)
      setCode('')
      setStep('new-email')
    },
  })
  const requestNew = useMutation({
    mutationFn: () => api.post<OtpResponse>('/customers/security/email-change/new/request/', {
      authorization_token: authorization,
      new_email: newEmail,
    }),
    onSuccess: (data) => {
      setChallenge(data)
      setCode('')
      setCooldown(data.resend_after)
      setStep('new-otp')
    },
    onError: (error) => setFieldErrors(apiFieldErrors(error)),
  })
  const verifyNew = useMutation({
    mutationFn: () => api.post<void>('/customers/security/email-change/new/verify/', {
      authorization_token: authorization,
      challenge_id: challenge?.challenge_id,
      code,
    }),
    onSuccess: async () => {
      await refreshUser()
      setStep('success')
    },
  })

  const sendCurrentCode = () => {
    if (currentRequestLock.current) return
    currentRequestLock.current = true
    requestCurrent.mutate(undefined, { onSettled: () => { currentRequestLock.current = false } })
  }
  const verifyCurrentCode = () => {
    if (currentVerifyLock.current) return
    currentVerifyLock.current = true
    verifyCurrent.mutate(undefined, { onSettled: () => { currentVerifyLock.current = false } })
  }
  const sendNewCode = () => {
    if (newRequestLock.current) return
    newRequestLock.current = true
    requestNew.mutate(undefined, { onSettled: () => { newRequestLock.current = false } })
  }
  const verifyNewCode = () => {
    if (newVerifyLock.current) return
    newVerifyLock.current = true
    verifyNew.mutate(undefined, { onSettled: () => { newVerifyLock.current = false } })
  }

  const submitNewEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors = validateForm(event.currentTarget)
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    sendNewCode()
  }
  const stageNumber = step === 'identity' ? 1 : step === 'current-otp' ? 2 : step === 'new-email' ? 3 : step === 'new-otp' ? 4 : 5

  return <>
    <p className="mb-5 text-xs font-semibold uppercase tracking-[.14em] text-[#087cf0]">Etapa {stageNumber} de 5</p>
    {step === 'identity' && <div>
      <h3 className="text-lg font-bold text-[#071044]">Confirme que a conta pertence a você</h3>
      <p className="mt-2 text-sm leading-6 text-[#52658f]">Primeiro enviaremos um código ao seu endereço atual: {maskEmail(user?.email || '')}.</p>
      {requestCurrent.isError && <div className="mt-4"><Notice>{apiErrorMessage(requestCurrent.error)}</Notice></div>}
      <Button className="mt-6 w-full" disabled={requestCurrent.isPending} onClick={sendCurrentCode}>
        {requestCurrent.isPending ? 'Enviando…' : 'Enviar código'}
      </Button>
    </div>}
    {step === 'current-otp' && <OtpStep
      title="Verifique seu e-mail atual"
      description={`Digite o código enviado para ${challenge?.masked_email}.`}
      code={code}
      setCode={setCode}
      cooldown={cooldown}
      pending={verifyCurrent.isPending}
      resendPending={requestCurrent.isPending}
      error={verifyCurrent.isError ? apiErrorMessage(verifyCurrent.error) : undefined}
      onContinue={verifyCurrentCode}
      onResend={sendCurrentCode}
    />}
    {step === 'new-email' && <form className="grid gap-4" onSubmit={submitNewEmail} noValidate>
      <div><h3 className="text-lg font-bold text-[#071044]">Informe o novo e-mail</h3><p className="mt-2 text-sm leading-6 text-[#52658f]">Enviaremos outro código para confirmar que você controla o novo endereço.</p></div>
      <Field label="Novo e-mail" name="new_email" type="email" autoComplete="email" required maxLength={254} value={newEmail} onChange={(event) => setNewEmail(event.target.value)} error={fieldErrors.new_email} />
      {requestNew.isError && <Notice>{apiErrorMessage(requestNew.error)}</Notice>}
      <Button disabled={requestNew.isPending}>{requestNew.isPending ? 'Enviando…' : 'Enviar código ao novo e-mail'}</Button>
    </form>}
    {step === 'new-otp' && <OtpStep
      title="Confirme o novo e-mail"
      description={`Digite o código enviado para ${challenge?.masked_email}. O e-mail só será alterado depois desta confirmação.`}
      code={code}
      setCode={setCode}
      cooldown={cooldown}
      pending={verifyNew.isPending}
      resendPending={requestNew.isPending}
      error={verifyNew.isError ? apiErrorMessage(verifyNew.error) : undefined}
      onContinue={verifyNewCode}
      onResend={sendNewCode}
    />}
    {step === 'success' && <div>
      <Notice kind="success">E-mail alterado com sucesso.</Notice>
      <p className="mt-4 text-sm leading-6 text-[#52658f]">Enviamos uma notificação de segurança ao endereço anterior.</p>
      <Button className="mt-6 w-full" onClick={onDone}>Concluir</Button>
    </div>}
  </>
}

function OtpStep({ title, description, code, setCode, cooldown, pending, resendPending, error, onContinue, onResend }: {
  title: string
  description: string
  code: string
  setCode: (value: string) => void
  cooldown: number
  pending: boolean
  resendPending: boolean
  error?: string
  onContinue: () => void
  onResend: () => void
}) {
  return <div>
    <h3 className="text-lg font-bold text-[#071044]">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-[#52658f]">{description}</p>
    <div className="mt-5"><OtpInput value={code} onChange={setCode} disabled={pending} error={error} /></div>
    <Button className="mt-5 w-full" disabled={code.length !== 6 || pending} onClick={onContinue}>{pending ? 'Verificando…' : 'Continuar'}</Button>
    <Button className="mt-2 w-full" variant="ghost" disabled={cooldown > 0 || resendPending} onClick={onResend}>{cooldown > 0 ? `Reenviar código em ${formatCountdown(cooldown)}` : 'Reenviar código'}</Button>
  </div>
}

function formatCountdown(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function maskEmail(email: string) {
  const [local = '', domain = ''] = email.split('@')
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`
}
