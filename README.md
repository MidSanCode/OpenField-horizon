# OpenField Horizon（地平线）

Horizon is the SEO-friendly **Vue 3 + Material 3 web client** for OpenField —
a second front-end beside the Flutter app that renders the same server APIs
from any browser, with crawlable public content.

## Stack

| Piece        | Choice                                                            |
|--------------|-------------------------------------------------------------------|
| Framework    | Vue 3 (`<script setup>` SFC, TypeScript)                          |
| Routing      | vue-router 4 (history mode, per-route meta + title + robots meta) |
| Markdown     | markdown-it with `html: false` (GFM parity with `flutter_markdown`) |
| State        | Pinia (`auth`, `settings`, `snackbar` stores)                     |
| UI           | Hand-rolled **Material 3** token system (`src/styles/m3.css`) — M3 baseline palette, elevation, shape radius, dark scheme via `data-theme` |
| Build        | Vite 6, dev proxy `/api → 127.0.0.1:8080`                         |

No component framework (Vuetify/MDC) — the M3 primitives (buttons, cards,
chips, dialogs, snackbars, inputs) are plain CSS classes over M3 design
tokens, keeping the bundle small and the markup semantic and crawler-legible.

## SEO strategy

- Semantic HTML: `<article>` per post, real headings, descriptive link text.
- Per-route `document.title`, `description`, `og:*` via `useSeo()`; private
  routes get `<meta name="robots" content="noindex, nofollow">`.
- `public/robots.txt` allows the content surface, disallows account pages.
- All reads of public content hit the API **without credentials**, so what a
  crawler sees equals what an anonymous visitor sees.
- Upgrade path: swap the Vite build for a prerender pass (`vite-plugin-ssr`
  or a headless prerenderer) when post detail pages need full SSR — the API
  layer is already unauthenticated-read-friendly, so no code changes needed.

## Getting started

```pwsh
cd horizon
npm install
npm run dev        # http://localhost:5173, /api proxied to 127.0.0.1:8080
npm run build      # dist/ static output
```

The API base defaults to `/api/v1` in dev (via the Vite proxy) and the
official gateway in release builds; users can override it at runtime in
**设置 → API 地址** (self-hosting).

