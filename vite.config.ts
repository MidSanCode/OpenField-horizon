import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Vite configuration for OpenField Horizon (地平线), the SEO-oriented Vue 3
 * web client. The dev server proxies /api to a locally running gateway so the
 * app works out of the box against `go run ./services/gateway/cmd`; in
 * production the SPA is static and talks to whatever API base the user has
 * configured (or the build-time default).
 */

/** Override the proxy target with HORIZON_API_TARGET when the gateway runs elsewhere. */
const apiTarget = process.env.HORIZON_API_TARGET || 'http://127.0.0.1:8080'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: false,
        // Replace vite's default per-request stack traces ("connect
        // ECONNREFUSED 127.0.0.1:8080") with one clean warning plus a 503
        // JSON body the frontend can surface as a friendly offline state.
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.warn(
              `[horizon] API gateway unreachable at ${apiTarget} (${err.message}). ` +
                'Start it with `go run ./services/gateway/cmd` in the server repo, ' +
                'or point HORIZON_API_TARGET at another instance.',
            )
            if (
              res &&
              'writeHead' in res &&
              typeof res.writeHead === 'function' &&
              !res.headersSent
            ) {
              res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' })
              res.end(JSON.stringify({ error: 'gateway unreachable' }))
            }
          })
        },
      },
    },
  },
  build: {
    target: 'es2020',
  },
})
