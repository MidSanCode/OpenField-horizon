/**
 * Markdown rendering for Horizon, backed by markdown-it.
 *
 * This used to be a hand-rolled regex renderer covering paragraphs, emphasis,
 * inline code, fenced code, links and blockquotes. That subset turned out to be
 * the bug: the Flutter client renders content with `flutter_markdown`, whose
 * default extension set is GitHub-flavored, so anything outside the subset —
 * headings most visibly (`# test` showed as literal text), then lists, tables,
 * images, autolinks and horizontal rules — rendered differently in the two
 * clients. Catching up by hand would have meant writing a CommonMark parser,
 * and every added rule is another place an attribute could be forged; a
 * maintained parser is both smaller to own and safer.
 *
 * Security posture — the source is untrusted user content:
 *
 * - `html: false` means raw HTML in the source is **escaped, never emitted**.
 *   There is no sanitizer to configure and no allow-list to drift, because the
 *   renderer is structurally incapable of producing attacker-supplied tags.
 * - Explicit links and `linkify` autolinks both go through markdown-it's
 *   `validateLink`, which rejects `javascript:`, `vbscript:`, `file:` and
 *   non-image `data:` URLs.
 * - Links open in a new tab with `rel="noopener noreferrer"`; images get lazy
 *   loading and are tagged for the broken-image placeholder.
 *
 * `audit_markdown.ts` pins the rendering and the security properties.
 */

import MarkdownIt from 'markdown-it'
import type { Renderer, RendererRule, Token } from 'markdown-it'

/**
 * `breaks: true` renders a single newline as a line break. That matches both
 * the previous Horizon renderer and the Flutter client, where the `markdown`
 * package emits a literal newline the text widget honours — people write
 * chat-style line breaks far more often than they intend a soft wrap.
 *
 * `linkify: true` matches GitHub-flavored autolinks, which is what
 * `flutter_markdown`'s default extension set produces.
 */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
})

/** Falls back to a plain token render for presets that omit a rule. */
const plainRule: RendererRule = (tokens, idx, options, _env, self: Renderer) =>
  self.renderToken(tokens, idx, options)

/** Rewrites one renderer rule, keeping the preset's own implementation. */
function overrideRule(name: string, decorate: (token: Token) => void): void {
  const base = md.renderer.rules[name] ?? plainRule
  md.renderer.rules[name] = (tokens, idx, options, env, self) => {
    decorate(tokens[idx])
    return base(tokens, idx, options, env, self)
  }
}

overrideRule('link_open', (token) => {
  token.attrSet('target', '_blank')
  token.attrSet('rel', 'noopener noreferrer')
})

overrideRule('image', (token) => {
  token.attrSet('loading', 'lazy')
  token.attrSet('decoding', 'async')
  // `useImagePlaceholder` looks for this when a content image fails to load,
  // so a markdown image gets the same placeholder as any other image.
  token.attrSet('data-image', 'markdown')
})

/**
 * Renders untrusted Markdown to an HTML string, safe for `v-html`.
 *
 * Empty input yields an empty string; malformed input is rendered as well as
 * the parser can rather than throwing, so one bad post never blanks a feed.
 */
export function renderMarkdown(source: string): string {
  if (!source) return ''
  return md.render(source)
}

/**
 * Strips markdown syntax down to prose, for `<title>`/`description` meta tags
 * where the raw source would leak `#` and `**` into search results.
 */
export function markdownToPlainText(source: string): string {
  if (!source) return ''
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, '')
    .replace(/^\s{0,3}([-*_])(\s*\1){2,}\s*$/gm, ' ')
    .replace(/(\*\*|__|~~|\*|_)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
