/**
 * Detection of E2EE message envelopes.
 *
 * An end-to-end-encrypted chat message stores its ciphertext — not its text —
 * in `messages.content`, as a small JSON envelope produced by the app's
 * `E2eeService.encryptMessage`:
 *
 * ```json
 * {"v":1,"s":2,"i":1,"n":"reKRqcv5xUHa6BkH","c":"-BZTAjQl6rfAlBVnCI-q7Q=="}
 * ```
 *
 * - `v` group-key version
 * - `s` sender user id
 * - `i` per-sender chain index
 * - `n` base64url AES-GCM nonce (12 bytes)
 * - `c` base64url AES-GCM ciphertext
 *
 * Horizon has no E2E key store, so it cannot decrypt these. It must therefore
 * recognise them and render "encrypted message" instead of dumping the JSON —
 * which it used to do whenever the *conversation* flag disagreed with the
 * message, e.g. after E2EE was switched off on a group that already had
 * ciphertext in its history. Detecting the payload itself is what makes that
 * safe, because it does not depend on the conversation flag being right.
 */

/** The five fields every envelope carries; all must be present and well typed. */
const ENVELOPE_FIELDS = ['v', 's', 'i', 'n', 'c'] as const

/**
 * Matches an envelope that failed to parse, e.g. a truncated payload. Only the
 * exact opening key is accepted so ordinary prose is never mistaken for one.
 */
const TRUNCATED_ENVELOPE_RE = /^\{\s*"v"\s*:/

/**
 * Whether [content] is an E2EE message envelope that Horizon cannot decrypt.
 *
 * Never throws: malformed JSON is just "not a (well-formed) envelope", except
 * for the narrowly matched truncated-envelope case above.
 */
export function isEncryptedEnvelope(content: string): boolean {
  const raw = content.trim()
  if (!raw.startsWith('{')) return false

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return TRUNCATED_ENVELOPE_RE.test(raw)
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return false
  }
  const record = parsed as Record<string, unknown>

  // Reject anything carrying keys outside the envelope shape, so unrelated
  // JSON blobs that merely happen to share a few names are not swallowed.
  if (Object.keys(record).some((key) => !ENVELOPE_FIELDS.includes(key as never))) {
    return false
  }

  // n/c are the strongest signal: non-empty base64url strings.
  if (!isNonEmptyString(record.n) || !isNonEmptyString(record.c)) return false

  // v/s/i are integers; accept a numeric string too, since the envelope is
  // read back with lenient casts on some clients.
  return isIntegerLike(record.v) && isIntegerLike(record.s) && isIntegerLike(record.i)
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0
}

function isIntegerLike(value: unknown): boolean {
  if (typeof value === 'number') return Number.isInteger(value)
  if (typeof value === 'string') return /^-?\d+$/.test(value)
  return false
}
