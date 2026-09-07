/**
 * Low-level HTTP layer for the Horizon client. Deliberately framework-free
 * (plain fetch + localStorage) so it works from any context — router guards,
 * stores, components — without pinia activation. Tokens live in localStorage
 * under stable keys; the auth store mirrors them into reactive state.
 */

const ACCESS_KEY = 'horizon.access'
const REFRESH_KEY = 'horizon.refresh'
const API_BASE_KEY = 'horizon.apiBase'

/** Default API base for production builds; dev defaults to the Vite proxy. */
export const DEFAULT_API_BASE =
  import.meta.env.DEV ? '/api/v1' : 'https://api.openfield.eu.cc/api/v1'

/** Thrown for every non-2xx response; carries the HTTP status. */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function readAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

export function readRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function writeTokens(access: string | null, refresh: string | null): void {
  if (access) localStorage.setItem(ACCESS_KEY, access)
  else localStorage.removeItem(ACCESS_KEY)
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  else localStorage.removeItem(REFRESH_KEY)
}

export function readApiBase(): string {
  return localStorage.getItem(API_BASE_KEY) || DEFAULT_API_BASE
}

export function writeApiBase(base: string): void {
  const trimmed = base.trim().replace(/\/+$/, '')
  if (!trimmed || trimmed === DEFAULT_API_BASE) {
    localStorage.removeItem(API_BASE_KEY)
  } else {
    localStorage.setItem(API_BASE_KEY, trimmed)
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  /** Multipart payload; bypasses the JSON content-type. */
  form?: FormData
  /** Set false to skip the Authorization header (public endpoints). */
  auth?: boolean
}

/** Internal retry marker so a failed refresh never loops. */
interface InternalOptions extends RequestOptions {
  _retried?: boolean
}

/**
 * Performs one API call. On 401 it tries a single token refresh (the server
 * rotates refresh tokens) and replays the request once; every other failure
 * surfaces as {@link ApiError} with the server's `error` message when
 * available.
 */
export async function request<T>(path: string, opts: InternalOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const token = readAccessToken()
  if (opts.auth !== false && token) {
    headers.Authorization = `Bearer ${token}`
  }
  let body: BodyInit | undefined
  if (opts.form) {
    body = opts.form
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }

  const res = await fetch(readApiBase() + path, {
    method: opts.method ?? 'GET',
    headers,
    body,
  })

  if (res.status === 401 && opts.auth !== false && readRefreshToken() && !opts._retried) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      return request<T>(path, { ...opts, _retried: true })
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, await extractError(res))
  }
  if (res.status === 204) {
    return undefined as T
  }
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return (await res.json()) as T
  }
  return undefined as T
}

/** Attempts one refresh-token rotation; returns whether new tokens landed. */
async function tryRefresh(): Promise<boolean> {
  const refresh = readRefreshToken()
  if (!refresh) return false
  try {
    const res = await fetch(readApiBase() + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { access_token?: string; refresh_token?: string }
    if (!data.access_token) return false
    writeTokens(data.access_token, data.refresh_token ?? refresh)
    return true
  } catch {
    return false
  }
}

/** Extracts the server's `{"error": "..."}` message, with sane fallbacks. */
async function extractError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string }
    if (data.error) return data.error
  } catch {
    // Non-JSON body — fall through to the generic message.
  }
  return `HTTP ${res.status}`
}
