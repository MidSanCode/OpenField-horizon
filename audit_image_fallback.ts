/**
 * Checks the image load-failure handling in `src/utils/imagePlaceholder.ts` and
 * `src/composables/imageFallback.ts`.
 *
 * These are small functions, but two of their properties are load-bearing:
 * the placeholder must be safe to drop into an HTML attribute (it is a data
 * URI, so any unescaped quote or angle bracket would break the attribute or
 * inject markup), and the swap must be idempotent or a failing image would
 * loop forever on its own error event.
 *
 * Run with:  node --experimental-strip-types audit_image_fallback.ts
 * (or `npm run check:images`).
 */
import { nextTick, ref } from 'vue'
import { IMAGE_PLACEHOLDER, applyImagePlaceholder } from './src/utils/imagePlaceholder.ts'
import { useImageFallback } from './src/composables/imageFallback.ts'

let failures = 0

function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : `\n       ${detail}`}`)
}

/** Minimal stand-in: applyImagePlaceholder only touches `dataset` and `src`. */
function fakeImage(src = 'https://example.com/broken.png') {
  return { dataset: {} as Record<string, string>, src } as unknown as HTMLImageElement & {
    dataset: Record<string, string>
  }
}

console.log('--- the placeholder is safe to embed in an attribute ---')
check('is an svg data URI', IMAGE_PLACEHOLDER.startsWith('data:image/svg+xml,'))
check(
  'contains no unescaped quote',
  !IMAGE_PLACEHOLDER.includes('"') && !IMAGE_PLACEHOLDER.includes("'"),
  IMAGE_PLACEHOLDER,
)
check('contains no unescaped angle bracket', !IMAGE_PLACEHOLDER.includes('<') && !IMAGE_PLACEHOLDER.includes('>'))
check('contains no unescaped ampersand', !/&(?!#?\w+;)/.test(IMAGE_PLACEHOLDER))
check('has no whitespace that would break a url()', !/\s/.test(IMAGE_PLACEHOLDER))

console.log('\n--- the placeholder decodes to well-formed markup ---')
const svg = decodeURIComponent(IMAGE_PLACEHOLDER.slice('data:image/svg+xml,'.length))
check('decodes to an <svg> root', svg.trimStart().startsWith('<svg'))
check('closes the <svg> root', svg.trimEnd().endsWith('</svg>'))
check('declares the svg namespace', svg.includes('xmlns="http://www.w3.org/2000/svg"'))
// Balanced-tag check: every opening tag has a matching close (or self-closes).
const opens = [...svg.matchAll(/<([a-zA-Z][\w:-]*)(?:\s[^>]*?)?(\/?)>/g)]
const closes = [...svg.matchAll(/<\/([a-zA-Z][\w:-]*)>/g)]
const openNames = opens.filter((m) => m[2] !== '/').map((m) => m[1])
const closeNames = closes.map((m) => m[1]).reverse()
check(
  'tags are balanced',
  JSON.stringify(openNames) === JSON.stringify(closeNames),
  `open ${JSON.stringify(openNames)} vs close ${JSON.stringify(closeNames)}`,
)

console.log('\n--- applyImagePlaceholder ---')
const img = fakeImage()
check('returns true on the first failure', applyImagePlaceholder(img) === true)
check('swaps the source', img.src === IMAGE_PLACEHOLDER, img.src)
check('marks the element', img.dataset.imageFailed === 'true')
// Without this guard a failing image would re-trigger its own error handler.
check('is idempotent', applyImagePlaceholder(img) === false)
check('leaves the source untouched on repeat', img.src === IMAGE_PLACEHOLDER)

console.log('\n--- useImageFallback ---')
{
  const source = ref<string | null>('https://example.com/a.png')
  const { failed, onError } = useImageFallback(source)
  check('starts not-failed', failed.value === false)
  onError()
  check('onError marks failed', failed.value === true)

  // A reused component instance must not stay stuck on the placeholder.
  source.value = 'https://example.com/b.png'
  await nextTick()
  check('resets when the source changes', failed.value === false)

  onError()
  check('can fail again after a reset', failed.value === true)
  source.value = null
  await nextTick()
  check('resets when the source is cleared', failed.value === false)
}

{
  const source = ref<string | null>(null)
  const { failed } = useImageFallback(source)
  check('a null source never reports failure', failed.value === false)
}

if (failures === 0) {
  console.log('\nALL PASS')
} else {
  console.log(`\n${failures} FAILURE(S)`)
}
process.exit(failures === 0 ? 0 : 1)
