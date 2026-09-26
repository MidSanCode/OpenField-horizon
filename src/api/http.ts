/**
 * Low-level HTTP layer for the Horizon client. Deliberately framework-free
 * (plain fetch + localStorage) so it works from any context — router guards,
 * stores, components — without pinia activation. Tokens live in localStorage
 * under stable keys; the auth store mirrors them into reactive state.
 */

import { API_PATH_PREFIX, normalizeApiBase } from './apiBase'

const ACCESS_KEY = 'horizon.access'
const REFRESH_KEY = 'horizon.refresh'
const API_BASE_KEY = 'horizon.apiBase'

/** Default API base for production builds; dev defaults to the Vite proxy. */
export const DEFAULT_API_BASE =
  import.meta.env.DEV
    ? API_PATH_PREFIX
    : 'https://api.openfield.eu.cc' + API_PATH_PREFIX

/** The page protocol, or a conservative default outside a browser. */
function pageProtocol(): string {
  return typeof window === 'undefined' ? 'https:' : window.location.protocol
}

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

/**
 * The API base in effect: the stored override (normalised, so entries saved
 * before normalisation existed — a bare gateway address — start working
 * without the user re-saving) or the build default.
 */
export function readApiBase(): string {
  const stored = localStorage.getItem(API_BASE_KEY)
  if (!stored) return DEFAULT_API_BASE
  return normalizeApiBase(stored, pageProtocol()) || DEFAULT_API_BASE
}

/**
 * Persists an API base override after normalising it, so a bare gateway
 * address gains the `/api/v1` prefix the API paths need. An empty value, or one
 * that resolves to the build default, clears the override. Returns the base now
 * in effect.
 */
export function writeApiBase(base: string): string {
  const normalized = normalizeApiBase(base, pageProtocol())
  if (!normalized || normalized === normalizeApiBase(DEFAULT_API_BASE, pageProtocol())) {
    localStorage.removeItem(API_BASE_KEY)
    return DEFAULT_API_BASE
  }
  localStorage.setItem(API_BASE_KEY, normalized)
  return normalized
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

  let res: Response
  try {
    res = await fetch(readApiBase() + path, {
      method: opts.method ?? 'GET',
      headers,
      body,
    })
  } catch (e) {
    // fetch only throws TypeErrors on network failures (DNS, refused
    // connection, CORS) — surface them as a stable offline error.
    throw new ApiError(0, 'gateway unreachable')
  }

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
  // The vite dev proxy answers 503 with this exact body when the gateway
  // behind it is down; keep the message stable for the UI.
  if (res.status === 503) return 'gateway unreachable'
  try {
    const data = (await res.json()) as { error?: string }
    if (data.error) return data.error
  } catch {
    // Non-JSON body — fall through to the generic message.
  }
  return `HTTP ${res.status}`
}
