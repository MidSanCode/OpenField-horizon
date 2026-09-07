import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Vite configuration for OpenField Horizon (地平线), the SEO-oriented Vue 3
 * web client. The dev server proxies /api to a locally running gateway so the
 * app works out of the box against `go run ./services/gateway/cmd`; in
 * production the SPA is static and talks to whatever API base the user has
 * configured (or the build-time default).
 */
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
        target: 'http://127.0.0.1:8080',
        changeOrigin: false,
      },
    },
  },
  build: {
    target: 'es2020',
  },
})
