/**
 * API base normalisation for Horizon.
 *
 * The settings page asks for the *gateway* address ("http://127.0.0.1:8080"),
 * but every path in ./index.ts is written relative to the versioned prefix
 * ("/posts" means `/api/v1/posts`). Feeding the raw value to `fetch` therefore
 * requested "http://127.0.0.1:8080/posts" and 404'd. Everything below exists to
 * turn what the user typed into a prefix the API paths can be appended to.
 *
 * Kept free of browser globals at module scope (no `localStorage`, no
 * `window`) and with the page protocol passed in explicitly, so the rules are
 * plain string logic that can be exercised directly.
 */

/** Versioned path prefix every API path in ./index.ts is relative to. */
export const API_PATH_PREFIX = '/api/v1'

/** Matches an already-present scheme, e.g. `https://` or `openfield://`. */
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * Normalises a user-entered API base into a prefix the relative API paths can
 * be appended to.
 *
 * Rules, in order:
 * - blank input stays blank (the caller falls back to its default);
 * - any query/fragment is dropped, as is a trailing slash;
 * - a scheme-less host gets one (see {@link defaultScheme}); protocol-relative
 *   `//host` values inherit the page protocol; already-relative values such as
 *   `/api/v1` (the dev default) are left alone;
 * - the versioned prefix is appended **only** when the value has no path of its
 *   own, so a bare gateway address gains `/api/v1` while an explicit custom
 *   mount like `https://host/openfield/api/v1` is respected as typed.
 *
 * @param raw the value the user typed
 * @param protocol the page's protocol (`location.protocol`), used to pick a
 *   scheme for a bare host; defaults to the conservative `http:`
 */
export function normalizeApiBase(raw: string, protocol = 'http:'): string {
  let value = raw.trim()
  if (!value) return ''

  value = value.replace(/[?#].*$/, '').replace(/\/+$/, '')
  if (!value) return ''

  // Protocol-relative ("//host") must be tested before the relative case,
  // which it also matches on its leading slash.
  if (value.startsWith('//')) {
    value = protocol + value
  } else if (!value.startsWith('/')) {
    if (!SCHEME_RE.test(value)) {
      value = defaultScheme(value, protocol) + value
    }
  }

  return value + (pathOf(value) ? '' : API_PATH_PREFIX)
}

/**
 * Whether a user-entered base already carries an explicit path, in which case
 * the versioned prefix must not be appended on top of it.
 */
function pathOf(value: string): string {
  // A relative value is its own path.
  if (value.startsWith('/')) return value.replace(/\/+$/, '')
  try {
    // URL drops "/" for an origin-only base, which is exactly what we test.
    return new URL(value).pathname.replace(/\/+$/, '')
  } catch {
    return ''
  }
}

/**
 * Chooses a scheme for a scheme-less entry. Loopback hosts are almost always a
 * local gateway on plain http; anything else mirrors the page so an HTTPS build
 * does not trip mixed-content blocking.
 */
function defaultScheme(value: string, protocol: string): string {
  const authority = value.split(/[/?#]/)[0].toLowerCase()
  let host = authority
  if (authority.startsWith('[')) {
    // Bracketed IPv6 literal, possibly with a port: keep "[::1]".
    const end = authority.indexOf(']')
    host = end === -1 ? authority : authority.slice(0, end + 1)
  } else {
    host = authority.split(':')[0]
  }

  const loopback =
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '[::1]' ||
    host === '0.0.0.0' ||
    /^127\./.test(host)

  if (loopback) return 'http://'
  return protocol === 'https:' ? 'https://' : 'http://'
}
