import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { api, apiErrorMessage, apiFieldErrors } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import type { User } from '../../types/api'
import { ProfileAvatar } from '../ProfileAvatar'
import { Button, Field, Notice, validateForm } from '../ui'

export function ProfilePanel({ onEmailChange }: { onEmailChange: () => void }) {
  const { user, refreshUser } = useAuth()
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const update = useMutation({
    mutationFn: (payload: FormData) => api.patch<User>('/customers/profile/me/', payload),
    onSuccess: async () => {
      await refreshUser()
      setMessage('Perfil atualizado.')
      setFieldErrors({})
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
    },
    onError: (error) => setFieldErrors(apiFieldErrors(error)),
  })
  const removeAvatar = useMutation({
    mutationFn: () => api.patch<User>('/customers/profile/me/', { avatar: null }),
    onSuccess: async () => {
      await refreshUser()
      setMessage('Foto removida.')
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
    },
  })
  const selectAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const avatar = event.target.files?.[0]
    if (!avatar) return
    const error = avatar.size > 2 * 1024 * 1024
      ? 'A imagem deve ter no máximo 2 MB.'
      : !['image/png', 'image/jpeg', 'image/webp'].includes(avatar.type)
        ? 'Use uma imagem PNG, JPEG ou WebP.'
        : ''
    if (error) {
      event.target.value = ''
      setFieldErrors((current) => ({ ...current, avatar: error }))
      return
    }
    setFieldErrors((current) => ({ ...current, avatar: '' }))
    setPreview(URL.createObjectURL(avatar))
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    const errors = validateForm(event.currentTarget)
    const data = new FormData(event.currentTarget)
    const avatar = data.get('avatar')
    if (avatar instanceof File) {
      if (!avatar.size) data.delete('avatar')
      else if (avatar.size > 2 * 1024 * 1024) errors.avatar = 'A imagem deve ter no máximo 2 MB.'
      else if (!['image/png', 'image/jpeg', 'image/webp'].includes(avatar.type)) errors.avatar = 'Use uma imagem PNG, JPEG ou WebP.'
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      return
    }
    update.mutate(data)
  }
  return <form className="grid gap-5" onSubmit={submit} noValidate>
      <p className="text-sm leading-6 text-[#52658f]">Gerencie suas informações pessoais.</p>
      {message && <Notice kind="success">{message}</Notice>}
      <div>
        <span className="label">Foto de perfil</span>
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[#d8e5f4] p-4">
          <ProfileAvatar src={preview || user?.avatar} name={user?.full_name || 'Cliente'} className="size-20" />
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} className="sr-only" aria-label="Selecionar foto" name="avatar" type="file" accept="image/png,image/jpeg,image/webp" onChange={selectAvatar} />
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>Alterar foto</Button>
            {(user?.avatar || preview) && <Button type="button" variant="ghost" disabled={removeAvatar.isPending} onClick={() => removeAvatar.mutate()}>{removeAvatar.isPending ? 'Removendo…' : 'Remover foto'}</Button>}
          </div>
        </div>
        {fieldErrors.avatar && <p className="field-error" role="alert">{fieldErrors.avatar}</p>}
      </div>
      <Field label="Nome" name="full_name" autoComplete="name" defaultValue={user?.full_name} required minLength={2} maxLength={150} error={fieldErrors.full_name} />
      <div>
        <span className="label">E-mail</span>
        <div className="flex min-h-12 items-center justify-between gap-3 rounded-[.65rem] border border-[#bdd5f4] px-4">
          <span className="min-w-0 truncate text-sm text-[#43557e]">{maskEmail(user?.email || '')}</span>
          <Button type="button" variant="ghost" className="shrink-0 !min-h-10 !px-2" onClick={onEmailChange}>Alterar</Button>
        </div>
      </div>
      <Field label="WhatsApp" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" defaultValue={formatPhone(user?.whatsapp || '')} required maxLength={20} error={fieldErrors.whatsapp} />
      {update.isError && <Notice>{apiErrorMessage(update.error)}</Notice>}
      {removeAvatar.isError && <Notice>{apiErrorMessage(removeAvatar.error)}</Notice>}
      <div className="flex justify-end"><Button disabled={update.isPending}>{update.isPending ? 'Salvando…' : 'Salvar alterações'}</Button></div>
    </form>
}

function maskEmail(email: string) {
  const [local = '', domain = ''] = email.split('@')
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  const local = digits.length === 13 && digits.startsWith('55') ? digits.slice(2) : digits
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  return phone
}
