/**
 * Checks the E2EE envelope detection in `src/utils/e2ee.ts`.
 *
 * Why this exists: a mis-detection in either direction is user-visible. A false
 * negative dumps raw ciphertext into the chat thread (the original bug); a
 * false positive hides a legitimate message behind a lock. Both are cheap to
 * pin down here with no framework and no dependencies.
 *
 * Run with:  node --experimental-strip-types audit_e2ee.ts
 * (or `npm run check:e2ee`).
 */
import { isEncryptedEnvelope } from './src/utils/e2ee.ts'

const cases: Array<[string, boolean]> = [
  // The exact payload from the bug report must be masked.
  ['{"v":1,"s":2,"i":1,"n":"reKRqcv5xUHa6BkH","c":"-BZTAjQl6rfAlBVnCI-q7Q=="}', true],
  ['{"v":1,"s":2,"i":0,"n":"l94CBnyIv_SOIGCC","c":"-5wdQ46fqz7LrvqtcpGnl2HfN9VurA=="}', true],
  // Ciphertext of any length, and a zero index.
  ['{"v":3,"s":17,"i":0,"n":"AAECAwQFBgcICQoL","c":"AA=="}', true],
  // Surrounding whitespace is tolerated.
  ['  {"v":1,"s":1,"i":1,"n":"abc","c":"def"}  ', true],
  // Numeric strings are accepted (lenient envelope readers exist).
  ['{"v":"1","s":"2","i":"3","n":"abc","c":"def"}', true],

  // Ordinary chat text is never an envelope.
  ['hello world', false],
  ['', false],
  ['   ', false],
  ['好像可以了', false],
  ['{"v":1}', false],
  // JSON that is not the envelope shape.
  ['{"v":1,"s":2,"i":1,"n":"abc"}', false],
  ['{"v":1,"s":2,"i":1,"c":"def"}', false],
  ['{"hello":"world"}', false],
  ['{"foo":1,"bar":2}', false],
  ['[1,2,3]', false],
  ['null', false],
  ['123', false],
  ['true', false],
  // Extra keys mean it is some other payload, not a message envelope.
  ['{"v":1,"s":2,"i":1,"n":"abc","c":"def","extra":true}', false],
  // Wrong types where they matter.
  ['{"v":1,"s":2,"i":1,"n":"","c":"def"}', false],
  ['{"v":1,"s":2,"i":1,"n":"abc","c":""}', false],
  ['{"v":1,"s":2,"i":1,"n":12,"c":"def"}', false],
  ['{"v":1,"s":2,"i":1.5,"n":"abc","c":"def"}', false],
  ['{"v":1,"s":2,"i":"x","n":"abc","c":"def"}', false],
  ['{"v":null,"s":2,"i":1,"n":"abc","c":"def"}', false],
  // JSON scalars that merely start with a brace.
  ['{}', false],
  // Prose that opens a brace but is not JSON, and not the envelope opener.
  ['{not json at all', false],
  // A truncated envelope is still masked: the opener is specific enough that
  // ordinary prose will not match it.
  ['{"v":1,"s":2,"i":1,"n":"reKRqcv5xUHa6BkH","c":"-BZTAjQl6rfAlBVn', true],
  ['{"v":', true],
  ['{"version":1}', false],
]

let failures = 0
for (const [input, expected] of cases) {
  const actual = isEncryptedEnvelope(input)
  const ok = actual === expected
  if (!ok) failures++
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} isEncryptedEnvelope(${JSON.stringify(input)}) -> ${actual}` +
      (ok ? '' : `\n       expected ${expected}`),
  )
}

if (failures === 0) {
  console.log(`\nALL PASS (${cases.length} cases)`)
} else {
  console.log(`\n${failures} FAILURE(S)`)
}
process.exit(failures === 0 ? 0 : 1)
