/**
 * Placeholder for images that fail to load.
 *
 * A broken avatar or attachment currently leaves the browser's broken-image
 * glyph in the layout, which reads as a rendering fault rather than as missing
 * media. Swapping the source for this placeholder keeps the layout intact and
 * makes the state legible.
 *
 * Built as a data URI rather than a bundled file so it costs no extra request
 * and cannot itself fail. It is drawn in a mid-grey with a transparent
 * background because a data URI cannot reference the M3 CSS custom properties,
 * so it has to read acceptably under both the light and the dark scheme.
 */

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="image unavailable">
  <g fill="none" stroke="#9aa0a6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="6" y="10" width="52" height="44" rx="6"/>
    <circle cx="22" cy="26" r="4"/>
    <path d="M10 47l14-14 10 10 8-8 12 12"/>
  </g>
</svg>`

/** `data:image/svg+xml,...` URI for the placeholder graphic. */
export const IMAGE_PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(SVG)}`

/**
 * Swaps a failed image's source for {@link IMAGE_PLACEHOLDER}.
 *
 * Idempotent: the element is tagged so a second error event (or the placeholder
 * itself) cannot start a loop. Returns whether the swap happened.
 */
export function applyImagePlaceholder(img: HTMLImageElement): boolean {
  if (img.dataset.imageFailed === 'true') return false
  img.dataset.imageFailed = 'true'
  img.src = IMAGE_PLACEHOLDER
  return true
}
