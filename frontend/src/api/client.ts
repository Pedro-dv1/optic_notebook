import type { User } from '../types/api'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

let accessToken: string | null = null
let csrfReady: Promise<void> | null = null
let refreshInFlight: Promise<string> | null = null
let sessionLostHandler: (() => void) | null = null

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly details: unknown,
    message = messageForStatus(status),
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function messageForStatus(status: number) {
  const messages: Record<number, string> = {
    400: 'Revise os dados informados.',
    401: 'Sua sessão expirou. Entre novamente.',
    403: 'Você não tem permissão para esta ação.',
    404: 'Não encontramos o que você procura.',
    409: 'Esse horário acabou de ser reservado. Escolha outro.',
    429: 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.',
    500: 'O serviço encontrou um problema. Tente novamente em instantes.',
  }
  return messages[status] || 'Não foi possível concluir. Tente novamente.'
}

function getCookie(name: string) {
  const prefix = `${name}=`
  const item = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))
  return item ? decodeURIComponent(item.slice(prefix.length)) : null
}

async function ensureCsrf() {
  if (!csrfReady) {
    csrfReady = fetch(`${API_BASE_URL}/auth/csrf/`, { credentials: 'include' }).then((response) => {
      if (!response.ok) throw new ApiError(response.status, null)
    }).catch((error) => {
      csrfReady = null
      throw error
    })
  }
  return csrfReady
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T
  const type = response.headers.get('content-type') || ''
  let payload: unknown = null
  if (type.includes('application/json')) {
    try {
      payload = await response.json()
    } catch {
      throw new ApiError(response.status, null, 'O serviço retornou uma resposta inválida.')
    }
  }
  if (!response.ok) throw new ApiError(response.status, payload)
  if (!type.includes('application/json')) {
    throw new ApiError(response.status, null, 'O serviço retornou uma resposta inválida.')
  }
  return payload as T
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  retryAuth?: boolean
}

async function rawRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body: requestBody, retryAuth, ...requestInit } = options
  const method = (options.method || 'GET').toUpperCase()
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(method)
  if (unsafe) await ensureCsrf()

  const headers = new Headers(options.headers)
  let body: BodyInit | undefined
  if (requestBody instanceof FormData) {
    body = requestBody
  } else if (requestBody !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(requestBody)
  }
  if (unsafe) {
    const csrf = getCookie('csrftoken')
    if (csrf) headers.set('X-CSRFToken', csrf)
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  let response: Response
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15_000)
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...requestInit, body, headers, credentials: 'include', signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, null, 'A solicitação demorou demais. Tente novamente.')
    }
    throw new ApiError(0, null, 'Não foi possível conectar ao servidor. Tente novamente.')
  } finally {
    window.clearTimeout(timeout)
  }

  if (response.status === 401 && retryAuth !== false && !path.startsWith('/auth/')) {
    try {
      await refreshAccess()
      return rawRequest<T>(path, { ...options, retryAuth: false })
    } catch {
      accessToken = null
      sessionLostHandler?.()
    }
  }
  return parseResponse<T>(response)
}

export async function refreshAccess() {
  if (!refreshInFlight) {
    refreshInFlight = rawRequest<{ access: string }>('/auth/refresh/', {
      method: 'POST',
      body: {},
      retryAuth: false,
    }).then(({ access }) => {
      accessToken = access
      return access
    }).finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

export function setSessionLostHandler(handler: (() => void) | null) {
  sessionLostHandler = handler
}

export const api = {
  get: <T>(path: string) => rawRequest<T>(path),
  post: <T>(path: string, body: unknown = {}) => rawRequest<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body: unknown) => rawRequest<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body: unknown) => rawRequest<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => rawRequest<T>(path, { method: 'DELETE' }),
  login: async (payload: { email: string; password: string; turnstile_token?: string }) => {
    const data = await rawRequest<{ access: string; user: User }>('/auth/login/', {
      method: 'POST', body: payload, retryAuth: false,
    })
    accessToken = data.access
    return data.user
  },
  logout: async () => {
    try {
      await rawRequest<void>('/auth/logout/', { method: 'POST', body: {}, retryAuth: false })
    } finally {
      accessToken = null
    }
  },
  clearAccess: () => { accessToken = null },
}

