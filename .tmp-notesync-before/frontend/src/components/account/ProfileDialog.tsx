import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { LuCamera } from 'react-icons/lu'
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
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [photoOptions, setPhotoOptions] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cameraRequest = useRef(0)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  useEffect(() => () => { cameraRequest.current++; streamRef.current?.getTracks().forEach((track) => track.stop()) }, [])
  const stopCamera = () => {
    cameraRequest.current++
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOpen(false); setCameraReady(false)
  }
  const startCamera = async () => {
    setPhotoOptions(false); setCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) { cameraInputRef.current?.click(); return }
    setCameraOpen(true); setCameraReady(false)
    const request = ++cameraRequest.current
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }, audio: false })
      if (request !== cameraRequest.current || !videoRef.current) { stream.getTracks().forEach((track) => track.stop()); return }
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      if (request === cameraRequest.current) setCameraReady(true)
    } catch (error) {
      if (request !== cameraRequest.current) return
      stopCamera()
      setCameraError(error instanceof DOMException && error.name === 'NotAllowedError' ? 'A permissão da câmera foi negada. Autorize no navegador ou escolha um arquivo.' : 'Não foi possível abrir a câmera. Você também pode escolher uma foto do dispositivo.')
    }
  }
  const setAvatar = (avatar: File) => {
    const error = avatar.size > 2 * 1024 * 1024 ? 'A imagem deve ter no máximo 2 MB.' : !['image/png', 'image/jpeg', 'image/webp'].includes(avatar.type) ? 'Use uma imagem PNG, JPEG ou WebP.' : ''
    if (error) { setFieldErrors((current) => ({ ...current, avatar: error })); return false }
    setFieldErrors((current) => ({ ...current, avatar: '' }))
    setAvatarFile(avatar); setPreview(URL.createObjectURL(avatar)); setPhotoOptions(false)
    return true
  }
  const capture = () => {
    const video = videoRef.current
    if (!video || !cameraReady || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    const request = cameraRequest.current
    canvas.toBlob((blob) => {
      if (request !== cameraRequest.current) return
      if (blob) { setAvatar(new File([blob], 'camera.jpg', { type: 'image/jpeg' })); stopCamera() }
      else setCameraError('Não foi possível capturar a imagem. Tente novamente.')
    }, 'image/jpeg', 0.9)
  }
  const update = useMutation({
    mutationFn: (payload: FormData) => api.patch<User>('/customers/profile/me/', payload),
    onSuccess: async () => {
      stopCamera()
      await refreshUser()
      setMessage('Perfil atualizado.')
      setFieldErrors({})
      setPreview(null)
      setAvatarFile(null)
      if (fileRef.current) fileRef.current.value = ''
    },
    onError: (error) => setFieldErrors(apiFieldErrors(error)),
  })
  const removeAvatar = useMutation({
    mutationFn: () => api.patch<User>('/customers/profile/me/', { avatar: null }),
    onSuccess: async () => {
      stopCamera()
      await refreshUser()
      setMessage('Foto removida.')
      setPreview(null)
      setAvatarFile(null)
      if (fileRef.current) fileRef.current.value = ''
    },
  })
  const selectAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const avatar = event.target.files?.[0]
    if (!avatar) return
    if (!setAvatar(avatar)) {
      event.target.value = ''
    }
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    const errors = validateForm(event.currentTarget)
    const data = new FormData(event.currentTarget)
    if (avatarFile) data.set('avatar', avatarFile)
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
          <div className="relative shrink-0">{preview ? <img src={preview} alt={`Foto de ${user?.full_name || 'Cliente'}`} className="size-20 rounded-full object-cover" /> : <ProfileAvatar src={user?.avatar} name={user?.full_name || 'Cliente'} className="size-20" />}<Button type="button" variant="secondary" className="absolute -bottom-1 -right-2 !size-11 !min-h-0 !rounded-full !bg-white !p-0" onClick={() => setPhotoOptions((value) => !value)} aria-label="Opções da foto de perfil" aria-expanded={photoOptions} aria-controls="avatar-photo-options"><LuCamera className="size-5" aria-hidden="true" /></Button></div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} className="sr-only" aria-label="Selecionar foto" name="avatar" type="file" accept="image/png,image/jpeg,image/webp" onChange={selectAvatar} />
            <input ref={cameraInputRef} className="sr-only" aria-label="Capturar foto no dispositivo" type="file" accept="image/*" capture="user" onChange={selectAvatar} />
            {(user?.avatar || preview) && <Button type="button" variant="ghost" disabled={removeAvatar.isPending} onClick={() => removeAvatar.mutate()}>{removeAvatar.isPending ? 'Removendo…' : 'Remover foto'}</Button>}
          </div>
        </div>
        {photoOptions && <div id="avatar-photo-options" role="group" aria-label="Origem da foto" className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => void startCamera()}>Tirar foto</Button><Button type="button" variant="secondary" onClick={() => { setPhotoOptions(false); fileRef.current?.click() }}>Escolher da galeria/arquivos</Button><Button type="button" variant="ghost" onClick={() => setPhotoOptions(false)}>Cancelar</Button></div>}
        {cameraOpen && <section className="mt-4" aria-label="Captura pela câmera"><video ref={videoRef} autoPlay playsInline muted aria-label="Prévia da câmera" className="aspect-square w-full rounded-xl bg-[#071044] object-cover" />{!cameraReady && <p role="status" className="mt-2 text-sm">Aguardando permissão e câmera…</p>}<div className="mt-3 flex flex-wrap gap-2"><Button type="button" disabled={!cameraReady} onClick={capture}>Capturar foto</Button><Button type="button" variant="secondary" onClick={stopCamera}>Cancelar câmera</Button></div></section>}
        {cameraError && <div className="mt-3"><Notice>{cameraError}</Notice></div>}
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
