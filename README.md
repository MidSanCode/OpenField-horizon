# OpenField Horizon（地平线）

Horizon is the SEO-friendly **Vue 3 + Material 3 web client** for OpenField —
a second front-end beside the Flutter app that renders the same server APIs
from any browser, with crawlable public content.

## Stack

| Piece        | Choice                                                            |
|--------------|-------------------------------------------------------------------|
| Framework    | Vue 3 (`<script setup>` SFC, TypeScript)                          |
| Routing      | vue-router 4 (history mode, per-route meta + title + robots meta) |
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
npm run check            # all three check scripts below
npm run check:api-base   # exercises the normalisation rules (no framework needed)
npm run check:e2ee       # E2EE envelope detection
npm run check:oauth      # OAuth redirect safety (open-redirect guard)
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

## Feature coverage vs. the Flutter client

| Feature                         | Horizon                                                        |
|---------------------------------|----------------------------------------------------------------|
| Password login / token refresh  | ✅ (rotating refresh, single replay on 401)                     |
| OAuth (OIDC) login              | ✅ web flow + multi-account picker (needs `oidc.web_redirect_url`) |
| Feed, post detail, replies      | ✅ (public + crawlable)                                         |
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
