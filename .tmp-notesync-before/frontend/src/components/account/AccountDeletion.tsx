import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api, apiErrorMessage } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { Button, Dialog, Field, Notice, PasswordField } from '../ui'

export function AccountDeletionPanel() {
  const { clearSession, user } = useAuth()
  const navigate = useNavigate()
  const [confirmation, setConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const deletion = useMutation({
    mutationFn: () => api.post('/auth/account/delete/', { password, confirmation }),
    onSuccess: () => { clearSession(); navigate('/', { replace: true }) },
  })
  const owner = Boolean(user?.company || user?.is_superuser)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (confirmation === 'EXCLUIR' && password && !deletion.isPending) deletion.mutate()
  }
  return <form className="grid gap-5" onSubmit={submit}>
    <Notice kind="warning" title="Esta ação é permanente">Sua conta, foto e acesso serão apagados. Agendamentos futuros vinculados a você como cliente serão cancelados e o histórico ficará sem seus dados pessoais. Esta ação não pode ser desfeita.</Notice>
    {owner ? <p className="text-sm leading-6 text-[#43557e]">Sua conta é responsável por uma empresa ou pela plataforma. A titularidade precisa ser resolvida antes da exclusão. <a href="/suporte" className="font-semibold text-[#164a8a] underline">Acessar suporte</a>.</p> : <>
      <Field label="Digite EXCLUIR para confirmar" name="confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required pattern="EXCLUIR" />
      <PasswordField label="Senha atual" name="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required maxLength={128} />
      {deletion.isError && <Notice>{apiErrorMessage(deletion.error)}</Notice>}
      <Button variant="danger" loading={deletion.isPending} disabled={confirmation !== 'EXCLUIR' || !password}>Excluir minha conta permanentemente</Button>
    </>}
  </form>
}

export function AccountDeletionSettings() {
  const [open, setOpen] = useState(false)
  return <section className="panel mt-6" aria-labelledby="account-security-title"><h2 id="account-security-title" className="text-lg font-semibold">Segurança</h2><p className="mt-2 text-sm text-[#43557e]">Gerencie a permanência da sua conta no NoteSync.</p><Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>Excluir minha conta</Button><Dialog open={open} title="Excluir minha conta" onClose={() => setOpen(false)}><AccountDeletionPanel /></Dialog></section>
}
