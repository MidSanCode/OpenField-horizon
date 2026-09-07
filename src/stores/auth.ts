/**
 * Session store: owns the access/refresh token pair and the cached profile.
 * The bootstrap action restores a persisted session before the router mounts
 * so route guards see the final auth state on first navigation.
 */
import { defineStore } from 'pinia'
import { api, type LoginResult } from '@/api'
import { readAccessToken, readRefreshToken, writeTokens } from '@/api/http'
import type { AuthUser } from '@/types'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: readAccessToken(),
    refreshToken: readRefreshToken(),
    user: null as AuthUser | null,
    ready: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
  },
  actions: {
    /** Applies a login/refresh result and fetches the full profile. */
    async applyAuth(result: LoginResult) {
      writeTokens(result.access_token, result.refresh_token ?? null)
      this.token = result.access_token
      this.refreshToken = result.refresh_token ?? null
      this.user = result.user as AuthUser
      await this.fetchMe()
    },
    async fetchMe() {
      if (!this.token) return
      try {
        this.user = await api.me()
      } catch {
        // A dead token pair clears the session on the next guarded route.
      }
    },
    /** Restores the persisted session once at app start. */
    async bootstrap() {
      if (this.token) {
        await this.fetchMe()
      }
      this.ready = true
    },
    async login(username: string, password: string) {
      await this.applyAuth(await api.login(username, password))
    },
    /** Clears tokens and the cached profile (server-side revoke is best-effort). */
    logout() {
      void api.logout()
      writeTokens(null, null)
      this.token = null
      this.refreshToken = null
      this.user = null
    },
  },
})
