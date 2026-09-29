import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, apiErrorMessage, apiFieldErrors } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { Button, Notice, PasswordInput, validateForm } from '../ui'
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

type Step = 'identity' | 'otp' | 'password' | 'success'

export function PasswordChangeFlow({ onSuccess, onDone }: { onSuccess: () => void; onDone: () => void }) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('identity')
  const [challenge, setChallenge] = useState<OtpResponse | null>(null)
  const [authorization, setAuthorization] = useState('')
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const requestLock = useRef(false)
  const verifyLock = useRef(false)
  const passwordLock = useRef(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1_000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const requestOtp = useMutation({
    mutationFn: () => api.post<OtpResponse>('/customers/security/password/request/'),
    onSuccess: (data) => {
      setChallenge(data)
      setCode('')
      setCooldown(data.resend_after)
      setStep('otp')
    },
  })
  const verifyOtp = useMutation({
    mutationFn: () => api.post<AuthorizationResponse>('/customers/security/password/verify/', {
      challenge_id: challenge?.challenge_id,
      code,
    }),
    onSuccess: (data) => {
      setAuthorization(data.authorization_token)
      setStep('password')
    },
  })
  const changePassword = useMutation({
    mutationFn: (payload: object) => api.post<void>('/customers/password/change/', payload),
    onSuccess: () => { setStep('success'); onSuccess() },
    onError: (error) => setFieldErrors(apiFieldErrors(error)),
  })

  const sendCode = () => {
    if (requestLock.current) return
    requestLock.current = true
    requestOtp.mutate(undefined, { onSettled: () => { requestLock.current = false } })
  }
  const verifyCode = () => {
    if (verifyLock.current) return
    verifyLock.current = true
    verifyOtp.mutate(undefined, { onSettled: () => { verifyLock.current = false } })
  }

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors = validateForm(event.currentTarget)
    const data = new FormData(event.currentTarget)
    if (data.get('new_password') !== data.get('new_password_confirm')) {
      errors.new_password_confirm = 'As senhas não coincidem.'
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    if (passwordLock.current) return
    passwordLock.current = true
    changePassword.mutate(
      { ...Object.fromEntries(data), authorization_token: authorization },
      { onSettled: () => { passwordLock.current = false } },
    )
  }
  return <>
    <p className="mb-5 text-xs font-semibold uppercase tracking-[.14em] text-[#087cf0]">
      Etapa {step === 'identity' ? '1' : step === 'otp' ? '2' : step === 'password' ? '3' : '4'} de 4
    </p>
    {step === 'identity' && <div>
      <h3 className="text-lg font-bold text-[#071044]">Confirmar identidade</h3>
      <p className="mt-2 text-sm leading-6 text-[#52658f]">Para proteger sua conta, vamos enviar um código para {challenge?.masked_email || maskEmail(user?.email || '')}.</p>
      {requestOtp.isError && <div className="mt-4"><Notice>{apiErrorMessage(requestOtp.error)}</Notice></div>}
      <Button className="mt-6 w-full" disabled={requestOtp.isPending} onClick={sendCode}>
        {requestOtp.isPending ? 'Enviando…' : 'Enviar código de verificação'}
      </Button>
    </div>}
    {step === 'otp' && <div>
      <h3 className="text-lg font-bold text-[#071044]">Verifique seu e-mail</h3>
      <p className="mt-2 text-sm leading-6 text-[#52658f]">Digite o código de 6 dígitos enviado para {challenge?.masked_email}.</p>
      <div className="mt-5"><OtpInput value={code} onChange={setCode} disabled={verifyOtp.isPending} error={verifyOtp.isError ? apiErrorMessage(verifyOtp.error) : undefined} /></div>
      <Button className="mt-5 w-full" disabled={code.length !== 6 || verifyOtp.isPending} onClick={verifyCode}>
        {verifyOtp.isPending ? 'Verificando…' : 'Continuar'}
      </Button>
      <Button className="mt-2 w-full" variant="ghost" disabled={cooldown > 0 || requestOtp.isPending} onClick={sendCode}>
        {cooldown > 0 ? `Reenviar código em ${formatCountdown(cooldown)}` : 'Reenviar código'}
      </Button>
    </div>}
    {step === 'password' && <form className="grid gap-4" onSubmit={submitPassword} noValidate>
      <div><h3 className="text-lg font-bold text-[#071044]">Criar nova senha</h3><p className="mt-2 text-sm leading-6 text-[#52658f]">Use pelo menos 12 caracteres. Evite dados pessoais e senhas comuns.</p></div>
      <PasswordInput label="Nova senha" name="new_password" autoComplete="new-password" required minLength={12} maxLength={128} error={fieldErrors.new_password} />
      <PasswordInput label="Confirmar nova senha" name="new_password_confirm" autoComplete="new-password" required minLength={12} maxLength={128} error={fieldErrors.new_password_confirm} />
      {changePassword.isError && <Notice>{apiErrorMessage(changePassword.error)}</Notice>}
      <Button disabled={changePassword.isPending}>{changePassword.isPending ? 'Alterando…' : 'Alterar senha'}</Button>
    </form>}
    {step === 'success' && <div>
      <Notice kind="success">Senha alterada com sucesso. Suas sessões anteriores foram encerradas.</Notice>
      <p className="mt-4 text-sm leading-6 text-[#52658f]">Enviamos uma notificação de segurança ao seu e-mail.</p>
      <Button className="mt-6 w-full" onClick={onDone}>Entrar novamente</Button>
    </div>}
  </>
}

function maskEmail(email: string) {
  const [local = '', domain = ''] = email.split('@')
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`
}

function formatCountdown(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
