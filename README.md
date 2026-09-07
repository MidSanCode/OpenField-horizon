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

## Feature coverage vs. the Flutter client

| Feature                         | Horizon                                                        |
|---------------------------------|----------------------------------------------------------------|
| Password login / token refresh  | ✅ (rotating refresh, single replay on 401)                     |
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
| E2E-encrypted conversations     | ❌ explicit notice (web has no key store yet)                    |
| Image/attachment upload         | ❌ composer is text-only for now                                 |
| Wallet / membership / exp       | ❌ app-first surfaces                                            |
| QR login & share codes          | ❌ app-first surface                                             |
| Realtime WS events              | ❌ polling only (send refreshes the thread)                      |

## Layout

```
src/
  api/        http.ts (fetch + auth + refresh), index.ts (typed endpoints)
  components/ PostCard, AuthorLine, AttachmentGrid, AppAnnouncementDialog
  composables/seo.ts
  pages/      Home, Post, Camps, Camp, User, Login, Composer, Settings,
              Chat, Conversation, Announcements, NotFound
  stores/     auth.ts, settings.ts, snackbar.ts
  styles/     m3.css (M3 tokens + primitives)
  utils/      markdown.ts (escaping-first mini renderer)
```
