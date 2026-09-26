/**
 * Checks the OAuth redirect handling in `src/utils/oauth.ts`.
 *
 * Why this exists: the callback navigates to whatever the login page parked in
 * sessionStorage, and the value originates from a `?redirect=` query parameter
 * that anyone can craft. If `isSafeRedirect` ever lets a non-path value
 * through, `/oauth/callback` becomes an open redirect that hands a freshly
 * signed-in user to an attacker's site — so the boundary is pinned here.
 *
 * Run with:  node --experimental-strip-types audit_oauth.ts
 * (or `npm run check:oauth`).
 */
import { consumeOAuthRedirect, isSafeRedirect, rememberOAuthRedirect } from './src/utils/oauth.ts'

/** Minimal sessionStorage so the remember/consume round trip is testable. */
class MemoryStorage {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}
;(globalThis as { sessionStorage?: unknown }).sessionStorage = new MemoryStorage()

let failures = 0

function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected
  if (!ok) failures++
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${label} -> ${JSON.stringify(actual)}` +
      (ok ? '' : `\n       expected ${JSON.stringify(expected)}`),
  )
}

// --- isSafeRedirect: only same-origin absolute paths may be navigated to ---
const safeCases: Array<[string, boolean]> = [
  ['/', true],
  ['/chat/4', true],
  ['/chat/4?tab=files', true],
  ['/camps/12#top', true],
  // Protocol-relative forms a browser would resolve to another origin.
  ['//evil.com', false],
  ['//evil.com/path', false],
  ['/\\evil.com', false],
  // Absolute URLs and schemes are never paths.
  ['https://evil.com', false],
  ['http://evil.com/x', false],
  ['javascript:alert(1)', false],
  ['data:text/html,<script>alert(1)</script>', false],
  // Relative (no leading slash) and empty values.
  ['chat/4', false],
  ['', false],
  ['\\\\evil.com', false],
]
for (const [value, expected] of safeCases) {
  check(`isSafeRedirect(${JSON.stringify(value)})`, isSafeRedirect(value), expected)
}

// --- remember/consume round trip ---
rememberOAuthRedirect('/chat/4')
check('round trip returns the remembered path', consumeOAuthRedirect(), '/chat/4')
check('consume clears the stored value', consumeOAuthRedirect(), '/')

// An unsafe target is refused on the way in, so the callback falls back to "/".
rememberOAuthRedirect('//evil.com')
check('unsafe target is not stored', consumeOAuthRedirect(), '/')

// A non-string (e.g. ?redirect=a&redirect=b becomes an array) is refused too.
rememberOAuthRedirect(['/a', '/b'])
check('array target is not stored', consumeOAuthRedirect(), '/')

// A value written directly into storage is still validated on the way out.
;(globalThis as { sessionStorage: MemoryStorage }).sessionStorage.setItem(
  'horizon.oauthRedirect',
  'https://evil.com',
)
check('unsafe stored value falls back to "/"', consumeOAuthRedirect(), '/')

check('empty storage falls back to "/"', consumeOAuthRedirect(), '/')

if (failures === 0) {
  console.log('\nALL PASS')
} else {
  console.log(`\n${failures} FAILURE(S)`)
}
process.exit(failures === 0 ? 0 : 1)
