/**
 * Image load-failure handling.
 *
 * Two shapes, one concern:
 *
 * - {@link useImageFallback} is for an image Vue renders itself (an avatar),
 *   where the placeholder is the author's initial and lives in the template.
 * - {@link useImagePlaceholder} is for images inside `v-html` content, which
 *   Vue cannot attach a listener to. Those get the shared placeholder through
 *   one delegated capture-phase listener on the container.
 */
import { ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { applyImagePlaceholder } from '@/utils/imagePlaceholder'

/**
 * Tracks whether the image at [source] failed to load, so the template can
 * render a placeholder instead.
 *
 * The flag resets whenever [source] changes: a reused instance (the same byline
 * re-rendered for another author, or the signed-in user picking a new avatar)
 * would otherwise stay stuck showing the placeholder.
 */
export function useImageFallback(source: MaybeRefOrGetter<string | null | undefined>) {
  const failed = ref(false)
  watch(
    () => toValue(source),
    () => {
      failed.value = false
    },
  )
  return {
    failed,
    /** Bind to the image's `@error`. */
    onError: () => {
      failed.value = true
    },
  }
}

/**
 * Replaces failed images inside [root] with the shared placeholder.
 *
 * The `error` event does not bubble, so the listener is registered in the
 * capture phase. It follows the ref instead of attaching once on mount,
 * because a container behind `v-if` (an attachment grid with no images yet)
 * only appears in the DOM later.
 */
export function useImagePlaceholder(root: Ref<HTMLElement | null>) {
  const onError = (event: Event) => {
    const target = event.target
    if (target instanceof HTMLImageElement) applyImagePlaceholder(target)
  }

  watch(
    root,
    (el, _previous, onCleanup) => {
      if (!el) return
      el.addEventListener('error', onError, true)
      onCleanup(() => el.removeEventListener('error', onError, true))
    },
    // post: run after the DOM is patched, so the element exists.
    { immediate: true, flush: 'post' },
  )
}
