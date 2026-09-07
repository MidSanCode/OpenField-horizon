/**
 * Tiny safe Markdown renderer for Horizon. Posts accept the same Markdown as
 * the Flutter client, but pulling a full parser (marked/markdown-it) for the
 * subset users actually write is not worth the bundle: this renders
 * paragraphs, bold/italic/strikethrough, inline code, fenced code blocks,
 * links (http/https only) and blockquotes — always from escaped input, so no
 * raw HTML ever reaches the DOM.
 *
 * NOT a general Markdown implementation; extend deliberately.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch)
}

/** Renders inline formatting on already-escaped text. */
function renderInline(text: string): string {
  let out = text
  // Links first so URL punctuation is not eaten by emphasis rules.
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  )
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|\W)\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  return out
}

/**
 * Renders untrusted Markdown to an HTML string. Input is escaped before any
 * transformation, so the output is safe for v-html.
 */
export function renderMarkdown(source: string): string {
  if (!source) return ''
  const lines = escapeHtml(source).split(/\r?\n/)
  const blocks: string[] = []
  let paragraph: string[] = []
  let codeBlock: string[] | null = null

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`)
      paragraph = []
    }
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (codeBlock) {
        blocks.push(`<pre><code>${codeBlock.join('\n')}</code></pre>`)
        codeBlock = null
      } else {
        flushParagraph()
        codeBlock = []
      }
      continue
    }
    if (codeBlock) {
      codeBlock.push(line)
      continue
    }
    if (line.trim() === '') {
      flushParagraph()
      continue
    }
    if (line.trimStart().startsWith('&gt; ')) {
      flushParagraph()
      blocks.push(`<blockquote>${renderInline(line.trimStart().slice(5))}</blockquote>`)
      continue
    }
    paragraph.push(line)
  }
  if (codeBlock) {
    blocks.push(`<pre><code>${codeBlock.join('\n')}</code></pre>`)
  }
  flushParagraph()
  return blocks.join('\n')
}
