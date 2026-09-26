/**
 * Checks the API base normalisation rules in `src/api/apiBase.ts`.
 *
 * Why this exists: the settings page takes a *gateway* address while every API
 * path is relative to `/api/v1`. When normalisation was missing, a bare
 * `http://127.0.0.1:8080` produced `GET http://127.0.0.1:8080/posts` → 404.
 * The rules are plain string logic, so they are cheap to pin down here.
 *
 * Run with:  node --experimental-strip-types audit_api_base.ts
 * (or `npm run check:api-base`). No dependencies, no test framework.
 */
import { normalizeApiBase, API_PATH_PREFIX } from './src/api/apiBase.ts'

/** [input, page protocol, expected output] */
const cases: Array<[string, string, string]> = [
  // The reported bug: a bare gateway address gains the versioned prefix.
  ['http://127.0.0.1:8080', 'http:', 'http://127.0.0.1:8080/api/v1'],
  ['http://127.0.0.1:8080/', 'http:', 'http://127.0.0.1:8080/api/v1'],
  ['https://api.example.com', 'https:', 'https://api.example.com/api/v1'],

  // An already-correct entry must not be doubled up.
  ['http://127.0.0.1:8080/api/v1', 'http:', 'http://127.0.0.1:8080/api/v1'],
  ['http://127.0.0.1:8080/api/v1/', 'http:', 'http://127.0.0.1:8080/api/v1'],
  ['https://api.openfield.eu.cc/api/v1', 'https:', 'https://api.openfield.eu.cc/api/v1'],

  // The dev default is a relative path served by the Vite proxy.
  [API_PATH_PREFIX, 'http:', '/api/v1'],
  ['/api/v1', 'https:', '/api/v1'],

  // An explicit custom mount is respected, not appended to.
  ['https://host/openfield/api/v1', 'https:', 'https://host/openfield/api/v1'],
  ['https://host/custom', 'https:', 'https://host/custom'],

  // Scheme-less entries: loopback is plain http, others mirror the page.
  ['127.0.0.1:8080', 'http:', 'http://127.0.0.1:8080/api/v1'],
  ['localhost:8080', 'https:', 'http://localhost:8080/api/v1'],
  ['[::1]:8080', 'http:', 'http://[::1]:8080/api/v1'],
  ['api.example.com', 'https:', 'https://api.example.com/api/v1'],
  ['api.example.com', 'http:', 'http://api.example.com/api/v1'],

  // Protocol-relative inherits the page protocol.
  ['//api.example.com', 'https:', 'https://api.example.com/api/v1'],

  // Whitespace, query and fragment are cleaned up.
  ['  http://127.0.0.1:8080  ', 'http:', 'http://127.0.0.1:8080/api/v1'],
  ['http://127.0.0.1:8080?x=1', 'http:', 'http://127.0.0.1:8080/api/v1'],
  ['http://127.0.0.1:8080/api/v1#top', 'http:', 'http://127.0.0.1:8080/api/v1'],
  ['HTTP://127.0.0.1:8080', 'http:', 'HTTP://127.0.0.1:8080/api/v1'],

  // Blank stays blank so the caller can fall back to its default.
  ['', 'http:', ''],
  ['   ', 'http:', ''],
]

let failures = 0
for (const [input, protocol, expected] of cases) {
  const actual = normalizeApiBase(input, protocol)
  const ok = actual === expected
  if (!ok) failures++
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} normalizeApiBase(${JSON.stringify(input)}, ${protocol})` +
      ` -> ${JSON.stringify(actual)}` +
      (ok ? '' : `\n       expected ${JSON.stringify(expected)}`),
  )
}

// The end-to-end shape from the bug report: base + the path ./index.ts uses.
const base = normalizeApiBase('http://127.0.0.1:8080', 'http:')
const url = base + '/posts?page=1&limit=20'
const expectedUrl = 'http://127.0.0.1:8080/api/v1/posts?page=1&limit=20'
if (url !== expectedUrl) {
  failures++
  console.log(`FAIL feed URL\n       got      ${url}\n       expected ${expectedUrl}`)
} else {
  console.log(`\nok   feed URL resolves to a registered gateway route: ${url}`)
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
