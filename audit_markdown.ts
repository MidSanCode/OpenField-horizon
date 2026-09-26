/**
 * Checks the Markdown renderer in `src/utils/markdown.ts`.
 *
 * Two things are worth pinning here:
 *
 * 1. **Coverage.** The renderer used to be a hand-rolled subset, and the gap
 *    only showed up as a user-visible bug (`# heading` rendered as literal
 *    text). Every construct the Flutter client renders belongs in this list, so
 *    a regression is caught here rather than in a bug report.
 * 2. **Security.** Post content is untrusted. `html: false` must keep raw HTML
 *    escaped and `validateLink` must keep `javascript:`/`data:` URLs out of
 *    `href` — a failure in either is an XSS, not a formatting glitch.
 *
 * Run with:  node --experimental-strip-types audit_markdown.ts
 * (or `npm run check:markdown`).
 */
import { markdownToPlainText, renderMarkdown } from './src/utils/markdown.ts'

let failures = 0

function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : `\n       ${detail}`}`)
}

/** Asserts the rendered HTML contains [needle]. */
function contains(source: string, needle: string, label = JSON.stringify(source)) {
  const html = renderMarkdown(source)
  check(`${label} contains ${JSON.stringify(needle)}`, html.includes(needle), `got ${JSON.stringify(html)}`)
}

/** Asserts the rendered HTML does NOT contain [needle]. */
function excludes(source: string, needle: string, label = JSON.stringify(source)) {
  const html = renderMarkdown(source)
  check(`${label} excludes ${JSON.stringify(needle)}`, !html.includes(needle), `got ${JSON.stringify(html)}`)
}

/**
 * Attribute names of the first `<a>` in the rendered output.
 *
 * Scans the attribute string quote-aware, so a value that merely contains
 * `name=` — the shape an injection attempt takes — is not counted as an
 * attribute of the tag.
 */
function anchorAttrs(source: string): string[] {
  const html = renderMarkdown(source)
  const tag = /<a\b([^>]*)>/.exec(html)
  if (!tag) return []
  const attrs = tag[1]
  const names: string[] = []
  let i = 0
  while (i < attrs.length) {
    const eq = attrs.indexOf('=', i)
    if (eq === -1) break
    const name = attrs.slice(i, eq).trim()
    let j = eq + 1
    while (j < attrs.length && /\s/.test(attrs[j])) j++
    const quote = attrs[j]
    if (quote === '"' || quote === "'") {
      const end = attrs.indexOf(quote, j + 1)
      j = end === -1 ? attrs.length : end + 1
    } else {
      while (j < attrs.length && !/\s/.test(attrs[j])) j++
    }
    if (/^[a-zA-Z_:][-\w:.]*$/.test(name)) names.push(name.toLowerCase())
    i = j
  }
  return names
}

/** Asserts no anchor is emitted at all (the link was rejected outright). */
function noAnchor(source: string, label = JSON.stringify(source)) {
  const html = renderMarkdown(source)
  check(`${label} emits no anchor`, !html.includes('<a'), `got ${JSON.stringify(html)}`)
}

console.log('--- block constructs the app renders ---')
contains('# test', '<h1>test</h1>')
contains('## 2s', '<h2>2s</h2>')
contains('### 3e', '<h3>3e</h3>')
contains('###### deep', '<h6>deep</h6>')
// The exact post that exposed the bug.
contains('hi\n# test\n## 2s\n### 3e', '<h1>test</h1>', 'real post #5')
contains('hi\n# test\n## 2s\n### 3e', '<h2>2s</h2>', 'real post #5')
contains('hi\n# test\n## 2s\n### 3e', '<h3>3e</h3>', 'real post #5')
contains('- a\n- b', '<ul>')
contains('- a\n- b', '<li>a</li>')
contains('1. a\n2. b', '<ol>')
contains('> quoted', '<blockquote>')
contains('---', '<hr>')
contains('```js\nlet a = 1\n```', '<pre><code class="language-js">')
contains('```\nplain\n```', '<pre><code>')
contains('| a | b |\n|---|---|\n| 1 | 2 |', '<table>')
contains('paragraph one\n\nparagraph two', '<p>paragraph one</p>')
// A single newline is a line break, matching the app and the old renderer.
contains('a\nb', '<br>')

console.log('\n--- inline constructs ---')
contains('**bold**', '<strong>bold</strong>')
contains('*it*', '<em>it</em>')
contains('~~gone~~', '<s>gone</s>')
contains('`code`', '<code>code</code>')
contains('[text](https://example.com)', 'href="https://example.com"')
// GFM autolinks, which flutter_markdown's default extension set also produces.
contains('see https://example.com now', 'href="https://example.com"')

console.log('\n--- links get safe external attributes ---')
contains('[t](https://example.com)', 'target="_blank"')
contains('[t](https://example.com)', 'rel="noopener noreferrer"')

console.log('\n--- images are lazy and tagged for the placeholder ---')
contains('![alt](https://example.com/i.png)', '<img')
contains('![alt](https://example.com/i.png)', 'loading="lazy"')
contains('![alt](https://example.com/i.png)', 'data-image="markdown"')
contains('![alt](https://example.com/i.png)', 'alt="alt"')

console.log('\n--- raw HTML is escaped, never emitted ---')
excludes('<script>alert(1)</script>', '<script')
contains('<script>alert(1)</script>', '&lt;script&gt;')
excludes('<img src=x onerror=alert(1)>', '<img src=x')
excludes('<div onclick="alert(1)">x</div>', '<div onclick')
// Even inside a code fence, where the text is preserved verbatim.
excludes('```\n<script>alert(1)</script>\n```', '<script')
contains('```\n<script>x</script>\n```', '&lt;script&gt;')

console.log('\n--- dangerous URL schemes are rejected ---')
// markdown-it drops the link entirely and renders the source as inert text, so
// the scheme may still appear in the output — what matters is that it never
// reaches an href.
noAnchor('[x](javascript:alert(1))')
noAnchor('[x](JaVaScRiPt:alert(1))')
noAnchor('[x](vbscript:msgbox(1))')
noAnchor('[x](file:///etc/passwd)')
noAnchor('[x](data:text/html,<script>alert(1)</script>)')
// Image data: URLs are the documented exception (they cannot run script in <img>).
contains('![x](data:image/png;base64,iVBORw0KGgo=)', 'data:image/png;base64')
// A safe link still renders, so the rejections above are not a blanket failure.
contains('[ok](https://example.com)', 'href="https://example.com"')

console.log('\n--- attributes cannot be forged ---')
// A quote in the title must not terminate the attribute and start a new one.
check(
  'title injection adds no event handler attribute',
  !anchorAttrs('[x](https://example.com "a\\" onmouseover=alert(1)")').includes('onmouseover'),
  `got ${JSON.stringify(anchorAttrs('[x](https://example.com "a\\" onmouseover=alert(1)")'))}`,
)
check(
  'anchor carries exactly href/title/target/rel',
  JSON.stringify(anchorAttrs('[x](https://example.com "t")')) ===
    JSON.stringify(['href', 'title', 'target', 'rel']),
  `got ${JSON.stringify(anchorAttrs('[x](https://example.com "t")'))}`,
)
check(
  'plain link carries exactly href/target/rel',
  JSON.stringify(anchorAttrs('[x](https://example.com)')) === JSON.stringify(['href', 'target', 'rel']),
  `got ${JSON.stringify(anchorAttrs('[x](https://example.com)'))}`,
)

console.log('\n--- edge cases ---')
check('empty input renders empty', renderMarkdown('') === '', `got ${JSON.stringify(renderMarkdown(''))}`)
check('whitespace-only input is harmless', typeof renderMarkdown('   \n  ') === 'string')
check('unclosed fence does not throw', typeof renderMarkdown('```\nunclosed') === 'string')
check('unclosed emphasis does not throw', typeof renderMarkdown('*unclosed') === 'string')
check('plain text passes through', renderMarkdown('hello world').includes('hello world'))

console.log('\n--- markdownToPlainText strips syntax for meta tags ---')
check('heading marker removed', markdownToPlainText('# title') === 'title', markdownToPlainText('# title'))
check('emphasis removed', markdownToPlainText('**bold** text') === 'bold text', markdownToPlainText('**bold** text'))
check('link keeps its label', markdownToPlainText('[label](https://e.com)') === 'label')
check('image dropped', markdownToPlainText('![alt](https://e.com/i.png)') === '')
check('fence dropped', markdownToPlainText('```\ncode\n```') === '')
check('quote marker removed', markdownToPlainText('> quoted') === 'quoted', markdownToPlainText('> quoted'))
check('list marker removed', markdownToPlainText('- item') === 'item', markdownToPlainText('- item'))
check('empty input stays empty', markdownToPlainText('') === '')

if (failures === 0) {
  console.log('\nALL PASS')
} else {
  console.log(`\n${failures} FAILURE(S)`)
}
process.exit(failures === 0 ? 0 : 1)
