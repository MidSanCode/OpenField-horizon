/**
 * SEO helper for per-route metadata. Setting document.title and the
 * description/og meta tags keeps every route independently crawlable even
 * though the app is an SPA; combined with server-side rendering of the
 * initial HTML shell (SSG prerender later), this satisfies the common
 * crawlers without a heavy SSR framework.
 */
import { onMounted, watchEffect } from 'vue'

export interface SeoInput {
  title: string
  description?: string
  /** Canonical-ish path; defaults to the current location. */
  path?: string
}

function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/** Applies page metadata on mount and keeps og:url synced with navigation. */
export function useSeo(input: SeoInput): void {
  onMounted(() => {
    document.title = input.title
    if (input.description) {
      setMeta('name', 'description', input.description)
      setMeta('property', 'og:description', input.description)
    }
    setMeta('property', 'og:title', input.title)
    setMeta('property', 'og:url', window.location.origin + (input.path ?? window.location.pathname))
  })
}

/** Reactive equality helper used by watchers that re-apply SEO on data load. */
export function watchSeo(source: () => SeoInput | null): void {
  watchEffect(() => {
    const value = source()
    if (!value) return
    document.title = value.title
    if (value.description) {
      setMeta('name', 'description', value.description)
      setMeta('property', 'og:description', value.description)
    }
    setMeta('property', 'og:title', value.title)
  })
}
