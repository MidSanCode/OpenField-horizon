/**
 * Post-sign-in redirect handling for the browser OAuth round trip.
 *
 * The OAuth callback returns to `/oauth/callback`, which is not where the user
 * wanted to go. The login page parks the intended target in sessionStorage and
 * the callback consumes it, so a deep link such as `/chat/4` survives the trip
 * to the provider and back.
 *
 * The value is validated on the way *out* rather than trusted on the way in:
 * only a same-origin absolute path is honoured, so a crafted `redirect` query
 * parameter cannot turn the callback into an open redirect. `//evil.com` is
 * rejected explicitly because a browser reads it as a protocol-relative URL.
 */

const REDIRECT_KEY = 'horizon.oauthRedirect'

/** Stores [target] for the OAuth callback to pick up (ignores unsafe values). */
export function rememberOAuthRedirect(target: unknown): void {
  if (typeof target !== 'string' || !isSafeRedirect(target)) return
  try {
    sessionStorage.setItem(REDIRECT_KEY, target)
  } catch {
    // Private-mode sessionStorage: the callback falls back to "/".
  }
}

/**
 * Returns the remembered target and clears it. Always safe to navigate to:
 * falls back to `/` when nothing valid was stored.
 */
export function consumeOAuthRedirect(): string {
  let saved: string | null = null
  try {
    saved = sessionStorage.getItem(REDIRECT_KEY)
    sessionStorage.removeItem(REDIRECT_KEY)
  } catch {
    return '/'
  }
  return saved !== null && isSafeRedirect(saved) ? saved : '/'
}

/** Whether [value] is a same-origin absolute path we may navigate to. */
export function isSafeRedirect(value: string): boolean {
  if (!value.startsWith('/')) return false
  // "//host" and "/\host" are read as protocol-relative by browsers.
  if (value.startsWith('//') || value.startsWith('/\\')) return false
  return true
}