The override is **normalised** (`src/api/apiBase.ts`): you can paste the bare
gateway address (`http://127.0.0.1:8080`) and the `/api/v1` prefix every API
path is relative to is appended automatically, a missing scheme is filled in
(`http` for loopback, otherwise the page's protocol), and trailing slashes /
query strings are dropped. An entry that already carries a path — the dev
default `/api/v1`, or a custom mount such as `https://host/openfield/api/v1` —
is respected as typed. Values saved before normalisation existed are normalised
on read, so they start working without being re-saved.

```pwsh
npm run check            # all five check scripts below
npm run check:api-base   # exercises the normalisation rules (no framework needed)
npm run check:e2ee       # E2EE envelope detection
npm run check:oauth      # OAuth redirect safety (open-redirect guard)
npm run check:markdown   # markdown rendering + its XSS/URL guards
npm run check:images     # image placeholder safety + fallback reset
npm run typecheck        # vue-tsc --noEmit
npm run build            # dist/ static output
```

## Sign-in

Two ways in, both against the same gateway:

- **Password** — always available (`POST /auth/login`), rotating refresh token
  with a single replay on 401.
- **OAuth (OIDC)** — offered when `GET /auth/providers` advertises `oidc`. The
  login page asks the server for an authorization URL with `flow=web` and sends
  the browser to the provider; the provider returns to the gateway, which
  redirects to `/oauth/callback` on this app.

The callback route reads one of three payloads, then strips it from the URL and
from browser history:

| Query                | Meaning                                                        |
|----------------------|----------------------------------------------------------------|
| `access_token=…`     | Signed in; the token pair is stored and the user is forwarded. |
| `pick=<ticket>`      | The identity owns several accounts — show the account picker.  |
| `error=…`            | The provider refused (e.g. the user cancelled).                |

For the OAuth half to work the gateway must set **`oidc.web_redirect_url`** to
this app's callback route:

```yaml
oidc:
  web_redirect_url: "http://localhost:5173/oauth/callback"   # dev (Vite)
  # production: "https://<horizon-host>/oauth/callback"
```

Two deployment requirements that follow from that:

- the host serving `dist/` must rewrite unknown paths to `index.html` (history
  mode), or `/oauth/callback` will 404 before the app ever loads;
- the gateway must accept this app's origin in `server.allowed_origins` when the
  two are on different hosts.

## Rendering user content

Post bodies and replies are rendered with **markdown-it**, configured to match
the Flutter client, which uses `flutter_markdown` with its default
GitHub-flavored extension set:

| Option       | Value  | Why                                                       |
|--------------|--------|-----------------------------------------------------------|
| `html`       | `false`| Raw HTML in the source is escaped, never emitted — the renderer cannot produce attacker-supplied tags, so no sanitizer is needed. |
| `linkify`    | `true` | Bare URLs become links, as GFM does.                      |
| `breaks`     | `true` | A single newline is a line break (the app does the same).  |

Links open in a new tab with `rel="noopener noreferrer"`; `validateLink` keeps
`javascript:`/`vbscript:`/`file:`/non-image `data:` URLs out of `href`.
`audit_markdown.ts` pins both the rendering and those guards.

Two structural rules the markup depends on:

- **Markdown output is never nested inside an anchor.** It is block-level and
  may contain its own links; an `<a>` inside the card's `<a>` triggers the HTML
  parser's adoption agency algorithm, which duplicates the outer anchor and
  hoists the paragraph out of the card. The feed card therefore puts its
  permalink on the timestamp and uses a *stretched link*
  (`.post__time::after`) to keep the whole card clickable.
- **Markdown containers must not set `white-space: pre-wrap`.** The renderer
  emits real newlines between block tags, which `pre-wrap` would turn into
  visible blank lines. The shared typography lives in `.md-body` (`m3.css`).

Images that fail to load are replaced with a placeholder rather than leaving
the browser's broken-image glyph:

- avatars (`AuthorLine`, `SettingsPage`, `UserPage`, `OAuthCallbackPage`) fall
  back to the author's initial — the same placeholder a *missing* URL already
  used — via `useImageFallback`, which resets when the URL changes so a reused
  component does not stay stuck;
- attachments and images inside rendered markdown get the shared data-URI
  placeholder via `useImagePlaceholder`, one delegated capture-phase `error`
  listener per container (Vue cannot attach listeners inside `v-html`).

## Feature coverage vs. the Flutter client

| Feature                         | Horizon                                                        |
|---------------------------------|----------------------------------------------------------------|
| Password login / token refresh  | ✅ (rotating refresh, single replay on 401)                     |
| OAuth (OIDC) login              | ✅ web flow + multi-account picker (needs `oidc.web_redirect_url`) |
| Feed, post detail, replies      | ✅ (public + crawlable; markdown in posts and replies)          |
| Reactions / favorites           | ✅                                                              |
| Pin / unpin own posts           | ✅                                                              |
| Delete own post                 | ✅                                                              |
| Compose (text, visibility)      | ✅                                                              |
| Camps (list/search/join/create) | ✅                                                              |
| Camp feed + camp composer       | ✅                                                              |
| Profiles + follow               | ✅                                                              |
| App announcements + dismissal   | ✅                                                              |
| Chat (list + plain conversations)| ✅ read/send, group extras read (announcements/todos/files)     |
| E2E-encrypted conversations     | ⚠️ no key store: encrypted messages render as a locked placeholder, never as ciphertext |
| Image/attachment upload         | ❌ composer is text-only for now                                 |
| Broken image fallback           | ✅ initial for avatars, placeholder for attachments/markdown      |
| Wallet / membership / exp       | ❌ app-first surfaces                                            |
| QR login & share codes          | ❌ app-first surface                                             |
| Realtime WS events              | ❌ polling only (send refreshes the thread)                      |

## Layout

```
src/
  api/        http.ts (fetch + auth + refresh), index.ts (typed endpoints),
              apiBase.ts (self-host API base normalisation)
  components/ PostCard, AuthorLine, AttachmentGrid, AppAnnouncementDialog
  composables/seo.ts
  pages/      Home, Post, Camps, Camp, User, Login, OAuthCallback, Composer,
              Settings, Chat, Conversation, Announcements, NotFound
  stores/     auth.ts, settings.ts, snackbar.ts
  styles/     m3.css (M3 tokens + primitives)
  utils/      markdown.ts (escaping-first mini renderer),
              e2ee.ts (E2EE envelope detection), oauth.ts (redirect handling)
```