export function apiErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Ocorreu um erro inesperado.'
  const payload = error.details as { errors?: unknown } | null
  const errors = payload?.errors
  const code = apiErrorCode(error)
  const securityMessages: Record<string, string> = {
    otp_invalid: 'Esse código não é válido.',
    otp_expired: 'O código expirou. Solicite um novo.',
    otp_used: 'Esse código não está mais disponível. Solicite um novo.',
    otp_attempts_exceeded: 'Muitas tentativas. Solicite um novo código.',
    resend_cooldown: 'Você solicitou códigos recentemente. Aguarde antes de tentar novamente.',
    rate_limited: 'Você solicitou códigos recentemente. Aguarde antes de tentar novamente.',
    email_delivery_failed: 'Não foi possível enviar o e-mail agora. Tente novamente em alguns instantes.',
    email_delivery_unavailable: 'Não foi possível enviar o código agora. Tente novamente em alguns instantes.',
    authorization_expired: 'A verificação expirou. Inicie novamente.',
    authorization_used: 'Esta verificação já foi utilizada. Inicie novamente.',
    authorization_invalid: 'A verificação não é válida. Inicie novamente.',
    email_in_use: 'Este e-mail já está em uso.',
    email_unchanged: 'Informe um e-mail diferente do atual.',
  }
  if (code && securityMessages[code]) return securityMessages[code]
  if (errors && typeof errors === 'object' && 'message' in errors) {
    const message = firstErrorMessage((errors as { message?: unknown }).message)
    if (message) return translateApiMessage(message)
  }
  const first = firstErrorMessage(errors)
  if (first) return translateApiMessage(first)
  return error.message
}

export function apiErrorCode(error: unknown) {
  if (!(error instanceof ApiError) || !error.details || typeof error.details !== 'object') return null
  const errors = (error.details as { errors?: unknown }).errors
  if (!errors || typeof errors !== 'object') return null
  const code = (errors as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

export function apiFieldErrors(error: unknown) {
  if (!(error instanceof ApiError) || !error.details || typeof error.details !== 'object') return {}
  const payload = error.details as { errors?: unknown }
  if (!payload.errors || typeof payload.errors !== 'object') return {}
  return Object.fromEntries(Object.entries(payload.errors as Record<string, unknown>).flatMap(([field, value]) => {
    const message = firstErrorMessage(value)
    return message ? [[field, translateApiMessage(message)]] : []
  })) as Record<string, string>
}

function firstErrorMessage(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstErrorMessage(item)
      if (message) return message
    }
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const message = firstErrorMessage(item)
      if (message) return message
    }
  }
  return null
}

function translateApiMessage(message: string) {
  const normalized = message.toLocaleLowerCase('en-US')
  if (normalized.includes('no active account found') || normalized.includes('given credentials') || normalized.includes('invalid credentials') || normalized.includes('credenciais inválidas') || normalized.includes('conta ativa encontrada')) return 'E-mail ou senha incorretos.'
  if (normalized.includes('company is suspended') || normalized.includes('conta está suspensa')) return 'Esta conta está suspensa.'
  if (normalized.includes('already exists') || normalized.includes('already registered') || normalized.includes('já está cadastrado')) return 'Este e-mail já está cadastrado.'
  if (normalized.includes('this field is required') || normalized.includes('required.')) return 'Este campo é obrigatório.'
  if (normalized.includes('valid email')) return 'Informe um e-mail válido.'
  if (normalized.includes('invalid pk') || normalized.includes('pk inválido') || normalized.includes('object does not exist') || normalized.includes('objeto não existe')) return 'Selecione uma opção válida e tente novamente.'
  return message
}
